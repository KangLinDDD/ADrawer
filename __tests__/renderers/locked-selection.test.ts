/**
 * 锁定选中态渲染测试（Task 7）
 * 控制点通过 ctx.fillRect(x, y, handleSize, handleSize) 绘制（renderer.ts 现状确认）。
 * 锁定选中（locked=true）时只画半透明填充 + 虚线框，不画控制点。
 */
import Drawer from '../../src/index'

// 与 annotation-store.ts 默认 selectionStyle.handleSize 一致
const HANDLE_SIZE = 12

type MockedCtx = {
  fillRect: jest.Mock
  strokeRect: jest.Mock
  fill: jest.Mock
  stroke: jest.Mock
  setLineDash: jest.Mock
}

describe('locked selection rendering', () => {
  let container: HTMLDivElement
  let drawer: Drawer

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'locked-test-container'
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    drawer = new Drawer({ id: 'locked-test-container', useEvents: false })
  })

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container)
    }
  })

  const getCtx = (): MockedCtx => drawer['ctx'] as unknown as MockedCtx

  const clearCtxMocks = (): void => {
    const ctx = getCtx()
    ctx.fillRect.mockClear()
    ctx.strokeRect.mockClear()
    ctx.fill.mockClear()
    ctx.stroke.mockClear()
    ctx.setLineDash.mockClear()
  }

  const render = (): void => {
    drawer['render']()
  }

  /** 统计控制点调用：fillRect 且宽/高均为 handleSize */
  const countHandleFillRects = (): number => {
    return getCtx().fillRect.mock.calls.filter(
      (args) => args[2] === HANDLE_SIZE && args[3] === HANDLE_SIZE
    ).length
  }

  const pushRect = (): void => {
    drawer['annotationManager'].recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled'
    })
  }

  const pushPolygon = (vertexCount: number): void => {
    const data = Array.from({ length: vertexCount }, (_, i) => ({
      point: { x: 100 + i * 50, y: 100 + (i % 2) * 50 }
    }))
    drawer['annotationManager'].recordList.push({
      type: 'polygon',
      data,
      status: 'fullfilled'
    })
  }

  describe('rect selection', () => {
    it('非锁定选中 rect → 绘制 4 个控制点', () => {
      pushRect()
      drawer['annotationManager'].selectAnnotation(0)
      clearCtxMocks()
      render()
      expect(countHandleFillRects()).toBe(4)
    })

    it('锁定选中 rect → 控制点 0 次，但仍画半透明填充与虚线框', () => {
      pushRect()
      drawer['annotationManager'].selectAnnotation(0, { lock: true })
      clearCtxMocks()
      render()

      // 无控制点
      expect(countHandleFillRects()).toBe(0)
      // 半透明填充仍在（rect 高亮填充走 fillRect，整个渲染中只剩这 1 次 fillRect）
      expect(getCtx().fillRect).toHaveBeenCalledTimes(1)
      // 虚线选中边框仍在
      expect(getCtx().strokeRect).toHaveBeenCalled()
      expect(getCtx().setLineDash).toHaveBeenCalledWith([5, 5])
    })
  })

  describe('polygon selection', () => {
    it('非锁定选中 polygon → 控制点等于顶点数', () => {
      pushPolygon(5)
      drawer['annotationManager'].selectAnnotation(0)
      clearCtxMocks()
      render()
      expect(countHandleFillRects()).toBe(5)
    })

    it('锁定选中 polygon → 控制点 0 次，但仍画半透明填充与虚线框', () => {
      pushPolygon(5)
      drawer['annotationManager'].selectAnnotation(0, { lock: true })
      clearCtxMocks()
      render()

      // 无控制点（polygon 高亮填充走 fill()，锁定后 fillRect 应为 0 次）
      expect(countHandleFillRects()).toBe(0)
      expect(getCtx().fillRect).not.toHaveBeenCalled()
      // 半透明填充与描边仍在
      expect(getCtx().fill).toHaveBeenCalled()
      expect(getCtx().stroke).toHaveBeenCalled()
      expect(getCtx().setLineDash).toHaveBeenCalledWith([5, 5])
    })
  })
})
