/**
 * Image Annotation Drawer
 * 一个轻量级的图片标注库，基于 HTML5 Canvas
 * 
 * 功能特性：
 * - 多种标注类型：矩形、多边形、文本标注
 * - 视图操作：鼠标滚轮缩放、拖拽平移
 * - 撤销功能：支持撤销上一步操作
 * - 快捷键：空格键重置视图，ESC 取消当前绘制
 * - 图片导出：支持导出标注后的图片
 * - TypeScript 支持：完整的类型定义
 */

// 导出类型定义
export type {
  Shape,
  Point,
  Rect,
  Polygon,
  TextAnnotation,
  Operate,
  DrawerOptions,
  DrawType,
  SelectedAnnotation,
  ActiveHandle,
  TextStyle,
  TextInputStyle,
  SelectionStyle,
  AnnotationStyle,
  LineStyle,
  VertexStyle,
  ColorConfig,
  ViewportSize,
  ViewportOffset,
  DrawerEventHandlers,
} from './modules/types'

// 导出工具函数
export { 
  isPointInRect, 
  isPointInPolygon, 
  getImageTypeFromUrl,
  base64ToFile,
  base64ToBlob,
  getZoomDelta,
} from './modules/utils'

// 导出各个模块（供高级用户使用）
export { ViewportManager } from './modules/viewport'
export { AnnotationManager } from './modules/annotations'
export { TextAnnotationManager } from './modules/text-annotation'
export { Renderer } from './modules/renderer'
export { EventHandler } from './modules/events'

// 导入内部模块
import type { 
  Rect, 
  Polygon, 
  TextAnnotation, 
  Operate, 
  DrawerOptions, 
  DrawType,
  DrawerEventHandlers,
  ColorConfig,
  LineStyle,
  VertexStyle,
  TextStyle,
  TextInputStyle
} from './modules/types'
import { getImageTypeFromUrl, base64ToFile, base64ToBlob, getZoomDelta } from './modules/utils'
import { ViewportManager } from './modules/viewport'
import { AnnotationManager } from './modules/annotations'
import { TextAnnotationManager } from './modules/text-annotation'
import { Renderer } from './modules/renderer'
import { EventHandler } from './modules/events'

/**
 * Drawer 类 - 图片标注库的主入口
 * 
 * @example
 * ```typescript
 * const drawer = new Drawer({
 *   id: 'container',
 *   drawType: 'rect'
 * });
 * drawer.drawImage('image.jpg');
 * ```
 */
export class Drawer {
  // Canvas 相关
  private canvas = document.createElement("canvas")
  private ctx: CanvasRenderingContext2D
  private container: HTMLElement

  // 功能模块
  private viewport: ViewportManager
  private annotationManager: AnnotationManager
  private textManager: TextAnnotationManager
  private renderer: Renderer
  private eventHandler: EventHandler

  // 事件处理器
  private events: DrawerEventHandlers

  // 图片相关
  private bgImage: HTMLImageElement | null = null
  private bgImageSrc = ""
  private bgImageExt = "jpeg"

  // 绘制类型
  public drawType: DrawType = ""

