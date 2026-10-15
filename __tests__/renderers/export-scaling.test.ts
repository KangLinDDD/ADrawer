/**
 * 导出缩放（export pixel ratio）
 *
 * 导出图是「原始图像分辨率」，而交互画布只有「容器分辨率」，
 * 两者相差 1 / viewport.scale 倍。画布上按像素给定的量（字号、内边距、圆角、
 * 线宽、顶点半径、标题间距与偏移）必须同倍放大，否则导出图里的文字
 * 相对整张图会变得极小 —— 页面把导出图缩进小面板显示时，文字会被重采样成糊点。
 */

import Drawer from '../../src/index'

type Stub = Record<string, any>

function makeCtx(): Stub {
  return {
    font: '10px sans-serif',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
    save: jest.fn(),
    restore: jest.fn(),
    setLineDash: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    roundRect: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    drawImage: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4
    }))
  }
}

/**
 * containerW/H 为容器尺寸，imageW/H 为底图原始尺寸。
 * viewport.scale = min(containerW / imageW, containerH / imageH)
 */
function createDrawer(
  id: string,
  containerW: number,
  containerH: number,
  imageW: number,
  imageH: number
): { drawer: Drawer; container: HTMLDivElement } {
  const container = document.createElement('div')
  container.id = id
  Object.defineProperty(container, 'clientWidth', { value: containerW })
  Object.defineProperty(container, 'clientHeight', { value: containerH })
  document.body.appendChild(container)

  const drawer = new Drawer({ id, useEvents: false, enableTitle: true })
  const viewport = (drawer as any).viewport
  viewport.setSize(containerW, containerH)
  viewport.setOriginalSize(imageW, imageH)
  viewport.calculateInitialView()
  return { drawer, container }
}

function pushRect(drawer: Drawer): void {
  ;(drawer as any).annotationManager.recordList.push({
    type: 'rect',
    data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
    status: 'fullfilled'
  })
}

function pushPolygon(drawer: Drawer): void {
  ;(drawer as any).annotationManager.recordList.push({
    type: 'polygon',
    data: [
      { point: { x: 100, y: 100 } },
      { point: { x: 200, y: 100 } },
      { point: { x: 150, y: 200 } }
    ],
    status: 'fullfilled'
  })
}

/** 统一的标题样式：14px 字号 / 6 水平内边距 / 3 垂直内边距 / 2 圆角 */
function applyTitleStyle(drawer: Drawer): void {
  const manager = (drawer as any).annotationManager
  manager.setTitleStyle({
    font: '14px Arial',
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 77, 79, 0.85)',
    paddingX: 6,
    paddingY: 3,
    borderRadius: 2
  })
  manager.setTitlePosition({ vertical: 'top', align: 'left' })
}

/** 标题框的 roundRect：宽高来自标题文本度量 + 内边距（文本 'ABC' → 宽 24） */
function titleBoxCall(ctx: Stub): number[] | undefined {
  return ctx.roundRect.mock.calls.find((c: number[]) => c[2] === 24 + 2 * 6 || c[2] === 24 + 2 * 12)
}

describe('drawForExport：导出图按 1 / viewport.scale 放大画布像素量', () => {
  const drawers: Array<{ drawer: Drawer; container: HTMLDivElement }> = []

  afterEach(() => {
    drawers.forEach(({ drawer, container }) => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
    drawers.length = 0
  })

  const open = (
    id: string,
    containerW: number,
    containerH: number,
    imageW: number,
    imageH: number
  ) => {
    const created = createDrawer(id, containerW, containerH, imageW, imageH)
    drawers.push(created)
    return created.drawer
  }

  it('scale = 1（画布与原图等大）时保持原有导出行为', () => {
    const drawer = open('export-scale-1', 800, 600, 800, 600)
    pushRect(drawer)
    applyTitleStyle(drawer)
    ;(drawer as any).annotationManager.setTitle(0, 'ABC')

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 800, 600)

    expect(ctx.font).toBe('14px Arial')
    expect(titleBoxCall(ctx)?.slice(2, 4)).toEqual([36, 20])
    expect(ctx.lineWidth).toBe(5)
  })

  it('scale = 0.5（1600x1200 原图装进 800x600 画布）时字号/内边距/圆角/线宽一律翻倍', () => {
    const drawer = open('export-scale-2', 800, 600, 1600, 1200)
    pushRect(drawer)
    applyTitleStyle(drawer)
    ;(drawer as any).annotationManager.setTitle(0, 'ABC')

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    // 14px → 28px；paddingX 6 → 12、paddingY 3 → 6；boxW = 24 + 24 = 48，boxH = 28 + 12 = 40
    expect(ctx.font).toBe('28px Arial')
    expect(titleBoxCall(ctx)?.slice(2, 4)).toEqual([48, 40])
    // 圆角 2 → 4
    expect(titleBoxCall(ctx)?.[4]).toBe(4)
    // 线宽 5 → 10
    expect(ctx.lineWidth).toBe(10)
  })

  it('标题位置随倍率换算：间距 gap 与内边距一起放大', () => {
    const drawer = open('export-scale-3', 800, 600, 1600, 1200)
    pushRect(drawer)
    applyTitleStyle(drawer)
    ;(drawer as any).annotationManager.setTitle(0, 'ABC')

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    // 锚点 y=100，框高 40，gap 4*2=8 → bgY = 52；paddingY 3*2=6 → fillText y = 58
    const call = ctx.fillText.mock.calls.find((c: any[]) => c[0] === 'ABC')
    expect(call).toBeTruthy()
    expect(call![1]).toBe(112) // x = 100 + paddingX 12
    expect(call![2]).toBe(58)
  })

  it('多边形顶点半径随倍率放大（屏幕 4px → 原图 8px）', () => {
    const drawer = open('export-scale-4', 800, 600, 1600, 1200)
    pushPolygon(drawer)

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    const radii = ctx.arc.mock.calls.map((c: any[]) => c[2])
    expect(radii.length).toBeGreaterThan(0)
    expect(radii.every((r: number) => r === 8)).toBe(true)
  })

  it('文本标注的字号/内边距/圆角同样随倍率放大', () => {
    const drawer = open('export-scale-5', 800, 600, 1600, 1200)
    const manager = (drawer as any).textManager
    manager.setTextStyle({ font: '16px Arial', padding: 6, borderRadius: 4 })
    manager.addTextAnnotation(50, 50, '文本')
    manager.finishEditing()

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    // 16px → 32px
    expect(ctx.font).toBe('32px Arial')
    // 框高 = 文字高(12+4) + 2 * (padding 6 → 12) = 40；圆角 4 → 8
    const call = ctx.roundRect.mock.calls.find((c: number[]) => c[3] === 40)
    expect(call).toBeTruthy()
    expect(call![4]).toBe(8)
  })

  it('视口缩放到 0 时退化为 1 倍，不产生 NaN', () => {
    const drawer = open('export-scale-6', 800, 600, 1600, 1200)
    ;(drawer as any).viewport.scale = 0
    pushRect(drawer)
    applyTitleStyle(drawer)
    ;(drawer as any).annotationManager.setTitle(0, 'ABC')

    const ctx = makeCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    expect(ctx.font).toBe('14px Arial')
    expect(
      ctx.fillText.mock.calls.every((c: any[]) => Number.isFinite(c[1]) && Number.isFinite(c[2]))
    ).toBe(true)
  })
})
