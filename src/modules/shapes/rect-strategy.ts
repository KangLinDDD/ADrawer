/**
 * 矩形策略：矩形的形状特异逻辑（从 annotations.ts 提炼，行为逐字等价）
 * 策略无状态：所有读写通过 store 参数或 record 参数进行
 *
 * 对应源（annotations.ts）：
 * - startDrawing      ← startRectDrawing（clamp 已由 store 在调用前完成）
 * - updateDrawing     ← updateRectDrawing
 * - finishDrawing     ← finishRectDrawing（id/样式快照/清删除历史/通知由 store.pushRecord 完成）
 * - cancelDrawing     ← cancelDrawing 的 rect 行为（polygon ≥2 点保存分支不属于 rect）
 * - withdrawInProgress← withdraw 的 rect 分支（deleteHistory/recordList 回退由 store 编排）
 * - hitTest           ← getAnnotationAtPoint 的 rect 分支（isPointInRect）
 * - getHandles        ← getHandleAtPoint 的 rect 分支（画布坐标：offset + p*scale）
 * - move              ← moveSelectedAnnotation 的 rect 分支
 * - snapshotForResize ← startResizing 的 rect 快照（此处为深拷贝，语义等价且隔离性更强）
 * - resize            ← resizeRect（越过交换改为返回新 handle index，由调用方写回）
 */
import type { Point, Rect, Operate } from '../types'
import type { ViewportManager } from '../viewport'
import { isPointInRect } from '../utils'
import type { ShapeStrategy, StrategyStore, ResizeSnapshot } from './shape-strategy'

export class RectStrategy implements ShapeStrategy<Rect> {
  readonly type = 'rect' as const

  // ---- 绘制生命周期 ----

  startDrawing(store: StrategyStore, point: Point): void {
    store.isDrawing = true
    store.drawStartPoint = point
    store.operate = {
      type: "rect",
      data: [{ start: { ...point }, width: 0, height: 0 }],
      status: "pending",
    }
  }

  updateDrawing(store: StrategyStore, point: Point): void {
    if (!store.isDrawing || store.operate.type !== "rect") return
    const rect = store.operate.data[0] as Rect
    rect.width = point.x - store.drawStartPoint.x
    rect.height = point.y - store.drawStartPoint.y
  }

  /** rect 无加点语义，恒返回 false */
  addPoint(_store: StrategyStore, _point: Point): boolean {
    return false
  }

  finishDrawing(store: StrategyStore): boolean {
    if (!store.isDrawing || store.operate.type !== "rect") return false

    const rect = store.operate.data[0] as Rect
    // 过滤无效矩形（太小）
    if (Math.abs(rect.width) > 5 && Math.abs(rect.height) > 5) {
      // id 生成 / 样式快照 / 清删除历史 / notifyChange('create') 统一由 store.pushRecord 完成
      store.pushRecord({ ...store.operate })
    }

    store.operate.data = []
    store.isDrawing = false
    return true
  }

  cancelDrawing(store: StrategyStore): void {
    store.operate.data = []
    store.isDrawing = false
    store.tempPolygonPoint = null
  }

  withdrawInProgress(store: StrategyStore): boolean {
    if (store.operate.data.length === 0) return false
    store.operate.data = []
    store.isDrawing = false
    return true
  }

  // ---- 已完成记录的交互 ----

  hitTest(record: Operate<Rect>, imgCoords: Point): boolean {
    return isPointInRect(imgCoords, record.data[0])
  }

  /** 返回画布坐标系控制点列表（handleSize 由调用方用于命中判定，此处不参与计算） */
  getHandles(record: Operate<Rect>, viewport: ViewportManager, _handleSize: number): { x: number; y: number; index: number }[] {
    const rect = record.data[0]
    const x = viewport.offset.x + rect.start.x * viewport.scale
    const y = viewport.offset.y + rect.start.y * viewport.scale
    const w = rect.width * viewport.scale
    const h = rect.height * viewport.scale

    // 四个角的控制点
    return [
      { x: x, y: y, index: 0 },
      { x: x + w, y: y, index: 1 },
      { x: x, y: y + h, index: 2 },
      { x: x + w, y: y + h, index: 3 },
    ]
  }

  move(record: Operate<Rect>, dx: number, dy: number): void {
    const rect = record.data[0]
    rect.start.x += dx
    rect.start.y += dy
  }

  /** 拍摄 resize 前快照（深拷贝：Rect.start 为嵌套对象，展开复制） */
  snapshotForResize(record: Operate<Rect>): ResizeSnapshot {
    const rect = record.data[0]
    return { start: { ...rect.start }, width: rect.width, height: rect.height }
  }

  /**
   * 执行 resize；越过固定角点时返回交换后的新 handle index（由调用方写回 activeHandle.index），
   * 否则返回 undefined。快照在每次调用末尾同步为当前矩形，供连续拖拽使用。
   */
  resize(record: Operate<Rect>, handleIndex: number, currentPoint: Point, snapshot: ResizeSnapshot): number | undefined {
    const rect = record.data[0]
    const original = snapshot as Rect

    // 原始矩形的四个角坐标
    const origLeft = original.start.x
    const origRight = original.start.x + original.width
    const origTop = original.start.y
    const origBottom = original.start.y + original.height

    // 根据当前控制点索引确定固定点
    let fixedX: number, fixedY: number
    switch (handleIndex) {
      case 0: fixedX = origRight; fixedY = origBottom; break
      case 1: fixedX = origLeft; fixedY = origBottom; break
      case 2: fixedX = origRight; fixedY = origTop; break
      case 3: fixedX = origLeft; fixedY = origTop; break
      default: return undefined
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

    // 根据新的矩形边界，计算交换后的控制点索引（实现越过交换）
    const isLeft = currentPoint.x < fixedX
    const isTop = currentPoint.y < fixedY

    let newHandleIndex: number | undefined
    if (handleIndex === 0) {
      if (!isLeft && !isTop) newHandleIndex = 3
      else if (!isLeft && isTop) newHandleIndex = 1
      else if (isLeft && !isTop) newHandleIndex = 2
    } else if (handleIndex === 1) {
      if (isLeft && !isTop) newHandleIndex = 2
      else if (isLeft && isTop) newHandleIndex = 0
      else if (!isLeft && !isTop) newHandleIndex = 3
    } else if (handleIndex === 2) {
      if (!isLeft && isTop) newHandleIndex = 1
      else if (isLeft && isTop) newHandleIndex = 0
      else if (!isLeft && !isTop) newHandleIndex = 3
    } else if (handleIndex === 3) {
      if (isLeft && isTop) newHandleIndex = 0
      else if (!isLeft && isTop) newHandleIndex = 1
      else if (isLeft && !isTop) newHandleIndex = 2
    }

    // 更新快照为当前矩形，为下次拖拽做准备
    original.start.x = rect.start.x
    original.start.y = rect.start.y
    original.width = rect.width
    original.height = rect.height

    return newHandleIndex
  }

  // ---- 渲染所需的只读信息 ----

  /** 标题/导出参考边界：rect 用自身 start/width/height */
  getBounds(record: Operate<Rect>): { x: number; y: number; width: number; height: number } {
    const rect = record.data[0]
    return { x: rect.start.x, y: rect.start.y, width: rect.width, height: rect.height }
  }
}

/** 策略无状态，导出单例 */
export const rectStrategy = new RectStrategy()
