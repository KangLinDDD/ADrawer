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
import {
  DEFAULT_EXPORT_QUALITY,
  getImageTypeFromUrl,
  toCanvasImageType,
} from '../src/index'

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

let exportSeq = 0

/** 造一个已 drawImage() 完成（底图 onload 已触发）的 Drawer */
async function drawerWithImage(url: string) {
  const { drawer, container } = createDrawer(`export-type-${++exportSeq}`, 800, 600, 1600, 1200)
  drawer.drawImage(url)
  // setup 里的 MockImage 用 setTimeout(…, 0) 触发 onload
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { drawer, container }
}

/**
 * 导出格式：`toDataURL(type)` 只认 `png` / `jpeg` / `webp`。
 *
 * 之前把 URL 后缀直接拼成 `image/${ext}`，于是 `.jpg` 底图传的是 `image/jpg` —— 不是合法的
 * canvas 编码类型，浏览器**静默回落成 PNG**：业务拿到的 data URL 是 `data:image/png`，
 * 文件名却按原图后缀写成 `.jpg`，内容与后缀脱节（上传 / 回填按后缀校验就会出问题）。
 */
describe('exportAnnotationImage：导出类型必须是 canvas 能真正编码的类型', () => {
  const CASES: Array<[string, string]> = [
    // image/jpg 不被支持，必须映射成 image/jpeg
    ['https://example.com/raw.jpg', 'image/jpeg'],
    ['https://example.com/raw.jpeg', 'image/jpeg'],
    ['https://example.com/raw.png', 'image/png'],
    ['https://example.com/raw.webp', 'image/webp'],
    // canvas 编码不出这几种，浏览器会回落 PNG —— 类型必须如实是 png
    ['https://example.com/raw.gif', 'image/png'],
    ['https://example.com/raw.bmp', 'image/png'],
    ['https://example.com/raw.svg', 'image/png'],
    // 无后缀（常见于 OSS / 带 query 的下载地址）→ 沿用历史默认 jpeg
    ['https://example.com/api/blob?id=1', 'image/jpeg'],
  ]

  afterEach(() => {
    ;(HTMLCanvasElement.prototype.toDataURL as jest.Mock).mockClear()
  })

  it.each(CASES)('%s 导出为 %s', async (url, expectedType) => {
    const { drawer, container } = await drawerWithImage(url)
    try {
      const base64 = await drawer.exportAnnotationImage()

      // png 无损、不接受质量参数；jpeg / webp 用默认质量
      if (expectedType === 'image/png') {
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(expectedType)
      } else {
        expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
          expectedType,
          DEFAULT_EXPORT_QUALITY,
        )
      }
      expect(base64.startsWith(`data:${expectedType};`)).toBe(true)
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    }
  })

  it('exportCurrentViewImage 同样使用归一化后的类型', async () => {
    const { drawer, container } = await drawerWithImage('https://example.com/raw.jpg')
    try {
      const base64 = await drawer.exportCurrentViewImage()

      expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith(
        'image/jpeg',
        DEFAULT_EXPORT_QUALITY,
      )
      expect(base64.startsWith('data:image/jpeg;')).toBe(true)
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    }
  })

  describe('toCanvasImageType', () => {
    it('jpg / jpeg 归一成 jpeg（image/jpg 不是合法编码类型）', () => {
      expect(toCanvasImageType('jpg')).toBe('jpeg')
      expect(toCanvasImageType('jpeg')).toBe('jpeg')
      expect(toCanvasImageType('JPG')).toBe('jpeg')
    })

    it('png / webp 原样保留', () => {
      expect(toCanvasImageType('png')).toBe('png')
      expect(toCanvasImageType('webp')).toBe('webp')
    })

    it('canvas 编码不出的格式回落 png', () => {
      expect(toCanvasImageType('gif')).toBe('png')
      expect(toCanvasImageType('bmp')).toBe('png')
      expect(toCanvasImageType('svg')).toBe('png')
      expect(toCanvasImageType('')).toBe('png')
    })

    it('与 getImageTypeFromUrl 串联后，任何 URL 都能拿到可编码类型', () => {
      const urls = CASES.map(([url]) => url)
      urls.forEach((url) => {
        expect(['png', 'jpeg', 'webp']).toContain(toCanvasImageType(getImageTypeFromUrl(url)))
      })
    })
  })
})

