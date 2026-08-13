/**
 * 矩形渲染策略
 * 搬运自 renderer.ts：drawRect / drawRectSelectionHighlight / 标题锚定 rect 分支 / drawForExport rect 分支
 */

import type { Operate, Rect, Polygon, AnnotationStyle, SelectionStyle } from '../types'
import type { ViewportManager } from '../viewport'
import type { AnnotationStore } from '../annotation-store'
import type { ShapeRenderStrategy, TitleAnchor } from './shape-renderer'

export class RectRenderer implements ShapeRenderStrategy {
  /**
   * 绘制矩形（原 drawRect；ctx 状态由渲染管线设置，原 _isSelected 参数本就未使用，移除）
   */
  draw(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    record: Operate<Rect | Polygon>,
    _style: AnnotationStyle
  ): void {
    const rect = record.data[0] as Rect
    ctx.strokeRect(
      viewport.offset.x + rect.start.x * viewport.scale,
      viewport.offset.y + rect.start.y * viewport.scale,
      rect.width * viewport.scale,
      rect.height * viewport.scale
    )
  }

  /**
   * 绘制正在进行中的矩形（原 drawAnnotations 中 operate.type === "rect" 分支）
   */
  drawInProgress(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    store: AnnotationStore
  ): void {
    const rect = store.operate.data[0] as Rect
    ctx.strokeRect(
      viewport.offset.x + rect.start.x * viewport.scale,
      viewport.offset.y + rect.start.y * viewport.scale,
      rect.width * viewport.scale,
      rect.height * viewport.scale
    )
  }

  /**
   * 绘制矩形选中高亮（原 drawRectSelectionHighlight；locked=true 时不画四个角控制点）
   */
  drawSelection(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    record: Operate<Rect | Polygon>,
    style: SelectionStyle,
    locked: boolean
  ): void {
    const rect = record.data[0] as Rect
    const x = viewport.offset.x + rect.start.x * viewport.scale
    const y = viewport.offset.y + rect.start.y * viewport.scale
    const w = rect.width * viewport.scale
    const h = rect.height * viewport.scale

    // 绘制半透明填充
    ctx.fillStyle = style.fillColor
    ctx.fillRect(x, y, w, h)

    // 绘制选中边框
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.strokeRect(x, y, w, h)

    // 锁定态：不画控制点（不可 resize）
    if (locked) return

    // 绘制四个角的控制点
    const handleSize = style.handleSize
    ctx.fillStyle = style.handleColor
    ctx.setLineDash([])

    // 左上
    ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    // 右上
    ctx.fillRect(x + w - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    // 左下
    ctx.fillRect(x - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
    // 右下
    ctx.fillRect(x + w - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
  }

  /**
   * 导出绘制（原 drawForExport 中 rect 分支，原始图像坐标系）
   */
  drawForExport(
    ctx: CanvasRenderingContext2D,
    record: Operate<Rect | Polygon>,
    _style: AnnotationStyle
  ): void {
    const rect = record.data[0] as Rect
    ctx.strokeRect(rect.start.x, rect.start.y, rect.width, rect.height)
  }

  /**
   * 标题锚定框（原 drawAnnotationTitle / drawForExport 标题段的 rect 分支）
   */
  getTitleAnchor(record: Operate<Rect | Polygon>, viewport?: ViewportManager): TitleAnchor | null {
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
}
