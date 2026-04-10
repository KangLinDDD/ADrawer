/**
 * 渲染模块
 * 负责所有绘制操作，包括背景图片、标注、选中高亮、文本标注等
 */

import type { 
  Rect, 
  Polygon,
  SelectionStyle,
  LineStyle,
  VertexStyle
} from './types'
import type { ViewportManager } from './viewport'
import type { AnnotationManager } from './annotations'
import type { TextAnnotationManager } from './text-annotation'

export class Renderer {
  constructor(
    private ctx: CanvasRenderingContext2D,
    private viewport: ViewportManager,
    private annotationManager: AnnotationManager,
    private textManager: TextAnnotationManager,
    private canvas: HTMLCanvasElement
  ) {}

  /**
   * 主渲染方法
   */
  render(bgImage: HTMLImageElement | null): void {
    // 清除画布
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height)

    // 绘制背景图片
    if (bgImage) {
      this.drawBackgroundImage(bgImage)
    }

    // 绘制标注
    this.drawAnnotations()

    // 绘制文本标注
    this.drawTextAnnotations()
  }

  /**
   * 绘制背景图片
   */
  private drawBackgroundImage(bgImage: HTMLImageElement): void {
    this.ctx.drawImage(
      bgImage,
      this.viewport.offset.x,
      this.viewport.offset.y,
      this.viewport.originalWidth * this.viewport.scale,
      this.viewport.originalHeight * this.viewport.scale
    )
  }

  /**
   * 绘制标注（矩形、多边形）
   */
  private drawAnnotations(): void {
    // 绘制已完成标注 - 每个标注始终使用自己的样式
    this.annotationManager.recordList.forEach((item, index) => {
      // 获取标注保存的样式
      const style = this.annotationManager.getAnnotationStyle(item)
      
      // 始终使用标注自己的样式（选中也不改变样式）
      this.ctx.strokeStyle = style.strokeColor
      this.ctx.lineWidth = style.lineWidth
      this.setLineDash(style.lineStyle || 'solid')
      this.ctx.fillStyle = this.ctx.strokeStyle
      
      const isSelected = this.annotationManager.selectedAnnotation?.index === index
      
      if (item.type === "rect") {
        this.drawRect(item.data[0] as Rect, isSelected)
      } else if (item.type === "polygon") {
        // 使用标注保存的顶点样式
        const vertexStyle = style.vertexStyle || this.annotationManager.getVertexStyle()
        this.drawPolygon(item.data as Polygon[], item.status === "fullfilled", vertexStyle)
      }
    })

    // 绘制当前操作（正在绘制的标注）- 使用当前设置的新样式
    if (this.annotationManager.operate.data.length > 0) {
      this.ctx.strokeStyle = this.annotationManager.strokeStyle
      this.ctx.lineWidth = this.annotationManager.lineWidth
      this.ctx.fillStyle = this.ctx.strokeStyle
      this.setLineDash(this.annotationManager.lineStyle)
      
      if (this.annotationManager.operate.type === "rect") {
        this.drawRect(this.annotationManager.operate.data[0] as Rect, false)
      } else if (this.annotationManager.operate.type === "polygon") {
        this.drawCurrentPolygon()
      }
    }

    // 重置虚线设置
    this.ctx.setLineDash([])

    // 绘制选中高亮
    this.drawSelectionHighlight()
  }

  /**
   * 设置边线虚线样式
   */
  private setLineDash(style: LineStyle): void {
    switch (style) {
      case 'dashed':
        this.ctx.setLineDash([10, 5])
        break
      case 'dotted':
        this.ctx.setLineDash([2, 4])
        break
      case 'solid':
      default:
        this.ctx.setLineDash([])
        break
    }
  }

  /**
   * 绘制矩形
   * @param rect - 矩形数据
   * @param isSelected - 是否被选中（用于顶点颜色）
   */
  private drawRect(rect: Rect, _isSelected: boolean = false): void {
    this.ctx.strokeRect(
      this.viewport.offset.x + rect.start.x * this.viewport.scale,
      this.viewport.offset.y + rect.start.y * this.viewport.scale,
      rect.width * this.viewport.scale,
      rect.height * this.viewport.scale
    )
  }

  /**
   * 绘制多边形
   * @param polygon - 多边形顶点数据
   * @param closed - 是否闭合
   * @param vertexStyle - 顶点样式
   */
  private drawPolygon(polygon: Polygon[], closed: boolean, vertexStyle?: VertexStyle): void {
    if (polygon.length === 0) return

    this.ctx.beginPath()
    polygon.forEach((point, index) => {
      const x = this.viewport.offset.x + point.point.x * this.viewport.scale
      const y = this.viewport.offset.y + point.point.y * this.viewport.scale
      if (index === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    })

    if (closed && polygon.length > 1) {
      const first = polygon[0]
      this.ctx.lineTo(
        this.viewport.offset.x + first.point.x * this.viewport.scale,
        this.viewport.offset.y + first.point.y * this.viewport.scale
      )
    }
    this.ctx.stroke()

    // 绘制顶点标记
    this.drawPolygonVertices(polygon, vertexStyle)
  }

  /**
   * 绘制多边形顶点标记
   * @param polygon - 多边形顶点数据
   * @param vertexStyle - 顶点样式
   */
  private drawPolygonVertices(polygon: Polygon[], vertexStyle?: VertexStyle): void {
    // 使用传入的样式或当前全局样式
    const style = vertexStyle || this.annotationManager.getVertexStyle()
    const size = style.size / 2
    
    polygon.forEach((point) => {
      const x = this.viewport.offset.x + point.point.x * this.viewport.scale
      const y = this.viewport.offset.y + point.point.y * this.viewport.scale
      
      this.ctx.fillStyle = style.fillColor
      this.ctx.strokeStyle = style.strokeColor
      this.ctx.lineWidth = style.strokeWidth
      
      this.ctx.beginPath()
      
      switch (style.shape) {
        case 'square':
          this.ctx.rect(x - size, y - size, size * 2, size * 2)
          break
        case 'diamond':
          this.ctx.moveTo(x, y - size)
          this.ctx.lineTo(x + size, y)
          this.ctx.lineTo(x, y + size)
          this.ctx.lineTo(x - size, y)
          this.ctx.closePath()
          break
        case 'circle':
        default:
          this.ctx.arc(x, y, size, 0, Math.PI * 2)
          break
      }
      
      this.ctx.fill()
      if (style.strokeWidth > 0) {
        this.ctx.stroke()
      }
    })
  }

  /**
   * 绘制当前正在绘制的多边形
   */
  private drawCurrentPolygon(): void {
    const data = this.annotationManager.operate.data as Polygon[]
    const tempPoint = this.annotationManager.tempPolygonPoint

    this.ctx.beginPath()
    data.forEach((point, index) => {
      const x = this.viewport.offset.x + point.point.x * this.viewport.scale
      const y = this.viewport.offset.y + point.point.y * this.viewport.scale
      if (index === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    })

    // 绘制到临时点
    if (tempPoint) {
      const x = this.viewport.offset.x + tempPoint.x * this.viewport.scale
      const y = this.viewport.offset.y + tempPoint.y * this.viewport.scale
      this.ctx.lineTo(x, y)
    }

    this.ctx.stroke()

    // 绘制顶点标记 - 使用当前设置的顶点样式
    this.drawPolygonVertices(data, this.annotationManager.getVertexStyle())

    // 绘制临时点标记
    if (tempPoint) {
      const vertexStyle = this.annotationManager.getVertexStyle()
      const x = this.viewport.offset.x + tempPoint.x * this.viewport.scale
      const y = this.viewport.offset.y + tempPoint.y * this.viewport.scale
      const size = vertexStyle.size / 2
      
      this.ctx.fillStyle = vertexStyle.fillColor
      this.ctx.strokeStyle = vertexStyle.strokeColor
      this.ctx.lineWidth = vertexStyle.strokeWidth
      this.ctx.beginPath()
      
      switch (vertexStyle.shape) {
        case 'square':
          this.ctx.rect(x - size, y - size, size * 2, size * 2)
          break
        case 'diamond':
          this.ctx.moveTo(x, y - size)
          this.ctx.lineTo(x + size, y)
          this.ctx.lineTo(x, y + size)
          this.ctx.lineTo(x - size, y)
          this.ctx.closePath()
          break
        case 'circle':
        default:
          this.ctx.arc(x, y, size, 0, Math.PI * 2)
          break
      }
      
      this.ctx.fill()
      if (vertexStyle.strokeWidth > 0) {
        this.ctx.stroke()
      }
    }
  }

  /**
   * 绘制选中状态的标注高亮
   */
  private drawSelectionHighlight(): void {
    const selected = this.annotationManager.selectedAnnotation
    if (!selected) return

    const annotation = this.annotationManager.recordList[selected.index]
    if (!annotation) return

    const style = this.annotationManager.selectionStyle
    this.ctx.save()

    if (annotation.type === "rect") {
      this.drawRectSelectionHighlight(annotation.data[0] as Rect, style)
    } else if (annotation.type === "polygon") {
      this.drawPolygonSelectionHighlight(annotation.data as Polygon[], style)
    }

    this.ctx.restore()
  }

  /**
   * 绘制矩形选中高亮
   */
  private drawRectSelectionHighlight(rect: Rect, style: SelectionStyle): void {
    const x = this.viewport.offset.x + rect.start.x * this.viewport.scale
    const y = this.viewport.offset.y + rect.start.y * this.viewport.scale
    const w = rect.width * this.viewport.scale
    const h = rect.height * this.viewport.scale

    // 绘制半透明填充
    this.ctx.fillStyle = style.fillColor
    this.ctx.fillRect(x, y, w, h)

    // 绘制选中边框
    this.ctx.strokeStyle = style.strokeColor
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])
    this.ctx.strokeRect(x, y, w, h)

    // 绘制四个角的控制点
    const handleSize = style.handleSize
    this.ctx.fillStyle = style.handleColor
    this.ctx.setLineDash([])

    // 左上
    this.ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    // 右上
    this.ctx.fillRect(x + w - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    // 左下
    this.ctx.fillRect(x - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
    // 右下
    this.ctx.fillRect(x + w - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
  }

  /**
   * 绘制多边形选中高亮
   */
  private drawPolygonSelectionHighlight(polygon: Polygon[], style: SelectionStyle): void {
    // 绘制半透明填充
    this.ctx.beginPath()
    polygon.forEach((p, i) => {
      const x = this.viewport.offset.x + p.point.x * this.viewport.scale
      const y = this.viewport.offset.y + p.point.y * this.viewport.scale
      if (i === 0) {
        this.ctx.moveTo(x, y)
      } else {
        this.ctx.lineTo(x, y)
      }
    })
    this.ctx.closePath()
    this.ctx.fillStyle = style.fillColor
    this.ctx.fill()

    // 绘制选中边框
    this.ctx.strokeStyle = style.strokeColor
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([5, 5])
    this.ctx.stroke()

    // 绘制顶点控制点
    const handleSize = style.handleSize
    this.ctx.fillStyle = style.handleColor
    this.ctx.setLineDash([])
    polygon.forEach((p) => {
      const x = this.viewport.offset.x + p.point.x * this.viewport.scale
      const y = this.viewport.offset.y + p.point.y * this.viewport.scale
      this.ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
    })
  }

  /**
   * 绘制文本标注
   */
  private drawTextAnnotations(): void {
    const globalStyle = this.textManager.textStyle

    this.textManager.textAnnotations.forEach((textData, index) => {
      const isEditing = this.textManager.editingTextIndex === index

      // 如果正在编辑（输入框显示中），不在 canvas 上绘制文本
      if (isEditing && this.textManager.textInput && this.textManager.textInput.style.display !== "none") {
        return
      }

      // 空文本不绘制
      if (!textData.text) return

      // 获取文本标注的样式（如果有保存的样式则使用，否则使用当前全局样式）
      const textStyle = textData.style || {
        font: globalStyle.font,
        color: globalStyle.color,
        backgroundColor: globalStyle.backgroundColor
      }

      const canvasX = this.viewport.offset.x + textData.position.x * this.viewport.scale
      // canvasY 是文本基线位置（fillText 的 y 参数）
      const canvasY = this.viewport.offset.y + textData.position.y * this.viewport.scale

      // 检查是否被选中
      const isSelected = this.textManager.selectedTextIndex === index

      // 设置字体以获取准确的文本度量
      this.ctx.font = textStyle.font
      const textMetrics = this.ctx.measureText(textData.text)
      
      // 计算文本实际高度（ascent + descent）
      const ascent = textMetrics.actualBoundingBoxAscent || textData.height * 0.8
      const descent = textMetrics.actualBoundingBoxDescent || textData.height * 0.2
      const actualTextHeight = ascent + descent
      
      // 计算背景框尺寸
      const r = globalStyle.borderRadius
      const bgX = canvasX - globalStyle.padding
      const boxWidth = textData.width + globalStyle.padding * 2
      const boxHeight = actualTextHeight + globalStyle.padding * 2
      
      // 背景框的 Y 位置：
      // canvasY 是基线位置，背景框顶部应该在基线位置上方 ascent + padding 处
      const bgY = canvasY - ascent - globalStyle.padding

      // 绘制背景（带圆角）
      this.ctx.fillStyle = textStyle.backgroundColor
      this.ctx.beginPath()
      this.ctx.roundRect(bgX, bgY, boxWidth, boxHeight, r)
      this.ctx.fill()

      // 如果选中，绘制选中边框
      if (isSelected) {
        this.ctx.strokeStyle = globalStyle.selectedBorderColor
        this.ctx.lineWidth = 2
        this.ctx.setLineDash([5, 5])
        this.ctx.beginPath()
        this.ctx.roundRect(bgX, bgY, boxWidth, boxHeight, r)
        this.ctx.stroke()
        this.ctx.setLineDash([])
      }

      // 绘制文本（在基线位置）
      this.ctx.fillStyle = textStyle.color
      this.ctx.fillText(textData.text, canvasX, canvasY)
    })
  }

  /**
   * 导出时绘制所有内容到指定上下文
   */
  drawForExport(
    ctx: CanvasRenderingContext2D,
    bgImage: HTMLImageElement,
    originalWidth: number,
    originalHeight: number
  ): void {
    // 绘制背景图片
    ctx.drawImage(bgImage, 0, 0, originalWidth, originalHeight)

    // 绘制标注 - 每个标注使用自己保存的样式
    this.annotationManager.recordList.forEach((item) => {
      // 获取标注保存的样式
      const style = this.annotationManager.getAnnotationStyle(item)
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.lineWidth
      
      if (item.type === "rect") {
        const rect = item.data[0] as Rect
        ctx.strokeRect(rect.start.x, rect.start.y, rect.width, rect.height)
      } else if (item.type === "polygon" && item.status === "fullfilled") {
        ctx.beginPath()
        ;(item.data as Polygon[]).forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.point.x, point.point.y)
          } else {
            ctx.lineTo(point.point.x, point.point.y)
          }
        })
        const first = item.data[0] as Polygon
        ctx.lineTo(first.point.x, first.point.y)
        ctx.stroke()

        // 绘制顶点标记 - 使用标注保存的颜色
        ;(item.data as Polygon[]).forEach((point) => {
          ctx.beginPath()
          ctx.arc(point.point.x, point.point.y, 4, 0, Math.PI * 2)
          ctx.fillStyle = style.strokeColor
          ctx.fill()
        })
      }
    })

    // 绘制文本标注 - 每个文本使用自己保存的样式
    this.textManager.textAnnotations.forEach((textData) => {
      const globalStyle = this.textManager.textStyle
      
      // 获取文本标注的样式（如果有保存的样式则使用，否则使用当前全局样式）
      const textStyle = textData.style || {
        font: globalStyle.font,
        color: globalStyle.color,
        backgroundColor: globalStyle.backgroundColor
      }
      
      ctx.font = textStyle.font
      
      // 测量文本以获取准确的高度信息
      const textMetrics = ctx.measureText(textData.text)
      const ascent = textMetrics.actualBoundingBoxAscent || textData.height * 0.8
      const descent = textMetrics.actualBoundingBoxDescent || textData.height * 0.2
      const actualTextHeight = ascent + descent
      
      // 计算背景框尺寸和位置
      const bgX = textData.position.x - globalStyle.padding
      const bgWidth = textData.width + globalStyle.padding * 2
      const bgHeight = actualTextHeight + globalStyle.padding * 2
      // 背景框顶部位置 = 基线位置 - 上行高度 - 内边距
      const bgY = textData.position.y - ascent - globalStyle.padding
      const r = globalStyle.borderRadius

      // 绘制背景
      ctx.fillStyle = textStyle.backgroundColor
      if ((ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect) {
        (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(bgX, bgY, bgWidth, bgHeight, r)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
      }

      // 绘制文本（在基线位置）
      ctx.fillStyle = textStyle.color
      ctx.fillText(textData.text, textData.position.x, textData.position.y)
    })
  }
}
