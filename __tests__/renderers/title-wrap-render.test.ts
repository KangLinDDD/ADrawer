import Drawer from '../../src/index'
import { createDrawerWithImage } from '../helpers'

const am = (d: Drawer) => (d as any).annotationManager
const ctxOf = (d: Drawer) => (d as any).ctx

describe('标题换行渲染（画布 + 导出）', () => {
  const cleanup: (() => void)[] = []
  const open = async (id: string) => {
    const created = await createDrawerWithImage(id, { enableTitle: true })
    cleanup.push(() => {
      created.drawer.destroy()
      if (created.container.parentNode) created.container.parentNode.removeChild(created.container)
    })
    return created
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  const pushRect = (drawer: Drawer, start: { x: number; y: number }, width = 50, height = 50) => {
    am(drawer).recordList.push({ type: 'rect', data: [{ start, width, height }], status: 'fullfilled' })
  }

  it('超宽标题在画布上分行绘制，且每行都在图片内', async () => {
    const { drawer } = await open('render-wrap')
    pushRect(drawer, { x: 700, y: 100 })
    const title = '一'.repeat(200)
    drawer.setAnnotationTitle(0, title)

    const ctx = ctxOf(drawer)
    ctx.fillText.mockClear()
    ;(drawer as any).render()

    const lines = ctx.fillText.mock.calls.map((call: any[]) => call[0] as string)
    expect(lines.join('')).toBe(title)
    expect(lines).toHaveLength(3)
    expect(lines.map((line: string) => line.length)).toEqual([98, 98, 4])

    ctx.fillText.mock.calls.forEach((call: any[]) => {
      const [text, x] = call as [string, number]
      expect(x + text.length * 8).toBeLessThanOrEqual(800)
      expect(x).toBeGreaterThanOrEqual(0)
    })
  })

  it('和图片等高的标注，标题画在标注内部顶边', async () => {
    const { drawer } = await open('render-inside')
    pushRect(drawer, { x: 100, y: 0 }, 100, 600)
    drawer.setAnnotationTitle(0, 'A')

    const ctx = ctxOf(drawer)
    ctx.fillText.mockClear()
    ;(drawer as any).render()

    const call = ctx.fillText.mock.calls.find((c: any[]) => c[0] === 'A') as any[]
    expect(call).toBeTruthy()
    expect(call[2]).toBeLessThan(50) // 贴着标注顶部，而不是图片下方
    expect(call[1]).toBeGreaterThanOrEqual(100)
  })

  it('选中标注时绘制标题虚线框与右边缘把手', async () => {
    const { drawer } = await open('render-chrome')
    pushRect(drawer, { x: 300, y: 300 })
    drawer.setAnnotationTitle(0, 'A')
    drawer.selectAnnotation(0)

    const ctx = ctxOf(drawer)
    ctx.strokeRect.mockClear()
    ctx.fillRect.mockClear()
    ;(drawer as any).render()

    expect(ctx.strokeRect).toHaveBeenCalled()
    expect(
      ctx.fillRect.mock.calls.some((c: number[]) => c[2] === 6 && c[3] === 20)
    ).toBe(true)
  })

  it('导出图同样分行绘制且不越界，不导出选中框', async () => {
    const { drawer } = await open('render-export-wrap')
    pushRect(drawer, { x: 700, y: 100 })
    const title = '一'.repeat(200)
    drawer.setAnnotationTitle(0, title)
    drawer.selectAnnotation(0)

    const ctx = ctxOf(drawer)
    ctx.fillText.mockClear()
    ctx.roundRect.mockClear()
    ctx.strokeRect.mockClear()
    ctx.fillRect.mockClear()
    ;(drawer as any).renderer.drawForExport(ctx, new Image(), 800, 600)

    const lines = ctx.fillText.mock.calls.map((call: any[]) => call[0] as string)
    expect(lines.join('')).toBe(title)
    expect(lines).toHaveLength(3)
    ctx.fillText.mock.calls.forEach((call: any[]) => {
      const [text, x] = call as [string, number]
      expect(x + text.length * 8).toBeLessThanOrEqual(800)
    })

    // 标题背景框（宽 796）在图片内；多行高度 > 单行 18
    const box = ctx.roundRect.mock.calls.find((c: number[]) => c[2] === 796)
    expect(box).toBeTruthy()
    expect(box![2] + box![0]).toBeLessThanOrEqual(800)
    expect(box![3]).toBeGreaterThan(18)

    // 选中框/把手不进入导出图（背景框 796 宽，选中虚线框只会在画布渲染时出现）
    expect(ctx.strokeRect.mock.calls.some((c: number[]) => c[2] === 796)).toBe(false)
    expect(ctx.fillRect.mock.calls.some((c: number[]) => c[2] === 6 && c[3] === 20)).toBe(false)
  })
})
