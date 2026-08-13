import { rectStrategy, RectStrategy } from '../../src/modules/shapes/rect-strategy'
import type { StrategyStore } from '../../src/modules/shapes/shape-strategy'
import type { Operate, Rect, Polygon, Point } from '../../src/modules/types'
import { ViewportManager } from '../../src/modules/viewport'

/** 内存 fake StrategyStore：pushRecord 用 jest.fn 以便断言 */
function createFakeStore() {
  const store: StrategyStore = {
    operate: { type: 'rect', data: [], status: 'pending' },
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

function makeRectRecord(x: number, y: number, width: number, height: number): Operate<Rect> {
  return {
    id: 'r1',
    type: 'rect',
    data: [{ start: { x, y }, width, height }],
    status: 'fullfilled',
  }
}

describe('RectStrategy 元信息', () => {
  it('type 为 rect，导出单例为 RectStrategy 实例', () => {
    expect(rectStrategy).toBeInstanceOf(RectStrategy)
    expect(rectStrategy.type).toBe('rect')
  })

  it('addPoint 空实现返回 false 且不改状态', () => {
    const store = createFakeStore()
    expect(rectStrategy.addPoint(store, { x: 1, y: 1 })).toBe(false)
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
  })
})

describe('startDrawing', () => {
  it('写入 operate / isDrawing / drawStartPoint', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 10, y: 20 })
    expect(store.isDrawing).toBe(true)
    expect(store.drawStartPoint).toEqual({ x: 10, y: 20 })
    expect(store.operate.type).toBe('rect')
    expect(store.operate.status).toBe('pending')
    const rect = store.operate.data[0] as Rect
    expect(rect).toEqual({ start: { x: 10, y: 20 }, width: 0, height: 0 })
  })

  it('operate 中的 start 是入参的拷贝（修改入参不影响）', () => {
    const store = createFakeStore()
    const p = { x: 10, y: 20 }
    rectStrategy.startDrawing(store, p)
    p.x = 999
    const rect = store.operate.data[0] as Rect
    expect(rect.start).toEqual({ x: 10, y: 20 })
  })
})

describe('updateDrawing', () => {
  it('正方向拖拽计算宽高', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 10, y: 10 })
    rectStrategy.updateDrawing(store, { x: 60, y: 45 })
    const rect = store.operate.data[0] as Rect
    expect(rect.width).toBe(50)
    expect(rect.height).toBe(35)
  })

  it('负方向拖拽得到负宽高', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 100, y: 100 })
    rectStrategy.updateDrawing(store, { x: 40, y: 70 })
    const rect = store.operate.data[0] as Rect
    expect(rect.width).toBe(-60)
    expect(rect.height).toBe(-30)
  })

  it('未在绘制时不动作', () => {
    const store = createFakeStore()
    rectStrategy.updateDrawing(store, { x: 60, y: 45 })
    expect(store.operate.data).toEqual([])
  })
})

describe('finishDrawing', () => {
  it('未在绘制时返回 false', () => {
    const store = createFakeStore()
    expect(rectStrategy.finishDrawing(store)).toBe(false)
    expect(store.pushRecord).not.toHaveBeenCalled()
  })

  it('无效矩形（|w|<=5）不入库，但 operate/isDrawing 复位，返回 true', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 0, y: 0 })
    rectStrategy.updateDrawing(store, { x: 5, y: 100 })
    expect(rectStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).not.toHaveBeenCalled()
    expect(store.recordList).toEqual([])
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
  })

  it('无效矩形（|h|<=5）不入库', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 0, y: 0 })
    rectStrategy.updateDrawing(store, { x: 100, y: 5 })
    expect(rectStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).not.toHaveBeenCalled()
    expect(store.isDrawing).toBe(false)
  })

  it('有效矩形（|w|>5 且 |h|>5）调用 pushRecord 且状态复位', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 10, y: 10 })
    rectStrategy.updateDrawing(store, { x: 60, y: 50 })
    expect(rectStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).toHaveBeenCalledTimes(1)
    const pushed = (store.pushRecord as jest.Mock).mock.calls[0][0] as Operate<Rect>
    expect(pushed.type).toBe('rect')
    expect(pushed.status).toBe('pending')
    expect(pushed.data[0]).toEqual({ start: { x: 10, y: 10 }, width: 50, height: 40 })
    // id/样式快照由 pushRecord 负责，策略不传
    expect(pushed.id).toBeUndefined()
    expect(store.recordList).toHaveLength(1)
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
  })

  it('负宽高但绝对值有效也入库', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 100, y: 100 })
    rectStrategy.updateDrawing(store, { x: 50, y: 60 })
    expect(rectStrategy.finishDrawing(store)).toBe(true)
    expect(store.pushRecord).toHaveBeenCalledTimes(1)
    const pushed = (store.pushRecord as jest.Mock).mock.calls[0][0] as Operate<Rect>
    expect(pushed.data[0]).toEqual({ start: { x: 100, y: 100 }, width: -50, height: -40 })
  })
})

