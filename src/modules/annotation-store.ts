/**
 * 标注存储基类
 * 持有标注的全部共享状态与共享逻辑（选中/删除/撤销编排/样式/颜色/标题/clamp/通知/清空），
 * 形状特异逻辑通过 ShapeStrategy 委托（见 shapes/ 目录），由子类 AnnotationManager 分发。
 *
 * 实现 StrategyStore 契约，供无状态策略读写绘制中状态。
 */

import type {
  Rect,
  Polygon,
  Point,
  Operate,
  SelectedAnnotation,
  ActiveHandle,
  SelectionStyle,
  ColorConfig,
  AnnotationStyle,
  LineStyle,
  VertexStyle,
  TitleStyle,
  TitlePosition,
  ChangeNotify
} from './types'
import { deepClone, generateId } from './utils'
import type { ViewportManager } from './viewport'
import {
  getTitleAnchor,
  computeTitleLayout,
  computeTitleBox,
  computeTitleTextLayout,
  resolveTitleVertical,
  DEFAULT_TITLE_GAP,
  DEFAULT_TITLE_PADDING_X,
  DEFAULT_TITLE_PADDING_Y,
  UNBOUNDED_TITLE_BOUNDS
} from './renderers/title-layout'
import type { TitleTextLayout } from './renderers/title-layout'
import { parseFontSize } from './renderers/export-scale'
import type { ShapeStrategy, StrategyStore } from './shapes/shape-strategy'
import { clampPoint, notifyShapeChange } from './shapes/shared'
import { defaultShapeRegistry } from './registry'

export class AnnotationStore implements StrategyStore {
  // 标注记录列表
  public recordList: Operate<Rect | Polygon>[] = []

  // 当前操作
  public operate: Operate<Rect | Polygon> = {
    type: "rect",
    data: [],
    status: "pending",
  }

  // 绘制状态
  public isDrawing = false
  public drawStartPoint: Point = { x: 0, y: 0 }
  public tempPolygonPoint: Point | null = null

  // 选中状态
  public selectedAnnotation: SelectedAnnotation | null = null
  public isMovingAnnotation = false
  public isResizing = false
  public activeHandle: ActiveHandle | null = null
  public annotationMoveStart: Point = { x: 0, y: 0 }

  // 调整大小用的原始数据（resize 快照：startResizing 时拍一次，拖拽期间由策略原地同步，store 不重拍）
  public originalRect: Rect | null = null
  public originalPolygon: Polygon[] | null = null

  // 删除历史记录（用于撤销删除）
  protected deleteHistory: { annotation: Operate<Rect | Polygon>; index: number }[] = []

  // 标题编辑相关
  public editingTitleIndex: number | null = null
  public titleInput: HTMLInputElement | null = null

  // 样式配置
  public strokeStyle = "red"
  public lineWidth = 5
  public lineStyle: LineStyle = 'solid'
  public vertexStyle: VertexStyle = {
    size: 8,
    fillColor: 'red',
    strokeColor: 'white',
    strokeWidth: 2,
    shape: 'circle'
  }
  public selectionStyle: SelectionStyle = {
    strokeColor: "#00D9FF",
    fillColor: "rgba(0,217,255,0.15)",
    handleSize: 12,
    handleColor: "#00D9FF",
  }

  // 颜色配置
  private colorConfig: ColorConfig = {
    rect: "red",
    polygon: "red",
    default: "red"
  }

  // 标题样式全局默认配置
  public titleStyle: TitleStyle = {
    font: '12px Arial',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingX: 6,
    paddingY: 3,
    borderRadius: 4,
    placeholder: '输入标题...'
  }

  // 标题位置全局默认配置
  public titlePosition: TitlePosition = {
    vertical: 'top',
    align: 'center',
    offsetX: 0,
    offsetY: 0
  }

  // 是否启用标题功能（默认 false，需在 DrawerOptions 中显式开启）
  public enableTitle = false

  // 是否允许编辑标题文字（默认 true；关闭后双击不进入编辑态，标题只能由代码设置）
  public titleEditable = true

  // 标题文字宽度测量函数（由 Drawer 用 canvas ctx 注入；未注入时设置标题只做垂直边缘判断）
  public measureTitleWidth?: (text: string, font: string) => number

  // 是否允许拖拽标题框（移动 + 改宽）
  public titleDraggable = true

  // 标题布局是否已按当前图片/视口算过（按对象引用记录，只算一次，避免每帧重算）
  private titleLayoutSynced = new WeakSet<Operate<Rect | Polygon>>()

  // 标题拖拽状态
  public isDraggingTitle = false
  public titleDragPart: 'handle' | 'body' | null = null
  public titleDragIndex: number | null = null
  private titleDragStartPointer: Point = { x: 0, y: 0 }
  private titleDragStartOffsetX = 0
  private titleDragStartOffsetY = 0
  private titleDragStartWidth = 0
  private titleDragMoved = false

  // 是否将绘制坐标约束在图片边界内（默认 true，由 DrawerOptions.clampToImageBounds 控制）
  public clampEnabled = true

  constructor(
    protected viewport: ViewportManager,
    protected container?: HTMLElement,
    protected renderCallback?: () => void,
    protected changeCallback?: ChangeNotify
  ) {
    this.applyColorConfig()
  }

  /**
   * 按形状类型查找策略（委托默认注册表）
   */
  protected strategyOf(type: 'rect' | 'polygon'): ShapeStrategy {
    return defaultShapeRegistry.get(type)
  }

  /**
   * 将点约束到图片边界内（StrategyStore 契约；委托 shapes/shared.clampPoint）
   */
  clamp(point: Point): Point {
    return clampPoint(this.viewport, point, this.clampEnabled)
  }

  /**
   * 将点约束到图片边界内（原图像素坐标系）
   * clampEnabled 为 false 或图片未加载（originalWidth/originalHeight 为 0）时跳过 clamp，原样返回
   */
  protected clampToImageBounds(point: Point): Point {
    return clampPoint(this.viewport, point, this.clampEnabled)
  }

