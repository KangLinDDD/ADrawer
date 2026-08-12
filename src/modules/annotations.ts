/**
 * 标注管理模块
 * 负责矩形、多边形标注的存储、绘制、选中、移动、调整大小等功能
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
import { isPointInRect, isPointInPolygon, deepClone, generateId } from './utils'
import type { ViewportManager } from './viewport'

export class AnnotationManager {
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
  
  // 调整大小用的原始数据
  public originalRect: Rect | null = null
  public originalPolygon: Polygon[] | null = null

  // 删除历史记录（用于撤销删除）
  private deleteHistory: { annotation: Operate<Rect | Polygon>; index: number }[] = []

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

  constructor(
    private viewport: ViewportManager,
    private container?: HTMLElement,
    private renderCallback?: () => void,
    private changeCallback?: ChangeNotify
  ) {
    this.applyColorConfig()
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
   * 上报标注变更（载荷携带深拷贝快照）
   */
  private notifyChange(event: 'create' | 'delete' | 'update', index: number, annotation: Operate<Rect | Polygon>): void {
    if (!this.changeCallback || !annotation.id) return
    this.changeCallback(event, {
      id: annotation.id,
      type: annotation.type as 'rect' | 'polygon',
      index,
      data: deepClone(annotation),
    })
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
   * 开始绘制矩形
   */
  startRectDrawing(startPoint: Point): void {
    this.isDrawing = true
    this.drawStartPoint = startPoint
    this.operate = {
      type: "rect",
      data: [{ start: { ...startPoint }, width: 0, height: 0 }],
      status: "pending",
    }
  }

  /**
   * 更新矩形绘制
   */
  updateRectDrawing(currentPoint: Point): void {
    if (!this.isDrawing || this.operate.type !== "rect") return
    const rect = this.operate.data[0] as Rect
    rect.width = currentPoint.x - this.drawStartPoint.x
    rect.height = currentPoint.y - this.drawStartPoint.y
  }

  /**
   * 完成矩形绘制
   */
  finishRectDrawing(): boolean {
    if (!this.isDrawing || this.operate.type !== "rect") return false
    
    const rect = this.operate.data[0] as Rect
    // 过滤无效矩形（太小）
    if (Math.abs(rect.width) > 5 && Math.abs(rect.height) > 5) {
      // 保存当前样式到标注
      const annotationWithStyle = {
        ...this.operate,
        id: generateId(),
        style: this.getCurrentStyle()
      }
      this.recordList.push(annotationWithStyle)
      // 添加新标注后清空删除历史
      this.deleteHistory = []
      this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)
    }

    this.operate.data = []
    this.isDrawing = false
    return true
  }

  /**
   * 开始绘制多边形
   */
  startPolygonDrawing(startPoint: Point): void {
    this.isDrawing = true
    this.operate = {
      type: "polygon",
      data: [{ point: startPoint }],
      status: "pending",
    }
    this.tempPolygonPoint = startPoint
  }

  /**
   * 添加多边形点
   */
  addPolygonPoint(point: Point): boolean {
    if (!this.isDrawing || this.operate.type !== "polygon") return false
    
    // 避免添加重复点
    const lastPoint = this.operate.data.length > 0 
      ? (this.operate.data[this.operate.data.length - 1] as Polygon)
      : null
    
    if (lastPoint && 
        Math.abs(lastPoint.point.x - point.x) <= 5 && 
        Math.abs(lastPoint.point.y - point.y) <= 5) {
      return false
    }

    this.operate.data.push({ point })
    return true
  }

  /**
   * 更新多边形临时点
   */
  updatePolygonTempPoint(point: Point): void {
    this.tempPolygonPoint = point
  }

  /**
   * 完成多边形绘制
   */
  finishPolygonDrawing(): boolean {
    if (!this.isDrawing || this.operate.type !== "polygon") return false
    
    // 过滤无效多边形（点数太少）
    if (this.operate.data.length >= 3) {
      this.operate.status = "fullfilled"
      // 保存当前样式到标注
      const annotationWithStyle = {
        ...this.operate,
        id: generateId(),
        style: this.getCurrentStyle()
      }
      this.recordList.push(annotationWithStyle)
      // 添加新标注后清空删除历史
      this.deleteHistory = []
      this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)
    }

    this.operate = {
      type: "polygon",
      data: [],
      status: "pending",
    }
    this.isDrawing = false
    this.tempPolygonPoint = null
    return true
  }

  /**
   * 取消当前绘制
   */
  cancelDrawing(): void {
    if (this.isDrawing && this.operate.type === "polygon" && this.operate.data.length >= 2) {
      // 如果多边形至少有两个点，保存当前进度
      this.operate.status = "fullfilled"
      // 保存当前样式到标注
      const annotationWithStyle = {
        ...this.operate,
        id: generateId(),
        style: this.getCurrentStyle()
      }
      this.recordList.push(annotationWithStyle)
      // 添加新标注后清空删除历史（与 finishRectDrawing / finishPolygonDrawing 一致）
      this.deleteHistory = []
      this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)
    }
    
    this.operate.data = []
    this.isDrawing = false
    this.tempPolygonPoint = null
  }

  /**
   * 撤销操作
   */
  withdraw(): boolean {
    if (this.operate.data.length > 0) {
      // 撤销当前操作中的点
      if (this.operate.type === "polygon") {
        this.operate.data.pop()
        if (this.operate.data.length === 0) {
          this.isDrawing = false
        }
      } else {
        this.operate.data = []
        this.isDrawing = false
      }
      return true
    } else if (this.deleteHistory.length > 0) {
      // 优先恢复删除的标注
      const { annotation, index } = this.deleteHistory.pop()!
      // 在原来的位置插入
      this.recordList.splice(index, 0, annotation)
      return true
    } else if (this.recordList.length > 0) {
      // 撤销已完成的操作
      this.recordList.pop()
      return true
    }
    return false
  }

  /**
   * 选中指定索引或 id 的标注
   */
  selectAnnotation(ref: number | string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.recordList.length) {
      this.deselectAnnotation()
      return false
    }

    const annotation = this.recordList[index]
    this.selectedAnnotation = {
      index,
      type: annotation.type as "rect" | "polygon",
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
   * 开始移动标注
   */
  startMovingAnnotation(e: MouseEvent): boolean {
    if (!this.selectedAnnotation) return false
    
    this.isMovingAnnotation = true
    this.annotationMoveStart = { x: e.clientX, y: e.clientY }
    return true
  }

  /**
   * 移动选中的标注
   */
  moveSelectedAnnotation(dx: number, dy: number): boolean {
    if (!this.selectedAnnotation) return false

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return false

    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      rect.start.x += dx
      rect.start.y += dy
    } else if (annotation.type === "polygon") {
      const polygon = annotation.data as Polygon[]
      polygon.forEach((p) => {
        p.point.x += dx
        p.point.y += dy
      })
    }

    return true
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
   * 开始调整大小
   */
  startResizing(handle: ActiveHandle, _startPoint: Point): boolean {
    if (!this.selectedAnnotation) return false

    this.activeHandle = handle
    this.isResizing = true
    
    const annotation = this.recordList[this.selectedAnnotation.index]
    if (annotation.type === "rect") {
      this.originalRect = { ...(annotation.data[0] as Rect) }
    } else if (annotation.type === "polygon") {
      this.originalPolygon = (annotation.data as Polygon[]).map(p => ({ point: { ...p.point } }))
    }
    
    return true
  }

  /**
   * 调整矩形大小
   */
  resizeRect(currentPoint: Point): boolean {
    if (!this.selectedAnnotation || this.selectedAnnotation.type !== "rect" || !this.originalRect || !this.activeHandle) {
      return false
    }

    const annotation = this.recordList[this.selectedAnnotation.index]
    const rect = annotation.data[0] as Rect
    const original = this.originalRect

    // 原始矩形的四个角坐标
    const origLeft = original.start.x
    const origRight = original.start.x + original.width
    const origTop = original.start.y
    const origBottom = original.start.y + original.height

    // 根据当前控制点索引确定固定点
    let fixedX: number, fixedY: number
    switch (this.activeHandle.index) {
      case 0: fixedX = origRight; fixedY = origBottom; break
      case 1: fixedX = origLeft; fixedY = origBottom; break
      case 2: fixedX = origRight; fixedY = origTop; break
      case 3: fixedX = origLeft; fixedY = origTop; break
      default: return false
    }

    // 新矩形的边界由拖拽点和对角点决定
    const newLeft = Math.min(currentPoint.x, fixedX)
    const newRight = Math.max(currentPoint.x, fixedX)
    const newTop = Math.min(currentPoint.y, fixedY)
    const newBottom = Math.max(currentPoint.y, fixedY)

    rect.start.x = newLeft
    rect.start.y = newTop
    rect.width = newRight - newLeft
    rect.height = newBottom - newTop

    // 根据新的矩形边界，更新控制点索引（实现越过交换）
    const isLeft = currentPoint.x < fixedX
    const isTop = currentPoint.y < fixedY

    if (this.activeHandle.index === 0) {
      if (!isLeft && !isTop) this.activeHandle.index = 3
      else if (!isLeft && isTop) this.activeHandle.index = 1
      else if (isLeft && !isTop) this.activeHandle.index = 2
    } else if (this.activeHandle.index === 1) {
      if (isLeft && !isTop) this.activeHandle.index = 2
      else if (isLeft && isTop) this.activeHandle.index = 0
      else if (!isLeft && !isTop) this.activeHandle.index = 3
    } else if (this.activeHandle.index === 2) {
      if (!isLeft && isTop) this.activeHandle.index = 1
      else if (isLeft && isTop) this.activeHandle.index = 0
      else if (!isLeft && !isTop) this.activeHandle.index = 3
    } else if (this.activeHandle.index === 3) {
      if (isLeft && isTop) this.activeHandle.index = 0
      else if (!isLeft && isTop) this.activeHandle.index = 1
      else if (isLeft && !isTop) this.activeHandle.index = 2
    }

    // 更新 originalRect 为当前矩形，为下次拖拽做准备
    this.originalRect = { ...rect }
    return true
  }

  /**
   * 调整多边形顶点位置
   */
  resizePolygon(currentPoint: Point): boolean {
    if (!this.selectedAnnotation || this.selectedAnnotation.type !== "polygon" || !this.activeHandle) {
      return false
    }

    const annotation = this.recordList[this.selectedAnnotation.index]
    const polygon = annotation.data as Polygon[]
    const vertexIndex = this.activeHandle.index

    if (vertexIndex >= 0 && vertexIndex < polygon.length) {
      polygon[vertexIndex].point.x = currentPoint.x
      polygon[vertexIndex].point.y = currentPoint.y
      return true
    }
    return false
  }

  /**
   * 获取点击位置对应的标注
   */
  getAnnotationAtPoint(imgCoords: Point): SelectedAnnotation | null {
    // 从后往前遍历，优先选中上层标注
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]

      if (annotation.type === "rect") {
        const rect = annotation.data[0] as Rect
        if (isPointInRect(imgCoords, rect)) {
          return { index: i, type: "rect" }
        }
      } else if (annotation.type === "polygon") {
        const polygon = annotation.data as Polygon[]
        if (isPointInPolygon(imgCoords, polygon)) {
          return { index: i, type: "polygon" }
        }
      }
    }

    return null
  }

  /**
   * 获取点击位置的控制点
   */
  getHandleAtPoint(offsetX: number, offsetY: number): ActiveHandle | null {
    if (!this.selectedAnnotation) return null

    const annotation = this.recordList[this.selectedAnnotation.index]
    const handleSize = this.selectionStyle.handleSize
    const halfHandle = handleSize / 2

    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      const x = this.viewport.offset.x + rect.start.x * this.viewport.scale
      const y = this.viewport.offset.y + rect.start.y * this.viewport.scale
      const w = rect.width * this.viewport.scale
      const h = rect.height * this.viewport.scale

      // 四个角的控制点
      const corners = [
        { x: x, y: y, index: 0 },
        { x: x + w, y: y, index: 1 },
        { x: x, y: y + h, index: 2 },
        { x: x + w, y: y + h, index: 3 },
      ]

      for (const corner of corners) {
        if (
          offsetX >= corner.x - halfHandle &&
          offsetX <= corner.x + halfHandle &&
          offsetY >= corner.y - halfHandle &&
          offsetY <= corner.y + halfHandle
        ) {
          return { type: "rect-corner", index: corner.index }
        }
      }
    } else if (annotation.type === "polygon") {
      const polygon = annotation.data as Polygon[]

      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i]
        const x = this.viewport.offset.x + p.point.x * this.viewport.scale
        const y = this.viewport.offset.y + p.point.y * this.viewport.scale

        if (
          offsetX >= x - halfHandle &&
          offsetX <= x + halfHandle &&
          offsetY >= y - halfHandle &&
          offsetY <= y + halfHandle
        ) {
          return { type: "polygon-vertex", index: i }
        }
      }
    }

    return null
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
