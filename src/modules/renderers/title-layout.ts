/**
 * 标注标题布局
 * 纯函数：根据标注锚定框、标题框尺寸、标题位置配置与图片边界，
 * 计算标题背景框左上角坐标（翻转优先 + 贴边兜底），并可直接用于「设置时」写回位置。
 */

import type { TitleAnchor } from './shape-renderer'
import type { Operate, Rect, Polygon, TitlePosition } from '../types'
import type { ViewportManager } from '../viewport'
import { parseFontSize } from './export-scale'

/** 图片矩形边界（坐标系由调用方决定） */
export type TitleBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 无边界约束（不传 bounds 时退化为固定位置） */
export const UNBOUNDED_TITLE_BOUNDS: TitleBounds = {
  minX: Number.NEGATIVE_INFINITY,
  minY: Number.NEGATIVE_INFINITY,
  maxX: Number.POSITIVE_INFINITY,
  maxY: Number.POSITIVE_INFINITY
}

export type TitleBoxInput = {
  /** 标注锚定框 */
  anchor: TitleAnchor
  /** 标题背景框宽 */
  boxWidth: number
  /** 标题背景框高 */
  boxHeight: number
  /** 标题位置配置 */
  position: TitlePosition
  /** 图片矩形；缺省为无约束（固定位置） */
  bounds?: TitleBounds
  /** 标注与标题之间的间距，默认 4 */
  gap?: number
}

export type TitleBox = { x: number; y: number }

/** 布局结果：包含实际采用的 vertical 与贴边补偿后的 offsetX */
export type TitleLayoutResult = {
  x: number
  y: number
  vertical: 'top' | 'bottom' | 'inside-top'
  align: 'left' | 'center' | 'right'
  offsetX: number
}

const DEFAULT_GAP = 4

/** 标注与标题之间的默认间距（画布像素；导出时需按倍率换算） */
export const DEFAULT_TITLE_GAP = DEFAULT_GAP

/** 标题框默认水平 / 垂直内边距（画布像素） */
export const DEFAULT_TITLE_PADDING_X = 6
export const DEFAULT_TITLE_PADDING_Y = 3

/** 标题文本布局结果（尺寸均为画布像素） */
export type TitleTextLayout = {
  /** 折行后的每一行（不含换行符） */
  lines: string[]
  /** 行高 */
  lineHeight: number
  /** 标题框总宽（含 paddingX） */
  boxWidth: number
  /** 标题框总高（含 paddingY） */
  boxHeight: number
  /** 最宽一行（不含 paddingX） */
  textWidth: number
}

export type TitleTextLayoutInput = {
  text: string
  /** 字体样式，如 "bold 12px Arial" */
  font: string
  paddingX?: number
  paddingY?: number
  /** 自动模式：行内最大宽度（不含 padding）；Infinity = 不换行 */
  maxTextWidth?: number
  /** 手动模式：标题框总宽（含 padding），优先于 maxTextWidth */
  boxWidth?: number
  measure: (text: string) => number
}

/**
 * 标题文本换行。
 *
 * - 贪心按宽度断行：中文逐字断；
 * - 英文优先在最近空格处断行（行首不留空格）；
 * - 单个单词超过最大宽度时按字符硬断；
 * - `maxTextWidth` 为 Infinity 时原样返回一行。
 */
export function wrapTitleText(
  text: string,
  maxTextWidth: number,
  measure: (text: string) => number
): string[] {
  if (!text) return ['']
  if (!Number.isFinite(maxTextWidth)) return [text]

  const limit = Math.max(1, maxTextWidth)
  if (measure(text) <= limit) return [text]

  const lines: string[] = []
  let line: string[] = []
  let lineWidth = 0
  let lastSpace = -1

  const measureChars = (chars: string[]): number =>
    chars.reduce((sum, ch) => sum + measure(ch), 0)

  /** 把 line 的前 endExclusive 个字符作为一行，剩余部分作为下一行起点 */
  const flush = (endExclusive: number): void => {
    const head = line.slice(0, endExclusive).join('').replace(/\s+$/, '')
    if (head) lines.push(head)
    const rest = line.slice(endExclusive)
    while (rest.length > 0 && /^\s$/.test(rest[0])) rest.shift()
    line = rest
    lineWidth = measureChars(rest)
    lastSpace = -1
    rest.forEach((ch, index) => {
      if (/\s/.test(ch)) lastSpace = index
    })
  }

  for (const ch of text) {
    const w = measure(ch)
    if (line.length > 0 && lineWidth + w > limit) {
      // 优先在空格处断，避免把英文单词劈开
      flush(lastSpace > 0 ? lastSpace : line.length)
    }
    line.push(ch)
    lineWidth += w
    if (/\s/.test(ch)) lastSpace = line.length - 1
  }

  const tail = line.join('').replace(/\s+$/, '')
  if (tail) lines.push(tail)
  return lines.length > 0 ? lines : ['']
}

