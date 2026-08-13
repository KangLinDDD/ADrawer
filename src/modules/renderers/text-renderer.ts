/**
 * 文本标注渲染
 * 搬运自 renderer.ts drawTextAnnotations（编辑可见性判断走 textManager.isEditingVisible()）
 */

import type { ViewportManager } from '../viewport'
import type { TextAnnotationManager } from '../shapes/text-manager'

/**
 * 绘制文本标注（背景框 + 选中虚线框 + 文字）
 */
export function drawTextAnnotations(
  ctx: CanvasRenderingContext2D,
  viewport: ViewportManager,
  textManager: TextAnnotationManager
): void {
  const globalStyle = textManager.textStyle

  textManager.textAnnotations.forEach((textData, index) => {
    const isEditing = textManager.editingTextIndex === index

    // 如果正在编辑（输入框显示中），不在 canvas 上绘制文本
    if (isEditing && textManager.isEditingVisible()) {
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

    // position 是背景框左上角
    const canvasX = viewport.offset.x + textData.position.x * viewport.scale
    const canvasY = viewport.offset.y + textData.position.y * viewport.scale

    // 检查是否被选中
    const isSelected = textManager.selectedTextIndex === index

    // 设置字体以获取准确的文本度量
    ctx.font = textStyle.font
    const textMetrics = ctx.measureText(textData.text)

    // 计算文本实际高度（ascent + descent）
    const ascent = textMetrics.actualBoundingBoxAscent || textData.height * 0.8
    const descent = textMetrics.actualBoundingBoxDescent || textData.height * 0.2
    const actualTextHeight = ascent + descent

    // 计算背景框尺寸（position 即左上角）
    const r = globalStyle.borderRadius
    const bgX = canvasX
    const bgY = canvasY
    const boxWidth = textData.width + globalStyle.padding * 2
    const boxHeight = actualTextHeight + globalStyle.padding * 2

    // 绘制背景（带圆角）
    ctx.fillStyle = textStyle.backgroundColor
    ctx.beginPath()
    ctx.roundRect(bgX, bgY, boxWidth, boxHeight, r)
    ctx.fill()

    // 如果选中，绘制选中边框
    if (isSelected) {
      ctx.strokeStyle = globalStyle.selectedBorderColor
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.roundRect(bgX, bgY, boxWidth, boxHeight, r)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 绘制文本：基线位置在背景框内部，向下偏移 ascent + padding
    const textBaselineX = canvasX + globalStyle.padding
    const textBaselineY = canvasY + globalStyle.padding + ascent
    ctx.fillStyle = textStyle.color
    ctx.fillText(textData.text, textBaselineX, textBaselineY)
  })
}