describe('cancelDrawing', () => {
  it('清空 operate.data、isDrawing=false、tempPolygonPoint=null，不入库', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 0, y: 0 })
    rectStrategy.updateDrawing(store, { x: 200, y: 200 })
    store.tempPolygonPoint = { x: 1, y: 1 }
    rectStrategy.cancelDrawing(store)
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
    expect(store.tempPolygonPoint).toBeNull()
    expect(store.pushRecord).not.toHaveBeenCalled()
  })
})

describe('withdrawInProgress', () => {
  it('有绘制中数据时整体清空并返回 true', () => {
    const store = createFakeStore()
    rectStrategy.startDrawing(store, { x: 0, y: 0 })
    rectStrategy.updateDrawing(store, { x: 50, y: 50 })
    expect(rectStrategy.withdrawInProgress(store)).toBe(true)
    expect(store.operate.data).toEqual([])
    expect(store.isDrawing).toBe(false)
  })

  it('无数据时返回 false 且不改状态', () => {
    const store = createFakeStore()
    store.isDrawing = true
    expect(rectStrategy.withdrawInProgress(store)).toBe(false)
    expect(store.isDrawing).toBe(true)
  })
})

describe('hitTest', () => {
  it('命中矩形内部点', () => {
    const record = makeRectRecord(10, 10, 50, 40)
    expect(rectStrategy.hitTest(record, { x: 30, y: 30 })).toBe(true)
  })

  it('未命中外部点', () => {
    const record = makeRectRecord(10, 10, 50, 40)
    expect(rectStrategy.hitTest(record, { x: 5, y: 30 })).toBe(false)
    expect(rectStrategy.hitTest(record, { x: 30, y: 60 })).toBe(false)
  })

  it('支持负宽高矩形（从右下往左上画）', () => {
    const record = makeRectRecord(60, 50, -50, -40)
    expect(rectStrategy.hitTest(record, { x: 30, y: 30 })).toBe(true)
    expect(rectStrategy.hitTest(record, { x: 70, y: 30 })).toBe(false)
  })
})

describe('getHandles', () => {
  it('返回画布坐标系四角控制点（offset + p*scale）', () => {
    const viewport = new ViewportManager()
    viewport.offset = { x: 10, y: 20 }
    viewport.scale = 2
    const record = makeRectRecord(5, 5, 10, 20)
    const handles = rectStrategy.getHandles(record, viewport, 12)
    expect(handles).toEqual([
      { x: 20, y: 30, index: 0 },
      { x: 40, y: 30, index: 1 },
      { x: 20, y: 70, index: 2 },
      { x: 40, y: 70, index: 3 },
    ])
  })
})

describe('move', () => {
  it('平移 rect.start', () => {
    const record = makeRectRecord(10, 20, 50, 40)
    rectStrategy.move(record, 5, -8)
    expect(record.data[0].start).toEqual({ x: 15, y: 12 })
    expect(record.data[0].width).toBe(50)
    expect(record.data[0].height).toBe(40)
  })
})

describe('snapshotForResize', () => {
  it('返回深拷贝：修改快照不影响原数据', () => {
    const record = makeRectRecord(1, 2, 100, 80)
    const snapshot = rectStrategy.snapshotForResize(record) as Rect
    expect(snapshot).toEqual({ start: { x: 1, y: 2 }, width: 100, height: 80 })
    snapshot.start.x = 999
    snapshot.width = 999
    expect(record.data[0].start.x).toBe(1)
    expect(record.data[0].width).toBe(100)
  })
})