/**
 * 计算标题框的折行与尺寸。
 *
 * - 单行时 `boxHeight` 与旧实现完全一致（`fontSize + 2*paddingY`），不改变已有短标题的观感；
 * - 自动模式框宽贴合最宽一行；手动模式框宽就是设定值；
 * - 行高固定为 `round(fontSize * 1.25)`。
 */
export function layoutTitleText(input: TitleTextLayoutInput): TitleTextLayout {
  const paddingX = input.paddingX ?? DEFAULT_TITLE_PADDING_X
  const paddingY = input.paddingY ?? DEFAULT_TITLE_PADDING_Y
  const text = input.text ?? ''
  const fontSize = parseFontSize(input.font)
  const lineHeight = Math.max(1, Math.round(fontSize * 1.25))

  const manualWidth = input.boxWidth
  let lines: string[]
  let boxWidth: number

  if (manualWidth != null && manualWidth > 0) {
    lines = wrapTitleText(text, Math.max(1, manualWidth - paddingX * 2), input.measure)
    boxWidth = manualWidth
  } else {
    lines = wrapTitleText(text, input.maxTextWidth ?? Infinity, input.measure)
    const maxLineWidth = lines.reduce((max, line) => Math.max(max, input.measure(line)), 0)
    boxWidth = maxLineWidth + paddingX * 2
  }

  const textWidth = lines.reduce((max, line) => Math.max(max, input.measure(line)), 0)
  const boxHeight = fontSize + (lines.length - 1) * lineHeight + paddingY * 2

  return { lines, lineHeight, boxWidth, boxHeight, textWidth }
}

/**
 * 按「标题位置」计算折行与尺寸：内部标题不许超过标注框宽，外置标题不超过图片宽；
 * 手动宽度优先，但不能超过图片宽。
 *
 * 单位必须一致（画布像素或导出像素），由调用方负责换算。
 */
export function computeTitleTextLayout(
  text: string,
  ctx: {
    font: string
    paddingX?: number
    paddingY?: number
    vertical?: TitlePosition['vertical']
    /** 图片宽度（当前单位） */
    imageWidth: number
    /** 标注框宽度（当前单位） */
    annotationWidth: number
    /** 手动标题框宽（当前单位）；0/undefined = 自动 */
    manualWidth?: number
    measure: (text: string) => number
  }
): TitleTextLayout {
  const paddingX = ctx.paddingX ?? DEFAULT_TITLE_PADDING_X
  const paddingY = ctx.paddingY ?? DEFAULT_TITLE_PADDING_Y
  const vertical = ctx.vertical || 'top'
  const imageWidth = ctx.imageWidth > 0 ? ctx.imageWidth : Infinity
  const wrapWidth = vertical === 'inside-top'
    ? (ctx.annotationWidth > 0 ? ctx.annotationWidth : imageWidth)
    : imageWidth

  let manualWidth: number | undefined
  if (ctx.manualWidth != null && ctx.manualWidth > 0) {
    const minWidth = Math.max(1, parseFontSize(ctx.font) + paddingX * 2)
    manualWidth = Math.min(Math.max(ctx.manualWidth, minWidth), imageWidth)
  }

  return layoutTitleText({
    text,
    font: ctx.font,
    paddingX,
    paddingY,
    boxWidth: manualWidth,
    maxTextWidth: wrapWidth - paddingX * 2,
    measure: ctx.measure
  })
}

/**
 * 选择标题的垂直落点：上 → 下 → 标注内部顶边。
 *
 * `base` 为调用方期望的位置；只有 `top` / `bottom` 会在放不下时互相翻转，
 * 两者都放不下时返回 `inside-top`。`inside-top` 原样返回，不再翻转。
 */
