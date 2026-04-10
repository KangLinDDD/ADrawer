/**
 * 事件处理模块
 * 负责所有用户交互事件的处理
 */

import type { DrawType, Point } from './types'
import type { ViewportManager } from './viewport'
import type { AnnotationManager } from './annotations'
import type { TextAnnotationManager } from './text-annotation'
import type { Renderer } from './renderer'
import { getZoomDelta } from './utils'

export class EventHandler {
  // 拖拽状态
  public isDragging = false
  public dragStart: Point = { x: 0, y: 0 }

  // 防止移动/调整大小后触发 click 绘制
  public justFinishedMove = false
  
  // 防止取消选中后触发 click 绘制
  public justDeselected = false

  constructor(
    private canvas: HTMLCanvasElement,
    private viewport: ViewportManager,
    private annotationManager: AnnotationManager,
    private textManager: TextAnnotationManager,
    private renderer: Renderer,
    private getDrawType: () => DrawType,
    private getBgImage: () => HTMLImageElement | null,
    private renderCallback: () => void,
    private setDrawTypeCallback: (type: DrawType) => void
  ) {}

  /**
   * 处理滚轮缩放
   */
  handleWheel(e: WheelEvent): void {
    e.preventDefault()
    if (!this.getBgImage()) return

    const delta = e.deltaY > 0 ? -0.02 : 0.02
    const oldScale = this.viewport.scale
    const newScale = Math.max(this.viewport.minScale, Math.min(oldScale + delta, this.viewport.maxScale))

    // 计算缩放中心（鼠标位置）
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // 计算缩放前鼠标点在图像中的位置
    const imgX = (mouseX - this.viewport.offset.x) / oldScale
    const imgY = (mouseY - this.viewport.offset.y) / oldScale

    // 更新缩放比例
    this.viewport.scale = newScale

    // 计算缩放后鼠标点应该的位置
    const newMouseX = imgX * newScale + this.viewport.offset.x
    const newMouseY = imgY * newScale + this.viewport.offset.y

    // 调整偏移量以保持鼠标点不变
    this.viewport.offset.x += mouseX - newMouseX
    this.viewport.offset.y += mouseY - newMouseY

    // 更新边界约束
    this.viewport.calculateBoundaries()
    this.viewport.constrainViewport()

    // 缩放后不再是初始状态
    this.viewport.isInitialScale = this.viewport.scale === this.viewport.initialScale

    this.renderCallback()
  }

  /**
   * 处理鼠标按下
   */
  handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return // 只处理左键

    const drawType = this.getDrawType()
    const bgImage = this.getBgImage()

