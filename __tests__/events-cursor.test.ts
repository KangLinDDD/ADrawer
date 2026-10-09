import Drawer from '../src/index'
import { dispatchMouse, createDrawerWithImage, pushRect, pushPolygon } from './helpers'

describe('events.ts 光标更新', () => {
  let cleanup: (() => void)[] = []
  const track = (drawer: Drawer, container: HTMLElement) => {
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup = []
  })

  // 画矩形 (100,100)-(200,200) 供命中
  const drawRect = (canvas: HTMLCanvasElement) => {
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
  }

  it('rect 模式：空白处 crosshair', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-rect-empty', { drawType: 'rect' })
    track(drawer, container)
    dispatchMouse(canvas, 'mousemove', 50, 50)
    expect(canvas.style.cursor).toBe('crosshair')
  })

  it('rect 模式：悬停矩形上 move', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-rect-hover', { drawType: 'rect' })
    track(drawer, container)
    drawRect(canvas)
    dispatchMouse(canvas, 'mousemove', 150, 150)
    expect(canvas.style.cursor).toBe('move')
  })

  it('rect 模式：选中后悬停左上控制点 nwse-resize，右上控制点 nesw-resize', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-rect-handle', { drawType: 'rect' })
    track(drawer, container)
    drawRect(canvas)
    ;(drawer as any).annotationManager.selectAnnotation(0)
    dispatchMouse(canvas, 'mousemove', 100, 100) // 左上 index 0
    expect(canvas.style.cursor).toBe('nwse-resize')
    dispatchMouse(canvas, 'mousemove', 200, 100) // 右上 index 1
    expect(canvas.style.cursor).toBe('nesw-resize')
  })

  it('polygon 模式：空白 crosshair，悬停多边形 move', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-poly', { drawType: 'polygon' })
    track(drawer, container)
    pushPolygon(drawer) // 顶点 (100,100),(150,150),(200,100)
    dispatchMouse(canvas, 'mousemove', 50, 50)
    expect(canvas.style.cursor).toBe('crosshair')
    dispatchMouse(canvas, 'mousemove', 150, 120)
    expect(canvas.style.cursor).toBe('move')
  })

  it('drag 模式：空白 grab，悬停标注 move', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-drag', { drawType: 'drag' })
    track(drawer, container)
    pushRect(drawer)
    dispatchMouse(canvas, 'mousemove', 50, 50)
    expect(canvas.style.cursor).toBe('grab')
    dispatchMouse(canvas, 'mousemove', 150, 150)
    expect(canvas.style.cursor).toBe('move')
  })

  it('text 模式：空白 crosshair，悬停文本 move', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-text', { drawType: 'text' })
    track(drawer, container)
    // 直插一条文本（position 300,300，宽度≥60）
    ;(drawer as any).textManager.textAnnotations.push({
      id: 't1',
      position: { x: 300, y: 300 },
      text: '你好',
      width: 60,
      height: 16
    })
    dispatchMouse(canvas, 'mousemove', 50, 50)
    expect(canvas.style.cursor).toBe('crosshair')
    dispatchMouse(canvas, 'mousemove', 310, 310)
    expect(canvas.style.cursor).toBe('move')
  })

  it('无模式：空白 default，悬停标注 move', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-none', {})
    track(drawer, container)
    pushRect(drawer)
    dispatchMouse(canvas, 'mousemove', 50, 50)
    expect(canvas.style.cursor).toBe('default')
    dispatchMouse(canvas, 'mousemove', 150, 150)
    expect(canvas.style.cursor).toBe('move')
  })

  it('锁定选中的标注悬停显示 default（不显示 move）', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('cursor-locked', {})
    track(drawer, container)
    pushRect(drawer)
    ;(drawer as any).annotationManager.selectAnnotation(0, { lock: true })
    dispatchMouse(canvas, 'mousemove', 150, 150)
    expect(canvas.style.cursor).toBe('default')
  })
})
