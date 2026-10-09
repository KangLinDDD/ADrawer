import Drawer from '../src/index'
import { dispatchMouse, dispatchWheel, createDrawerWithImage } from './helpers'

describe('events.ts 滚轮缩放', () => {
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

  it('滚轮向上滚动（deltaY<0）放大视图', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('wheel-zoom-in', {})
    track(drawer, container)
    const vp = (drawer as any).viewport
    const initial = vp.scale
    dispatchWheel(canvas, -100)
    expect(vp.scale).toBeGreaterThan(initial)
  })

  it('滚轮向下滚动（deltaY>0）缩小视图', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('wheel-zoom-out', {})
    track(drawer, container)
    const vp = (drawer as any).viewport
    dispatchWheel(canvas, -100)
    dispatchWheel(canvas, -100)
    const zoomed = vp.scale
    expect(zoomed).toBeGreaterThan(vp.initialScale)
    dispatchWheel(canvas, 100)
    expect(vp.scale).toBeLessThan(zoomed)
  })

  it('滚轮缩小不会低于最小缩放（minScale）', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('wheel-min', {})
    track(drawer, container)
    const vp = (drawer as any).viewport
    // scale 已为 minScale(=1)，向下滚不产生低于下限的变化
    dispatchWheel(canvas, 100)
    expect(vp.scale).toBe(vp.minScale)
  })
})

describe('events.ts drag 视图拖拽', () => {
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

  it('drag 模式 mousedown 进入拖拽态，cursor=grabbing，mouseup 结束恢复 grab', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('drag-pan', { drawType: 'drag' })
    track(drawer, container)
    const eh = (drawer as any).eventHandler
    dispatchMouse(canvas, 'mousedown', 400, 300)
    expect(eh.isDragging).toBe(true)
    expect(canvas.style.cursor).toBe('grabbing')
    dispatchMouse(canvas, 'mousemove', 450, 350)
    dispatchMouse(canvas, 'mouseup', 450, 350)
    expect(eh.isDragging).toBe(false)
    expect(canvas.style.cursor).toBe('grab')
  })

  it('放大后 drag 拖拽产生视口平移', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('drag-pan-offset', { drawType: 'drag' })
    track(drawer, container)
    const vp = (drawer as any).viewport
    // 先放大创造可平移空间（scale>1 时 minOffsetX<0）
    dispatchWheel(canvas, -100)
    expect(vp.scale).toBeGreaterThan(1)
    const before = { ...vp.offset }
    dispatchMouse(canvas, 'mousedown', 400, 300)
    dispatchMouse(canvas, 'mousemove', 440, 340)
    dispatchMouse(canvas, 'mouseup', 440, 340)
    expect(vp.offset.x !== before.x || vp.offset.y !== before.y).toBe(true)
  })
})