  /**
   * 把**整个标注**约束到图片边界内 —— 供「移动 / 缩放已有标注」使用。
   *
   * 为什么需要单独一个：`strategy.move()` 只是把坐标整体加 dx/dy，`resize()` 直接用鼠标点，
   * 两者原先都没有边界判断，所以已有标注能被拖到/缩到图外；
   * 而 `clampToImageBounds(point)` 只作用于绘制入口（startRectDrawing / updateRectDrawing 等）。
   *
   * - `clampEnabled` 为 false 或图片未加载时原样返回
   * - 矩形：按包围盒先把尺寸限制到不超过图片，再把左上角夹到 `[0, w-width] × [0, h-height]`
   * - 多边形：按包围盒整体平移；比图片还大时贴左上角
   * - **完全在图内时不做任何改动**（保留调用方原有的坐标表示，例如负宽高）
   */
  protected clampRecordToImageBounds(record: Operate<Rect | Polygon>): void {
    if (!this.clampEnabled) return
    const { originalWidth: w, originalHeight: h } = this.viewport
    if (!w || !h) return

    if (record.type === 'rect') {
      const rect = record.data[0] as Rect
      if (!rect) return

      const rawX1 = Math.min(rect.start.x, rect.start.x + rect.width)
      const rawX2 = Math.max(rect.start.x, rect.start.x + rect.width)
      const rawY1 = Math.min(rect.start.y, rect.start.y + rect.height)
      const rawY2 = Math.max(rect.start.y, rect.start.y + rect.height)

      // 已完全在图内：不改动，避免无谓地改写存储形态（如负宽高）
      if (rawX1 >= 0 && rawY1 >= 0 && rawX2 <= w && rawY2 <= h) return

      const width = Math.min(rawX2 - rawX1, w)
      const height = Math.min(rawY2 - rawY1, h)
      rect.start.x = Math.max(0, Math.min(rawX1, w - width))
      rect.start.y = Math.max(0, Math.min(rawY1, h - height))
      rect.width = width
      rect.height = height
      return
    }

    const points = record.data as Polygon[]
    if (!points || points.length === 0) return

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const p of points) {
      minX = Math.min(minX, p.point.x)
      maxX = Math.max(maxX, p.point.x)
      minY = Math.min(minY, p.point.y)
      maxY = Math.max(maxY, p.point.y)
    }

    let dx = 0
    let dy = 0
    if (maxX - minX > w) dx = -minX
    else if (minX < 0) dx = -minX
    else if (maxX > w) dx = w - maxX

    if (maxY - minY > h) dy = -minY
    else if (minY < 0) dy = -minY
    else if (maxY > h) dy = h - maxY