  constructor(options: DrawerOptions) {
    const { drawType, useEvents = true, id = "container", annotationColor, lineStyle, vertexStyle, textStyle } = options

    // 获取容器
    const container = document.getElementById(id)
    if (!container) throw new Error(`Container with id "${id}" not found`)
    this.container = container

    // 确保容器有相对定位
    if (container.style.position !== "absolute" && 
        container.style.position !== "fixed" && 
        container.style.position !== "relative") {
      container.style.position = "relative"
    }

    // 初始化 Canvas
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D
    
    // 初始化视口
    this.viewport = new ViewportManager()
    this.viewport.setSize(container.clientWidth, container.clientHeight)

    // 设置 Canvas 尺寸
    this.canvas.width = this.viewport.width
    this.canvas.height = this.viewport.height
    this.canvas.style.width = `${this.viewport.width}px`
    this.canvas.style.height = `${this.viewport.height}px`
    this.canvas.style.cursor = "default"
    this.canvas.style.display = "block"
    container.appendChild(this.canvas)

    // 初始化功能模块
    this.annotationManager = new AnnotationManager(this.viewport)
    
    // 设置颜色配置
    if (annotationColor) {
      this.annotationManager.setColorConfig(annotationColor)
    }
    
    // 设置边线样式
    if (lineStyle) {
      this.annotationManager.setLineStyle(lineStyle)
    }
    
    // 设置顶点样式
    if (vertexStyle) {
      this.annotationManager.setVertexStyle(vertexStyle)
    }
    
    this.textManager = new TextAnnotationManager(this.viewport, this.container, this.ctx, () => this.render())
    
    // 设置文本样式
    if (textStyle) {
      this.textManager.setTextStyle(textStyle)
    }
    this.renderer = new Renderer(this.ctx, this.viewport, this.annotationManager, this.textManager, this.canvas)
    this.eventHandler = new EventHandler(
      this.canvas,
      this.viewport,
      this.annotationManager,
      this.textManager,
      this.renderer,
      () => this.drawType,
      () => this.bgImage,
      () => this.render(),
      (type) => this.setDrawType(type)
    )

    // 初始化事件处理器
    this.events = {
      wheel: (e: WheelEvent) => this.eventHandler.handleWheel(e),
      mousedown: (e: MouseEvent) => this.eventHandler.handleMouseDown(e),
      mousemove: (e: MouseEvent) => this.eventHandler.handleMouseMove(e),
      mouseup: (e: MouseEvent) => this.eventHandler.handleMouseUp(e),
      mouseleave: (e: MouseEvent) => this.eventHandler.handleMouseLeave(e),
      dblclick: (e: MouseEvent) => this.eventHandler.handleDoubleClick(e),
      click: (e: MouseEvent) => this.eventHandler.handleClick(e),
      keydown: (e: KeyboardEvent) => this.eventHandler.handleKeyDown(e),
    }

    // 设置绘制类型
    this.setDrawType(drawType || "")

    // 绑定事件
    if (useEvents) {
      this.addEventListeners()
    }
  }

  /**
   * 设置绘制模式
   * @param type - 绘制类型: 'rect' | 'polygon' | 'drag' | 'text' | ''
   */
  public setDrawType(type: DrawType): void {
    // 检查当前是否正在绘制多边形
    if (this.drawType === "polygon" && this.annotationManager.isDrawing) {
      if (this.annotationManager.operate.data.length > 0) {
        console.warn(
          "Cannot switch mode while polygon is being drawn. Please complete or cancel the polygon first.",
        )
        return
      }
    }

    // 如果切换到相同模式，不做任何操作
    if (this.drawType === type) return

    // 重置当前操作状态
    this.annotationManager.operate.data = []
    this.annotationManager.isDrawing = false
    this.annotationManager.tempPolygonPoint = null

    // 如果切换到绘制模式，取消选中状态
    if (type !== "") {
      this.deselectAnnotation()
    }

    // 更新操作类型和绘制类型
    this.annotationManager.operate.type = type
    this.drawType = type

    // 设置光标样式
    if (type === "drag") {
      this.canvas.style.cursor = "grab"
    } else if (type === "text") {
      this.canvas.style.cursor = "text"
    } else {
      this.canvas.style.cursor = "default"
    }
  }

  /**
   * 加载背景图片
   * @param src - 图片 URL
   */
  public drawImage(src: string): void {
    this.bgImageSrc = src
    this.bgImageExt = getImageTypeFromUrl(src)
    
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src
    img.onload = () => {
      this.bgImage = img
      this.viewport.setOriginalSize(img.width, img.height)
      this.viewport.calculateInitialView()
      this.render()
    }
  }

  /**
   * 渲染画布
   */
  private render(): void {
    this.renderer.render(this.bgImage)
  }

  /**
   * 清除所有标注
   * @param type - 清除后设置的绘制类型
   */
  public clear(type: DrawType = ""): void {
    this.annotationManager.clear()
    this.textManager.clearTextAnnotations()
    this.setDrawType(type)
    this.render()
  }

  /**
   * 撤销上一步操作
   */
  public withdraw(): void {
    const annotationWithdrawn = this.annotationManager.withdraw()
    const textWithdrawn = this.textManager.withdraw()
    
    if (annotationWithdrawn || textWithdrawn) {
      this.render()
    }
  }