    // 优先处理：如果有选中的标注，检查是否点击了控制点
    if (this.annotationManager.selectedAnnotation && bgImage) {
      const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.annotationManager.startResizing(handle, imgCoords)
        this.renderCallback()
        return
      }
    }

    // 文本标注模式
    if (drawType === "text") {
      // 先检查是否点击了已有文本（只选中，不直接移动）
      const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
      if (textIndex !== null) {
        // 如果点击的是已选中的文本，开始移动
        if (this.textManager.selectedTextIndex === textIndex) {
          this.textManager.startMoving(e, textIndex)
        } else {
          // 否则选中文本（取消其他选中）
          this.annotationManager.deselectAnnotation()
          this.textManager.selectTextAnnotation(textIndex)
        }
        this.renderCallback()
        return
      }
      
      // 文本模式下也可以选中其他标注
      if (bgImage) {
        const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
        
        // 检查矩形
        const rectClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
        if (rectClicked?.type === "rect") {
          this.annotationManager.selectAnnotation(rectClicked.index)
          this.annotationManager.startMovingAnnotation(e)
          this.renderCallback()
          return
        }
        
        // 检查多边形
        const polygonClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
        if (polygonClicked?.type === "polygon") {
          this.annotationManager.selectAnnotation(polygonClicked.index)
          this.annotationManager.startMovingAnnotation(e)
          this.renderCallback()
          return
        }
        
        // 如果点击了空白处且有选中的标注，取消选中
        if (this.annotationManager.selectedAnnotation) {
          this.annotationManager.deselectAnnotation()
          this.renderCallback()
          return
        }
      }
      
      // 如果点击了空白处且有选中的文本标注，取消选中
      if (this.textManager.selectedTextIndex !== null) {
        this.textManager.deselectTextAnnotation()
        this.renderCallback()
        return
      }
      
      // 没有点击任何标注，创建新文本
      this.handleTextModeClick(e)
      return
    }

    // 其他模式需要背景图片
    if (!bgImage) return

    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)

    if (drawType === "rect") {
      // 矩形模式：优先检测是否点击了任何标注（可以选中并移动）
      
      // 如果当前有选中的矩形，优先处理选中状态
      if (this.annotationManager.selectedAnnotation?.type === "rect") {
        // 检查是否点击了控制点
        const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          this.annotationManager.startResizing(handle, imgCoords)
          this.renderCallback()
          return
        }
        
        // 检查是否点击到已有矩形（可能是另一个矩形）
        const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
        if (clicked && clicked.type === "rect") {
          this.annotationManager.selectAnnotation(clicked.index)
          this.annotationManager.startMovingAnnotation(e)
          this.renderCallback()
          return
        }
        
        // 点击空白处，取消选中，不开始新矩形
        this.annotationManager.deselectAnnotation()
        this.justDeselected = true
        this.renderCallback()
        return
      }
      
      // 没有选中的矩形，可以选中其他类型标注或开始新矩形
      
      // 1. 先检查文本（只选中，不直接移动）
      const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
      if (textIndex !== null) {
        // 如果点击的是已选中的文本，开始移动
        if (this.textManager.selectedTextIndex === textIndex) {
          this.textManager.startMoving(e, textIndex)
        } else {
          // 否则选中文本（取消其他选中）
          this.annotationManager.deselectAnnotation()
          this.textManager.selectTextAnnotation(textIndex)
        }
        this.renderCallback()
        return
      }

      // 2. 检查多边形
      const polygonClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
      if (polygonClicked?.type === "polygon") {
        this.annotationManager.selectAnnotation(polygonClicked.index)
        this.annotationManager.startMovingAnnotation(e)
        this.renderCallback()
        return
      }

      // 3. 检查矩形（选中它）
      const rectClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
      if (rectClicked?.type === "rect") {
        this.annotationManager.selectAnnotation(rectClicked.index)
        this.annotationManager.startMovingAnnotation(e)
        this.renderCallback()
        return
      }

      // 开始绘制新矩形
      this.annotationManager.startRectDrawing(imgCoords)
    } else if (drawType === "polygon") {
      // 多边形模式：优先检测是否点击了任何标注（可以选中并移动）
      
      // 如果当前有选中的多边形，优先处理选中状态
      if (this.annotationManager.selectedAnnotation?.type === "polygon") {
        // 检查是否点击了顶点
        const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle && handle.type === "polygon-vertex") {
          this.annotationManager.startResizing(handle, imgCoords)
          this.renderCallback()
          return
        }
        
        // 检查是否点击到已有多边形（可能是另一个多边形）
        const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
        if (clicked && clicked.type === "polygon") {
          this.annotationManager.selectAnnotation(clicked.index)
          this.annotationManager.startMovingAnnotation(e)
          this.renderCallback()
          return
        }
        
        // 点击空白处，取消选中，不开始新多边形
        this.annotationManager.deselectAnnotation()
        this.justDeselected = true
        this.renderCallback()
        return
      }
      
      // 没有选中的多边形，可以选中其他类型标注或开始新多边形
      
      // 1. 先检查文本（只选中，不直接移动）
      const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
      if (textIndex !== null) {
        // 如果点击的是已选中的文本，开始移动
        if (this.textManager.selectedTextIndex === textIndex) {
          this.textManager.startMoving(e, textIndex)
        } else {
          // 否则选中文本（取消其他选中）
          this.annotationManager.deselectAnnotation()
          this.textManager.selectTextAnnotation(textIndex)
        }
        this.renderCallback()
        return
      }

      // 2. 检查矩形
      const rectClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
      if (rectClicked?.type === "rect") {
        this.annotationManager.selectAnnotation(rectClicked.index)
        this.annotationManager.startMovingAnnotation(e)
        this.renderCallback()
        return
      }

      // 3. 检查多边形（选中它）
      const polyClicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
      if (polyClicked?.type === "polygon") {
        this.annotationManager.selectAnnotation(polyClicked.index)
        this.annotationManager.startMovingAnnotation(e)
        this.renderCallback()
        return
      }

      // 开始绘制新多边形
      if (!this.annotationManager.isDrawing) {
        this.annotationManager.startPolygonDrawing(imgCoords)
      } else if (this.checkPolygonPointValid(imgCoords)) {
        this.annotationManager.addPolygonPoint(imgCoords)
      }
      this.annotationManager.updatePolygonTempPoint(imgCoords)
      this.renderCallback()
    } else if (drawType === "drag") {
      // 拖拽模式
      if (this.annotationManager.selectedAnnotation) {
        const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          this.annotationManager.startResizing(handle, imgCoords)
          this.renderCallback()
          return
        }
      }

      // 检查文本（只选中，不直接移动）
      const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
      if (textIndex !== null) {
        // 如果点击的是已选中的文本，开始移动
        if (this.textManager.selectedTextIndex === textIndex) {
          this.textManager.startMoving(e, textIndex)
        } else {
          // 否则选中文本（取消其他选中）
          this.annotationManager.deselectAnnotation()
          this.textManager.selectTextAnnotation(textIndex)
        }
        this.renderCallback()
        return
      }

      // 检查矩形
      const rectHandled = this.handleRectModeClick(e, imgCoords)
      if (rectHandled) return

      // 检查多边形
      const polygonHandled = this.handlePolygonModeClick(e, imgCoords)
      if (polygonHandled) return

      // 开始拖拽视图
      this.isDragging = true
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.canvas.style.cursor = "grabbing"
    } else if (drawType === "") {
      // 无模式：可以选中和编辑所有类型的标注
      this.handleNoModeClick(e, imgCoords)
    }
  }

  /**
   * 拖拽模式下检查文本点击
   */
  private checkTextClickInDragMode(e: MouseEvent): boolean {
    const result = this.textManager.checkTextClickForMove(e)
    if (result.handled) {
      this.canvas.style.cursor = "grabbing"
      return true
    }
    return false
  }

  /**
   * 文本模式下的点击处理
   */
  private handleTextModeClick(e: MouseEvent): boolean {
    // 检测是否点击了已有文本
    const clickedIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
    if (clickedIndex !== null) {
      this.textManager.startMoving(e, clickedIndex)
      this.canvas.style.cursor = "grabbing"
      this.renderCallback()
      return true
    }

    // 没有点击文本，创建新文本
    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    this.textManager.addTextAnnotation(imgCoords.x, imgCoords.y)
    return true
  }

  /**
   * 矩形模式下的点击处理
   */
  private handleRectModeClick(e: MouseEvent, imgCoords: Point): boolean {
    // 如果有选中的矩形，先检查是否点击了控制点
    if (this.annotationManager.selectedAnnotation?.type === "rect") {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.annotationManager.startResizing(handle, imgCoords)
        this.renderCallback()
        return true
      }
    }

    // 检测是否点击到已有矩形
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked && clicked.type === "rect") {
      this.annotationManager.selectAnnotation(clicked.index)
      this.annotationManager.startMovingAnnotation(e)
      this.renderCallback()
      return true
    }

    // 如果当前有选中的矩形，点击空白处取消选中并返回true（表示已处理）
    if (this.annotationManager.selectedAnnotation?.type === "rect") {
      this.annotationManager.deselectAnnotation()
      this.renderCallback()
      return true
    }

    // 没有选中矩形且没有点击到矩形，返回false让调用方继续处理
    return false
  }

  /**
   * 多边形模式下的点击处理
   */
  private handlePolygonModeClick(e: MouseEvent, imgCoords: Point): boolean {
    // 如果有选中的多边形，先检查是否点击了顶点
    if (this.annotationManager.selectedAnnotation?.type === "polygon") {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle && handle.type === "polygon-vertex") {
        this.annotationManager.startResizing(handle, imgCoords)
        this.renderCallback()
        return true
      }
    }

    // 检测是否点击到已有多边形
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked && clicked.type === "polygon") {
      this.annotationManager.selectAnnotation(clicked.index)
      this.annotationManager.startMovingAnnotation(e)
      this.renderCallback()
      return true
    }

    // 如果当前有选中的多边形，点击空白处取消选中并返回true（表示已处理）
    if (this.annotationManager.selectedAnnotation?.type === "polygon") {
      this.annotationManager.deselectAnnotation()
      this.renderCallback()
      return true
    }

    // 没有选中多边形且没有点击到多边形，返回false让调用方继续处理
    return false
  }

  /**
   * 纯移动检测：检测是否点击了矩形
   */
  private handleRectModeClickForMove(e: MouseEvent, imgCoords: Point): boolean {
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked && clicked.type === "rect") {
      this.annotationManager.selectAnnotation(clicked.index)
      this.annotationManager.startMovingAnnotation(e)
      this.renderCallback()
      return true
    }
    return false
  }

  /**
   * 纯移动检测：检测是否点击了多边形
   */
  private handlePolygonModeClickForMove(e: MouseEvent, imgCoords: Point): boolean {
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked && clicked.type === "polygon") {
      this.annotationManager.selectAnnotation(clicked.index)
      this.annotationManager.startMovingAnnotation(e)
      this.renderCallback()
      return true
    }
    return false
  }

  /**
   * 无模式下的点击处理
   */
  private handleNoModeClick(e: MouseEvent, imgCoords: Point): void {
    // 先检查是否点击了文本
    const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
    if (textIndex !== null) {
      // 如果点击的是已选中的文本，开始移动
      if (this.textManager.selectedTextIndex === textIndex) {
        this.textManager.startMoving(e, textIndex)
      } else {
        // 否则选中文本（取消其他选中）
        this.annotationManager.deselectAnnotation()
        this.textManager.selectTextAnnotation(textIndex)
      }
      this.renderCallback()
      return
    }

    // 取消文本选中
    this.textManager.deselectTextAnnotation()

    // 再检查是否点击了矩形/多边形
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked) {
      this.annotationManager.selectAnnotation(clicked.index)
      this.annotationManager.startMovingAnnotation(e)
      this.renderCallback()
    } else {
      this.annotationManager.deselectAnnotation()
    }
  }

  /**
   * 检查多边形点是否有效（避免重复点）
   */
  private checkPolygonPointValid(imgCoords: Point): boolean {
    const lastPoint = this.annotationManager.operate.data.length > 0
      ? this.annotationManager.operate.data[this.annotationManager.operate.data.length - 1] as { point: Point }
      : null

    return (
      !lastPoint ||
      Math.abs(lastPoint.point.x - imgCoords.x) > 5 ||
      Math.abs(lastPoint.point.y - imgCoords.y) > 5
    )
  }

  /**
   * 处理鼠标移动
   */
  handleMouseMove(e: MouseEvent): void {
    if (!this.getBgImage()) return

    const drawType = this.getDrawType()

    // 处理视图拖拽
    if (this.isDragging && drawType === "drag") {
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y
      this.viewport.updateOffset(dx, dy)
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.renderCallback()
      return
    }

    // 处理文本移动
    if (this.textManager.isTextMoving && this.textManager.editingTextIndex !== null) {
      if (this.textManager.moveAnnotation(e)) {
        this.renderCallback()
      }
      return
    }

    // 处理标注移动或调整大小
    if ((this.annotationManager.isMovingAnnotation || this.annotationManager.isResizing) && 
        this.annotationManager.selectedAnnotation) {
      this.handleAnnotationMove(e)
      return
    }

    // 更新光标样式
    if (!this.annotationManager.isMovingAnnotation && 
        !this.annotationManager.isResizing && 
        !this.textManager.isTextMoving) {
      this.updateCursor(e)
    }

    // 处理矩形绘制
    if (this.annotationManager.isDrawing && this.annotationManager.operate.type === "rect") {
      const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
      this.annotationManager.updateRectDrawing(imgCoords)
      this.renderCallback()
    }

    // 处理多边形临时点
    if (drawType === "polygon" && this.annotationManager.isDrawing) {
      const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
      this.annotationManager.updatePolygonTempPoint(imgCoords)
      this.renderCallback()
    }
  }

  /**
   * 处理标注移动或调整大小
   */
  private handleAnnotationMove(e: MouseEvent): void {
    // 处理调整大小
    if (this.annotationManager.isResizing && this.annotationManager.activeHandle) {
      const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)

      if (this.annotationManager.selectedAnnotation?.type === "rect") {
        this.annotationManager.resizeRect(imgCoords)
      } else if (this.annotationManager.selectedAnnotation?.type === "polygon") {
        this.annotationManager.resizePolygon(imgCoords)
      }

      this.renderCallback()
      return
    }

    // 处理移动
    if (!this.annotationManager.isMovingAnnotation || !this.annotationManager.selectedAnnotation) return

    const dx = (e.clientX - this.annotationManager.annotationMoveStart.x) / this.viewport.scale
    const dy = (e.clientY - this.annotationManager.annotationMoveStart.y) / this.viewport.scale

    this.annotationManager.moveSelectedAnnotation(dx, dy)
    this.annotationManager.annotationMoveStart = { x: e.clientX, y: e.clientY }
    this.renderCallback()
  }

  /**
   * 更新鼠标光标样式
   */
  private updateCursor(e: MouseEvent): void {
    const drawType = this.getDrawType()

    // 文本模式
    if (drawType === "text") {
      // 文本模式下也可以悬停其他标注
      if (this.getBgImage()) {
        const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
        
        // 检查控制点
        if (this.annotationManager.selectedAnnotation) {
          const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
          if (handle) {
            if (handle.type === "rect-corner") {
              this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
            } else {
              this.canvas.style.cursor = "crosshair"
            }
            return
          }
        }
        
        // 检查矩形/多边形
        const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
        if (clicked) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      
      // 检查文本
      const clickedIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
      this.canvas.style.cursor = clickedIndex !== null ? "move" : "crosshair"
      return
    }

    // 矩形模式
    if (drawType === "rect") {
      this.updateRectModeCursor(e)
      return
    }

    // 多边形模式
    if (drawType === "polygon") {
      this.updatePolygonModeCursor(e)
      return
    }

    // 拖拽模式
    if (drawType === "drag") {
      this.updateDragModeCursor(e)
      return
    }

    // 无模式
    if (drawType === "") {
      this.updateNoModeCursor(e)
      return
    }

    this.canvas.style.cursor = "default"
  }

  /**
   * 更新矩形模式光标
   */
  private updateRectModeCursor(e: MouseEvent): void {
    // 先检查控制点
    if (this.annotationManager.selectedAnnotation?.type === "rect") {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
        return
      }
    }

    // 检查是否在矩形上
    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked) {
      this.canvas.style.cursor = "move"
      return
    }

    // 检查文本
    if (this.textManager.checkTextClick(e.offsetX, e.offsetY) !== null) {
      this.canvas.style.cursor = "move"
      return
    }

    this.canvas.style.cursor = "crosshair"
  }

  /**
   * 更新多边形模式光标
   */
  private updatePolygonModeCursor(e: MouseEvent): void {
    // 先检查顶点
    if (this.annotationManager.selectedAnnotation?.type === "polygon") {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.canvas.style.cursor = "crosshair"
        return
      }
    }

    // 检查是否在多边形上
    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    if (clicked) {
      this.canvas.style.cursor = "move"
      return
    }

    // 检查文本
    if (this.textManager.checkTextClick(e.offsetX, e.offsetY) !== null) {
      this.canvas.style.cursor = "move"
      return
    }

    this.canvas.style.cursor = "crosshair"
  }

  /**
   * 更新拖拽模式光标
   */
  private updateDragModeCursor(e: MouseEvent): void {
    // 检查控制点
    if (this.annotationManager.selectedAnnotation) {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        if (handle.type === "rect-corner") {
          this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
        } else {
          this.canvas.style.cursor = "crosshair"
        }
        return
      }
    }

    // 检查文本
    if (this.textManager.checkTextClick(e.offsetX, e.offsetY) !== null) {
      this.canvas.style.cursor = "move"
      return
    }

    // 检查矩形/多边形
    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    this.canvas.style.cursor = clicked ? "move" : "grab"
  }

  /**
   * 更新无模式光标
   */
  private updateNoModeCursor(e: MouseEvent): void {
    // 检查控制点
    if (this.annotationManager.selectedAnnotation) {
      const handle = this.annotationManager.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        if (handle.type === "rect-corner") {
          this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
        } else {
          this.canvas.style.cursor = "crosshair"
        }
        return
      }
    }

    // 检查文本
    if (this.textManager.checkTextClick(e.offsetX, e.offsetY) !== null) {
      this.canvas.style.cursor = "move"
      return
    }

    // 检查矩形/多边形
    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    const clicked = this.annotationManager.getAnnotationAtPoint(imgCoords)
    this.canvas.style.cursor = clicked ? "move" : "default"
  }

  /**
   * 处理鼠标释放
   */
  handleMouseUp(e: MouseEvent): void {
    if (this.isDragging) {
      this.isDragging = false
      const drawType = this.getDrawType()
      this.canvas.style.cursor = drawType === "drag" ? "grab" : "default"
      return
    }

    if (this.textManager.isTextMoving) {
      this.justFinishedMove = true
      this.textManager.finishMoving()
      const drawType = this.getDrawType()
      if (drawType === "drag") {
        this.canvas.style.cursor = "grab"
      } else if (drawType === "") {
        this.canvas.style.cursor = "move"
      } else {
        this.textManager.editingTextIndex = null
        this.canvas.style.cursor = "default"
      }
    }

    // 结束标注移动或调整大小
    if (this.annotationManager.isMovingAnnotation || this.annotationManager.isResizing) {
      this.justFinishedMove = true
      this.annotationManager.finishMovingAnnotation()
      this.canvas.style.cursor = this.annotationManager.selectedAnnotation ? "move" : "default"
    }

    // 完成矩形绘制
    if (this.annotationManager.isDrawing && this.annotationManager.operate.type === "rect") {
      this.annotationManager.finishRectDrawing()
      this.renderCallback()
    }
  }

  /**
   * 处理鼠标离开
   */
  handleMouseLeave(e: MouseEvent): void {
    if (this.isDragging || this.textManager.isTextMoving || 
        this.annotationManager.isResizing || this.annotationManager.isMovingAnnotation) {
      this.handleMouseUp(e)
    }
    // 不再自动取消选中状态
  }

  /**
   * 处理鼠标双击
   */
  handleDoubleClick(e: MouseEvent): void {
    if (!this.getBgImage()) return

    // 清除 justFinishedMove 标志
    this.justFinishedMove = false

    // 优先检查是否双击了文本
    const textIndex = this.textManager.checkTextClick(e.offsetX, e.offsetY)
    if (textIndex !== null) {
      this.textManager.startEditing(textIndex)
      return
    }

    // 多边形模式下双击结束绘制
    const drawType = this.getDrawType()
    if (drawType === "polygon") {
      if (this.annotationManager.isDrawing && this.annotationManager.operate.data.length <= 2) {
        return
      }
      this.annotationManager.finishPolygonDrawing()
      this.renderCallback()
    }
  }

  /**
   * 处理鼠标单击（用于多边形绘制）
   */
  handleClick(e: MouseEvent): void {
    const drawType = this.getDrawType()
    if (!this.getBgImage() || drawType !== "polygon" || 
        this.isDragging || this.annotationManager.isMovingAnnotation || 
        this.annotationManager.isResizing || this.textManager.isTextMoving) {
      return
    }

    // 如果刚刚取消了选中，跳过绘制
    if (this.justDeselected) {
      this.justDeselected = false
      return
    }

    // 如果当前有选中的多边形，不开始新多边形
    if (this.annotationManager.selectedAnnotation?.type === "polygon") {
      return
    }

    const imgCoords = this.viewport.toImageCoordinates(e.offsetX, e.offsetY)
    
    if (this.checkPolygonPointValid(imgCoords)) {
      if (!this.annotationManager.isDrawing) {
        this.annotationManager.startPolygonDrawing(imgCoords)
      } else {
        this.annotationManager.addPolygonPoint(imgCoords)
      }
    }

    this.annotationManager.updatePolygonTempPoint(imgCoords)
    this.renderCallback()
  }

  /**
   * 处理键盘按下
   */
  handleKeyDown(e: KeyboardEvent): void {
    // 撤销操作
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      this.annotationManager.withdraw() || this.textManager.withdraw()
      this.renderCallback()
      return
    }

    // 空格键重置视图
    if (e.key === " ") {
      this.viewport.resetToInitial()
      this.renderCallback()
      return
    }

    // ESC键
    if (e.key === "Escape") {
      if (this.annotationManager.isDrawing) {
        this.annotationManager.cancelDrawing()
        this.renderCallback()
      } else if (this.annotationManager.selectedAnnotation) {
        this.annotationManager.deselectAnnotation()
        this.renderCallback()
      }
      return
    }

    // Delete 键删除选中的标注
    if (e.key === "Delete" || e.key === "Backspace") {
      // 优先删除正在编辑的文本标注
      if (this.textManager.editingTextIndex !== null) {
        this.textManager.removeTextAnnotation(this.textManager.editingTextIndex)
        this.renderCallback()
        return
      }
      // 删除选中的文本标注（非编辑状态）
      if (this.textManager.selectedTextIndex !== null) {
        this.textManager.deleteSelectedTextAnnotation()
        this.renderCallback()
        return
      }
      // 删除选中的矩形/多边形标注
      if (this.annotationManager.selectedAnnotation) {
        this.annotationManager.deleteSelectedAnnotation()
        this.renderCallback()
      }
    }
  }
}
