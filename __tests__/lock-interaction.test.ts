/**
 * Task 8: 锁定选中（lock）交互测试
 * 锁定选中：显示高亮但不允许鼠标拖动/缩放；程序化移动不受影响。
 * 公共 API 透传 selectAnnotation(ref, {lock}) 属 Task 9，此处通过内部 manager 驱动锁定。
 */

import Drawer from '../src/index'
import type { Rect } from '../src/index'

function dispatchMouse(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'offsetX', { value: x })
  Object.defineProperty(e, 'offsetY', { value: y })
  canvas.dispatchEvent(e)
}

async function createDrawerWithImage(id: string, options: Record<string, unknown> = {}) {
  const container = document.createElement('div')
  container.id = id
  container.style.width = '800px'
  container.style.height = '600px'
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  const drawer = new Drawer({ id, useEvents: true, drawType: 'rect', ...options })
  drawer.drawImage('test.jpg')
  await new Promise((r) => setTimeout(r, 10))
  const canvas = container.querySelector('canvas')!
  return { drawer, canvas, container }
}

// 画一个 (100,100) 100x100 的矩形
async function setupRect() {
  const { drawer, canvas, container } = await createDrawerWithImage('lock-rect-' + Math.random().toString(36).slice(2))
  dispatchMouse(canvas, 'mousedown', 100, 100)
  dispatchMouse(canvas, 'mousemove', 200, 200)
  dispatchMouse(canvas, 'mouseup', 200, 200)
  return { drawer, canvas, container }
}

function lockSelect(drawer: Drawer, index: number) {
  drawer.selectAnnotation(index, { lock: true })
}

describe('锁定选中（lock）交互', () => {
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

  it('锁定选中后拖动：坐标不变、仍选中、仍锁定', async () => {
    const { drawer, canvas, container } = await setupRect()
    track(drawer, container)

    drawer.setDrawType('')
    lockSelect(drawer, 0)

    // 拖动尝试
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mousemove', 180, 190)
    dispatchMouse(canvas, 'mouseup', 180, 190)

    const rect = drawer.getAnnotations()[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 100, y: 100 })
    expect(drawer.getSelectedAnnotation()).not.toBeNull()
    const sel = (drawer as unknown as { annotationManager: { selectedAnnotation: { locked?: boolean } } }).annotationManager.selectedAnnotation
    expect(sel.locked).toBe(true)
  })

  it('非锁定选中后拖动：坐标改变', async () => {
    const { drawer, canvas, container } = await setupRect()
    track(drawer, container)

    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150) // 普通选中
    dispatchMouse(canvas, 'mousemove', 180, 190)
    dispatchMouse(canvas, 'mouseup', 180, 190)

    const rect = drawer.getAnnotations()[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 130, y: 140 })
  })

  it('锁定选中后程序化移动仍生效', async () => {
    const { drawer, canvas, container } = await setupRect()
    track(drawer, container)

    lockSelect(drawer, 0)
    drawer.moveSelectedAnnotation(10, 20)

    const rect = drawer.getAnnotations()[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 110, y: 120 })
  })

  it('锁定后取消选中再普通选中：可拖动', async () => {
    const { drawer, canvas, container } = await setupRect()
    track(drawer, container)

    drawer.setDrawType('')
    lockSelect(drawer, 0)
    drawer.deselectAnnotation()
    dispatchMouse(canvas, 'mousedown', 150, 150) // 普通选中
    dispatchMouse(canvas, 'mousemove', 180, 190)
    dispatchMouse(canvas, 'mouseup', 180, 190)

    const rect = drawer.getAnnotations()[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 130, y: 140 })
  })

  it('公共 API selectAnnotation(0, {lock:true}) 返回选中且锁定', async () => {
    const { drawer, container } = await setupRect()
    track(drawer, container)

    drawer.selectAnnotation(0, { lock: true })

    expect(drawer.getSelectedAnnotation()).not.toBeNull()
    expect(drawer.getSelectedAnnotation()?.index).toBe(0)
    const sel = (drawer as unknown as { annotationManager: { selectedAnnotation: { locked?: boolean } } }).annotationManager.selectedAnnotation
    expect(sel.locked).toBe(true)
  })

  it('公共 API selectAnnotation(0) 缺省参数：普通选中（locked=false）', async () => {
    const { drawer, container } = await setupRect()
    track(drawer, container)

    drawer.selectAnnotation(0)

    expect(drawer.getSelectedAnnotation()).not.toBeNull()
    const sel = (drawer as unknown as { annotationManager: { selectedAnnotation: { locked?: boolean } } }).annotationManager.selectedAnnotation
    expect(sel.locked).toBe(false)
  })
})
