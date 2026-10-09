// 共享测试工具：事件派发、Drawer+图片创建、标注直插
import Drawer from '../src/index'

// jsdom 的 MouseEvent 不支持 offsetX/offsetY 构造参数，需手动定义
export function dispatchMouse(canvas: HTMLCanvasElement, type: string, x: number, y: number): void {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y })
  Object.defineProperty(e, 'offsetX', { value: x })
  Object.defineProperty(e, 'offsetY', { value: y })
  canvas.dispatchEvent(e)
}

export function dispatchWheel(canvas: HTMLCanvasElement, deltaY: number): void {
  const e = new WheelEvent('wheel', { deltaY, clientX: 400, clientY: 300, bubbles: true, cancelable: true })
  canvas.dispatchEvent(e)
}

export function dispatchKey(key: string, options: KeyboardEventInit = {}): void {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options })
  document.dispatchEvent(e)
}

// 模拟双击：Drawer 通过 300ms 内两次 click 的去抖逻辑内部触发 dblclick 处理
export function dispatchDoubleClick(canvas: HTMLCanvasElement, x: number, y: number): void {
  dispatchMouse(canvas, 'click', x, y)
  dispatchMouse(canvas, 'click', x, y)
}

// MockImage（setup.ts）在 setTimeout 0 后触发 onload；图片 800x600，容器 800x600 → scale=1, offset=(0,0)
export async function createDrawerWithImage(id: string, options: Record<string, unknown> = {}): Promise<{
  drawer: Drawer
  canvas: HTMLCanvasElement
  container: HTMLDivElement
}> {
  const container = document.createElement('div')
  container.id = id
  container.style.width = '800px'
  container.style.height = '600px'
  // jsdom 的 clientWidth/clientHeight 恒为 0，必须显式 mock
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  const drawer = new Drawer({ id, useEvents: true, ...options })
  drawer.drawImage('test.jpg')
  await new Promise((r) => setTimeout(r, 10))
  const canvas = container.querySelector('canvas')!
  return { drawer, canvas, container }
}

// 直插一个已完成矩形（起点 (100,100)，100x100）
export function pushRect(drawer: Drawer): void {
  (drawer as any).annotationManager.recordList.push({
    type: 'rect',
    data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
    status: 'fullfilled'
  })
}

// 直插一个已完成多边形（默认 3 顶点：(100,100),(150,150),(200,100)）
export function pushPolygon(drawer: Drawer, vertexCount = 3): void {
  const data = Array.from({ length: vertexCount }, (_, i) => ({
    point: { x: 100 + i * 50, y: 100 + (i % 2) * 50 }
  }))
  ;(drawer as any).annotationManager.recordList.push({
    type: 'polygon',
    data,
    status: 'fullfilled'
  })
}
