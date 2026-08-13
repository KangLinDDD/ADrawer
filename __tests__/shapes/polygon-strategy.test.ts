import { polygonStrategy, PolygonStrategy } from '../../src/modules/shapes/polygon-strategy'
import type { StrategyStore } from '../../src/modules/shapes/shape-strategy'
import type { Operate, Rect, Polygon, Point } from '../../src/modules/types'
import { ViewportManager } from '../../src/modules/viewport'

/** 内存 fake StrategyStore：pushRecord 用 jest.fn 以便断言 */
function createFakeStore() {
  const store: StrategyStore = {
    operate: { type: 'polygon', data: [], status: 'pending' },
    isDrawing: false,
    drawStartPoint: { x: 0, y: 0 },
    tempPolygonPoint: null,
    recordList: [],
    strokeStyle: 'red',
    lineWidth: 5,
    getCurrentStyle: () => ({ strokeColor: store.strokeStyle, lineWidth: store.lineWidth }),
    clamp: (p: Point) => p,
    pushRecord: jest.fn((record: Operate<Rect | Polygon>) => {
      store.recordList.push(record)
    }),
  }
  return store
}

function makePolygonRecord(points: Point[]): Operate<Polygon> {
  return {
    id: 'p1',
    type: 'polygon',
    data: points.map((point) => ({ point })),
    status: 'fullfilled',
  }
}

/** 在 store 上开始一个多边形并添加后续点（绕过 ±5px 去重的快捷路径） */
function drawPolygon(store: StrategyStore, points: Point[]) {
  polygonStrategy.startDrawing(store, points[0])
  for (let i = 1; i < points.length; i++) {
    polygonStrategy.addPoint(store, points[i])
  }
}

describe('PolygonStrategy 元信息', () => {
  it('type 为 polygon，导出单例为 PolygonStrategy 实例', () => {
    expect(polygonStrategy).toBeInstanceOf(PolygonStrategy)
    expect(polygonStrategy.type).toBe('polygon')
  })
})

describe('startDrawing', () => {
  it('首点入 operate.data，tempPolygonPoint 与 isDrawing 置位', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 10, y: 20 })
    expect(store.isDrawing).toBe(true)
    expect(store.operate.type).toBe('polygon')
    expect(store.operate.status).toBe('pending')
    expect(store.operate.data).toEqual([{ point: { x: 10, y: 20 } }])
    expect(store.tempPolygonPoint).toEqual({ x: 10, y: 20 })
  })
})

describe('addPoint', () => {
  it('未在绘制时返回 false', () => {
    const store = createFakeStore()
    expect(polygonStrategy.addPoint(store, { x: 10, y: 10 })).toBe(false)
    expect(store.operate.data).toEqual([])
  })

  it('operate 类型非 polygon 时返回 false', () => {
    const store = createFakeStore()
    store.isDrawing = true
    store.operate = { type: 'rect', data: [], status: 'pending' }
    expect(polygonStrategy.addPoint(store, { x: 10, y: 10 })).toBe(false)
  })

  it('距离足够远时添加并返回 true', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 0, y: 0 })
    expect(polygonStrategy.addPoint(store, { x: 100, y: 100 })).toBe(true)
    expect(store.operate.data).toHaveLength(2)
    expect(store.operate.data[1]).toEqual({ point: { x: 100, y: 100 } })
  })

  it('x 且 y 均差 ≤5 时拒绝并返回 false', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 100, y: 100 })
    expect(polygonStrategy.addPoint(store, { x: 103, y: 98 })).toBe(false)
    expect(store.operate.data).toHaveLength(1)
  })

  it('边界：恰好差 5（x 且 y 均差 5）应拒绝', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 100, y: 100 })
    expect(polygonStrategy.addPoint(store, { x: 105, y: 95 })).toBe(false)
    expect(store.operate.data).toHaveLength(1)
  })

  it('边界：差 6 应接受', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 100, y: 100 })
    expect(polygonStrategy.addPoint(store, { x: 106, y: 100 })).toBe(true)
    expect(store.operate.data).toHaveLength(2)
  })

  it('仅一个轴差 >5 也接受（去重需要 x 且 y 同时 ≤5）', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 100, y: 100 })
    expect(polygonStrategy.addPoint(store, { x: 102, y: 120 })).toBe(true)
    expect(store.operate.data).toHaveLength(2)
  })

  it('去重只与最后一个点比较', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 0, y: 0 })
    polygonStrategy.addPoint(store, { x: 100, y: 100 })
    // 与首点重合，但与末点距离远 → 应接受
    expect(polygonStrategy.addPoint(store, { x: 0, y: 0 })).toBe(true)
    expect(store.operate.data).toHaveLength(3)
  })
})

