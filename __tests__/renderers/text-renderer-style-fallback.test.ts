/**
 * 交互画布文本渲染：textData.style 缺字段时逐字段回退到全局默认。
 *
 * 与导出路径（Renderer.drawForExport）同源的缺陷：
 * 只判断 `textData.style` 是否存在是不够的 —— 外部直接写入 `textManager.textAnnotations`
 * 时 style 可能存在但缺字段：
 *   - 缺 font：`ctx.font = undefined` 被 canvas 静默忽略，沿用上一次的字体，度量全错；
 *   - 缺 color：`ctx.fillStyle = undefined` 同样被忽略，文字被画成**背景色** → 完全看不见。
 */

import { drawTextAnnotations } from '../../src/modules/renderers/text-renderer'

function makeCtx() {
  const ctx: Record<string, any> = {
    font: '10px sans-serif',
    strokeStyle: '',
    lineWidth: 1,
    setLineDash: jest.fn(),
    beginPath: jest.fn(),
    roundRect: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4
    }))
  }

  // 照实建模真 canvas 的访问器语义：赋 undefined / 非法值被静默忽略
  let fillStyle = ''
  Object.defineProperty(ctx, 'fillStyle', {
    get: () => fillStyle,
    set: (value: unknown) => {
      if (value !== undefined && value !== null) fillStyle = value as string
    },
    enumerable: true
  })

  return ctx
}

function makeTextManager(style: Record<string, unknown>) {
  return {
    textStyle: {
      font: '16px Arial',
      color: '#FFD700',
      padding: 6,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 4,
      selectedBorderColor: '#00D9FF'
    },
    textAnnotations: [
      {
        id: 'a',
        position: { x: 10, y: 10 },
        text: 'AB',
        style,
        width: 16,
        height: 16
      }
    ],
    editingTextIndex: -1,
    selectedTextIndex: -1,
    isEditingVisible: () => true
  }
}

const viewport = { offset: { x: 0, y: 0 }, scale: 1 } as any

/** 记录 fillText 落笔那一刻的 fillStyle */
function recordFillAtDraw(ctx: Record<string, any>): string[] {
  const fills: string[] = []
  ctx.fillText.mockImplementation(() => {
    fills.push(ctx.fillStyle as string)
  })
  return fills
}

describe('drawTextAnnotations：style 缺字段时回退到全局默认', () => {
  it('缺 color 时文字用全局默认色，不会被画成背景色（不可见）', () => {
    const ctx = makeCtx()
    const fills = recordFillAtDraw(ctx)

    drawTextAnnotations(
      ctx as any,
      viewport,
      makeTextManager({ font: '16px Arial', backgroundColor: '#123456' }) as any
    )

    expect(fills.length).toBe(1)
    expect(fills[0]).not.toBe('#123456')
    expect(fills[0]).toBe('#FFD700')
  })

  it('缺 font 时回退到全局默认字体', () => {
    const ctx = makeCtx()

    drawTextAnnotations(
      ctx as any,
      viewport,
      makeTextManager({ color: '#00FF00', backgroundColor: 'rgba(0,0,0,0.6)' }) as any
    )

    expect(ctx.font).toBe('16px Arial')
  })
})
