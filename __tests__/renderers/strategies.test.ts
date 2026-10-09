import Drawer from '../../src/index'
import { setLineDash } from '../../src/modules/renderers/shape-renderer'
import { RectRenderer } from '../../src/modules/renderers/rect-renderer'
import { PolygonRenderer } from '../../src/modules/renderers/polygon-renderer'

describe('shape-renderer.ts setLineDash', () => {
  it('dashed → [10,5]', () => {
    const ctx = { setLineDash: jest.fn() }
    setLineDash(ctx as any, 'dashed')
    expect(ctx.setLineDash).toHaveBeenCalledWith([10, 5])
  })
  it('dotted → [2,4]', () => {
    const ctx = { setLineDash: jest.fn() }
    setLineDash(ctx as any, 'dotted')
    expect(ctx.setLineDash).toHaveBeenCalledWith([2, 4])
  })
  it('solid/undefined → []', () => {
    const ctx = { setLineDash: jest.fn() }
    setLineDash(ctx as any, 'solid')
    setLineDash(ctx as any, undefined)
    expect(ctx.setLineDash).toHaveBeenCalledWith([])
  })
})

describe('rect-renderer.ts', () => {
  it('drawForExport 用原始坐标 strokeRect', () => {
    const r = new RectRenderer()
    const ctx = { strokeRect: jest.fn() }
    const record = { type: 'rect', data: [{ start: { x: 10, y: 20 }, width: 30, height: 40 }], status: 'fullfilled' } as any
    r.drawForExport(ctx as any, record, {} as any)
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 30, 40)
  })
  it('getTitleAnchor 无 viewport 返回原始坐标', () => {
    const r = new RectRenderer()
    const record = { type: 'rect', data: [{ start: { x: 10, y: 20 }, width: 30, height: 40 }], status: 'fullfilled' } as any
    expect(r.getTitleAnchor(record)).toEqual({ x: 10, y: 20, width: 30, height: 40 })
  })
  it('getTitleAnchor 有 viewport 返回画布坐标', () => {
    const r = new RectRenderer()
    const record = { type: 'rect', data: [{ start: { x: 10, y: 20 }, width: 30, height: 40 }], status: 'fullfilled' } as any
    const viewport = { offset: { x: 5, y: 5 }, scale: 2 } as any
    expect(r.getTitleAnchor(record, viewport)).toEqual({ x: 25, y: 45, width: 60, height: 80 })
  })
})

describe('polygon-renderer.ts', () => {
  const diamondStore = {
    getVertexStyle: () => ({ size: 8, fillColor: 'red', strokeColor: 'white', strokeWidth: 2, shape: 'diamond' as const })
  } as any
  const diamondStyle = {
    strokeColor: 'red', lineWidth: 1,
    vertexStyle: { size: 8, fillColor: 'red', strokeColor: 'white', strokeWidth: 2, shape: 'diamond' as const }
  } as any
  const mockCtx = () => ({
    beginPath: jest.fn(), closePath: jest.fn(),
    moveTo: jest.fn(), lineTo: jest.fn(),
    arc: jest.fn(), rect: jest.fn(),
    fill: jest.fn(), stroke: jest.fn(),
    fillRect: jest.fn(), strokeRect: jest.fn(),
    setLineDash: jest.fn(),
    save: jest.fn(), restore: jest.fn(),
  }) as any

  it('diamond 顶点样式走 moveTo/lineTo 绘制', () => {
    const r = new PolygonRenderer(diamondStore)
    const ctx = mockCtx()
    const record = { type: 'polygon', data: [{ point: { x: 10, y: 20 } }, { point: { x: 30, y: 40 } }], status: 'fullfilled' } as any
    const viewport = { offset: { x: 0, y: 0 }, scale: 1 } as any
    r.draw(ctx, viewport, record, diamondStyle)
    expect(ctx.lineTo).toHaveBeenCalled()
  })

  it('drawForExport 未完成多边形（pending）直接返回', () => {
    const r = new PolygonRenderer(diamondStore)
    const ctx = mockCtx()
    const record = { type: 'polygon', data: [{ point: { x: 0, y: 0 } }], status: 'pending' } as any
    r.drawForExport(ctx, record, { strokeColor: 'red', lineWidth: 1 } as any)
    expect(ctx.beginPath).not.toHaveBeenCalled()
  })

  it('drawForExport 完成多边形闭合并画顶点', () => {
    const r = new PolygonRenderer(diamondStore)
    const ctx = mockCtx()
    const record = {
      type: 'polygon',
      data: [{ point: { x: 0, y: 0 } }, { point: { x: 10, y: 0 } }, { point: { x: 5, y: 10 } }],
      status: 'fullfilled'
    } as any
    r.drawForExport(ctx, record, { strokeColor: 'red', lineWidth: 1 } as any)
    expect(ctx.stroke).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(3)
  })

  it('getTitleAnchor 空多边形返回 null，非空返回 bbox', () => {
    const r = new PolygonRenderer({} as any)
    expect(r.getTitleAnchor({ type: 'polygon', data: [], status: 'fullfilled' } as any)).toBeNull()
    const bbox = r.getTitleAnchor({
      type: 'polygon',
      data: [{ point: { x: 0, y: 0 } }, { point: { x: 100, y: 50 } }],
      status: 'fullfilled'
    } as any)
    expect(bbox).toEqual({ x: 0, y: 0, width: 100, height: 50 })
  })
})

describe('text-renderer.ts 选中边框', () => {
  it('选中文本时绘制虚线边框', () => {
    const container = document.createElement('div')
    container.id = 'text-sel-container'
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    const drawer = new Drawer({ id: 'text-sel-container', useEvents: false })
    const tm = (drawer as any).textManager
    tm.addTextAnnotation(100, 100, '文本')
    tm.finishEditing()
    tm.selectedTextIndex = 0
    const ctx = (drawer as any).ctx
    ctx.stroke.mockClear()
    ctx.setLineDash.mockClear()
    ;(drawer as any).render()
    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 5])
    expect(ctx.stroke).toHaveBeenCalled()
    drawer.destroy()
    if (container.parentNode) container.parentNode.removeChild(container)
  })
})
