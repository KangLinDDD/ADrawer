/**
 * 多边形渲染策略
 * 搬运自 renderer.ts：drawPolygon / drawPolygonVertices / drawCurrentPolygon /
 * drawPolygonSelectionHighlight / 标题锚定 polygon 分支 / drawForExport polygon 分支
 */

import type { Operate, Rect, Polygon, AnnotationStyle, SelectionStyle, VertexStyle } from '../types'
import type { ViewportManager } from '../viewport'
import type { AnnotationStore } from '../annotation-store'
import type { ShapeRenderStrategy, TitleAnchor } from './shape-renderer'

export class PolygonRenderer implements ShapeRenderStrategy {
  /**
   * @param store 用于顶点样式的全局回退（style.vertexStyle 缺省时取 store.getVertexStyle()）
   */
  constructor(private store: AnnotationStore) {}

  /**
   * 绘制已完成多边形（原 drawAnnotations 中 polygon 分支 + drawPolygon）
   */
  draw(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    record: Operate<Rect | Polygon>,
    style: AnnotationStyle
  ): void {
    // 使用标注保存的顶点样式
    const vertexStyle = style.vertexStyle || this.store.getVertexStyle()
    this.drawPolygon(ctx, viewport, record.data as Polygon[], record.status === "fullfilled", vertexStyle)
  }

