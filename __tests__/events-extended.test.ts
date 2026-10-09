import Drawer from '../src/index'
import { dispatchMouse, dispatchWheel, dispatchKey, dispatchDoubleClick, createDrawerWithImage } from './helpers'

describe('events.ts resize 控制点', () => {
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

  const drawRect = (canvas: HTMLCanvasElement) => {
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
  }
  const selectRect = (drawer: Drawer, canvas: HTMLCanvasElement) => {
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
  }

  it('拖动右下角控制点放大矩形', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('resize-rect-br', { drawType: 'rect' })
    track(drawer, container)
    drawRect(canvas)
    selectRect(drawer, canvas)
    dispatchMouse(canvas, 'mousedown', 200, 200) // 右下角 index 3
    dispatchMouse(canvas, 'mousemove', 250, 250)
    dispatchMouse(canvas, 'mouseup', 250, 250)
    const rect = drawer.getAnnotations()[0].data[0] as any
    expect(rect.width).toBe(150)
    expect(rect.height).toBe(150)
    expect(rect.start).toEqual({ x: 100, y: 100 })
  })

  it('拖动左上角控制点向内缩小矩形', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('resize-rect-tl', { drawType: 'rect' })
    track(drawer, container)
    drawRect(canvas)
    selectRect(drawer, canvas)
    dispatchMouse(canvas, 'mousedown', 100, 100) // 左上角 index 0
    dispatchMouse(canvas, 'mousemove', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
    const rect = drawer.getAnnotations()[0].data[0] as any
    expect(rect.width).toBe(50)
    expect(rect.height).toBe(50)
    expect(rect.start).toEqual({ x: 150, y: 150 })
  })

  it('拖动多边形顶点移动该顶点', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('resize-poly', { drawType: 'polygon' })
    track(drawer, container)
    // 画三角形 (100,100),(200,100),(150,200)
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousedown', 200, 100)
    dispatchMouse(canvas, 'mousedown', 150, 200)
    dispatchDoubleClick(canvas, 150, 200)
    expect(drawer.getAnnotations()).toHaveLength(1)
    // 选中并拖动第 3 顶点 (150,200)
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 140)
    dispatchMouse(canvas, 'mouseup', 150, 140)
    dispatchMouse(canvas, 'mousedown', 150, 200)
    dispatchMouse(canvas, 'mousemove', 180, 220)
    dispatchMouse(canvas, 'mouseup', 180, 220)
    const points = drawer.getAnnotations()[0].data as any[]
    expect(points[2].point).toEqual({ x: 180, y: 220 })
  })
})

describe('events.ts 双击', () => {
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

  it('启用标题后双击选中矩形触发标题编辑', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('dbl-title', { drawType: 'rect', enableTitle: true })
    track(drawer, container)
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
    dispatchDoubleClick(canvas, 150, 150)
    const titleInput = (drawer as any).annotationManager.titleInput
    expect(titleInput.style.display).toBe('block')
  })

  it('双击文本进入编辑态', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('dbl-text', { drawType: 'text' })
    track(drawer, container)
    dispatchMouse(canvas, 'mousedown', 300, 300) // 文本模式创建文本并进入编辑
    const tm = (drawer as any).textManager
    tm.textInput.value = '你好'
    tm.finishEditing()
    expect(tm.editingTextIndex).toBeNull()
    dispatchDoubleClick(canvas, 300, 300)
    expect(tm.editingTextIndex).not.toBeNull()
  })
})

describe('events.ts 键盘', () => {
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

  it('空格键重置视图到初始缩放', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('key-space', {})
    track(drawer, container)
    const vp = (drawer as any).viewport
    dispatchWheel(canvas, -100)
    expect(vp.scale).toBeGreaterThan(vp.initialScale)
    dispatchKey(' ')
    expect(vp.scale).toBe(vp.initialScale)
  })

  it('ESC 取消选中标注', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('key-esc', { drawType: 'rect' })
    track(drawer, container)
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
    expect(drawer.getSelectedAnnotation()).not.toBeNull()
    dispatchKey('Escape')
    expect(drawer.getSelectedAnnotation()).toBeNull()
  })

  it('焦点在输入框时按键不触发标注操作', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('key-input-guard', { drawType: 'rect' })
    track(drawer, container)
    dispatchMouse(canvas, 'mousedown', 100, 100)
    dispatchMouse(canvas, 'mousemove', 200, 200)
    dispatchMouse(canvas, 'mouseup', 200, 200)
    drawer.setDrawType('')
    dispatchMouse(canvas, 'mousedown', 150, 150)
    dispatchMouse(canvas, 'mouseup', 150, 150)
    expect(drawer.getAnnotations()).toHaveLength(1)
    // 从 input 派发 Delete，事件冒泡到 document，target 为 INPUT → 被忽略
    const input = document.createElement('input')
    document.body.appendChild(input)
    const e = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })
    input.dispatchEvent(e)
    document.body.removeChild(input)
    expect(drawer.getAnnotations()).toHaveLength(1)
  })
})

describe('events.ts mouseleave', () => {
  it('拖拽中 mouseleave 触发 mouseup 收尾', async () => {
    const { drawer, canvas, container } = await createDrawerWithImage('mouseleave-drag', { drawType: 'drag' })
    const eh = (drawer as any).eventHandler
    dispatchMouse(canvas, 'mousedown', 400, 300)
    expect(eh.isDragging).toBe(true)
    dispatchMouse(canvas, 'mouseleave', 400, 300)
    expect(eh.isDragging).toBe(false)
    drawer.destroy()
    if (container.parentNode) container.parentNode.removeChild(container)
  })
})
