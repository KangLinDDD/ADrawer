/**
 * 标注管理模块（兼容层）
 * 继承 AnnotationStore 获得全部共享状态与共享方法，
 * 形状特异方法在此按类型委托给 ShapeStrategy（见 shapes/ 目录与 registry.ts）。
 * 公共 API（构造签名、方法签名、字段名、通知时机）与原实现完全一致。
 */

import type {
  Rect,
  Polygon,
  Point,
  SelectedAnnotation,
  ActiveHandle,
} from './types'
import { AnnotationStore } from './annotation-store'

export class AnnotationManager extends AnnotationStore {
  /**
   * 开始绘制矩形
   */
  startRectDrawing(startPoint: Point): void {
    startPoint = this.clampToImageBounds(startPoint)
    this.strategyOf('rect').startDrawing(this, startPoint)
  }

  /**
   * 更新矩形绘制
   */
  updateRectDrawing(currentPoint: Point): void {
    if (!this.isDrawing || this.operate.type !== "rect") return
    currentPoint = this.clampToImageBounds(currentPoint)
    this.strategyOf('rect').updateDrawing(this, currentPoint)
  }

  /**
   * 完成矩形绘制
   */
  finishRectDrawing(): boolean {
    return this.strategyOf('rect').finishDrawing(this)
  }

  /**
   * 开始绘制多边形
   */
  startPolygonDrawing(startPoint: Point): void {
    startPoint = this.clampToImageBounds(startPoint)
    this.strategyOf('polygon').startDrawing(this, startPoint)
  }

  /**
   * 添加多边形点
   */
  addPolygonPoint(point: Point): boolean {
    if (!this.isDrawing || this.operate.type !== "polygon") return false
    point = this.clampToImageBounds(point)
    return this.strategyOf('polygon').addPoint(this, point)
  }

  /**
   * 更新多边形临时点
   */
  updatePolygonTempPoint(point: Point): void {
    this.strategyOf('polygon').updateDrawing(this, this.clampToImageBounds(point))
  }

  /**
   * 完成多边形绘制
   */
  finishPolygonDrawing(): boolean {
    return this.strategyOf('polygon').finishDrawing(this)
  }

  /**
   * 取消当前绘制（按 operate.type 分发；polygon ≥2 点保存入库的行为在策略内；
   * 非 polygon 一律按 rect 语义复位，与原实现的尾部三行一致）
   */
  cancelDrawing(): void {
    const type = this.operate.type === 'polygon' ? 'polygon' : 'rect'
    this.strategyOf(type).cancelDrawing(this)
  }

  /**
   * 移动选中的标注
   */
  moveSelectedAnnotation(dx: number, dy: number): boolean {
    if (!this.selectedAnnotation) return false

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return false

    this.strategyOf(annotation.type as 'rect' | 'polygon').move(annotation, dx, dy)
    return true
  }

  /**
   * 开始调整大小（拍摄一次 resize 快照；拖拽期间策略原地同步快照，store 不重拍）
   */
  startResizing(handle: ActiveHandle, _startPoint: Point): boolean {
    if (!this.selectedAnnotation) return false

    this.activeHandle = handle
    this.isResizing = true

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (annotation.type === "rect") {
      this.originalRect = this.strategyOf('rect').snapshotForResize(annotation) as Rect
    } else if (annotation.type === "polygon") {
      this.originalPolygon = this.strategyOf('polygon').snapshotForResize(annotation) as Polygon[]
    }

    return true
  }

  /**
   * 调整矩形大小（策略返回越过交换后的新 handle index 时写回 activeHandle.index）
   */
  resizeRect(currentPoint: Point): boolean {
    if (!this.selectedAnnotation || this.selectedAnnotation.type !== "rect" || !this.originalRect || !this.activeHandle) {
      return false
    }
    // 与原实现一致：handle index 非 0-3（四角）时不动作
    if (this.activeHandle.index < 0 || this.activeHandle.index > 3) {
      return false
    }

    const annotation = this.recordList[this.selectedAnnotation.index]
    const newHandleIndex = this.strategyOf('rect').resize(annotation, this.activeHandle.index, currentPoint, this.originalRect)
    if (typeof newHandleIndex === 'number') {
      this.activeHandle.index = newHandleIndex
    }
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
    const vertexIndex = this.activeHandle.index
    const polygon = annotation.data as Polygon[]

    // 与原实现一致：顶点索引越界时不动作
    if (vertexIndex < 0 || vertexIndex >= polygon.length) {
      return false
    }

    this.strategyOf('polygon').resize(annotation, vertexIndex, currentPoint, this.originalPolygon ?? [])
    return true
  }

  /**
   * 获取点击位置对应的标注（倒序遍历，优先上层）
   */
  getAnnotationAtPoint(imgCoords: Point): SelectedAnnotation | null {
    // 从后往前遍历，优先选中上层标注
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]
      const type = annotation.type as 'rect' | 'polygon'
      if (this.strategyOf(type).hitTest(annotation, imgCoords)) {
        return { index: i, type }
      }
    }

    return null
  }

  /**
   * 获取点击位置的控制点（命中判定在 store：控制点画布坐标 ± handleSize/2）
   */
  getHandleAtPoint(offsetX: number, offsetY: number): ActiveHandle | null {
    if (!this.selectedAnnotation) return null
    // 锁定选中态：无控制点（无 resize 入口）
    if (this.selectedAnnotation.locked === true) return null

    const annotation = this.recordList[this.selectedAnnotation.index]
    const handleSize = this.selectionStyle.handleSize
    const halfHandle = handleSize / 2
    const type = this.selectedAnnotation.type as 'rect' | 'polygon'

    const handles = this.strategyOf(type).getHandles(annotation, this.viewport, handleSize)
    for (const handle of handles) {
      if (
        offsetX >= handle.x - halfHandle &&
        offsetX <= handle.x + halfHandle &&
        offsetY >= handle.y - halfHandle &&
        offsetY <= handle.y + halfHandle
      ) {
        return type === "rect"
          ? { type: "rect-corner", index: handle.index }
          : { type: "polygon-vertex", index: handle.index }
      }
    }

    return null
  }
}