    if (dx === 0 && dy === 0) return
    for (const p of points) {
      p.point.x += dx
      p.point.y += dy
    }
  }

  /**
   * 新标注入库：generateId + 当前样式快照 + push + 清删除历史 + notifyChange('create')
   * （统一自原 finishRectDrawing / finishPolygonDrawing / cancelDrawing 的入库尾段；
   *  记录 status 由策略在调用前自行设定，store 不统一改写）
   */
  pushRecord(record: Operate<Rect | Polygon>): void {
    const annotationWithStyle = {
      ...record,
      id: generateId(),
      style: this.getCurrentStyle()
    }
    this.recordList.push(annotationWithStyle)
    // 添加新标注后清空删除历史
    this.deleteHistory = []
    this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)
  }

  /**
   * 初始化标题功能（由 Drawer 在设置 enableTitle 后调用）
   */
  initTitleSupport(): void {
    if (this.container && this.enableTitle) {
      this.createTitleInput()
    }
  }

  /**
   * 设置颜色配置
   */
  setColorConfig(config: string | ColorConfig): void {
    if (typeof config === 'string') {
      this.colorConfig = {
        rect: config,
        polygon: config,
        default: config
      }
    } else {
      this.colorConfig = {
        ...this.colorConfig,
        ...config
      }
    }
    this.applyColorConfig()
  }

  /**
   * 获取颜色配置
   */
  getColorConfig(): ColorConfig {
    return { ...this.colorConfig }
  }

  /**
   * 应用颜色配置到当前样式
   */
  private applyColorConfig(): void {
    this.strokeStyle = this.colorConfig.default || "red"
  }

  /**
   * 获取指定类型的颜色
   */
  getColorForType(type: 'rect' | 'polygon' | 'default'): string {
    return this.colorConfig[type] || this.colorConfig.default || "red"
  }

  /**
   * 获取当前样式（用于创建新标注时保存）
   */
  getCurrentStyle(): AnnotationStyle {
    return {
      strokeColor: this.strokeStyle,
      lineWidth: this.lineWidth,
      lineStyle: this.lineStyle,
      vertexStyle: { ...this.vertexStyle }
    }
  }

  /**
   * 上报标注变更（载荷携带深拷贝快照；委托 shapes/shared.notifyShapeChange）
   */
  protected notifyChange(event: 'create' | 'delete' | 'update', index: number, annotation: Operate<Rect | Polygon>): void {
    notifyShapeChange(this.changeCallback, annotation.type as 'rect' | 'polygon', event, index, annotation)
  }

  /**
   * 供 Drawer 在程序化移动后触发 update（拖拽路径由 finishMovingAnnotation 触发）
   */
  notifyUpdate(index: number): void {
    const annotation = this.recordList[index]
    if (annotation) this.notifyChange('update', index, annotation)
  }

  /**
   * 解析标注定位参数：number 按索引，string 按 id
   */
  resolveIndex(ref: number | string): number {
    if (typeof ref === 'number') return ref
    return this.recordList.findIndex((a) => a.id === ref)
  }

  /**
   * 按索引或 id 获取单个标注（深拷贝快照）
   */
  getAnnotation(ref: number | string): Operate<Rect | Polygon> | undefined {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return undefined
    return deepClone(this.recordList[index])
  }

  /**
   * 将当前全局样式应用到指定标注（按索引或 id），保存并通知 update
   */
  updateAnnotationStyle(ref: number | string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return false
    this.recordList[index].style = this.getCurrentStyle()
    this.notifyUpdate(index)
    return true
  }

  /**
   * 设置边线样式
   */
  setLineStyle(style: LineStyle): void {
    this.lineStyle = style
  }

  /**
   * 设置顶点样式
   */
  setVertexStyle(style: Partial<VertexStyle>): void {
    this.vertexStyle = { ...this.vertexStyle, ...style }
    // 同步更新颜色
    if (style.fillColor) {
      this.strokeStyle = style.fillColor
    }
  }

  /**
   * 获取边线样式
   */
  getLineStyle(): LineStyle {
    return this.lineStyle
  }

  /**
   * 获取顶点样式
   */
  getVertexStyle(): VertexStyle {
    return { ...this.vertexStyle }
  }

  /**
   * 获取标注的样式（如果不存在则返回当前样式）
   */
  getAnnotationStyle(annotation: Operate<Rect | Polygon>): AnnotationStyle {
    return annotation.style || this.getCurrentStyle()
  }

  /**
   * 撤销操作（编排顺序：先策略撤销绘制中状态，再 deleteHistory 恢复，再 recordList.pop）
   */
  withdraw(): boolean {
    if (this.operate.data.length > 0) {
      // polygon 逐点 pop；其余类型（含非形状 mode 遗留的 operate.type）按原 else 分支整体清空
      const type = this.operate.type === 'polygon' ? 'polygon' : 'rect'
      this.strategyOf(type).withdrawInProgress(this)
      return true
    }
    if (this.deleteHistory.length > 0) {
      // 优先恢复删除的标注
      const { annotation, index } = this.deleteHistory.pop()!
      // 在原来的位置插入
      this.recordList.splice(index, 0, annotation)
      this.validateSelection()
      return true
    }
    if (this.recordList.length > 0) {
      // 撤销已完成的操作
      this.recordList.pop()
      this.validateSelection()
      return true
    }
    return false
  }

  /**
   * 选中指定索引或 id 的标注
   * @param ref - 标注索引或 id
   * @param options.lock - true 时进入锁定选中态（无控制点，不可 resize）；缺省/false 与现状一致
   */
  selectAnnotation(ref: number | string, options?: { lock?: boolean }): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) {
      this.deselectAnnotation()
      return false
    }

    const annotation = this.recordList[index]
    // 锁定态属于"本次选中"：取消选中或选中其他标注才失效；
    // 重选同一锁定标注且未显式指定 lock 时保留锁定态（避免 mousedown 重选时意外解锁）
    const locked = options?.lock !== undefined
      ? !!options.lock
      : this.selectedAnnotation?.index === index && this.selectedAnnotation.locked === true
    this.selectedAnnotation = {
      index,
      type: annotation.type as "rect" | "polygon",
      locked,
    }
    return true
  }

  /**
   * 取消选中
   */
  deselectAnnotation(): void {
    this.selectedAnnotation = null
    this.isMovingAnnotation = false
    this.isResizing = false
    this.activeHandle = null
    this.originalRect = null
    this.originalPolygon = null
    this.cancelTitleDrag()
  }

  /**
   * 记录集变动后校验选中项：索引越界说明选中的标注已不存在
   * （典型场景：选中最后一条后点「回退」，该条被 pop 掉），必须取消选中。
   * 否则后续鼠标交互会拿着悬空索引去取记录，在 `getHandleAtPoint` / `resize` 里
   * 读到 `undefined` 并抛出 `Cannot read properties of undefined (reading 'data')`。
   */
  protected validateSelection(): void {
    const selected = this.selectedAnnotation
    if (selected && (selected.index < 0 || selected.index >= this.recordList.length)) {
      this.deselectAnnotation()
    }
  }

  /**
   * 删除选中的标注
   */
  deleteSelectedAnnotation(): boolean {
    if (!this.selectedAnnotation) return false

    const index = this.selectedAnnotation.index
    const annotation = this.recordList[index]

    // 保存删除的记录到历史（用于撤销）
    this.deleteHistory.push({
      annotation: { ...annotation },
      index
    })

    // 删除标注
    this.recordList.splice(index, 1)
    this.deselectAnnotation()
    this.notifyChange('delete', index, annotation)
    return true
  }

  /**
   * 开始移动标注（锁定选中态不可交互移动；程序化 moveSelectedAnnotation 不受此限制）
   */
  startMovingAnnotation(e: MouseEvent): boolean {
    if (!this.selectedAnnotation || this.selectedAnnotation.locked === true) return false

    this.isMovingAnnotation = true
    this.annotationMoveStart = { x: e.clientX, y: e.clientY }
    return true
  }

  /**
   * 更新移动起始点（供事件层在移动过程中同步鼠标位置，替代越权直写 annotationMoveStart）
   */
  updateMoveStart(p: Point): void {
    this.annotationMoveStart = p
  }

  /**
   * 完成标注移动
   */
  finishMovingAnnotation(): void {
    const wasMovingOrResizing = this.isMovingAnnotation || this.isResizing
    this.isMovingAnnotation = false
    this.isResizing = false
    this.activeHandle = null
    this.originalRect = null
    this.originalPolygon = null

    if (wasMovingOrResizing && this.selectedAnnotation) {
      // 拖拽/缩放结束后补做一次标题边缘自适应。
      // 标题是按「标注锚点 + 存储的 titlePosition」绘制的，且自 1.3.1 起拖动过程中不再实时重算
      // （避免标题随拖动乱跳）；因此把标注拖到/缩到贴边后，标题会留在图片外。
      // 这里只在操作**结束**时拉回图内：最终态合法，拖动过程手感不变。
      // autoAdjustTitlePosition 内部已跳过「无标题」「显式设置过位置」「图片未加载」的情况。
      const annotation = this.recordList[this.selectedAnnotation.index]
      if (annotation?.title) {
        this.autoAdjustTitlePosition(annotation, annotation.title)
      }
      this.notifyUpdate(this.selectedAnnotation.index)
      // 拖拽结束时事件层**不会**再重绘（events.ts 只在 mousemove 里 render，mouseup 只 emit update），
      // 所以上面写回的标题位置要等到下一次 render（例如取消选中）才可见 —— 表现为
      // 「松手后标题没回到图内，点了别处才跳回来」。这里主动补一次重绘。
      this.renderCallback?.()
    }
  }

  /**
   * 清除所有标注
   */
  clear(): void {
    this.recordList = []
    this.operate = {
      type: "rect",
      data: [],
      status: "pending",
    }
    this.isDrawing = false
    this.tempPolygonPoint = null
    this.deselectAnnotation()
    // 清空删除历史
    this.deleteHistory = []
    this.titleLayoutSynced = new WeakSet()
  }

  /**
   * 获取所有标注数据
   */
  getAnnotations(): Operate<Rect | Polygon>[] {
    return this.recordList.map((a) => deepClone(a))
  }

  /**
   * 获取当前选中的标注信息
   */
  getSelectedAnnotation(): { index: number; type: "rect" | "polygon" | "text"; data: Operate<Rect | Polygon> } | null {
    if (!this.selectedAnnotation) return null

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return null

    return {
      index: this.selectedAnnotation.index,
      type: this.selectedAnnotation.type,
      data: deepClone(annotation),
    }
  }

  // ==================== 标题相关方法 ====================

  /**
   * 设置标题样式（全局默认）
   * @param style - 标题样式配置
   */
  setTitleStyle(style: Partial<TitleStyle>): void {
    this.titleStyle = { ...this.titleStyle, ...style }
  }

  /**
   * 获取当前标题样式
   */
  getTitleStyle(): TitleStyle {
    return { ...this.titleStyle }
  }

  /**
   * 设置标题位置（全局默认）
   * @param position - 标题位置配置
   */
  setTitlePosition(position: Partial<TitlePosition>): void {
    this.titlePosition = { ...this.titlePosition, ...position }
  }

  /**
   * 获取当前标题位置
   */
  getTitlePosition(): TitlePosition {
    return { ...this.titlePosition }
  }

  /**
   * 获取标注实际使用的标题样式（标注自定义样式优先于全局默认）
   */
  getEffectiveTitleStyle(annotation: Operate<Rect | Polygon>): TitleStyle {
    const annotationStyle = this.getAnnotationStyle(annotation)
    return {
      ...this.titleStyle,
      ...(annotationStyle.titleStyle || {})
    }
  }

  /**
   * 获取标注实际使用的标题位置（标注自定义位置优先于全局默认）
   */
  getEffectiveTitlePosition(annotation: Operate<Rect | Polygon>): TitlePosition {
    const annotationStyle = this.getAnnotationStyle(annotation)
    return {
      ...this.titlePosition,
      ...(annotationStyle.titlePosition || {})
    }
  }

  /**
   * 将当前全局标题样式/位置快照存入标注（设置标题时自动调用）
   */
  private captureTitleStyleSnapshot(annotation: Operate<Rect | Polygon>): void {
    if (!annotation.style) {
      annotation.style = this.getCurrentStyle()
    }
    annotation.style.titleStyle = { ...this.titleStyle }
    // 显式设置过的位置不被全局快照覆盖
    if (!annotation.style.titlePositionExplicit) {
      annotation.style.titlePosition = { ...this.titlePosition }
    }
  }

  /** 标题布局使用的初始显示比例（尺寸不随缩放重算） */
  private getTitleLayoutScale(): number {
    const { initialScale, scale } = this.viewport
    return initialScale > 0 ? initialScale : scale > 0 ? scale : 1
  }

  /** 初始显示比例下的图片宽度；图片未加载时为 Infinity（不换行） */
  private getTitleImageWidth(): number {
    const { originalWidth } = this.viewport
    return originalWidth > 0 ? originalWidth * this.getTitleLayoutScale() : Infinity
  }

  /** 绑定字体的测量函数 */
  private titleMeasureFor(font: string): ((text: string) => number) | null {
    const measure = this.measureTitleWidth
    if (!measure) return null
    return (text: string) => measure(text, font)
  }

  /** 标题框允许的最小宽度（至少能放下一行字） */
  private getTitleMinWidth(annotation: Operate<Rect | Polygon>): number {
    const style = this.getEffectiveTitleStyle(annotation)
    const fontSize = parseFontSize(style.font || '12px Arial')
    const paddingX = style.paddingX ?? DEFAULT_TITLE_PADDING_X
    return Math.max(20, fontSize + paddingX * 2)
  }

  /**
   * 设置标题时按图片初始显示尺寸自动判断标题位置（上 → 下 → 内部顶边 + 贴边），并写回标注。
   * 规则：显式设置过位置、图片未加载、空多边形时跳过。
   */
  private autoAdjustTitlePosition(annotation: Operate<Rect | Polygon>, title: string): void {
    if (!title || annotation.style?.titlePositionExplicit) return

    const { originalWidth, originalHeight } = this.viewport
    if (originalWidth <= 0 || originalHeight <= 0) return

    const anchorImg = getTitleAnchor(annotation)
    if (!anchorImg) return

    const s = this.getTitleLayoutScale()
    const imageWidth = originalWidth * s
    const imageHeight = originalHeight * s
    const anchor = {
      x: anchorImg.x * s,
      y: anchorImg.y * s,
      width: anchorImg.width * s,
      height: anchorImg.height * s
    }

    const style = this.getEffectiveTitleStyle(annotation)
    const font = style.font || '12px Arial'
    const paddingX = style.paddingX ?? DEFAULT_TITLE_PADDING_X
    const paddingY = style.paddingY ?? DEFAULT_TITLE_PADDING_Y
    const base = { ...this.titlePosition }
    // 手动宽度可能来自标注自身（业务注入）或全局默认；自动布局只负责不超出图片
    const manualWidth = annotation.style?.titlePosition?.width ?? base.width
    const bounds = { minX: 0, minY: 0, maxX: imageWidth, maxY: imageHeight }
    const measure = this.titleMeasureFor(font)

    let finalLayout: TitleTextLayout
    let vertical: 'top' | 'bottom' | 'inside-top'

    if (measure) {
      const outside = computeTitleTextLayout(title, {
        font,
        paddingX,
        paddingY,
        vertical: base.vertical,
        imageWidth,
        annotationWidth: anchor.width,
        manualWidth,
        measure
      })
      vertical = resolveTitleVertical({
        anchor,
        boxHeight: outside.boxHeight,
        base: base.vertical,
        offsetY: base.offsetY,
        bounds
      })
      finalLayout = vertical === 'inside-top'
        ? computeTitleTextLayout(title, {
            font,
            paddingX,
            paddingY,
            vertical: 'inside-top',
            imageWidth,
            annotationWidth: anchor.width,
            manualWidth,
            measure
          })
        : outside
    } else {
      // 无测量能力时保持旧行为：只做垂直判断、宽度不约束
      const boxHeight = parseFontSize(font) + paddingY * 2
      vertical = resolveTitleVertical({
        anchor,
        boxHeight,
        base: base.vertical,
        offsetY: base.offsetY,
        bounds: { minX: Number.NEGATIVE_INFINITY, minY: 0, maxX: Number.POSITIVE_INFINITY, maxY: imageHeight }
      })
      finalLayout = {
        lines: [title],
        lineHeight: Math.max(1, Math.round(parseFontSize(font) * 1.25)),
        boxWidth: 0,
        boxHeight,
        textWidth: 0
      }
    }

    const layout = computeTitleLayout({
      anchor,
      boxWidth: finalLayout.boxWidth,
      boxHeight: finalLayout.boxHeight,
      position: { ...base, vertical },
      bounds,
      gap: DEFAULT_TITLE_GAP
    })

    if (!annotation.style) {
      annotation.style = this.getCurrentStyle()
    }
    annotation.style.titlePosition = {
      ...base,
      ...(manualWidth != null && manualWidth > 0 ? { width: manualWidth } : {}),
      vertical: layout.vertical,
      align: layout.align,
      offsetX: layout.offsetX
    }
    this.titleLayoutSynced.add(annotation)
  }

  /**
   * 绘制前保证标题布局已计算过（懒布局）。
   *
   * 覆盖「业务方直接塞 recordList / 反序列化」等没有走 setTitle 的入口：
   * 每个标注对象只算一次，缩放/拖动时不会每帧重算。
   */
  public ensureTitleLayouts(): void {
    if (this.viewport.originalWidth <= 0 || this.viewport.originalHeight <= 0) return
    this.recordList.forEach((annotation) => {
      if (!annotation.title || annotation.style?.titlePositionExplicit) return
      if (this.titleLayoutSynced.has(annotation)) return
      this.autoAdjustTitlePosition(annotation, annotation.title)
    })
  }

  /**
   * 图片加载完成后，对所有「未显式设置位置」的标题补做一次边缘判断。
   * 同时清空懒布局缓存，换图后按新尺寸重算。
   */
  public adjustTitlePositions(): void {
    if (this.viewport.originalWidth <= 0 || this.viewport.originalHeight <= 0) return
    this.titleLayoutSynced = new WeakSet()
    this.recordList.forEach((annotation) => {
      if (annotation.title && !annotation.style?.titlePositionExplicit) {
        this.autoAdjustTitlePosition(annotation, annotation.title)
      }
    })
  }

  /** 强制重算全部未显式设置的标题布局并重绘 */
  public refreshTitleLayouts(): void {
    this.adjustTitlePositions()
    this.renderCallback?.()
  }

  /**
   * 整体替换矩形/多边形标注（导入 / 回填 / 反序列化）。
   * 归一化后落库，并返回深拷贝快照。
   */
  public setAnnotations(input: Operate<Rect | Polygon>[]): Operate<Rect | Polygon>[] {
    const ids = new Set<string>()
    const records = this.normalizeImportedAnnotations(input, ids)
    this.recordList = records
    this.deselectAnnotation()
    this.deleteHistory = []
    this.titleLayoutSynced = new WeakSet()
    this.ensureTitleLayouts()
    return this.getAnnotations()
  }

  /**
   * 追加一条矩形/多边形标注；返回落库后的深拷贝快照，非法数据返回 null。
   */
  public addAnnotation(input: Operate<Rect | Polygon>): Operate<Rect | Polygon> | null {
    const ids = new Set<string>()
    this.recordList.forEach((record) => {
      if (record.id) ids.add(record.id)
    })
    const records = this.normalizeImportedAnnotations([input], ids)
    const record = records[0]
    if (!record) return null

    this.recordList.push(record)
    this.deleteHistory = []
    this.ensureTitleLayouts()
    this.notifyChange('create', this.recordList.length - 1, record)
    return deepClone(record)
  }

  /** 导入数据归一化：类型/几何校验、id、status、样式、边界 */
  private normalizeImportedAnnotations(
    input: Operate<Rect | Polygon>[],
    ids: Set<string>
  ): Operate<Rect | Polygon>[] {
    if (!Array.isArray(input)) return []
    const result: Operate<Rect | Polygon>[] = []
    input.forEach((raw) => {
      const record = this.normalizeImportedAnnotation(raw, ids)
      if (record) result.push(record)
    })
    return result
  }

  private normalizeImportedAnnotation(
    raw: Operate<Rect | Polygon>,
    ids: Set<string>
  ): Operate<Rect | Polygon> | null {
    if (!raw || (raw.type !== 'rect' && raw.type !== 'polygon')) return null

    const clone = deepClone(raw)
    const type = clone.type as 'rect' | 'polygon'

    if (type === 'rect') {
      const rect = clone.data?.[0] as Rect | undefined
      if (
        !rect ||
        !Number.isFinite(rect.start?.x) ||
        !Number.isFinite(rect.start?.y) ||
        !Number.isFinite(rect.width) ||
        !Number.isFinite(rect.height)
      ) {
        return null
      }
    } else {
      const points = clone.data as Polygon[]
      if (
        !Array.isArray(points) ||
        points.length < 3 ||
        !points.every(
          (p) => p?.point && Number.isFinite(p.point.x) && Number.isFinite(p.point.y)
        )
      ) {
        return null
      }
    }

    const id =
      typeof clone.id === 'string' && clone.id.length > 0 && !ids.has(clone.id)
        ? clone.id
        : generateId()
    ids.add(id)

    const record: Operate<Rect | Polygon> = {
      ...clone,
      id,
      type,
      status: 'fullfilled',
      style: { ...this.getCurrentStyle(), ...(clone.style || {}) }
    }
    this.clampRecordToImageBounds(record)
    return record
  }

  /**
   * 计算标注标题的完整渲染数据（画布坐标）。
   * 渲染与命中检测共用，避免「看到的位置点不中」。
   */
  public computeTitleRenderData(
    annotation: Operate<Rect | Polygon>,
    measureOverride?: (text: string, font: string) => number
  ): {
    layout: TitleTextLayout
    x: number
    y: number
    vertical: 'top' | 'bottom' | 'inside-top'
    font: string
    paddingX: number
    paddingY: number
  } | null {
    if (!annotation.title) return null

    const { originalHeight } = this.viewport
    const anchor = getTitleAnchor(annotation, this.viewport)
    const anchorImg = getTitleAnchor(annotation)
    if (!anchor || !anchorImg) return null

    const style = this.getEffectiveTitleStyle(annotation)
    const pos = this.getEffectiveTitlePosition(annotation)
    const vertical = pos.vertical || 'top'
    const font = style.font || '12px Arial'
    const measureFn = measureOverride || this.measureTitleWidth
    if (!measureFn) return null

    const paddingX = style.paddingX ?? DEFAULT_TITLE_PADDING_X
    const paddingY = style.paddingY ?? DEFAULT_TITLE_PADDING_Y
    const s = this.getTitleLayoutScale()
    const measure = (text: string) => measureFn(text, font)

    const layout = computeTitleTextLayout(annotation.title, {
      font,
      paddingX,
      paddingY,
      vertical,
      imageWidth: this.getTitleImageWidth(),
      annotationWidth: anchorImg.width * s,
      manualWidth: pos.width,
      measure
    })

    const box = computeTitleBox({
      anchor,
      boxWidth: layout.boxWidth,
      boxHeight: layout.boxHeight,
      position: { ...pos, vertical },
      gap: DEFAULT_TITLE_GAP
    })
    const x = box.x
    let y = box.y

    // 内部标题向下生长，若超出图片底边则整体上移（不截断文字）
    if (vertical === 'inside-top' && originalHeight > 0) {
      const imageTop = this.viewport.offset.y
      const imageBottom = imageTop + originalHeight * this.viewport.scale
      const maxY = imageBottom - layout.boxHeight
      if (maxY >= imageTop) y = Math.min(Math.max(y, imageTop), maxY)
    }

    return { layout, x, y, vertical, font, paddingX, paddingY }
  }

  /** 标题框在画布上的矩形（命中检测 / 测试用） */
  public getTitleBoxRect(
    index: number,
    measureOverride?: (text: string, font: string) => number
  ): { x: number; y: number; width: number; height: number } | null {
    const annotation = this.recordList[index]
    if (!annotation?.title) return null
    const data = this.computeTitleRenderData(annotation, measureOverride)
    if (!data) return null
    return {
      x: data.x,
      y: data.y,
      width: data.layout.boxWidth,
      height: data.layout.boxHeight
    }
  }

  /**
   * 命中标题框（从后往前，后画的优先）。
   * `part=handle` 仅对已选中的标注返回；未选中的标题只用于「点击选中」。
   */
  public hitTestTitle(
    canvasX: number,
    canvasY: number
  ): { index: number; part: 'handle' | 'body' } | null {
    if (!this.titleDraggable) return null

    for (let index = this.recordList.length - 1; index >= 0; index--) {
      const annotation = this.recordList[index]
      if (!annotation?.title) continue
      const box = this.getTitleBoxRect(index)
      if (!box) continue
      if (
        canvasX < box.x ||
        canvasX > box.x + box.width ||
        canvasY < box.y ||
        canvasY > box.y + box.height
      ) {
        continue
      }
      const handleWidth = Math.min(8, box.width)
      const isSelected = this.selectedAnnotation?.index === index
      return {
        index,
        part: isSelected && canvasX >= box.x + box.width - handleWidth ? 'handle' : 'body'
      }
    }
    return null
  }


  /**
   * 开始拖拽标题框（移动框体 / 拖右边缘改宽）
   */
  public startTitleDrag(
    part: 'handle' | 'body',
    index: number,
    pointer: Point
  ): boolean {
    if (!this.titleDraggable) return false
    if (this.selectedAnnotation?.index !== index) return false
    if (this.selectedAnnotation.locked === true) return false

    const annotation = this.recordList[index]
    if (!annotation?.title) return false
    const pos = this.getEffectiveTitlePosition(annotation)
    const box = this.getTitleBoxRect(index)
    if (!box) return false

    this.isDraggingTitle = true
    this.titleDragPart = part
    this.titleDragIndex = index
    this.titleDragStartPointer = { ...pointer }
    this.titleDragStartOffsetX = pos.offsetX ?? 0
    this.titleDragStartOffsetY = pos.offsetY ?? 0
    this.titleDragStartWidth = pos.width ?? box.width
    this.titleDragMoved = false
    return true
  }

  /**
   * 更新标题拖拽（pointer 为画布坐标）；返回是否产生了有效位移。
   * 位移按画布像素 1:1 应用，再统一夹回图片边界。
   */
  public updateTitleDrag(pointer: Point): boolean {
    if (!this.isDraggingTitle || this.titleDragIndex === null) return false

    const annotation = this.recordList[this.titleDragIndex]
    if (!annotation?.title) {
      this.finishTitleDrag()
      return false
    }

    const dx = pointer.x - this.titleDragStartPointer.x
    const dy = pointer.y - this.titleDragStartPointer.y
    // 过滤双击/点击时的抖动，避免“双击编辑”把标题挪动
    if (!this.titleDragMoved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return false
    this.titleDragMoved = true

    if (!annotation.style) annotation.style = this.getCurrentStyle()
    if (!annotation.style.titlePosition) {
      annotation.style.titlePosition = { ...this.getEffectiveTitlePosition(annotation) }
    }
    const pos = annotation.style.titlePosition

    if (this.titleDragPart === 'handle') {
      const maxWidth = this.getTitleImageWidth()
      pos.width = Math.min(
        Math.max(this.titleDragStartWidth + dx, this.getTitleMinWidth(annotation)),
        maxWidth
      )
    } else {
      pos.offsetX = this.titleDragStartOffsetX + dx
      pos.offsetY = this.titleDragStartOffsetY + dy
    }
    // 手动调整后不再参与自动上下/内部兜底
    annotation.style.titlePositionExplicit = true
    this.clampTitleOffsets(annotation)
    return true
  }

  /** 结束标题拖拽并上报 update；返回本次是否有实际位移 */
  public finishTitleDrag(): boolean {
    const changed = this.titleDragMoved
    const index = this.titleDragIndex
    this.isDraggingTitle = false
    this.titleDragPart = null
    this.titleDragIndex = null
    this.titleDragMoved = false
    if (changed && index !== null) {
      this.notifyUpdate(index)
      this.renderCallback?.()
    }
    return changed
  }

  private cancelTitleDrag(): void {
    this.isDraggingTitle = false
    this.titleDragPart = null
    this.titleDragIndex = null
    this.titleDragMoved = false
  }

  /**
   * 把标题框整体夹回图片内（初始显示坐标系），再反推 offsetX/offsetY。
   * 手动移动/改宽后调用，保证任意缩放下都不出图。
   */
  private clampTitleOffsets(annotation: Operate<Rect | Polygon>): void {
    const pos = annotation.style?.titlePosition
    if (!pos || !annotation.title) return

    const anchorImg = getTitleAnchor(annotation)
    if (!anchorImg) return

    const style = this.getEffectiveTitleStyle(annotation)
    const font = style.font || '12px Arial'
    const measure = this.titleMeasureFor(font)
    if (!measure) return

    const s = this.getTitleLayoutScale()
    const imageWidth = this.getTitleImageWidth()
    const { originalHeight } = this.viewport
    const imageHeight = originalHeight > 0 ? originalHeight * s : Infinity
    const anchor = {
      x: anchorImg.x * s,
      y: anchorImg.y * s,
      width: anchorImg.width * s,
      height: anchorImg.height * s
    }
    const vertical = pos.vertical || this.titlePosition.vertical || 'top'
    const paddingX = style.paddingX ?? DEFAULT_TITLE_PADDING_X
    const paddingY = style.paddingY ?? DEFAULT_TITLE_PADDING_Y

    const layout = computeTitleTextLayout(annotation.title, {
      font,
      paddingX,
      paddingY,
      vertical,
      imageWidth,
      annotationWidth: anchor.width,
      manualWidth: pos.width,
      measure
    })

    const base = { ...pos, vertical }
    const raw = computeTitleBox({
      anchor,
      boxWidth: layout.boxWidth,
      boxHeight: layout.boxHeight,
      position: base,
      bounds: UNBOUNDED_TITLE_BOUNDS,
      gap: DEFAULT_TITLE_GAP
    })
    const raw0 = computeTitleBox({
      anchor,
      boxWidth: layout.boxWidth,
      boxHeight: layout.boxHeight,
      position: { ...base, offsetX: 0, offsetY: 0 },
      bounds: UNBOUNDED_TITLE_BOUNDS,
      gap: DEFAULT_TITLE_GAP
    })

    const maxX = Number.isFinite(imageWidth) ? Math.max(0, imageWidth - layout.boxWidth) : raw.x
    const maxY = Number.isFinite(imageHeight) ? Math.max(0, imageHeight - layout.boxHeight) : raw.y
    const x = Math.min(Math.max(raw.x, 0), maxX)
    const y = Math.min(Math.max(raw.y, 0), maxY)
    pos.offsetX = x - raw0.x
    pos.offsetY = y - raw0.y
  }

  /**
   * 清除手动宽度/位置，恢复自动换行与自动上下/内部兜底
   */
  public resetAnnotationTitleLayout(ref: number | string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return false
    const annotation = this.recordList[index]
    if (!annotation) return false

    if (annotation.style) {
      delete annotation.style.titlePosition
      annotation.style.titlePositionExplicit = false
    }
    this.titleLayoutSynced.delete(annotation)
    if (annotation.title) this.autoAdjustTitlePosition(annotation, annotation.title)
    this.notifyUpdate(index)
    return true
  }


  /**
   * 单独修改某个标注的标题样式（不影响全局默认）
   * @param ref - 标注索引或 id
   * @param style - 标题样式（部分覆盖）
   */
  setAnnotationTitleStyle(ref: number | string, style: Partial<TitleStyle>): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return false
    const annotation = this.recordList[index]
    if (!annotation.style) {
      annotation.style = this.getCurrentStyle()
    }
    annotation.style.titleStyle = {
      ...(annotation.style.titleStyle || this.titleStyle),
      ...style
    }
    // 字号 / padding 变了，标题框尺寸跟着变，需要重新做一次边缘判断
    if (annotation.title) {
      if (annotation.style.titlePositionExplicit) {
        // 手动布局不重新选上/下/内部，但尺寸变化后仍要保证不出图
        this.clampTitleOffsets(annotation)
      } else {
        this.titleLayoutSynced.delete(annotation)
        this.autoAdjustTitlePosition(annotation, annotation.title)
      }
    }
    this.notifyUpdate(index)
    return true
  }

  /**
   * 单独修改某个标注的标题位置（不影响全局默认）
   * @param ref - 标注索引或 id
   * @param position - 标题位置（部分覆盖）
   */
  setAnnotationTitlePosition(ref: number | string, position: Partial<TitlePosition>): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return false
    const annotation = this.recordList[index]
    if (!annotation.style) {
      annotation.style = this.getCurrentStyle()
    }
    annotation.style.titlePosition = {
      ...(annotation.style.titlePosition || this.titlePosition),
      ...position
    }
    // 标记为显式设置，后续设置标题时的自动边缘判断不再覆盖
    annotation.style.titlePositionExplicit = true
    this.notifyUpdate(index)
    return true
  }

  /**
   * 创建标题输入框
   */
  private createTitleInput(): void {
    if (!this.container) return

    this.titleInput = document.createElement("input")
    this.titleInput.type = "text"
    this.titleInput.style.position = "absolute"
    this.titleInput.style.zIndex = "99998"
    this.titleInput.style.display = "none"
    this.titleInput.style.outline = "none"
    this.titleInput.style.border = "1px solid #00D9FF"
    this.titleInput.style.borderRadius = "4px"
    this.titleInput.style.padding = "4px 8px"
    this.titleInput.style.fontSize = "13px"
    this.titleInput.style.fontFamily = "Arial, sans-serif"
    this.titleInput.style.backgroundColor = "#ffffff"
    this.titleInput.style.color = "#333"
    this.titleInput.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)"
    this.titleInput.style.minWidth = "80px"
    this.titleInput.style.maxWidth = "200px"
    this.titleInput.placeholder = this.titleStyle.placeholder || "输入标题..."

    // 失去焦点时完成编辑
    this.titleInput.addEventListener("blur", () => {
      this.finishTitleEditing()
    })

    // 键盘事件
    this.titleInput.addEventListener("keydown", (e) => {
      e.stopPropagation()
      if (e.key === "Enter") {
        this.finishTitleEditing()
      } else if (e.key === "Escape") {
        e.preventDefault()
        this.cancelTitleEditing()
      }
    })

    this.container.appendChild(this.titleInput)
  }

  /**
   * 设置标注标题（API调用）
   * @param ref - 标注索引或 id
   * @param title - 标题文本
   */
  setTitle(ref: number | string, title: string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return false
    const annotation = this.recordList[index]
    annotation.title = title || undefined

    // 设置非空标题时，将当前全局样式快照存入标注，保证后续全局修改不影响已有标题
    if (title) {
      this.captureTitleStyleSnapshot(annotation)
      // 按图片初始尺寸自动判断是否靠边，并写回位置；显式布局保留位置，但编辑文字后仍需夹回图内
      if (annotation.style?.titlePositionExplicit) {
        this.clampTitleOffsets(annotation)
      } else {
        this.autoAdjustTitlePosition(annotation, title)
      }
    }
    this.notifyUpdate(index)
    return true
  }

  /**
   * 获取标注标题
   * @param ref - 标注索引或 id
   */
  getTitle(ref: number | string): string | undefined {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) return undefined
    return this.recordList[index].title
  }

  /**
   * 开始编辑标题（双击或API触发）
   * @param index - 标注索引
   */
  startTitleEditing(index: number): boolean {
    if (!this.enableTitle || !this.titleInput || index < 0 || index >= this.recordList.length) {
      return false
    }

    const annotation = this.recordList[index]
    this.editingTitleIndex = index
    this.deselectAnnotation()

    // 计算标注的位置（画布坐标）
    let canvasX: number, canvasY: number
    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      canvasX = this.viewport.offset.x + rect.start.x * this.viewport.scale
      canvasY = this.viewport.offset.y + rect.start.y * this.viewport.scale
    } else {
      // 多边形：使用第一个顶点的位置
      const firstPoint = (annotation.data as Polygon[])[0]
      canvasX = this.viewport.offset.x + firstPoint.point.x * this.viewport.scale
      canvasY = this.viewport.offset.y + firstPoint.point.y * this.viewport.scale
    }

    // 定位输入框在标注上方
    this.titleInput.value = annotation.title || ""
    // 应用该标注的生效 placeholder（标注快照优先于全局默认）
    this.titleInput.placeholder =
      this.getEffectiveTitleStyle(annotation).placeholder || "输入标题..."
    this.titleInput.style.left = `${canvasX}px`
    this.titleInput.style.top = `${canvasY - 32}px`
    this.titleInput.style.display = "block"

    // 延迟聚焦
    setTimeout(() => {
      if (this.titleInput) {
        this.titleInput.focus()
        this.titleInput.select()
      }
    }, 10)

    return true
  }

  /**
   * 完成标题编辑
   */
  finishTitleEditing(): boolean {
    if (!this.titleInput || this.editingTitleIndex === null) return false

    const index = this.editingTitleIndex
    const newTitle = this.titleInput.value.trim()

    if (index >= 0 && index < this.recordList.length) {
      const annotation = this.recordList[index]
      annotation.title = newTitle || undefined
      // 设置非空标题时，将当前全局样式快照存入标注
      if (newTitle) {
        this.captureTitleStyleSnapshot(annotation)
        // 按图片初始尺寸自动判断是否靠边，并写回位置；显式布局保留位置，但编辑文字后仍需夹回图内
        if (annotation.style?.titlePositionExplicit) {
          this.clampTitleOffsets(annotation)
        } else {
          this.autoAdjustTitlePosition(annotation, newTitle)
        }
      }
      this.notifyUpdate(index)
      // 重新选中标注
      this.selectAnnotation(index)
    }

    this.resetTitleEditingState()
    if (this.renderCallback) this.renderCallback()
    return true
  }

  /**
   * 取消标题编辑
   */
  cancelTitleEditing(): boolean {
    if (!this.titleInput || this.editingTitleIndex === null) return false

    const index = this.editingTitleIndex
    // 恢复选中
    if (index >= 0 && index < this.recordList.length) {
      this.selectAnnotation(index)
    }

    this.resetTitleEditingState()
    if (this.renderCallback) this.renderCallback()
    return true
  }

  /**
   * 重置标题编辑状态
   */
  private resetTitleEditingState(): void {
    if (this.titleInput) {
      this.titleInput.style.display = "none"
    }
    this.editingTitleIndex = null
  }

  /**
   * 清理标题输入框
   */
  destroyTitleInput(): void {
    if (this.titleInput && this.titleInput.parentNode) {
      this.titleInput.parentNode.removeChild(this.titleInput)
      this.titleInput = null
    }
  }
}
