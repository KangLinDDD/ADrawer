/**
 * 形状渲染策略契约与共享工具
 * 每种形状（rect/polygon）实现自己的绘制策略，renderer.ts 通过策略表分发
 */

import type { Operate, Rect, Polygon, AnnotationStyle, SelectionStyle, LineStyle } from '../types'
import type { ViewportManager } from '../viewport'
import type { AnnotationStore } from '../annotation-store'

/** 标题锚定框（调用方决定坐标系：传 viewport 为画布坐标，不传为原始图像坐标） */
export type TitleAnchor = {
  x: number
  y: number
  width: number
  height: number
}

export interface ShapeRenderStrategy {
  /** 绘制已完成标注（ctx 状态由渲染管线设置） */
  draw(ctx: CanvasRenderingContext2D, viewport: ViewportManager, record: Operate<Rect | Polygon>, style: AnnotationStyle): void
  /** 绘制正在进行中的标注（读 store.operate/tempPolygonPoint 等绘制中状态） */
  drawInProgress(ctx: CanvasRenderingContext2D, viewport: ViewportManager, store: AnnotationStore): void
  /** 绘制选中高亮：半透明填充 + 虚线框；locked=true 时不画控制点 */
  drawSelection(ctx: CanvasRenderingContext2D, viewport: ViewportManager, record: Operate<Rect | Polygon>, selectionStyle: SelectionStyle, locked: boolean): void
  /** 导出绘制（原始图像坐标系，无 viewport 变换） */
  drawForExport(ctx: CanvasRenderingContext2D, record: Operate<Rect | Polygon>, style: AnnotationStyle): void
  /** 标题锚定框；传 viewport 返回画布坐标，缺省返回原始图像坐标；无法锚定（如空多边形）返回 null */
  getTitleAnchor(record: Operate<Rect | Polygon>, viewport?: ViewportManager): TitleAnchor | null
}

/** 线型 → setLineDash 映射（自 renderer.ts 搬出共享） */
export function setLineDash(ctx: CanvasRenderingContext2D, lineStyle: LineStyle | undefined): void {
  switch (lineStyle) {
    case 'dashed':
      ctx.setLineDash([10, 5])
      break
    case 'dotted':
      ctx.setLineDash([2, 4])
      break
    case 'solid':
    default:
      ctx.setLineDash([])
      break
  }
}
