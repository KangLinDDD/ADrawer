import Drawer from '../src/index'
import { createDrawerWithImage } from './helpers'

const am = (d: Drawer) => (d as any).annotationManager

describe('设置标题时按初始图片尺寸自动判断位置', () => {
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

  const pushRectAt = (drawer: Drawer, start: { x: number; y: number }, width = 5, height = 50) => {
    am(drawer).recordList.push({ type: 'rect', data: [{ start, width, height }], status: 'fullfilled' })
  }

  it('标注靠上边缘时写回 vertical=bottom', async () => {
    const { drawer, container } = await createDrawerWithImage('edge-top', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 2 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })

  it('标注靠左边缘时修正 offsetX', async () => {
    const { drawer, container } = await createDrawerWithImage('edge-left', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 0, y: 200 }, 6, 50)
    drawer.setAnnotationTitle(0, 'A')
    const p = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    // boxW = 'A'(8) + paddingX(6*2) = 20；center rawX = 0 + 3 - 10 = -7 → clamp 0 → offsetX = 7
    expect(p.offsetX).toBe(7)
  })

  it('标注在中间时保持 top、offsetX 不变', async () => {
    const { drawer, container } = await createDrawerWithImage('edge-mid', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 400, y: 300 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    const p = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(p.vertical).toBe('top')
    expect(p.offsetX).toBe(0)
  })

  it('显式设置位置后重新设置标题不被覆盖', async () => {
    const { drawer, container } = await createDrawerWithImage('edge-explicit', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 2 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    drawer.setAnnotationTitlePosition(0, { vertical: 'inside-top' })
    drawer.setAnnotationTitle(0, 'B')
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('inside-top')
  })

  it('图片未加载时不调整', () => {
    const container = document.createElement('div')
    container.id = 'edge-noimg'
    container.style.width = '800px'
    container.style.height = '600px'
    document.body.appendChild(container)
    const drawer = new Drawer({ id: 'edge-noimg', enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 2 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('top')
  })

  it('UI 双击编辑完成同样触发自动判断', async () => {
    const { drawer, container } = await createDrawerWithImage('edge-ui', { enableTitle: true })
    track(drawer, container)
    pushRectAt(drawer, { x: 100, y: 2 }, 100, 50)
    am(drawer).startTitleEditing(0)
    am(drawer).titleInput.value = 'A'
    am(drawer).finishTitleEditing()
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })

  it('图片尚未加载时设置标题，图片加载后补做一次判断', async () => {
    const container = document.createElement('div')
    container.id = 'edge-late'
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    const drawer = new Drawer({ id: 'edge-late', enableTitle: true })
    track(drawer, container)

    pushRectAt(drawer, { x: 100, y: 2 }, 100, 50)
    drawer.setAnnotationTitle(0, 'A')
    // 图片未加载 → 暂不调整
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('top')

    drawer.drawImage('test.jpg')
    await new Promise((r) => setTimeout(r, 10))
    // 图片加载后补做判断
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })
})
