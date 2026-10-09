/**
 * 标注标题布局
 * 纯函数：根据标注锚定框、标题框尺寸、标题位置配置与图片边界，
 * 计算标题背景框左上角坐标（翻转优先 + 贴边兜底）。
 */

import type { TitleAnchor } from './shape-renderer'
import type { TitlePosition } from '../types'

/** 图片矩形边界（坐标系由调用方决定） */
export type TitleBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** 无边界约束（图片尺寸无效时退化为固定位置） */
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
  /** 图片矩形 */
  bounds: TitleBounds
  /** 标注与标题之间的间距，默认 4 */
  gap?: number
}

export type TitleBox = { x: number; y: number }

const DEFAULT_GAP = 4

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 计算标题背景框左上角坐标。
 * 垂直：上/下放不下时翻转；水平：按 align 计算后贴边；最后统一 clamp 兜底。
 */
export function computeTitleBox(input: TitleBoxInput): TitleBox {
  const { anchor, boxWidth, boxHeight, position, bounds } = input
  const gap = input.gap ?? DEFAULT_GAP
  const offsetX = position.offsetX ?? 0
  const offsetY = position.offsetY ?? 0

  // 水平：按 align 计算后贴边
  const align = position.align || 'center'
  let x: number
  switch (align) {
    case 'left':
      x = anchor.x + offsetX
      break
    case 'right':
      x = anchor.x + anchor.width - boxWidth + offsetX
      break
    case 'center':
    default:
      x = anchor.x + anchor.width / 2 - boxWidth / 2 + offsetX
      break
  }
  x = clamp(x, bounds.minX, Math.max(bounds.minX, bounds.maxX - boxWidth))

  // 垂直：翻转优先，贴边兜底
  const vertical = position.vertical || 'top'
  let y: number
  if (vertical === 'inside-top') {
    y = anchor.y + gap + offsetY
  } else if (vertical === 'bottom') {
    y = anchor.y + anchor.height + gap + offsetY
    if (y + boxHeight > bounds.maxY) {
      y = anchor.y - boxHeight - gap + offsetY
    }
  } else {
    // top（含缺省）
    y = anchor.y - boxHeight - gap + offsetY
    if (y < bounds.minY) {
      y = anchor.y + anchor.height + gap + offsetY
    }
  }
  y = clamp(y, bounds.minY, Math.max(bounds.minY, bounds.maxY - boxHeight))

  return { x, y }
}