/**
 * 导出选项 `{ type, quality }`。
 *
 * 默认值：`type` 跟随底图（见上一个 describe），`quality` 为 `DEFAULT_EXPORT_QUALITY`（0.92）——
 * 标注多是细线和小字，0.7 压缩后放大查看会糊。`png` 无损，不接受质量参数，因此
 * `toDataURL()` 只传一个参数（而不是传个被忽略的 quality 让人误以为生效）。
 */
describe('exportAnnotationImage(options)：type / quality 可覆盖', () => {
  const toDataURL = () => HTMLCanvasElement.prototype.toDataURL as jest.Mock

  afterEach(() => {
    toDataURL().mockClear()
  })

  async function exportWith(options?: { type?: 'png' | 'jpeg' | 'webp' | 'jpg'; quality?: number }) {
    const { drawer, container } = await drawerWithImage('https://example.com/raw.jpg')
    try {
      const base64 = await drawer.exportAnnotationImage(options)
      return base64
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    }
  }

  it('默认：jpeg 底图用默认质量 0.92（不再是 0.7）', async () => {
    await exportWith()

    expect(toDataURL()).toHaveBeenCalledWith('image/jpeg', DEFAULT_EXPORT_QUALITY)
    expect(DEFAULT_EXPORT_QUALITY).toBeGreaterThan(0.7)
  })

  it('type 覆盖底图格式：.jpg 底图也能导出无损 png', async () => {
    const base64 = await exportWith({ type: 'png' })

    expect(toDataURL()).toHaveBeenCalledWith('image/png')
    expect(base64.startsWith('data:image/png;')).toBe(true)
  })

  it("type 传 'jpg' 等价于 'jpeg'（不能拼出非法的 image/jpg）", async () => {
    await exportWith({ type: 'jpg' })

    expect(toDataURL()).toHaveBeenCalledWith('image/jpeg', DEFAULT_EXPORT_QUALITY)
  })

  it('quality 生效：0.8 → toDataURL(image/jpeg, 0.8)', async () => {
    await exportWith({ quality: 0.8 })

    expect(toDataURL()).toHaveBeenCalledWith('image/jpeg', 0.8)
  })

  it('png 不带质量参数（无损格式忽略 quality）', async () => {
    await exportWith({ type: 'png', quality: 0.3 })

    expect(toDataURL()).toHaveBeenCalledWith('image/png')
    expect(toDataURL().mock.calls[0]).toHaveLength(1)
  })

  it('越界质量裁剪到 0–1', async () => {
    await exportWith({ quality: 1.5 })
    expect(toDataURL()).toHaveBeenLastCalledWith('image/jpeg', 1)

    await exportWith({ quality: -1 })
    expect(toDataURL()).toHaveBeenLastCalledWith('image/jpeg', 0)
  })

  it('非数字质量回落默认值', async () => {
    await exportWith({ quality: Number.NaN })

    expect(toDataURL()).toHaveBeenLastCalledWith('image/jpeg', DEFAULT_EXPORT_QUALITY)
  })

  it('离屏导出失败降级到交互画布时，沿用同一套 options', async () => {
    const { drawer, container } = await drawerWithImage('https://example.com/raw.jpg')
    try {
      // 模拟离屏绘制抛错（例如跨域图被污染）→ 走 exportCurrentViewImage 降级
      ;(drawer as any).renderer.drawForExport = () => {
        throw new Error('boom')
      }

      const base64 = await drawer.exportAnnotationImage({ type: 'webp', quality: 0.5 })

      expect(toDataURL()).toHaveBeenCalledWith('image/webp', 0.5)
      expect(base64.startsWith('data:image/webp;')).toBe(true)
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    }
  })

  it('exportCurrentViewImage 也接受同样的 options', async () => {
    const { drawer, container } = await drawerWithImage('https://example.com/raw.png')
    try {
      const base64 = await drawer.exportCurrentViewImage({ type: 'jpeg', quality: 0.6 })

      expect(toDataURL()).toHaveBeenCalledWith('image/jpeg', 0.6)
      expect(base64.startsWith('data:image/jpeg;')).toBe(true)
    } finally {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    }
  })
})
