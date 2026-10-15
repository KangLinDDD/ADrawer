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
import { computeTitleBox } from './renderers/title-layout'
import { DEFAULT_TITLE_GAP } from './renderers/title-layout'
import { parseFontSize, scaleFont, scalePx, scaleStrokePx } from './renderers/export-scale'

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
    this.annotationManager.recordList.forEach((item) => {
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
    const textHeight = parseFontSize(font)

    // 计算标注参考位置（画布坐标；非 rect 一律走 polygon 锚定，与原 else 分支一致）
    const strategy = annotation.type === "rect" ? this.shapeRenderers.rect : this.shapeRenderers.polygon
    const anchor = strategy.getTitleAnchor(annotation, this.viewport)
    if (!anchor) { this.ctx.restore(); return }

    const bgW = textWidth + paddingX * 2
    const bgH = textHeight + paddingY * 2

    // 固定位置绘制：位置已在设置标题时按图片初始尺寸决定并写回，此处不再按视口边界重算
    const { x: bgX, y: bgY } = computeTitleBox({
      anchor,
      boxWidth: bgW,
      boxHeight: bgH,
      position: titlePos
    })

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
   * 交互画布（容器分辨率）→ 导出图（原始图像分辨率）的像素倍率。
   *
   * 导出图是当前视图的 1/scale 倍放大，而画布上的字号 / 内边距 / 圆角 / 线宽 /
   * 顶点半径 / 标题间距与偏移都是按「画布像素」给定的常量；
   * 若不在导出时同倍换算，导出图里的文字相对整张图会被缩小同样的倍数
   * （4000px 原图里 14px 的字 → 页面缩到几百像素宽显示时只剩 1~3px，看起来像没画）。
   */
  private getExportPixelRatio(): number {
    const scale = this.viewport.scale
    return scale > 0 ? 1 / scale : 1
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
    // 画布像素 → 原图像素
    const ratio = this.getExportPixelRatio()

    // 绘制背景图片
    ctx.drawImage(bgImage, 0, 0, originalWidth, originalHeight)

    // 绘制标注 - 每个标注使用自己保存的样式（几何绘制委托策略表）
    this.annotationManager.recordList.forEach((item) => {
      // 获取标注保存的样式
      const style = this.annotationManager.getAnnotationStyle(item)
      ctx.strokeStyle = style.strokeColor
      ctx.lineWidth = scaleStrokePx(style.lineWidth, ratio)

      if (item.type === "rect") {
        this.shapeRenderers.rect.drawForExport(ctx, item, style, ratio)
      } else if (item.type === "polygon") {
        this.shapeRenderers.polygon.drawForExport(ctx, item, style, ratio)
      }
    })

    // 绘制文本标注 - 每个文本使用自己保存的样式
    this.textManager.textAnnotations.forEach((textData) => {
      const globalStyle = this.textManager.textStyle

      // 获取文本标注的样式：逐字段回退到全局默认。
      // 样式字段在类型上是必填，但外部直接写入 textAnnotations 时可能缺失：
      // 缺 font 会让 scaleFont 抛错，被 exportAnnotationImage() 静默退回低清画布；
      // 缺 color 则会被画成背景色，文字完全看不见。
      const font = textData.style?.font || globalStyle.font || '16px Arial'
      const color = textData.style?.color || globalStyle.color || '#FFD700'
      const backgroundColor =
        textData.style?.backgroundColor || globalStyle.backgroundColor || 'rgba(0,0,0,0.6)'

      ctx.font = scaleFont(font, ratio)

      // 测量文本以获取准确的高度信息
      const textMetrics = ctx.measureText(textData.text)
      const ascent = textMetrics.actualBoundingBoxAscent || textData.height * 0.8
      const descent = textMetrics.actualBoundingBoxDescent || textData.height * 0.2
      const actualTextHeight = ascent + descent

      // position 是背景框左上角（图像坐标，无需换算）；宽高随字号与内边距一起放大
      const bgX = textData.position.x
      const bgY = textData.position.y
      const padding = scalePx(globalStyle.padding, ratio)
      const bgWidth = textMetrics.width + padding * 2
      const bgHeight = actualTextHeight + padding * 2
      const r = scalePx(globalStyle.borderRadius, ratio)

      // 绘制背景
      ctx.fillStyle = backgroundColor
      const roundRectCtx = ctx as unknown as {
        roundRect: (x: number, y: number, w: number, h: number, r: number) => void
      }
      if (roundRectCtx.roundRect) {
        // 必须先 beginPath：roundRect 是追加到当前路径的，而 fill() 填充整条路径。
        // 漏掉它会让路径跨轮累积，后面每个框的 fill() 把前面所有框重填一遍，
        // 从而盖住先画好的文字（表现：越靠前的标注标题越糊/看不见）。
        ctx.beginPath()
        roundRectCtx.roundRect(bgX, bgY, bgWidth, bgHeight, r)
        ctx.fill()
      } else {
        ctx.fillRect(bgX, bgY, bgWidth, bgHeight)
      }

      // 绘制文本：基线在背景框内部
      ctx.fillStyle = color
      ctx.fillText(textData.text, bgX + padding, bgY + padding + ascent)
    })

    // 绘制标注标题（导出模式 - 仅在启用时）
    if (this.annotationManager.enableTitle) {
      this.annotationManager.recordList.forEach((item) => {
      if (!item.title) return

      const titleStyle = this.annotationManager.getEffectiveTitleStyle(item)
      const titlePos = this.annotationManager.getEffectiveTitlePosition(item)

      const color = titleStyle.color || '#FFFFFF'
      const bgColor = titleStyle.backgroundColor || 'rgba(0, 0, 0, 0.7)'
      // 字号、内边距、圆角都按倍率放大（字号同时也决定标题框高度）
      const font = scaleFont(titleStyle.font || '12px Arial', ratio)
      const paddingX = scalePx(titleStyle.paddingX ?? 6, ratio)
      const paddingY = scalePx(titleStyle.paddingY ?? 3, ratio)
      const borderRadius = scalePx(titleStyle.borderRadius ?? 4, ratio)

      ctx.font = font

      const textMetrics = ctx.measureText(item.title)
      const textWidth = textMetrics.width
      const textHeight = parseFontSize(font)

      // 计算标注参考位置（原始图像坐标；非 rect 一律走 polygon 锚定，与原 else 分支一致）
      const strategy = item.type === "rect" ? this.shapeRenderers.rect : this.shapeRenderers.polygon
      const anchor = strategy.getTitleAnchor(item)
      if (!anchor) return

      const bgW = textWidth + paddingX * 2
      const bgH = textHeight + paddingY * 2

      // 固定位置绘制：位置已在设置标题时按图片初始尺寸决定并写回，此处不再按边界重算；
      // 其中存下来的偏移量与标题间距都是「画布像素」，导出时同样按倍率换算
      const { x: bgX, y: bgY } = computeTitleBox({
        anchor,
        boxWidth: bgW,
        boxHeight: bgH,
        position: {
          ...titlePos,
          offsetX: scalePx(titlePos.offsetX ?? 0, ratio),
          offsetY: scalePx(titlePos.offsetY ?? 0, ratio)
        },
        gap: scalePx(DEFAULT_TITLE_GAP, ratio)
      })

      ctx.fillStyle = bgColor
      const roundRectCtx = ctx as unknown as {
        roundRect: (x: number, y: number, w: number, h: number, r: number) => void
      }
      if (roundRectCtx.roundRect) {
        // 同文本标注：必须先 beginPath，否则这次 fill() 会把之前所有标题框重填一遍，
        // 把先画的标题文字盖成半透明残影（第一个标题最严重）。
        ctx.beginPath()
        roundRectCtx.roundRect(bgX, bgY, bgW, bgH, borderRadius)
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
