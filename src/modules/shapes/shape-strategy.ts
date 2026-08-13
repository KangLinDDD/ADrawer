/**
 * 形状策略接口：每种标注形状（rect/polygon/未来星型）实现一个策略
 * 策略是无状态的纯逻辑单元，所有共享状态存于 AnnotationStore
 */
import type { Point, Rect, Polygon, Operate, AnnotationStyle } from '../types'
import type { ViewportManager } from '../viewport'

/** resize 所需的原始数据快照（rect 用 Rect 副本，polygon 用 Polygon[] 副本） */
export type ResizeSnapshot = Rect | Polygon[]

export interface ShapeStrategy<T extends Rect | Polygon = Rect | Polygon> {
  readonly type: 'rect' | 'polygon'

  // ---- 绘制生命周期（读写 store 的 operate/isDrawing 等，由 AnnotationStore 传入自身） ----
  /** 开始绘制（point 已由 store 完成 clamp） */
  startDrawing(store: StrategyStore, point: Point): void
  /** 更新绘制中状态（rect: 更新宽高；polygon: 更新临时点） */
  updateDrawing(store: StrategyStore, point: Point): void
  /** 尝试加点（仅 polygon 有意义；rect 空实现返回 false）。返回是否实际添加 */
  addPoint(store: StrategyStore, point: Point): boolean
  /** 完成绘制；满足入库条件则推入 recordList 并 notifyChange('create')。返回是否结束了绘制 */
  finishDrawing(store: StrategyStore): boolean
  /** 取消绘制（polygon ≥2 点保存入库的现有行为在策略内实现） */
  cancelDrawing(store: StrategyStore): void
  /** 撤销绘制中状态（polygon 逐点 pop；rect 整体清）。返回是否有动作 */
  withdrawInProgress(store: StrategyStore): boolean

  // ---- 已完成记录的交互 ----
  hitTest(record: Operate<T>, imgCoords: Point): boolean
  /** 返回画布坐标系控制点列表 */
  getHandles(record: Operate<T>, viewport: ViewportManager, handleSize: number): { x: number; y: number; index: number }[]
  move(record: Operate<T>, dx: number, dy: number): void
  /** 拍摄 resize 前快照 */
  snapshotForResize(record: Operate<T>): ResizeSnapshot
  /** 执行 resize；如需交换控制点（rect 越过交换）返回新 handle index，否则返回 undefined */
  resize(record: Operate<T>, handleIndex: number, currentPoint: Point, snapshot: ResizeSnapshot): number | undefined

  // ---- 渲染所需的只读信息 ----
  /** 标题/导出参考边界（图像坐标）：rect 用自身，polygon 用顶点 bbox */
  getBounds(record: Operate<T>): { x: number; y: number; width: number; height: number }
}

/** 策略视角的 Store 最小契约（AnnotationStore 实现它） */
export interface StrategyStore {
  operate: Operate<Rect | Polygon>
  isDrawing: boolean
  drawStartPoint: Point
  tempPolygonPoint: Point | null
  recordList: Operate<Rect | Polygon>[]
  strokeStyle: string
  lineWidth: number
  getCurrentStyle(): AnnotationStyle
  clamp(point: Point): Point   // 内部委托 shared.clampPoint(viewport, point, clampEnabled)
  pushRecord(record: Operate<Rect | Polygon>): void   // 内部完成 id 生成、样式快照、清删除历史、notifyChange('create')
}
