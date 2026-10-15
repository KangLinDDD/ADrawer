/**
 * exportAnnotationImage：离屏导出用的图片必须带 CORS 加载。
 *
 * `exportAnnotationImage()` 会新建一个 `Image` 重新加载底图，再把它画到离屏 canvas 上。
 * 若 `src` 先于 `crossOrigin` 赋值，这次请求可能不带 CORS，离屏 canvas 会被**污染**，
 * 于是 `offscreenCanvas.toDataURL()` 抛 `SecurityError`，被同一个 try/catch **静默**
 * 降级成 `exportCurrentViewImage()` —— 存下去的是交互画布（~950px），而不是原图分辨率，
 * 整张图分辨率暴跌、文字发虚。主画布路径 `drawImage()` 是先设 crossOrigin 的，两者必须一致。
 */

import Drawer from '../src/index'

function createDrawer(id: string, containerW: number, containerH: number, imageW: number, imageH: number) {
  const container = document.createElement('div')
  container.id = id
  Object.defineProperty(container, 'clientWidth', { value: containerW })
  Object.defineProperty(container, 'clientHeight', { value: containerH })
  document.body.appendChild(container)

  const drawer = new Drawer({ id, useEvents: false })
  const viewport = (drawer as any).viewport
  viewport.setSize(containerW, containerH)
  viewport.setOriginalSize(imageW, imageH)
  viewport.calculateInitialView()
  return { drawer, container }
}

describe('exportAnnotationImage：CORS 加载顺序', () => {
  it('先设 crossOrigin 再设 src，避免离屏 canvas 被污染后静默降级成低清画布', () => {
    const order: string[] = []
    const RealImage = global.Image

    // 记录两个属性的赋值先后
    class RecordingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 800
      height = 600
      naturalWidth = 800
      naturalHeight = 600
      private _crossOrigin: string | null = null
      private _src = ''
      set crossOrigin(value: string | null) {
        order.push('crossOrigin')
        this._crossOrigin = value
      }
      get crossOrigin() {
        return this._crossOrigin
      }
      set src(value: string) {
        order.push('src')
        this._src = value
      }
      get src() {
        return this._src
      }
    }
    ;(global as any).Image = RecordingImage

    const { drawer, container } = createDrawer('crossorigin-order', 800, 600, 1600, 1200)
    try {
      // exportAnnotationImage 的前置条件：已有底图
      ;(drawer as any).bgImage = { width: 1600, height: 1200 }

      void (drawer as any).exportAnnotationImage()

      expect(order.slice(0, 2)).toEqual(['crossOrigin', 'src'])
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
      ;(global as any).Image = RealImage
    }
  })

  it('与主画布路径 drawImage 的顺序保持一致', () => {
    const order: string[] = []
    const RealImage = global.Image

    class RecordingImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set crossOrigin(_value: string | null) {
        order.push('crossOrigin')
      }
      get crossOrigin() {
        return 'anonymous'
      }
      set src(_value: string) {
        order.push('src')
      }
      get src() {
        return ''
      }
    }
    ;(global as any).Image = RecordingImage

    const { drawer, container } = createDrawer('crossorigin-order-draw', 800, 600, 1600, 1200)
    try {
      ;(drawer as any).drawImage('https://example.com/a.png')
      expect(order.slice(0, 2)).toEqual(['crossOrigin', 'src'])
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
      ;(global as any).Image = RealImage
    }
  })
})
