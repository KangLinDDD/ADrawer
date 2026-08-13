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
      return true
    }
    if (this.recordList.length > 0) {
      // 撤销已完成的操作
      this.recordList.pop()
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
      this.notifyUpdate(this.selectedAnnotation.index)
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
    annotation.style.titlePosition = { ...this.titlePosition }
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