  /**
   * 绑定事件监听器
   */
  public addEventListeners(): void {
    this.canvas.addEventListener("mousedown", this.events.mousedown)
    this.canvas.addEventListener("mousemove", this.events.mousemove)
    this.canvas.addEventListener("mouseup", this.events.mouseup)
    this.canvas.addEventListener("mouseleave", this.events.mouseleave)
    this.canvas.addEventListener("wheel", this.events.wheel)
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault())
    document.addEventListener("keydown", this.events.keydown)
    this.handleClickEventListener()
  }

  /**
   * 处理单击事件（用于区分单击和双击）
   */
  private handleClickEventListener(): void {
    let clickTimeout: number | null = null
    let clickCount = 0

    this.canvas.addEventListener("click", (e) => {
      // 跳过拖拽/移动/调整大小/文本移动结束后的点击
      if (this.eventHandler.isDragging || 
          this.annotationManager.isMovingAnnotation || 
          this.annotationManager.isResizing || 
          this.textManager.isTextMoving) {
        return
      }

      // 检查是否需要跳过这次点击
      const shouldSkip = this.eventHandler.justFinishedMove
      if (shouldSkip) {
        this.eventHandler.justFinishedMove = false
      }

      clickCount++
      if (clickCount === 1) {
        clickTimeout = window.setTimeout(() => {
          if (clickCount === 1 && !shouldSkip) {
            this.events.click(e)
          }
          clickCount = 0
          clickTimeout = null
        }, 300)
      } else if (clickCount === 2) {
        this.eventHandler.justFinishedMove = false
        this.events.dblclick(e)
        clickCount = 0
        if (clickTimeout !== null) {
          clearTimeout(clickTimeout)
          clickTimeout = null
        }
      }
    })
  }

  /**
   * 改变缩放比例
   * @param zoomIn - true: 放大, false: 缩小
   */
  public changeScale(zoomIn: boolean): void {
    if (!this.bgImage) return

    const delta = getZoomDelta(this.viewport.scale, zoomIn)
    const centerX = this.viewport.width / 2
    const centerY = this.viewport.height / 2
    const newScale = this.viewport.scale + delta

    this.viewport.updateScale(newScale, centerX, centerY)
    this.render()
  }

  /**
   * 清除整个画布，包括背景图片和所有标注
   * @param keepImage - 是否保留背景图片，默认为 false
   * @param clearImage - 是否清除背景图片，默认为 true（与 keepImage 互斥）
   */
  public clearCanvas(keepImage: boolean = false, clearImage: boolean = true): void {
    // 清除所有标注
    this.annotationManager.clear()
    this.textManager.clearTextAnnotations()
    // 取消文本标注选中
    this.textManager.deselectTextAnnotation()

    // 只有在不清除图片且需要重置视图时才重置
    if (!keepImage && clearImage) {
      // 清除背景图片
      this.bgImage = null
      this.bgImageSrc = ""
      this.viewport.setOriginalSize(0, 0)
      // 重置视图状态
      this.viewport.reset()
    }

    // 清除画布内容
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height)

    // 如果保留图片，重新渲染
    if (keepImage && this.bgImage) {
      this.render()
    }

    // 更新光标
    if (this.drawType === "drag") {
      this.canvas.style.cursor = "default"
    }
  }

  /**
   * 清除所有标注但保留背景图片
   */
  public clearAnnotations(): void {
    this.clearCanvas(true, false)
  }

  /**
   * 获取当前所有标注数据
   */
  public getAnnotations(): Operate<Rect | Polygon | TextAnnotation>[] {
    return this.annotationManager.getAnnotations()
  }

  /**
   * 获取所有文本标注
   */
  public getTextAnnotations(): TextAnnotation[] {
    return this.textManager.getTextAnnotations()
  }

  /**
   * 导出原始尺寸标注图片
   */
  public exportAnnotationImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.bgImage) {
        reject(new Error("No background image loaded"))
        return
      }

      // 创建离屏 Canvas
      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = this.viewport.originalWidth
      offscreenCanvas.height = this.viewport.originalHeight
      const offscreenCtx = offscreenCanvas.getContext("2d")
      
      if (!offscreenCtx) {
        reject(new Error("Could not create offscreen canvas context"))
        return
      }

      const image = new Image()
      image.src = this.bgImageSrc
      image.crossOrigin = "anonymous"
      image.onload = () => {
        try {
          this.renderer.drawForExport(
            offscreenCtx,
            image,
            this.viewport.originalWidth,
            this.viewport.originalHeight
          )
          const base64 = offscreenCanvas.toDataURL(`image/${this.bgImageExt}`, 0.7)
          resolve(base64)
        } catch (e) {
          this.exportCurrentViewImage()
            .then(resolve)
            .catch((err) => reject(new Error(`Both methods failed: ${err.message}`)))
        }
      }
      image.onerror = () => {
        reject(new Error("Failed to load image for export"))
      }
    })
  }

  /**
   * 导出当前视图为 base64 图片
   */
  public exportCurrentViewImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const base64 = this.canvas.toDataURL(`image/${this.bgImageExt}`)
        resolve(base64)
      } catch (e: any) {
        reject(new Error(`Failed to export current view: ${e.message}`))
      }
    })
  }

  /**
   * 将 base64 转换为 File 对象
   */
  public base64ToFile(base64Data: string, filename: string): File {
    return base64ToFile(base64Data, filename)
  }

  /**
   * 将 base64 转换为 Blob 对象（静态方法）
   */
  public static base64ToBlob(base64: string): Promise<Blob> {
    return base64ToBlob(base64)
  }

  // ==================== 文本标注 API ====================

  /**
   * 添加文本标注
   * @param x - 图像坐标 X
   * @param y - 图像坐标 Y
   * @param text - 初始文本（可选，默认为空字符串）
   */
  public addTextAnnotation(x: number, y: number, text: string = ""): void {
    this.textManager.addTextAnnotation(x, y, text)
    this.render()
  }

  /**
   * 更新文本标注内容
   * @param index - 文本标注索引
   * @param text - 新文本内容
   */
  public updateTextAnnotation(index: number, text: string): void {
    if (this.textManager.updateTextAnnotation(index, text)) {
      this.render()
    }
  }

  /**
   * 移动文本标注位置
   * @param index - 文本标注索引
   * @param x - 新位置 X（图像坐标）
   * @param y - 新位置 Y（图像坐标）
   */
  public moveTextAnnotation(index: number, x: number, y: number): void {
    if (this.textManager.moveTextAnnotation(index, x, y)) {
      this.render()
    }
  }

  /**
   * 删除文本标注
   * @param index - 文本标注索引
   */
  public removeTextAnnotation(index: number): void {
    if (this.textManager.removeTextAnnotation(index)) {
      this.render()
    }
  }

  /**
   * 清除所有文本标注
   */
  public clearTextAnnotations(): void {
    this.textManager.clearTextAnnotations()
    this.render()
  }

  // ==================== 标注选中与移动 API ====================

  /**
   * 选中指定索引的标注
   * @param index - 标注索引
   */
  public selectAnnotation(index: number): void {
    if (this.annotationManager.selectAnnotation(index)) {
      this.render()
    }
  }

  /**
   * 取消选中
   */
  public deselectAnnotation(): void {
    this.annotationManager.deselectAnnotation()
    this.textManager.deselectTextAnnotation()
    this.textManager.editingTextIndex = null
    this.render()
  }

  /**
   * 获取当前选中的标注信息
   */
  public getSelectedAnnotation(): { index: number; type: "rect" | "polygon" | "text"; data: Operate<Rect | Polygon> | TextAnnotation } | null {
    // 优先返回矩形/多边形的选中
    const shapeSelected = this.annotationManager.getSelectedAnnotation()
    if (shapeSelected) return shapeSelected
    
    // 返回文本标注的选中
    const textSelected = this.textManager.getSelectedTextAnnotation()
    if (textSelected) {
      return {
        index: textSelected.index,
        type: "text",
        data: textSelected.data
      }
    }
    return null
  }

  /**
   * 删除选中的标注
   */
  public deleteSelectedAnnotation(): void {
    // 优先删除选中的文本标注
    if (this.textManager.selectedTextIndex !== null) {
      this.textManager.deleteSelectedTextAnnotation()
      this.render()
      return
    }
    // 删除选中的矩形/多边形标注
    if (this.annotationManager.deleteSelectedAnnotation()) {
      this.render()
    }
  }

  /**
   * 移动选中的标注
   * @param dx - X 方向移动距离
   * @param dy - Y 方向移动距离
   */
  public moveSelectedAnnotation(dx: number, dy: number): void {
    if (this.annotationManager.moveSelectedAnnotation(dx, dy)) {
      this.render()
    }
  }

  // ==================== 颜色配置 API ====================

  /**
   * 设置标注颜色配置
   * 新设置的样式只影响之后创建的标注
   * 如果当前有选中的标注，会实时预览新样式（但不会保存，除非调用 updateSelectedAnnotationStyle）
   * @param color - 颜色字符串或颜色配置对象
   * @example
   * // 设置所有标注为同一种颜色
   * drawer.setAnnotationColor('#FF0000')
   * 
   * // 为不同类型设置不同颜色
   * drawer.setAnnotationColor({
   *   rect: '#FF0000',
   *   polygon: '#00FF00',
   *   default: '#0000FF'
   * })
   */
  public setAnnotationColor(color: string | ColorConfig): void {
    this.annotationManager.setColorConfig(color)
    this.render()
  }

  /**
   * 获取当前颜色配置
   */
  public getAnnotationColor(): ColorConfig {
    return this.annotationManager.getColorConfig()
  }

  /**
   * 更新选中标注的样式为当前设置的样式
   * 调用此方法后，选中的标注会保存当前的新样式
   */
  public updateSelectedAnnotationStyle(): boolean {
    const selected = this.annotationManager.selectedAnnotation
    if (!selected) return false

    const annotation = this.annotationManager.recordList[selected.index]
    if (!annotation) return false

    // 更新标注的样式为当前样式
    annotation.style = this.annotationManager.getCurrentStyle()
    this.render()
    return true
  }

  // ==================== 边线和顶点样式 API ====================

  /**
   * 设置边线样式
   * @param style - 边线样式：'solid' | 'dashed' | 'dotted'
   */
  public setLineStyle(style: LineStyle): void {
    this.annotationManager.setLineStyle(style)
    this.render()
  }

  /**
   * 获取当前边线样式
   */
  public getLineStyle(): LineStyle {
    return this.annotationManager.getLineStyle()
  }

  /**
   * 设置顶点样式
   * @param style - 顶点样式配置
   * @example
   * drawer.setVertexStyle({
   *   size: 10,
   *   fillColor: '#FF0000',
   *   strokeColor: '#FFFFFF',
   *   strokeWidth: 2,
   *   shape: 'circle' // 'circle' | 'square' | 'diamond'
   * })
   */
  public setVertexStyle(style: Partial<VertexStyle>): void {
    this.annotationManager.setVertexStyle(style)
    this.render()
  }

  /**
   * 获取当前顶点样式
   */
  public getVertexStyle(): VertexStyle {
    return this.annotationManager.getVertexStyle()
  }

  // ==================== 文本样式 API ====================

  /**
   * 设置文本标注样式
   * @param style - 文本样式配置
   * @example
   * drawer.setTextStyle({
   *   font: '16px Arial',
   *   color: '#FFD700',
   *   backgroundColor: 'rgba(0,0,0,0.6)'
   * })
   */
  public setTextStyle(style: Partial<TextStyle>): void {
    this.textManager.setTextStyle(style)
    this.render()
  }

  /**
   * 设置文本输入框样式
   * @param style - 输入框样式配置
   * @example
   * drawer.setTextInputStyle({
   *   border: '2px solid #00D9FF',
   *   borderRadius: '6px',
   *   backgroundColor: '#ffffff',
   *   color: '#333'
   * })
   */
  public setTextInputStyle(style: Partial<TextInputStyle>): void {
    this.textManager.setInputStyle(style)
  }

  /**
   * 设置文本标注选中态样式
   * @param style - 选中态样式配置
   * @example
   * drawer.setTextSelectionStyle({
   *   selectedBorderColor: '#00D9FF',
   *   selectedBackgroundColor: 'rgba(0,217,255,0.15)'
   * })
   */
  public setTextSelectionStyle(style: { selectedBorderColor?: string; selectedBackgroundColor?: string }): void {
    this.textManager.setSelectionStyle(style)
    this.render()
  }

  /**
   * 销毁 Drawer 实例，清理资源
   */
  public destroy(): void {
    // 清理文本输入框
    this.textManager.destroy()
    
    // 移除 Canvas
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas)
    }
  }
}

// 默认导出 Drawer 类，兼容原来的使用方式
export default Drawer
