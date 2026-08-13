/**
 * 渲染模块
 * 渲染管线：背景图片 → 形状标注（策略表分发） → 选中高亮 → 文本标注
 * 形状特异绘制逻辑已拆至 renderers/ 目录（Task 7）
 */

import type { Operate, Rect, Polygon } from './types'
import type { ViewportManager } from './viewport'
import type { AnnotationManager } from './annotations'
import type { TextAnnotationManager } from './shapes/text-manager'
import { setLineDash } from './renderers/shape-renderer'
import type { ShapeRenderStrategy } from './renderers/shape-renderer'
import { RectRenderer } from './renderers/rect-renderer'
import { PolygonRenderer } from './renderers/polygon-renderer'
import { drawTextAnnotations } from './renderers/text-renderer'

export class Renderer {
  /** 形状渲染策略表 */
  private shapeRenderers: Record<'rect' | 'polygon', ShapeRenderStrategy>

  constructor(
    private ctx: CanvasRenderingContext2D,
    private viewport: ViewportManager,
    private annotationManager: AnnotationManager,
    private textManager: TextAnnotationManager
  ) {
    this.shapeRenderers = {
      rect: new RectRenderer(),
      polygon: new PolygonRenderer(annotationManager)
    }
  }

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
    drawTextAnnotations(this.ctx, this.viewport, this.textManager)
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
   * 绘制标注（矩形、多边形）——ctx 状态由管线统一设置，几何绘制委托策略表
   */
  private drawAnnotations(): void {
    // 绘制已完成标注 - 每个标注始终使用自己的样式
    this.annotationManager.recordList.forEach((item, index) => {
      // 获取标注保存的样式
      const style = this.annotationManager.getAnnotationStyle(item)

      // 始终使用标注自己的样式（选中也不改变样式）
      this.ctx.strokeStyle = style.strokeColor
      this.ctx.lineWidth = style.lineWidth
      setLineDash(this.ctx, style.lineStyle || 'solid')
      this.ctx.fillStyle = this.ctx.strokeStyle

      if (item.type === "rect") {
        this.shapeRenderers.rect.draw(this.ctx, this.viewport, item, style)
      } else if (item.type === "polygon") {
        this.shapeRenderers.polygon.draw(this.ctx, this.viewport, item, style)
      }

      // 绘制标题（如果存在且启用标题功能）
      if (this.annotationManager.enableTitle && item.title) {
        this.drawAnnotationTitle(item)
      }
    })

    // 绘制当前操作（正在绘制的标注）- 使用当前设置的新样式
    if (this.annotationManager.operate.data.length > 0) {
      this.ctx.strokeStyle = this.annotationManager.strokeStyle
      this.ctx.lineWidth = this.annotationManager.lineWidth
      this.ctx.fillStyle = this.ctx.strokeStyle
      setLineDash(this.ctx, this.annotationManager.lineStyle)

      if (this.annotationManager.operate.type === "rect") {
        this.shapeRenderers.rect.drawInProgress(this.ctx, this.viewport, this.annotationManager)
      } else if (this.annotationManager.operate.type === "polygon") {
        this.shapeRenderers.polygon.drawInProgress(this.ctx, this.viewport, this.annotationManager)
      }
    }

    // 重置虚线设置
    this.ctx.setLineDash([])

    // 绘制选中高亮
    this.drawSelectionHighlight()
  }

  /**
   * 绘制选中状态的标注高亮（读取锁定态：locked 时策略不画控制点）
   */
  private drawSelectionHighlight(): void {
    const selected = this.annotationManager.selectedAnnotation
    if (!selected) return

    const annotation = this.annotationManager.recordList[selected.index]
    if (!annotation) return

    const style = this.annotationManager.selectionStyle
    const locked = selected.locked === true
    this.ctx.save()

    if (annotation.type === "rect") {
      this.shapeRenderers.rect.drawSelection(this.ctx, this.viewport, annotation, style, locked)
    } else if (annotation.type === "polygon") {
      this.shapeRenderers.polygon.drawSelection(this.ctx, this.viewport, annotation, style, locked)
    }

    this.ctx.restore()
  }