describe('resize', () => {
  // 基准矩形：start(0,0) w100 h100
  const setup = () => {
    const record = makeRectRecord(0, 0, 100, 100)
    const snapshot = rectStrategy.snapshotForResize(record) as Rect
    return { record, snapshot }
  }

  describe('普通拖拽（不越过固定角，返回 undefined）', () => {
    it('handle 0（左上角）：固定右下角 (100,100)', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 0, { x: 10, y: 20 }, snapshot)
      expect(ret).toBeUndefined()
      expect(record.data[0]).toEqual({ start: { x: 10, y: 20 }, width: 90, height: 80 })
    })

    it('handle 1（右上角）：固定左下角 (0,100)', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 1, { x: 120, y: 30 }, snapshot)
      expect(ret).toBeUndefined()
      expect(record.data[0]).toEqual({ start: { x: 0, y: 30 }, width: 120, height: 70 })
    })

    it('handle 2（左下角）：固定右上角 (100,0)', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 2, { x: 30, y: 120 }, snapshot)
      expect(ret).toBeUndefined()
      expect(record.data[0]).toEqual({ start: { x: 30, y: 0 }, width: 70, height: 120 })
    })

    it('handle 3（右下角）：固定左上角 (0,0)', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 3, { x: 120, y: 130 }, snapshot)
      expect(ret).toBeUndefined()
      expect(record.data[0]).toEqual({ start: { x: 0, y: 0 }, width: 120, height: 130 })
    })
  })

  describe('越过固定角时返回新 handle index', () => {
    it('handle 0 越过右+下 → 3', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 0, { x: 150, y: 160 }, snapshot)
      expect(ret).toBe(3)
      expect(record.data[0]).toEqual({ start: { x: 100, y: 100 }, width: 50, height: 60 })
    })

    it('handle 0 越过右（未越过下）→ 1', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 0, { x: 150, y: 60 }, snapshot)
      expect(ret).toBe(1)
      expect(record.data[0]).toEqual({ start: { x: 100, y: 60 }, width: 50, height: 40 })
    })

    it('handle 0 越过下（未越过右）→ 2', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 0, { x: 60, y: 150 }, snapshot)
      expect(ret).toBe(2)
      expect(record.data[0]).toEqual({ start: { x: 60, y: 100 }, width: 40, height: 50 })
    })

    it('handle 1 越过左+上 → 0', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 1, { x: -20, y: 30 }, snapshot)
      expect(ret).toBe(0)
      expect(record.data[0]).toEqual({ start: { x: -20, y: 30 }, width: 20, height: 70 })
    })

    it('handle 1 越过左（未越过上）→ 2', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 1, { x: -20, y: 150 }, snapshot)
      expect(ret).toBe(2)
      expect(record.data[0]).toEqual({ start: { x: -20, y: 100 }, width: 20, height: 50 })
    })

    it('handle 1 越过下（未越过左）→ 3', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 1, { x: 120, y: 150 }, snapshot)
      expect(ret).toBe(3)
      expect(record.data[0]).toEqual({ start: { x: 0, y: 100 }, width: 120, height: 50 })
    })

    it('handle 2 越过右+上 → 0', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 2, { x: 30, y: -30 }, snapshot)
      expect(ret).toBe(0)
      expect(record.data[0]).toEqual({ start: { x: 30, y: -30 }, width: 70, height: 30 })
    })

    it('handle 2 越过右（未越过上）→ 1', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 2, { x: 150, y: -30 }, snapshot)
      expect(ret).toBe(1)
      expect(record.data[0]).toEqual({ start: { x: 100, y: -30 }, width: 50, height: 30 })
    })

    it('handle 2 越过下+右 → 3', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 2, { x: 150, y: 120 }, snapshot)
      expect(ret).toBe(3)
      expect(record.data[0]).toEqual({ start: { x: 100, y: 0 }, width: 50, height: 120 })
    })

    it('handle 3 越过左+上 → 0', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 3, { x: -10, y: -20 }, snapshot)
      expect(ret).toBe(0)
      expect(record.data[0]).toEqual({ start: { x: -10, y: -20 }, width: 10, height: 20 })
    })

    it('handle 3 越过上（未越过左）→ 1', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 3, { x: 50, y: -20 }, snapshot)
      expect(ret).toBe(1)
      expect(record.data[0]).toEqual({ start: { x: 0, y: -20 }, width: 50, height: 20 })
    })

    it('handle 3 越过左（未越过上）→ 2', () => {
      const { record, snapshot } = setup()
      const ret = rectStrategy.resize(record, 3, { x: -10, y: 50 }, snapshot)
      expect(ret).toBe(2)
      expect(record.data[0]).toEqual({ start: { x: -10, y: 0 }, width: 10, height: 50 })
    })
  })

  it('resize 后快照同步为当前矩形，连续拖拽基于新快照', () => {
    const { record, snapshot } = setup()
    rectStrategy.resize(record, 3, { x: 120, y: 130 }, snapshot)
    expect(snapshot).toEqual({ start: { x: 0, y: 0 }, width: 120, height: 130 })
    const ret = rectStrategy.resize(record, 3, { x: 110, y: 120 }, snapshot)
    expect(ret).toBeUndefined()
    expect(record.data[0]).toEqual({ start: { x: 0, y: 0 }, width: 110, height: 120 })
  })

  it('非法 handle index 返回 undefined 且不改数据', () => {
    const { record, snapshot } = setup()
    const ret = rectStrategy.resize(record, 9, { x: 50, y: 50 }, snapshot)
    expect(ret).toBeUndefined()
    expect(record.data[0]).toEqual({ start: { x: 0, y: 0 }, width: 100, height: 100 })
  })
})

describe('getBounds', () => {
  it('返回矩形自身边界（图像坐标）', () => {
    const record = makeRectRecord(5, 6, 30, 40)
    expect(rectStrategy.getBounds(record)).toEqual({ x: 5, y: 6, width: 30, height: 40 })
  })
})
