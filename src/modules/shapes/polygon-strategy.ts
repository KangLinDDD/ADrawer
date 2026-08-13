/**
 * 多边形策略：多边形的形状特异逻辑（从 annotations.ts 提炼，行为逐字等价）
 * 策略无状态：所有读写通过 store 参数或 record 参数进行
 *
 * 对应源（annotations.ts）：
 * - startDrawing      ← startPolygonDrawing（clamp 已由 store 在调用前完成）
 * - addPoint          ← addPolygonPoint（±5px 去重：x 且 y 均 ≤5 才拒绝）
 * - updateDrawing     ← updatePolygonTempPoint
 * - finishDrawing     ← finishPolygonDrawing（≥3 点入库；<3 点复位不入库；恒返回 true 语义保持）
 * - cancelDrawing     ← cancelDrawing 的 polygon 分支（≥2 点保存入库；<2 点丢弃；尾部三行复位）
 * - withdrawInProgress← withdraw 的 polygon 分支（逐点 pop，pop 空后 isDrawing=false；
 *                      deleteHistory/recordList 回退由 store 编排）
 * - hitTest           ← getAnnotationAtPoint 的 polygon 分支（isPointInPolygon）
 * - getHandles        ← getHandleAtPoint 的 polygon 分支（画布坐标：offset + p*scale）
 * - move              ← moveSelectedAnnotation 的 polygon 分支
 * - snapshotForResize ← 原 originalPolygon = data.map(p => ({ point: { ...p.point } }))
 * - resize            ← resizePolygon（直接改写顶点坐标；polygon 无控制点交换，恒返回 undefined）
 */
import type { Point, Polygon, Operate } from '../types'
import type { ViewportManager } from '../viewport'
import { isPointInPolygon } from '../utils'
import type { ShapeStrategy, StrategyStore, ResizeSnapshot } from './shape-strategy'

export class PolygonStrategy implements ShapeStrategy<Polygon> {
  readonly type = 'polygon' as const

  // ---- 绘制生命周期 ----

  startDrawing(store: StrategyStore, point: Point): void {
    store.isDrawing = true
    store.operate = {
      type: "polygon",
      data: [{ point }],
      status: "pending",
    }
    store.tempPolygonPoint = point
  }

  updateDrawing(store: StrategyStore, point: Point): void {
    store.tempPolygonPoint = point
  }

  /** ±5px 去重：与最后一个点的 x 且 y 均差 ≤5 才拒绝；添加返回 true / 拒绝返回 false */
  addPoint(store: StrategyStore, point: Point): boolean {
    if (!store.isDrawing || store.operate.type !== "polygon") return false

    // 避免添加重复点
    const lastPoint = store.operate.data.length > 0
      ? (store.operate.data[store.operate.data.length - 1] as Polygon)
      : null

    if (lastPoint &&
        Math.abs(lastPoint.point.x - point.x) <= 5 &&
        Math.abs(lastPoint.point.y - point.y) <= 5) {
      return false
    }

    store.operate.data.push({ point })
    return true
  }

  finishDrawing(store: StrategyStore): boolean {
    if (!store.isDrawing || store.operate.type !== "polygon") return false

    // 过滤无效多边形（点数太少）
    if (store.operate.data.length >= 3) {
      store.operate.status = "fullfilled"
      // id 生成 / 样式快照 / 清删除历史 / notifyChange('create') 统一由 store.pushRecord 完成
      store.pushRecord({ ...store.operate })
    }

    store.operate = {
      type: "polygon",
      data: [],
      status: "pending",
    }
    store.isDrawing = false
    store.tempPolygonPoint = null
    return true
  }

  cancelDrawing(store: StrategyStore): void {
    if (store.isDrawing && store.operate.type === "polygon" && store.operate.data.length >= 2) {
      // 如果多边形至少有两个点，保存当前进度
      store.operate.status = "fullfilled"
      store.pushRecord({ ...store.operate })
    }

    store.operate.data = []
    store.isDrawing = false
    store.tempPolygonPoint = null
  }

  /** 逐点 pop，pop 空后 isDrawing=false；空 operate 返回 false（回退由 store 编排） */
  withdrawInProgress(store: StrategyStore): boolean {
    if (store.operate.data.length === 0) return false
    store.operate.data.pop()
    if (store.operate.data.length === 0) {
      store.isDrawing = false
    }
    return true
  }

  // ---- 已完成记录的交互 ----

  hitTest(record: Operate<Polygon>, imgCoords: Point): boolean {
    return isPointInPolygon(imgCoords, record.data)
  }

  /** 返回画布坐标系控制点列表（每顶点一个；handleSize 由调用方用于命中判定，此处不参与计算） */
  getHandles(record: Operate<Polygon>, viewport: ViewportManager, _handleSize: number): { x: number; y: number; index: number }[] {
    const polygon = record.data
    const handles: { x: number; y: number; index: number }[] = []
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i]
      handles.push({
        x: viewport.offset.x + p.point.x * viewport.scale,
        y: viewport.offset.y + p.point.y * viewport.scale,
        index: i,
      })
    }
    return handles
  }

  move(record: Operate<Polygon>, dx: number, dy: number): void {
    const polygon = record.data
    polygon.forEach((p) => {
      p.point.x += dx
      p.point.y += dy
    })
  }

  /** 拍摄 resize 前快照（深拷贝：Polygon.point 为嵌套对象，展开复制） */
  snapshotForResize(record: Operate<Polygon>): ResizeSnapshot {
    return record.data.map((p) => ({ point: { ...p.point } }))
  }

  /** 直接改写指定顶点坐标；polygon 无控制点交换，恒返回 undefined */
  resize(record: Operate<Polygon>, handleIndex: number, currentPoint: Point, _snapshot: ResizeSnapshot): number | undefined {
    const polygon = record.data
    if (handleIndex >= 0 && handleIndex < polygon.length) {
      polygon[handleIndex].point.x = currentPoint.x
      polygon[handleIndex].point.y = currentPoint.y
    }
    return undefined
  }

  // ---- 渲染所需的只读信息 ----

  /** 标题/导出参考边界：顶点 bbox（最小/最大 x/y 推导 x/y/width/height） */
  getBounds(record: Operate<Polygon>): { x: number; y: number; width: number; height: number } {
    const polygon = record.data
    if (polygon.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    polygon.forEach((p) => {
      if (p.point.x < minX) minX = p.point.x
      if (p.point.y < minY) minY = p.point.y
      if (p.point.x > maxX) maxX = p.point.x
      if (p.point.y > maxY) maxY = p.point.y
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
}

/** 策略无状态，导出单例 */
export const polygonStrategy = new PolygonStrategy()
