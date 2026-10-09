import { computeTitleBox, UNBOUNDED_TITLE_BOUNDS } from '../../src/modules/renderers/title-layout'
import type { TitleBounds } from '../../src/modules/renderers/title-layout'

const anchor = { x: 100, y: 100, width: 100, height: 50 }
const bounds: TitleBounds = { minX: 0, minY: 0, maxX: 300, maxY: 300 }

describe('computeTitleBox 垂直翻转', () => {
  it('top 上方空间充足时保持在标注上方', () => {
    const r = computeTitleBox({ anchor, boxWidth: 40, boxHeight: 18, position: { vertical: 'top' }, bounds })
    expect(r.y).toBe(78) // 100 - 18 - 4
  })

  it('top 上方放不下时翻转到下方', () => {
    const nearTop = { x: 100, y: 2, width: 100, height: 50 }
    const r = computeTitleBox({ anchor: nearTop, boxWidth: 40, boxHeight: 18, position: { vertical: 'top' }, bounds })
    expect(r.y).toBe(56) // 2 + 50 + 4
  })

  it('bottom 下方放不下时翻转到上方', () => {
    const nearBottom = { x: 100, y: 240, width: 100, height: 50 }
    const r = computeTitleBox({ anchor: nearBottom, boxWidth: 40, boxHeight: 18, position: { vertical: 'bottom' }, bounds })
    expect(r.y).toBe(218) // bottom 294+18>300 → 240 - 18 - 4
  })

  it('inside-top 不翻转，位于标注内部上方', () => {
    const nearTop = { x: 100, y: 2, width: 100, height: 50 }
    const r = computeTitleBox({ anchor: nearTop, boxWidth: 40, boxHeight: 18, position: { vertical: 'inside-top' }, bounds })
    expect(r.y).toBe(6) // 2 + 4
  })
})

describe('computeTitleBox 水平贴边', () => {
  it('align=left 贴左边时 x 不小于图片 minX', () => {
    const nearLeft = { x: -20, y: 100, width: 100, height: 50 }
    const r = computeTitleBox({ anchor: nearLeft, boxWidth: 40, boxHeight: 18, position: { align: 'left' }, bounds })
    expect(r.x).toBe(0)
  })

  it('align=right 贴右边时 x 不大于 maxX - boxWidth', () => {
    const nearRight = { x: 280, y: 100, width: 100, height: 50 }
    const r = computeTitleBox({ anchor: nearRight, boxWidth: 40, boxHeight: 18, position: { align: 'right' }, bounds })
    expect(r.x).toBe(260) // 340 → clamp 到 300 - 40
  })

  it('align=center 两侧越界时贴边', () => {
    const nearLeft = { x: -20, y: 100, width: 10, height: 50 }
    const r = computeTitleBox({ anchor: nearLeft, boxWidth: 40, boxHeight: 18, position: { align: 'center' }, bounds })
    expect(r.x).toBe(0)
  })
})

describe('computeTitleBox 偏移与退化', () => {
  it('offsetX / offsetY 未越界时生效', () => {
    const r = computeTitleBox({
      anchor,
      boxWidth: 40,
      boxHeight: 18,
      position: { vertical: 'top', align: 'center', offsetX: 5, offsetY: -3 },
      bounds
    })
    expect(r).toEqual({ x: 135, y: 75 }) // x: 100+50-20+5, y: 100-18-4-3
  })

  it('标题框大于图片时退化为贴左上', () => {
    const r = computeTitleBox({ anchor, boxWidth: 500, boxHeight: 500, position: { vertical: 'top', align: 'center' }, bounds })
    expect(r).toEqual({ x: 0, y: 0 })
  })

  it('gap 可覆盖默认值', () => {
    const r = computeTitleBox({ anchor, boxWidth: 40, boxHeight: 18, position: { vertical: 'inside-top' }, bounds, gap: 10 })
    expect(r.y).toBe(110) // 100 + 10
  })

  it('无限边界时等价于固定位置', () => {
    const r = computeTitleBox({
      anchor,
      boxWidth: 40,
      boxHeight: 18,
      position: { vertical: 'top', align: 'center' },
      bounds: UNBOUNDED_TITLE_BOUNDS
    })
    expect(r).toEqual({ x: 130, y: 78 }) // 100+50-20, 100-18-4
  })
})
