import Drawer from '../src/index'
import { createDrawerWithImage } from './helpers'

const am = (d: Drawer) => (d as any).annotationManager

describe('标题换行与自动垂直兜底（设置时）', () => {
  const cleanup: (() => void)[] = []
  const track = (drawer: Drawer, container: HTMLElement) => {
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  const pushRectAt = (
    drawer: Drawer,
    start: { x: number; y: number },
    width = 100,
    height = 50
  ) => {
    am(drawer).recordList.push({ type: 'rect', data: [{ start, width, height }], status: 'fullfilled' })
  }

  it('超宽标题按图片宽换行，标题框仍夹在图片内', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-wide', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 700, y: 100 }, 50, 50)
    drawer.setAnnotationTitle(0, '一'.repeat(200))

    const box = am(drawer).getTitleBoxRect(0)
    expect(box).not.toBeNull()
    // 200 字 / 每行 98 字 → 3 行；框宽 98*8 + 12 = 796
    expect(box.width).toBeLessThanOrEqual(800)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(800)
  })

  it('标注与图片等高时落到标注内部顶边', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-tall', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 0 }, 100, 600)
    drawer.setAnnotationTitle(0, 'A')

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.vertical).toBe('inside-top')
    const box = am(drawer).getTitleBoxRect(0)
    expect(box.y).toBe(4)
    expect(box.x).toBeGreaterThanOrEqual(100)
    expect(box.x + box.width).toBeLessThanOrEqual(200)
  })

  it('内部标题按标注宽换行，不超出标注', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-inside', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 0 }, 100, 600)
    drawer.setAnnotationTitle(0, '一二三四五六七八九十一二三四五六七八九十')

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.vertical).toBe('inside-top')
    const box = am(drawer).getTitleBoxRect(0)
    // 内宽 100 - 12 = 88 → 每行 11 字
    expect(box.width).toBe(100)
    expect(box.x).toBe(100)
    expect(box.x + box.width).toBe(200)
  })

  it('内部标题超出图片底边时整体上移，不溢出', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-inside-overflow', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 20 }, 100, 580)
    drawer.setAnnotationTitle(0, '一'.repeat(420))

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.vertical).toBe('inside-top')
    const box = am(drawer).getTitleBoxRect(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(600)
  })

  it('手动宽度生效并参与换行', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-manual', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 200 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    drawer.setAnnotationTitlePosition(0, { width: 200 })

    expect(am(drawer).getTitleBoxRect(0).width).toBe(200)
  })

  it('resetAnnotationTitleLayout 清掉手动宽度并恢复自动兜底', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-reset', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 0 }, 100, 600)
    drawer.setAnnotationTitle(0, 'A')
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('inside-top')

    drawer.setAnnotationTitlePosition(0, { vertical: 'top', width: 300 })
    drawer.resetAnnotationTitleLayout(0)

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.vertical).toBe('inside-top')
    expect(pos.width).toBeUndefined()
    expect(am(drawer).getTitleBoxRect(0).width).toBeLessThanOrEqual(100)
  })

  it('修改标题 padding 后重新做水平贴边', async () => {
    const { drawer, container } = await createDrawerWithImage('wrap-style', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 0, y: 300 }, 6, 50)
    drawer.setAnnotationTitle(0, 'A')
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).offsetX).toBe(7)

    drawer.setAnnotationTitleStyle(0, { paddingX: 20 })
    // boxW = 8 + 40 = 48 → rawX = 3 - 24 = -21 → clamp 0 → offsetX 21
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).offsetX).toBe(21)
  })
})

describe('API 注入的标题在下一次渲染前补布局', () => {
  const cleanup: (() => void)[] = []
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  it('直接 push 带 title 的标注，render 后得到正确的垂直兜底', async () => {
    const { drawer, container } = await createDrawerWithImage('lazy-title', { enableTitle: true })
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
    am(drawer).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
      status: 'fullfilled',
      title: 'A'
    })

    ;(drawer as any).render()

    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })

  it('refreshTitleLayouts 强制重算原地修改过的标题', async () => {
    const { drawer, container } = await createDrawerWithImage('refresh-title', { enableTitle: true })
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
    am(drawer).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
      status: 'fullfilled',
      title: 'A'
    })

    drawer.refreshTitleLayouts()

    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })

  it('titlePositionExplicit 的注入标注不被改写', async () => {
    const { drawer, container } = await createDrawerWithImage('lazy-explicit', { enableTitle: true })
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
    am(drawer).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
      status: 'fullfilled',
      title: 'A',
      style: {
        strokeColor: 'red',
        lineWidth: 5,
        titlePosition: { vertical: 'top', align: 'left' },
        titlePositionExplicit: true
      }
    })

    ;(drawer as any).render()

    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('top')
  })
})