export function resolveTitleVertical(input: {
  anchor: TitleAnchor
  /** 外置标题框高度 */
  boxHeight: number
  base?: TitlePosition['vertical']
  gap?: number
  offsetY?: number
  bounds: TitleBounds
}): 'top' | 'bottom' | 'inside-top' {
  const base = input.base || 'top'
  if (base === 'inside-top') return 'inside-top'

  const gap = input.gap ?? DEFAULT_GAP
  const offsetY = input.offsetY ?? 0
  const { anchor, boxHeight, bounds } = input
  const topY = anchor.y - boxHeight - gap + offsetY
  const bottomY = anchor.y + anchor.height + gap + offsetY
  const topFits = topY >= bounds.minY
  const bottomFits = bottomY + boxHeight <= bounds.maxY

  if (base === 'bottom') {
    if (bottomFits) return 'bottom'
    if (topFits) return 'top'
    return 'inside-top'
  }

  if (topFits) return 'top'
  if (bottomFits) return 'bottom'
  return 'inside-top'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 计算标题布局：
 * - vertical：上/下放不下时翻转（inside-top 不翻转）
 * - 水平：按 align 计算后贴边，并通过 offsetX 记录贴边补偿
 * - 最后统一 clamp 兜底
 */
export function computeTitleLayout(input: TitleBoxInput): TitleLayoutResult {
  const { anchor, boxWidth, boxHeight, position } = input
  const bounds = input.bounds ?? UNBOUNDED_TITLE_BOUNDS
  const gap = input.gap ?? DEFAULT_GAP
  const baseOffsetX = position.offsetX ?? 0
  const offsetY = position.offsetY ?? 0

  // 水平：按 align 计算后贴边
  const align = position.align || 'center'
  let rawX: number
  switch (align) {
    case 'left':
      rawX = anchor.x + baseOffsetX
      break
    case 'right':
      rawX = anchor.x + anchor.width - boxWidth + baseOffsetX
      break
    case 'center':
    default:
      rawX = anchor.x + anchor.width / 2 - boxWidth / 2 + baseOffsetX
      break
  }
  const x = clamp(rawX, bounds.minX, Math.max(bounds.minX, bounds.maxX - boxWidth))
  const offsetX = baseOffsetX + (x - rawX)

  // 垂直：翻转优先，贴边兜底
  const baseVertical = position.vertical || 'top'
  let vertical: TitleLayoutResult['vertical'] = baseVertical
  let y: number
  if (baseVertical === 'inside-top') {
    y = anchor.y + gap + offsetY
  } else if (baseVertical === 'bottom') {
    y = anchor.y + anchor.height + gap + offsetY
    if (y + boxHeight > bounds.maxY) {
      vertical = 'top'
      y = anchor.y - boxHeight - gap + offsetY
    }
  } else {
    y = anchor.y - boxHeight - gap + offsetY
    if (y < bounds.minY) {
      vertical = 'bottom'
      y = anchor.y + anchor.height + gap + offsetY
    }
  }
  y = clamp(y, bounds.minY, Math.max(bounds.minY, bounds.maxY - boxHeight))

  return { x, y, vertical, align, offsetX }
}

/** 计算标题背景框左上角坐标（computeTitleLayout 的薄封装） */
export function computeTitleBox(input: TitleBoxInput): TitleBox {
  const { x, y } = computeTitleLayout(input)
  return { x, y }
}

/**
 * 计算标注标题锚定框（矩形取 start/width/height；多边形取顶点包围盒，空返回 null）。
 * 传 viewport 返回画布坐标，缺省返回原始图像坐标。
 */
export function getTitleAnchor(
  record: Operate<Rect | Polygon>,
  viewport?: ViewportManager
): TitleAnchor | null {
  if (record.type === 'polygon') {
    const polygon = record.data as Polygon[]
    if (polygon.length === 0) return null
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    polygon.forEach((p) => {
      const px = viewport ? viewport.offset.x + p.point.x * viewport.scale : p.point.x
      const py = viewport ? viewport.offset.y + p.point.y * viewport.scale : p.point.y
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  const rect = record.data[0] as Rect
  if (viewport) {
    return {
      x: viewport.offset.x + rect.start.x * viewport.scale,
      y: viewport.offset.y + rect.start.y * viewport.scale,
      width: rect.width * viewport.scale,
      height: rect.height * viewport.scale
    }
  }
  return { x: rect.start.x, y: rect.start.y, width: rect.width, height: rect.height }
}