  /**
   * 绘制当前正在绘制的多边形（原 drawCurrentPolygon）
   */
  drawInProgress(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    store: AnnotationStore
  ): void {
    const data = store.operate.data as Polygon[]
    const tempPoint = store.tempPolygonPoint

    ctx.beginPath()
    data.forEach((point, index) => {
      const x = Math.round(viewport.offset.x + point.point.x * viewport.scale)
      const y = Math.round(viewport.offset.y + point.point.y * viewport.scale)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    // 绘制到临时点
    if (tempPoint) {
      const x = Math.round(viewport.offset.x + tempPoint.x * viewport.scale)
      const y = Math.round(viewport.offset.y + tempPoint.y * viewport.scale)
      ctx.lineTo(x, y)
    }

    ctx.stroke()

    // 绘制顶点标记 - 使用当前设置的顶点样式
    this.drawPolygonVertices(ctx, viewport, data, store.getVertexStyle())

    // 绘制临时点标记
    if (tempPoint) {
      const vertexStyle = store.getVertexStyle()
      const x = Math.round(viewport.offset.x + tempPoint.x * viewport.scale)
      const y = Math.round(viewport.offset.y + tempPoint.y * viewport.scale)
      const size = vertexStyle.size / 2

      ctx.fillStyle = vertexStyle.fillColor
      ctx.strokeStyle = vertexStyle.strokeColor
      ctx.lineWidth = vertexStyle.strokeWidth
      ctx.beginPath()

      switch (vertexStyle.shape) {
        case 'square':
          ctx.rect(x - size, y - size, size * 2, size * 2)
          break
        case 'diamond':
          ctx.moveTo(x, y - size)
          ctx.lineTo(x + size, y)
          ctx.lineTo(x, y + size)
          ctx.lineTo(x - size, y)
          ctx.closePath()
          break
        case 'circle':
        default:
          ctx.arc(x, y, size, 0, Math.PI * 2)
          break
      }

      ctx.fill()
      if (vertexStyle.strokeWidth > 0) {
        ctx.stroke()
      }
    }
  }

  /**
   * 绘制多边形选中高亮（原 drawPolygonSelectionHighlight；locked=true 时不画顶点控制点）
   */
  drawSelection(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    record: Operate<Rect | Polygon>,
    style: SelectionStyle,
    locked: boolean
  ): void {
    const polygon = record.data as Polygon[]

    // 绘制半透明填充
    ctx.beginPath()
    polygon.forEach((p, i) => {
      const x = viewport.offset.x + p.point.x * viewport.scale
      const y = viewport.offset.y + p.point.y * viewport.scale
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.closePath()
    ctx.fillStyle = style.fillColor
    ctx.fill()

    // 绘制选中边框
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5])
    ctx.stroke()

    // 锁定态：不画控制点（不可 resize）
    if (locked) return

    // 绘制顶点控制点
    const handleSize = style.handleSize
    ctx.fillStyle = style.handleColor
    ctx.setLineDash([])
    polygon.forEach((p) => {
      const x = Math.round(viewport.offset.x + p.point.x * viewport.scale)
      const y = Math.round(viewport.offset.y + p.point.y * viewport.scale)
      ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    })
  }

  /**
   * 导出绘制（原 drawForExport 中 polygon 分支，原始图像坐标系；仅闭合多边形导出）
   */
  drawForExport(
    ctx: CanvasRenderingContext2D,
    record: Operate<Rect | Polygon>,
    style: AnnotationStyle
  ): void {
    if (record.status !== "fullfilled") return

    const polygon = record.data as Polygon[]
    ctx.beginPath()
    polygon.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.point.x, point.point.y)
      } else {
        ctx.lineTo(point.point.x, point.point.y)
      }
    })
    const first = record.data[0] as Polygon
    ctx.lineTo(first.point.x, first.point.y)
    ctx.stroke()

    // 绘制顶点标记 - 使用标注保存的颜色
    polygon.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.point.x, point.point.y, 4, 0, Math.PI * 2)
      ctx.fillStyle = style.strokeColor
      ctx.fill()
    })
  }

  /**
   * 标题锚定框（原 drawAnnotationTitle / drawForExport 标题段的 polygon 分支：顶点包围盒）
   * 空多边形返回 null（原行为：画布路径 restore+return，导出路径跳过该标注）
   */
  getTitleAnchor(record: Operate<Rect | Polygon>, viewport?: ViewportManager): TitleAnchor | null {
    const polygon = record.data as Polygon[]
    if (polygon.length === 0) return null

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    polygon.forEach(p => {
      const px = viewport ? viewport.offset.x + p.point.x * viewport.scale : p.point.x
      const py = viewport ? viewport.offset.y + p.point.y * viewport.scale : p.point.y
      if (px < minX) minX = px
      if (py < minY) minY = py
      if (px > maxX) maxX = px
      if (py > maxY) maxY = py
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }

  /**
   * 绘制多边形（原 drawPolygon）
   */
  private drawPolygon(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    polygon: Polygon[],
    closed: boolean,
    vertexStyle?: VertexStyle
  ): void {
    if (polygon.length === 0) return

    ctx.beginPath()
    polygon.forEach((point, index) => {
      const x = Math.round(viewport.offset.x + point.point.x * viewport.scale)
      const y = Math.round(viewport.offset.y + point.point.y * viewport.scale)
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })

    if (closed && polygon.length > 1) {
      const first = polygon[0]
      ctx.lineTo(
        viewport.offset.x + first.point.x * viewport.scale,
        viewport.offset.y + first.point.y * viewport.scale
      )
    }
    ctx.stroke()

    // 绘制顶点标记
    this.drawPolygonVertices(ctx, viewport, polygon, vertexStyle)
  }

  /**
   * 绘制多边形顶点标记（原 drawPolygonVertices）
   */
  private drawPolygonVertices(
    ctx: CanvasRenderingContext2D,
    viewport: ViewportManager,
    polygon: Polygon[],
    vertexStyle?: VertexStyle
  ): void {
    // 使用传入的样式或当前全局样式
    const style = vertexStyle || this.store.getVertexStyle()
    const size = style.size / 2

    polygon.forEach((point) => {
      const x = Math.round(viewport.offset.x + point.point.x * viewport.scale)
      const y = Math.round(viewport.offset.y + point.point.y * viewport.scale)

      ctx.fillStyle = style.fillColor
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.strokeWidth

      ctx.beginPath()

      switch (style.shape) {
        case 'square':
          ctx.rect(x - size, y - size, size * 2, size * 2)
          break
        case 'diamond':
          ctx.moveTo(x, y - size)
          ctx.lineTo(x + size, y)
          ctx.lineTo(x, y + size)
          ctx.lineTo(x - size, y)
          ctx.closePath()
          break
        case 'circle':
        default:
          ctx.arc(x, y, size, 0, Math.PI * 2)
          break
      }

      ctx.fill()
      if (style.strokeWidth > 0) {
        ctx.stroke()
      }
    })
  }
}
