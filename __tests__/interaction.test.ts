/**
 * Task 0: 事件交互特征化测试（Golden Master）
 *
 * 目的：在重写 events.ts 之前，用公共 API + dispatchEvent 锁定当前鼠标交互行为。
 * 这些测试在重构前后必须同样通过（断言以当前实际行为为准）。
 *
 * 环境说明：
 * - jsdom 中 HTMLElement.clientWidth/clientHeight 恒为 0，
 *   必须用 Object.defineProperty 模拟容器尺寸，否则 scale=0 导致坐标换算失效。
 * - 容器 800x600、图片 800x600 → drawImage 后 scale=1、offset=(0,0)，
 *   画布坐标即图像坐标。
 * - Drawer 未监听原生 dblclick：双击通过 300ms 内两次 click 的去抖逻辑触发
 *   （见 src/index.ts handleClickEventListener），测试中快速派发两次 click 模拟双击。
 */

import Drawer from '../src/index'
import type { Rect, Polygon } from '../src/index'

// jsdom 的 MouseEvent 不支持 offsetX/offsetY 构造参数，需手动定义
function dispatchMouse(canvas: HTMLCanvasElement, type: string, x: number, y: number) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'offsetX', { value: x })
  Object.defineProperty(e, 'offsetY', { value: y })
  canvas.dispatchEvent(e)
}

// 键盘事件监听挂在 document 上（见 src/index.ts addEventListeners）
function dispatchKey(key: string, options: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options })
  document.dispatchEvent(e)
}

// 模拟双击：Drawer 通过 300ms 内两次 click 的去抖逻辑内部触发 dblclick 处理
function dispatchDoubleClick(canvas: HTMLCanvasElement, x: number, y: number) {
  dispatchMouse(canvas, 'click', x, y)
  dispatchMouse(canvas, 'click', x, y)
}

// MockImage（setup.ts）在 setTimeout 0 后触发 onload；图片 800x600，容器 800x600 → scale=1, offset=(0,0)
async function createDrawerWithImage(id: string, options: Record<string, unknown> = {}) {
  const container = document.createElement('div')
  container.id = id
  container.style.width = '800px'
  container.style.height = '600px'
  // jsdom 的 clientWidth/clientHeight 恒为 0，必须显式 mock（与 events.test.ts 一致）
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  const drawer = new Drawer({ id, useEvents: true, ...options })
  drawer.drawImage('test.jpg')
  await new Promise((r) => setTimeout(r, 10))
  const canvas = container.querySelector('canvas')!
  return { drawer, canvas, container }
}

describe('鼠标交互特征化测试（Golden Master）', () => {
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

  it('1. 鼠标画矩形：mousedown → mousemove → mouseup 生成 1 个 rect 标注', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-rect', { drawType: 'rect' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)

    const annotations = drawer.getAnnotations()
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('rect')
    const rect = annotations[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 100, y: 100 })
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(100)
  })

  it('2. 鼠标画多边形：3 次 mousedown + 双击结束 → 1 个 polygon、3 顶点', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-polygon', { drawType: 'polygon' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousedown', 200, 100)
    dispatchMouse(canvas, 'mousedown', 150, 200)
    dispatchDoubleClick(canvas, 150, 200)

    const annotations = drawer.getAnnotations()
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('polygon')
    const points = annotations[0].data as Polygon[]
    expect(points).toHaveLength(3)
    expect(points[0].point).toEqual({ x: 100, y: 100 })
    expect(points[1].point).toEqual({ x: 200, y: 100 })
    expect(points[2].point).toEqual({ x: 150, y: 200 })
  })

  it('3. 多边形双击结束时重复的 mousedown 不加点（±5px 去重）：顶点数严格为 3', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-polygon-dedupe', { drawType: 'polygon' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousedown', 200, 100)
    dispatchMouse(canvas, 'mousedown', 150, 200)
    // 真实双击伴随的第二次 mousedown 落在上一个顶点上（±5px 内），应被去重
    dispatchMouse(canvas, 'mousedown', 153, 198)
    dispatchDoubleClick(canvas, 153, 198)

    const annotations = drawer.getAnnotations()
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('polygon')
    const points = annotations[0].data as Polygon[]
    expect(points).toHaveLength(3)
  })

  it('4. 文本模式点击空白：创建文本标注并进入编辑', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-text', { drawType: 'text' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 300, 300)

    const textAnnotations = drawer.getTextAnnotations()
    expect(textAnnotations).toHaveLength(1)
    expect(textAnnotations[0].position).toEqual({ x: 300, y: 300 })
    expect(textAnnotations[0].text).toBe('')
    // 进入编辑态：容器内出现文本输入框
    expect(container.querySelector('input')).not.toBeNull()
  })

  it('5. 无模式（\'\'）点击已有矩形：选中；mousedown+move+up 拖动后坐标变化', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-select-drag', { drawType: 'rect' })
    track(drawer, container)

    // 先画一个矩形 (100,100) 100x100
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    expect(drawer.getAnnotations()).toHaveLength(1)

    // 切到无模式并点击矩形内部
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)

    const selected = drawer.getSelectedAnnotation()
    expect(selected).not.toBeNull()
    expect(selected?.type).toBe('rect')
    expect(selected?.index).toBe(0)

    // 拖动：move 30,40 → mouseup
    dispatchMouse(canvas, 'mousemove', 180, 190)
    dispatchMouse(canvas, 'mouseup', 180, 190)

    const rect = drawer.getAnnotations()[0].data[0] as Rect
    expect(rect.start).toEqual({ x: 130, y: 140 })
    expect(rect.width).toBe(100)
    expect(rect.height).toBe(100)
  })

  it('6. ESC 取消：polygon 画 2 点后 keydown Escape → 2 点多边形被保存入库（现有行为）', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-esc', { drawType: 'polygon' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousedown', 200, 100)
    dispatchKey('Escape')

    // 现有行为：ESC 不是丢弃，而是把 ≥2 点的多边形保存入库
    const annotations = drawer.getAnnotations()
    expect(annotations).toHaveLength(1)
    expect(annotations[0].type).toBe('polygon')
    const points = annotations[0].data as Polygon[]
    expect(points).toHaveLength(2)
    expect(points[0].point).toEqual({ x: 100, y: 100 })
    expect(points[1].point).toEqual({ x: 200, y: 100 })
  })

  it('7. Ctrl+Z 撤销：画完矩形后 Ctrl+Z → 标注列表为空', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-undo', { drawType: 'rect' })
    track(drawer, container)

    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    expect(drawer.getAnnotations()).toHaveLength(1)

    dispatchKey('z', { ctrlKey: true })

    expect(drawer.getAnnotations()).toEqual([])
  })

  it('8. Delete 删除选中：选中矩形后 keydown Delete → 标注消失', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('ia-delete', { drawType: 'rect' })
    track(drawer, container)

    // 画矩形并选中
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
    expect(drawer.getSelectedAnnotation()).not.toBeNull()

    dispatchKey('Delete')

    expect(drawer.getAnnotations()).toEqual([])
    expect(drawer.getSelectedAnnotation()).toBeNull()
  })
})
