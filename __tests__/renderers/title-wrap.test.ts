import {
  layoutTitleText,
  resolveTitleVertical,
  wrapTitleText
} from '../../src/modules/renderers/title-layout'

/** 与 setup.ts 的 canvas mock 保持一致：每个字符 8px */
const measure = (text: string) => text.length * 8

describe('wrapTitleText 按宽度断行', () => {
  it('放得下时不换行', () => {
    expect(wrapTitleText('abc', 80, measure)).toEqual(['abc'])
  })

  it('中文逐字断行', () => {
    expect(wrapTitleText('一二三四五六七八九十', 32, measure)).toEqual([
      '一二三四',
      '五六七八',
      '九十'
    ])
  })

  it('英文优先在空格处断行，行首不留空格', () => {
    expect(wrapTitleText('hello world foo', 80, measure)).toEqual(['hello', 'world foo'])
  })

  it('单个超长单词按字符硬断', () => {
    expect(wrapTitleText('abcdefghij', 24, measure)).toEqual(['abc', 'def', 'ghi', 'j'])
  })

  it('Infinity 表示不换行', () => {
    expect(wrapTitleText('一二三四五六七八九十', Infinity, measure)).toEqual(['一二三四五六七八九十'])
  })

  it('空文本返回一个空行', () => {
    expect(wrapTitleText('', 40, measure)).toEqual([''])
  })

  it('无空格中文断行后文字全部保留', () => {
    const text = '这是一个很长的中文标题需要换行显示'
    expect(wrapTitleText(text, 48, measure).join('')).toBe(text)
  })
})

describe('layoutTitleText 尺寸', () => {
  it('单行尺寸与旧实现一致（fontSize + 2*paddingY）', () => {
    const r = layoutTitleText({ text: 'A', font: '12px Arial', measure })
    expect(r.lines).toEqual(['A'])
    expect(r.lineHeight).toBe(15)
    expect(r.boxWidth).toBe(8 + 6 * 2)
    expect(r.boxHeight).toBe(12 + 3 * 2)
  })

  it('多行按行高累加，框宽贴合最宽行', () => {
    const r = layoutTitleText({
      text: '一二三四五六七八九十',
      font: '12px Arial',
      maxTextWidth: 32,
      measure
    })
    expect(r.lines).toHaveLength(3)
    expect(r.lineHeight).toBe(15)
    expect(r.textWidth).toBe(32)
    expect(r.boxWidth).toBe(32 + 12)
    expect(r.boxHeight).toBe(12 + 2 * 15 + 6)
  })

  it('手动宽度精确生效，即使文字更窄', () => {
    const r = layoutTitleText({ text: 'A', font: '12px Arial', boxWidth: 100, measure })
    expect(r.boxWidth).toBe(100)
    expect(r.lines).toEqual(['A'])
  })

  it('手动宽度决定换行内宽', () => {
    const r = layoutTitleText({
      text: '一二三四五六七八九十',
      font: '12px Arial',
      boxWidth: 44,
      measure
    })
    // 内宽 44 - 12 = 32 → 每行 4 个字
    expect(r.lines).toEqual(['一二三四', '五六七八', '九十'])
    expect(r.boxWidth).toBe(44)
  })

  it('自定义 padding 与字体字号', () => {
    const r = layoutTitleText({
      text: 'ab',
      font: 'bold 20px Arial',
      paddingX: 2,
      paddingY: 1,
      measure
    })
    expect(r.lineHeight).toBe(25)
    expect(r.boxWidth).toBe(16 + 4)
    expect(r.boxHeight).toBe(20 + 2)
  })
})

describe('resolveTitleVertical 上下/内部兜底', () => {
  const bounds = { minX: 0, minY: 0, maxX: 300, maxY: 300 }

  it('上方放得下 → top', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 100, width: 100, height: 50 },
        boxHeight: 18,
        base: 'top',
        bounds
      })
    ).toBe('top')
  })

  it('上方放不下、下方放得下 → bottom', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 2, width: 100, height: 50 },
        boxHeight: 18,
        base: 'top',
        bounds
      })
    ).toBe('bottom')
  })

  it('上下都放不下 → inside-top（和图片等高的标注）', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 0, width: 100, height: 300 },
        boxHeight: 18,
        base: 'top',
        bounds
      })
    ).toBe('inside-top')
  })

  it('base=bottom 下方放不下、上方放得下 → top', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 240, width: 100, height: 50 },
        boxHeight: 18,
        base: 'bottom',
        bounds
      })
    ).toBe('top')
  })

  it('base=inside-top 不翻转', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 0, width: 100, height: 300 },
        boxHeight: 18,
        base: 'inside-top',
        bounds
      })
    ).toBe('inside-top')
  })

  it('offsetY 参与放不下判断', () => {
    expect(
      resolveTitleVertical({
        anchor: { x: 100, y: 30, width: 100, height: 50 },
        boxHeight: 18,
        base: 'top',
        offsetY: -20,
        bounds
      })
    ).toBe('bottom')
  })
})
