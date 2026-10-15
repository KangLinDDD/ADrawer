/**
 * 标注标题布局
 * 纯函数：根据标注锚定框、标题框尺寸、标题位置配置与图片边界，
 * 计算标题背景框左上角坐标（翻转优先 + 贴边兜底），并可直接用于「设置时」写回位置。
 */

import type { TitleAnchor } from './shape-renderer'
import type { Operate, Rect, Polygon, TitlePosition } from '../types'
import type { ViewportManager } from '../viewport'

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