describe('updateDrawing', () => {
  it('更新 tempPolygonPoint', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 10, y: 10 })
    polygonStrategy.updateDrawing(store, { x: 50, y: 60 })
    expect(store.tempPolygonPoint).toEqual({ x: 50, y: 60 })
    // 不改动已入 data 的点
    expect(store.operate.data).toEqual([{ point: { x: 10, y: 10 } }])
  })
})

describe('finishDrawing', () => {
  it('未在绘制时返回 false', () => {
    const store = createFakeStore()
    expect(polygonStrategy.finishDrawing(store)).toBe(false)
    expect(store.pushRecord).not.toHaveBeenCalled()
  })

  it('<3 点不入库，但 operate/tempPolygonPoint/isDrawing 复位，返回 true', () => {
    const store = createFakeStore()
    drawPolygon(store, [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(polygonStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).not.toHaveBeenCalled()
    expect(store.recordList).toEqual([])
    expect(store.operate).toEqual({ type: 'polygon', data: [], status: 'pending' })
    expect(store.isDrawing).toBe(false)
    expect(store.tempPolygonPoint).toBeNull()
  })

  it('≥3 点 pushRecord（status 置 fullfilled）并复位', () => {
    const store = createFakeStore()
    drawPolygon(store, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(polygonStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).toHaveBeenCalledTimes(1)
    const pushed = (store.pushRecord as jest.Mock).mock.calls[0][0] as Operate<Polygon>
    expect(pushed.type).toBe('polygon')
    expect(pushed.status).toBe('fullfilled')
    expect(pushed.data).toEqual([
      { point: { x: 0, y: 0 } },
      { point: { x: 100, y: 0 } },
      { point: { x: 100, y: 100 } },
    ])
    // id/样式快照由 pushRecord 负责，策略不传
    expect(pushed.id).toBeUndefined()
    expect(store.recordList).toHaveLength(1)
    expect(store.operate).toEqual({ type: 'polygon', data: [], status: 'pending' })
    expect(store.isDrawing).toBe(false)
    expect(store.tempPolygonPoint).toBeNull()
  })
})

describe('cancelDrawing', () => {
  it('≥2 点保存入库（status 先置 fullfilled）', () => {
    const store = createFakeStore()
    drawPolygon(store, [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    polygonStrategy.cancelDrawing(store)
    expect(store.pushRecord).toHaveBeenCalledTimes(1)
    const pushed = (store.pushRecord as jest.Mock).mock.calls[0][0] as Operate<Polygon>
    expect(pushed.type).toBe('polygon')
    expect(pushed.status).toBe('fullfilled')
    expect(pushed.data).toHaveLength(2)
    expect(store.recordList).toHaveLength(1)
  })

  it('<2 点丢弃不入库', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 10, y: 10 })
    polygonStrategy.cancelDrawing(store)
    expect(store.pushRecord).not.toHaveBeenCalled()
    expect(store.recordList).toEqual([])
  })

  it('尾部复位：operate.data 清空、isDrawing=false、tempPolygonPoint=null', () => {
    const store = createFakeStore()
    drawPolygon(store, [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    store.tempPolygonPoint = { x: 5, y: 5 }
    polygonStrategy.cancelDrawing(store)
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
    expect(store.tempPolygonPoint).toBeNull()
  })
})

describe('withdrawInProgress', () => {
  it('逐点 pop，返回 true', () => {
    const store = createFakeStore()
    drawPolygon(store, [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(polygonStrategy.withdrawInProgress(store)).toBe(true)
    expect(store.operate.data).toHaveLength(2)
    expect(store.isDrawing).toBe(true)
    expect(polygonStrategy.withdrawInProgress(store)).toBe(true)
    expect(store.operate.data).toHaveLength(1)
    expect(store.isDrawing).toBe(true)
  })

  it('pop 至空时 isDrawing=false 且返回 true', () => {
    const store = createFakeStore()
    polygonStrategy.startDrawing(store, { x: 10, y: 10 })
    expect(polygonStrategy.withdrawInProgress(store)).toBe(true)
    expect(store.operate.data).toHaveLength(0)
    expect(store.isDrawing).toBe(false)
  })

  it('空 operate 返回 false（记录回退由 store 编排）', () => {
    const store = createFakeStore()
    expect(polygonStrategy.withdrawInProgress(store)).toBe(false)
  })
})

describe('hitTest', () => {
  const record = () =>
    makePolygonRecord([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ])

  it('命中多边形内部点', () => {
    expect(polygonStrategy.hitTest(record(), { x: 50, y: 50 })).toBe(true)
  })

  it('未命中外部点', () => {
    expect(polygonStrategy.hitTest(record(), { x: 150, y: 50 })).toBe(false)
    expect(polygonStrategy.hitTest(record(), { x: -10, y: 50 })).toBe(false)
  })

  it('少于 3 个顶点的记录恒未命中', () => {
    const r = makePolygonRecord([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    expect(polygonStrategy.hitTest(r, { x: 50, y: 50 })).toBe(false)
  })
})

describe('getHandles', () => {
  it('每个顶点一个控制点，画布坐标 offset + p*scale', () => {
    const viewport = new ViewportManager()
    viewport.offset = { x: 10, y: 20 }
    viewport.scale = 2
    const record = makePolygonRecord([
      { x: 5, y: 5 },
      { x: 20, y: 5 },
      { x: 20, y: 30 },
    ])
    const handles = polygonStrategy.getHandles(record, viewport, 12)
    expect(handles).toEqual([
      { x: 20, y: 30, index: 0 },
      { x: 50, y: 30, index: 1 },
      { x: 50, y: 80, index: 2 },
    ])
  })
})

describe('move', () => {
  it('平移全部顶点', () => {
    const record = makePolygonRecord([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    polygonStrategy.move(record, 5, -8)
    expect(record.data).toEqual([
      { point: { x: 5, y: -8 } },
      { point: { x: 105, y: -8 } },
      { point: { x: 105, y: 92 } },
    ])
  })
})

describe('snapshotForResize', () => {
  it('返回 Polygon[] 深拷贝：修改快照不影响原数据', () => {
    const record = makePolygonRecord([
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
    const snapshot = polygonStrategy.snapshotForResize(record) as Polygon[]
    expect(snapshot).toEqual([{ point: { x: 1, y: 2 } }, { point: { x: 3, y: 4 } }])
    snapshot[0].point.x = 999
    expect(record.data[0].point.x).toBe(1)
  })
})

describe('resize', () => {
  it('直接改写指定顶点坐标，返回 undefined', () => {
    const record = makePolygonRecord([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ])
    const snapshot = polygonStrategy.snapshotForResize(record)
    const ret = polygonStrategy.resize(record, 1, { x: 120, y: -30 }, snapshot)
    expect(ret).toBeUndefined()
    expect(record.data[1]).toEqual({ point: { x: 120, y: -30 } })
    // 其余顶点不变
    expect(record.data[0]).toEqual({ point: { x: 0, y: 0 } })
    expect(record.data[2]).toEqual({ point: { x: 100, y: 100 } })
  })

  it('非法顶点 index 不改数据，返回 undefined', () => {
    const record = makePolygonRecord([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ])
    const snapshot = polygonStrategy.snapshotForResize(record)
    expect(polygonStrategy.resize(record, 5, { x: 1, y: 1 }, snapshot)).toBeUndefined()
    expect(polygonStrategy.resize(record, -1, { x: 1, y: 1 }, snapshot)).toBeUndefined()
    expect(record.data).toEqual([{ point: { x: 0, y: 0 } }, { point: { x: 100, y: 100 } }])
  })
})

describe('getBounds', () => {
  it('返回顶点 bbox（最小/最大 x/y 推导）', () => {
    const record = makePolygonRecord([
      { x: 10, y: 40 },
      { x: 100, y: 5 },
      { x: 30, y: 80 },
    ])
    expect(polygonStrategy.getBounds(record)).toEqual({ x: 10, y: 5, width: 90, height: 75 })
  })

  it('空数据返回零边界', () => {
    const record = makePolygonRecord([])
    expect(polygonStrategy.getBounds(record)).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