  /**
   * 绘制标注标题
   * @param annotation - 标注操作记录
   */
  private drawAnnotationTitle(annotation: Operate<Rect | Polygon>): void {
    if (!annotation.title) return

    const titleStyle = this.annotationManager.getEffectiveTitleStyle(annotation)
    const titlePos = this.annotationManager.getEffectiveTitlePosition(annotation)

    const font = titleStyle.font || '12px Arial'
    const color = titleStyle.color || '#FFFFFF'
    const bgColor = titleStyle.backgroundColor || 'rgba(0, 0, 0, 0.7)'
    const paddingX = titleStyle.paddingX ?? 6
    const paddingY = titleStyle.paddingY ?? 3
    const borderRadius = titleStyle.borderRadius ?? 4

    this.ctx.save()
    this.ctx.font = font

    const textMetrics = this.ctx.measureText(annotation.title)
    const textWidth = textMetrics.width
    // 从字体字符串中提取字号
    const fontSizeMatch = font.match(/(\d+)px/)
    const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 12
    const textHeight = fontSize

    // 计算标注参考位置（画布坐标；非 rect 一律走 polygon 锚定，与原 else 分支一致）
    const strategy = annotation.type === "rect" ? this.shapeRenderers.rect : this.shapeRenderers.polygon
    const anchor = strategy.getTitleAnchor(annotation, this.viewport)
    if (!anchor) { this.ctx.restore(); return }
    const refX = anchor.x
    const refY = anchor.y
    const refW = anchor.width
    const refH = anchor.height

    const bgW = textWidth + paddingX * 2
    const bgH = textHeight + paddingY * 2

    // 根据 vertical 计算 bgY
    const vertical = titlePos.vertical || 'top'
    const offsetX = titlePos.offsetX || 0
    const offsetY = titlePos.offsetY || 0
    let bgY: number
    switch (vertical) {
      case 'bottom':
        bgY = refY + refH + 4 + offsetY
        break
      case 'inside-top':
        bgY = refY + 4 + offsetY
        break
      case 'top':
      default:
        bgY = refY - bgH - 4 + offsetY
        break
    }

    // 根据 align 计算 bgX
    const align = titlePos.align || 'center'
    let bgX: number
    switch (align) {
      case 'left':
        bgX = refX + offsetX
        break
      case 'right':
        bgX = refX + refW - bgW + offsetX
        break
      case 'center':
      default:
        bgX = refX + refW / 2 - bgW / 2 + offsetX
        break
    }

    // 绘制背景
    this.ctx.fillStyle = bgColor
    this.ctx.setLineDash([])
    this.ctx.beginPath()
    this.ctx.roundRect(bgX, bgY, bgW, bgH, borderRadius)
    this.ctx.fill()

    // 绘制标题文本
    this.ctx.fillStyle = color
    this.ctx.textAlign = "left"
    this.ctx.textBaseline = "top"
    this.ctx.fillText(annotation.title, bgX + paddingX, bgY + paddingY)

    this.ctx.restore()
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

    // 绘制标注 - 每个标注使用自己保存的样式（几何绘制委托策略表）
    this.annotationManager.recordList.forEach((item) => {
      // 获取标注保存的样式
      const style = this.annotationManager.getAnnotationStyle(item)
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = style.lineWidth

      if (item.type === "rect") {
        this.shapeRenderers.rect.drawForExport(ctx, item, style)
      } else if (item.type === "polygon") {
        this.shapeRenderers.polygon.drawForExport(ctx, item, style)
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

      // position 是背景框左上角
      const bgX = textData.position.x
      const bgY = textData.position.y
      const bgWidth = textData.width + globalStyle.padding * 2
      const bgHeight = actualTextHeight + globalStyle.padding * 2
      const r = globalStyle.borderRadius

      // 绘制背景
      ctx.fillStyle = textStyle.backgroundColor
      if ((ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect) {
        (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(bgX, bgY, bgWidth, bgHeight, r)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
      }

      // 绘制文本：基线在背景框内部
      ctx.fillStyle = textStyle.color
      ctx.fillText(textData.text, textData.position.x + globalStyle.padding, textData.position.y + globalStyle.padding + ascent)
    })

    // 绘制标注标题（导出模式 - 仅在启用时）
    if (this.annotationManager.enableTitle) {
      this.annotationManager.recordList.forEach((item) => {
      if (!item.title) return

      const titleStyle = this.annotationManager.getEffectiveTitleStyle(item)
      const titlePos = this.annotationManager.getEffectiveTitlePosition(item)

      const font = titleStyle.font || '12px Arial'
      const color = titleStyle.color || '#FFFFFF'
      const bgColor = titleStyle.backgroundColor || 'rgba(0, 0, 0, 0.7)'
      const paddingX = titleStyle.paddingX ?? 6
      const paddingY = titleStyle.paddingY ?? 3
      const borderRadius = titleStyle.borderRadius ?? 4

      ctx.font = font

      const textMetrics = ctx.measureText(item.title)
      const textWidth = textMetrics.width
      const fontSizeMatch = font.match(/(\d+)px/)
      const textHeight = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 12

      // 计算标注参考位置（原始图像坐标；非 rect 一律走 polygon 锚定，与原 else 分支一致）
      const strategy = item.type === "rect" ? this.shapeRenderers.rect : this.shapeRenderers.polygon
      const anchor = strategy.getTitleAnchor(item)
      if (!anchor) return
      const refX = anchor.x
      const refY = anchor.y
      const refW = anchor.width
      const refH = anchor.height

      const bgW = textWidth + paddingX * 2
      const bgH = textHeight + paddingY * 2

      const vertical = titlePos.vertical || 'top'
      const offsetX = titlePos.offsetX || 0
      const offsetY = titlePos.offsetY || 0
      let bgY: number
      switch (vertical) {
        case 'bottom': bgY = refY + refH + 4 + offsetY; break
        case 'inside-top': bgY = refY + 4 + offsetY; break
        default: bgY = refY - bgH - 4 + offsetY; break
      }

      const align = titlePos.align || 'center'
      let bgX: number
      switch (align) {
        case 'left': bgX = refX + offsetX; break
        case 'right': bgX = refX + refW - bgW + offsetX; break
        default: bgX = refX + refW / 2 - bgW / 2 + offsetX; break
      }

      ctx.fillStyle = bgColor
      if ((ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect) {
        (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void }).roundRect(bgX, bgY, bgW, bgH, borderRadius)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgW, bgH)
      }

      ctx.fillStyle = color
      ctx.textAlign = "left"
      ctx.textBaseline = "top"
      ctx.fillText(item.title, bgX + paddingX, bgY + paddingY)
    })
    }
  }
}
