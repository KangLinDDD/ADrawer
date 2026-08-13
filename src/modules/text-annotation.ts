/**
 * 文本标注模块
 * 负责文本标注的添加、编辑、移动、删除等功能
 */

import type { TextAnnotation, TextStyle, Point, TextInputStyle, ChangeNotify } from './types'
import type { ViewportManager } from './viewport'
import { deepClone, generateId } from './utils'

export class TextAnnotationManager {
  // 文本标注列表
  public textAnnotations: TextAnnotation[] = []
  
  // 编辑状态
  public editingTextIndex: number | null = null
  public currentEditingIndex: number | null = null
  public isTextMoving = false
  public textMoveStart: Point = { x: 0, y: 0 }
  public textBeforeEditing = ""
  
  // 选中状态（非编辑状态下的选中）
  public selectedTextIndex: number | null = null

  // 是否将标注坐标约束在图片边界内（默认 true，由 DrawerOptions.clampToImageBounds 控制）
  public clampEnabled = true

  // DOM 元素
  public textInput: HTMLInputElement | null = null

  // 删除历史记录（用于撤销删除）
  private deleteHistory: { annotation: TextAnnotation; index: number }[] = []

  // 默认输入框样式
  private defaultInputStyle: TextInputStyle = {
    border: "2px solid #00D9FF",
    borderRadius: "6px",
    padding: "6px 10px",
    fontSize: "16px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#ffffff",
    color: "#333",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    minWidth: "60px",
    maxWidth: "200px"
  }

  // 样式配置
  public textStyle: TextStyle = {
    font: "16px Arial",
    color: "#FFD700",
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    selectedBorderColor: "#00D9FF",
    selectedBackgroundColor: "rgba(0,217,255,0.15)",
    inputStyle: { ...this.defaultInputStyle }
  }

  constructor(
    private viewport: ViewportManager,
    private container: HTMLElement,
    private ctx: CanvasRenderingContext2D,
    private renderCallback?: () => void,
    private changeCallback?: ChangeNotify
  ) {
    this.createTextInput()
  }

  /**
   * 创建文本输入框
   */
  private createTextInput(): void {
    this.textInput = document.createElement("input")
    this.textInput.type = "text"
    this.textInput.style.position = "absolute"
    this.textInput.style.zIndex = "99999"
    this.textInput.style.display = "none"
    this.textInput.style.outline = "none"
    this.textInput.style.width = "fit-content"
    this.textInput.placeholder = "输入文字..."
    
    // 应用自定义样式
    this.applyInputStyle()

    // 失去焦点时完成编辑
    this.textInput.addEventListener("blur", () => {
      this.finishEditing()
      // 触发重新渲染以显示文本标注
      if (this.renderCallback) {
        this.renderCallback()
      }
    })

    // 键盘事件处理
    this.textInput.addEventListener("keydown", (e) => {
      e.stopPropagation()

      if (e.key === "Enter") {
        this.finishEditing()
        // 触发重新渲染以显示文本标注
        if (this.renderCallback) {
          this.renderCallback()
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        this.cancelEditing()
      } else if (e.key === "Delete") {
        if (this.textInput!.value === "") {
          e.preventDefault()
          this.deleteEditingAnnotation()
        }
      }
    })

    // 输入时自动调整宽度
    this.textInput.addEventListener("input", () => {
      this.adjustInputWidth()
    })

    this.container.appendChild(this.textInput)
  }

  /**
   * 应用输入框样式
   */
  private applyInputStyle(): void {
    if (!this.textInput) return
    
    const style = { ...this.defaultInputStyle, ...this.textStyle.inputStyle }
    
    this.textInput.style.border = style.border
    this.textInput.style.borderRadius = style.borderRadius
    this.textInput.style.padding = style.padding
    this.textInput.style.fontSize = style.fontSize
    this.textInput.style.fontFamily = style.fontFamily
    this.textInput.style.backgroundColor = style.backgroundColor
    this.textInput.style.color = style.color
    this.textInput.style.boxShadow = style.boxShadow
    this.textInput.style.minWidth = style.minWidth
    this.textInput.style.maxWidth = style.maxWidth
  }

  /**
   * 设置文本样式
   */
  setTextStyle(style: Partial<TextStyle>): void {
    this.textStyle = { ...this.textStyle, ...style }
    this.applyInputStyle()
  }

  /**
   * 设置输入框样式
   */
  setInputStyle(style: Partial<TextInputStyle>): void {
    this.textStyle.inputStyle = { ...this.textStyle.inputStyle, ...style }
    this.applyInputStyle()
  }

  /**
   * 设置选中态样式
   */
  setSelectionStyle(style: { selectedBorderColor?: string; selectedBackgroundColor?: string }): void {
    if (style.selectedBorderColor !== undefined) {
      this.textStyle.selectedBorderColor = style.selectedBorderColor
    }
    if (style.selectedBackgroundColor !== undefined) {
      this.textStyle.selectedBackgroundColor = style.selectedBackgroundColor
    }
  }

  /**
   * 获取当前文本样式（用于创建新标注时保存）
   */
  getCurrentStyle(): Pick<TextStyle, 'font' | 'color' | 'backgroundColor'> {
    return {
      font: this.textStyle.font,
      color: this.textStyle.color,
      backgroundColor: this.textStyle.backgroundColor
    }
  }

  /**
   * 上报文本标注变更（载荷携带深拷贝快照）
   */
  private notifyChange(event: 'create' | 'delete' | 'update', index: number, annotation: TextAnnotation): void {
    if (!this.changeCallback || !annotation.id) return
    this.changeCallback(event, {
      id: annotation.id,
      type: 'text',
      index,
      data: deepClone(annotation),
    })
  }

  /**
   * 解析文本标注定位参数：number 按索引，string 按 id
   */
  resolveIndex(ref: number | string): number {
    if (typeof ref === 'number') return ref
    return this.textAnnotations.findIndex((a) => a.id === ref)
  }

  /**
   * 按索引或 id 获取单个文本标注（深拷贝快照）
   */
  getTextAnnotation(ref: number | string): TextAnnotation | undefined {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.textAnnotations.length) return undefined
    return deepClone(this.textAnnotations[index])
  }

  /**
   * 更新指定文本标注的样式（部分覆盖，不影响全局默认和其他标注）
   * @param ref - 文本标注索引或 id
   * @param style - 样式（部分覆盖）
   */
  updateTextAnnotationStyle(ref: number | string, style: Partial<Pick<TextStyle, 'font' | 'color' | 'backgroundColor'>>): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.textAnnotations.length) return false
    const annotation = this.textAnnotations[index]
    annotation.style = {
      ...(annotation.style || this.getCurrentStyle()),
      ...style
    }
    this.notifyChange('update', index, this.textAnnotations[index])
    return true
  }

  /**
   * 将点约束到图片边界内（原图像素坐标系）
   * clampEnabled 为 false 或图片未加载（originalWidth/originalHeight 为 0）时跳过 clamp，原样返回
   */
  private clampToImageBounds(point: Point): Point {
    if (!this.clampEnabled) return point
    const { originalWidth, originalHeight } = this.viewport
    if (!originalWidth || !originalHeight) return point
    return {
      x: Math.max(0, Math.min(point.x, originalWidth)),
      y: Math.max(0, Math.min(point.y, originalHeight)),
    }
  }

  /**
   * 添加文本标注
   * @param x - 图像坐标 X（标注背景框左上角）
   * @param y - 图像坐标 Y（标注背景框左上角）
   * @param text - 初始文本（可选，默认为空字符串）
   */
  addTextAnnotation(x: number, y: number, text: string = ""): number {
    // 约束到图片边界内
    const position = this.clampToImageBounds({ x, y })
    x = position.x
    y = position.y

    // 测量文本尺寸
    this.ctx.font = this.textStyle.font
    const measureText = text || "输入文字..."
    const metrics = this.ctx.measureText(measureText)
    
    // 计算实际文本高度（使用 actualBoundingBox 如果可用，否则使用字体大小）
    let textHeight: number
    if (metrics.actualBoundingBoxAscent && metrics.actualBoundingBoxDescent) {
      textHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
    } else {
      // 回退：使用字体大小
      const fontSize = parseInt(this.textStyle.font.match(/\d+/)?.[0] || "16")
      textHeight = fontSize * 1.2
    }
    
    const textAnnotation: TextAnnotation = {
      id: generateId(),
      position: { x, y },
      text,
      // 保存当前样式到标注
      style: this.getCurrentStyle(),
      width: Math.max(metrics.width, 60),
      height: textHeight,
    }

    this.textAnnotations.push(textAnnotation)
    const index = this.textAnnotations.length - 1

    this.notifyChange('create', index, textAnnotation)

    // 添加新标注后清空删除历史
    this.deleteHistory = []
    
    // 直接进入编辑模式
    this.startEditing(index)
    
    return index
  }

  /**
   * 更新文本标注内容
   */
  updateTextAnnotation(ref: number | string, text: string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.textAnnotations.length) return false

    const textAnnotation = this.textAnnotations[index]
    textAnnotation.text = text

    // 更新文本尺寸
    this.ctx.font = this.textStyle.font
    const metrics = this.ctx.measureText(text)
    textAnnotation.width = metrics.width
    textAnnotation.height = parseInt(this.textStyle.font) * 1.2

    this.notifyChange('update', index, this.textAnnotations[index])
    return true
  }

  /**
   * 移动文本标注位置
   */
  moveTextAnnotation(ref: number | string, x: number, y: number): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.textAnnotations.length) return false

    this.textAnnotations[index].position = { x, y }
    this.notifyChange('update', index, this.textAnnotations[index])
    return true
  }

  /**
   * 删除文本标注
   */
  removeTextAnnotation(ref: number | string): boolean {
    const index = this.resolveIndex(ref)
    if (index < 0 || index >= this.textAnnotations.length) return false

    const annotation = this.textAnnotations[index]

    // 保存删除的记录到历史（用于撤销）
    this.deleteHistory.push({
      annotation: { ...annotation },
      index
    })

    this.textAnnotations.splice(index, 1)

    this.notifyChange('delete', index, annotation)
    
    // 如果正在编辑该标注，重置编辑状态（不触碰数组，避免误删下移的标注）
    if (this.editingTextIndex === index) {
      this.resetEditingState()
    } else if (this.editingTextIndex !== null && this.editingTextIndex > index) {
      // 调整编辑索引
      this.editingTextIndex--
    }
    
    return true
  }

  /**
   * 清除所有文本标注
   */
  clearTextAnnotations(): void {
    this.textAnnotations = []
    this.selectedTextIndex = null
    this.cancelEditing()
    // 清空删除历史
    this.deleteHistory = []
  }

  /**
   * 开始编辑文本标注
   */
  startEditing(index: number): boolean {
    if (!this.textInput || index < 0 || index >= this.textAnnotations.length) {
      return false
    }

    const textData = this.textAnnotations[index]
    this.editingTextIndex = index
    this.currentEditingIndex = index
    this.textBeforeEditing = textData.text

    // 计算画布位置（position 表示背景框左上角）
    const canvasX = this.viewport.offset.x + textData.position.x * this.viewport.scale
    const canvasY = this.viewport.offset.y + textData.position.y * this.viewport.scale

    // 定位输入框在背景框左上角位置
    this.textInput.value = textData.text
    this.textInput.style.left = `${canvasX}px`
    this.textInput.style.top = `${canvasY}px`
    this.textInput.style.display = "block"

    // 调整输入框宽度
    this.adjustInputWidth()

    // 延迟聚焦
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.focus()
        this.textInput.select()
      }
    }, 10)

    return true
  }

  /**
   * 完成编辑
   */
  finishEditing(): boolean {
    if (!this.textInput) return false

    const index = this.currentEditingIndex
    const newText = this.textInput.value.trim()

    if (index === null || index < 0 || index >= this.textAnnotations.length) {
      this.resetEditingState()
      return false
    }

    if (newText === "") {
      // 如果文本为空，删除该标注
      const removed = this.textAnnotations[index]
      this.textAnnotations.splice(index, 1)
      this.notifyChange('delete', index, removed)
    } else {
      const textData = this.textAnnotations[index]
      textData.text = newText

      // 更新文本尺寸
      this.ctx.font = this.textStyle.font
      const metrics = this.ctx.measureText(textData.text)
      textData.width = metrics.width
      textData.height = parseInt(this.textStyle.font) * 1.2
      this.notifyChange('update', index, textData)
    }

    this.resetEditingState()
    return true
  }

  /**
   * 取消编辑
   */
  cancelEditing(): boolean {
    if (!this.textInput || this.editingTextIndex === null) return false

    // 恢复原文本
    this.textInput.value = this.textBeforeEditing

    // 如果原文本为空且这是新创建的标注，删除它
    const index = this.editingTextIndex
    if (index >= 0 && index < this.textAnnotations.length) {
      const textData = this.textAnnotations[index]
      if (textData.text === "" && this.textBeforeEditing === "") {
        const removed = this.textAnnotations[index]
        this.textAnnotations.splice(index, 1)
        this.notifyChange('delete', index, removed)
      }
    }

    this.resetEditingState()
    return true
  }

  /**
   * 删除正在编辑的文本标注
   */
  deleteEditingAnnotation(): boolean {
    if (this.editingTextIndex === null) return false

    const index = this.editingTextIndex

    // 隐藏输入框
    if (this.textInput) {
      this.textInput.style.display = "none"
    }

    // 删除标注
    if (index >= 0 && index < this.textAnnotations.length) {
      const removed = this.textAnnotations[index]
      this.textAnnotations.splice(index, 1)
      this.notifyChange('delete', index, removed)
    }

    this.resetEditingState()
    return true
  }

  /**
   * 重置编辑状态
   */
  private resetEditingState(): void {
    if (this.textInput) {
      this.textInput.style.display = "none"
    }
    this.editingTextIndex = null
    this.currentEditingIndex = null
    this.textBeforeEditing = ""
  }

  /**
   * 调整输入框宽度
   */
  private adjustInputWidth(): void {
    if (!this.textInput || this.editingTextIndex === null) return

    this.ctx.font = this.textStyle.font
    const text = this.textInput.value || this.textInput.placeholder || ""
    const metrics = this.ctx.measureText(text)
    const textWidth = metrics.width

    const minWidth = 60
    const maxWidth = 200
    const newWidth = Math.min(Math.max(textWidth + 24, minWidth), maxWidth)
    this.textInput.style.width = `${newWidth}px`
  }

  /**
   * 开始移动文本标注
   */
  startMoving(e: MouseEvent, index: number): boolean {
    if (index < 0 || index >= this.textAnnotations.length) return false

    this.editingTextIndex = index
    this.isTextMoving = true
    this.textMoveStart = { x: e.clientX, y: e.clientY }
    return true
  }

  /**
   * 移动文本标注
   */
  moveAnnotation(e: MouseEvent): boolean {
    if (!this.isTextMoving || this.editingTextIndex === null) return false

    const dx = e.clientX - this.textMoveStart.x
    const dy = e.clientY - this.textMoveStart.y

    const textData = this.textAnnotations[this.editingTextIndex]
    if (textData) {
      textData.position.x += dx / this.viewport.scale
      textData.position.y += dy / this.viewport.scale
      this.textMoveStart = { x: e.clientX, y: e.clientY }
      return true
    }
    return false
  }

  /**
   * 完成移动
   */
  finishMoving(): void {
    this.isTextMoving = false
    if (this.editingTextIndex !== null) {
      const annotation = this.textAnnotations[this.editingTextIndex]
      if (annotation) this.notifyChange('update', this.editingTextIndex, annotation)
    }
  }

  /**
   * 检查是否点击了文本标注
   */
  checkTextClick(offsetX: number, offsetY: number): number | null {
    // 从后往前遍历，优先选中上层的文本
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      // position 是背景框左上角（已包含 padding 偏移）
      const canvasX = this.viewport.offset.x + textData.position.x * this.viewport.scale
      const canvasY = this.viewport.offset.y + textData.position.y * this.viewport.scale
      const boxW = Math.max(textData.width, 60) + this.textStyle.padding * 2
      const boxH = textData.height + this.textStyle.padding * 2

      if (
        offsetX >= canvasX &&
        offsetX <= canvasX + boxW &&
        offsetY >= canvasY &&
        offsetY <= canvasY + boxH
      ) {
        return i
      }
    }
    return null
  }

  /**
   * 检查是否点击了文本标注（用于移动）
   */
  checkTextClickForMove(e: MouseEvent): { index: number; handled: boolean } {
    const index = this.checkTextClick(e.offsetX, e.offsetY)
    if (index !== null) {
      this.startMoving(e, index)
      return { index, handled: true }
    }
    return { index: -1, handled: false }
  }

  /**
   * 获取所有文本标注
   */
  getTextAnnotations(): TextAnnotation[] {
    return this.textAnnotations.map((a) => deepClone(a))
  }

  /**
   * 撤销文本标注
   */
  withdraw(): boolean {
    // 优先恢复删除的文本标注
    if (this.deleteHistory.length > 0) {
      const { annotation, index } = this.deleteHistory.pop()!
      // 在原来的位置插入
      this.textAnnotations.splice(index, 0, annotation)
      return true
    }
    // 否则删除最后一个文本标注
    if (this.textAnnotations.length > 0) {
      this.textAnnotations.pop()
      return true
    }
    return false
  }

  /**
   * 选中文本标注
   */
  selectTextAnnotation(index: number): boolean {
    if (index < 0 || index >= this.textAnnotations.length) {
      this.deselectTextAnnotation()
      return false
    }
    this.selectedTextIndex = index
    // 取消编辑状态
    if (this.editingTextIndex !== null) {
      this.finishEditing()
    }
    return true
  }

  /**
   * 取消选中文本标注
   */
  deselectTextAnnotation(): void {
    this.selectedTextIndex = null
  }

  /**
   * 删除选中的文本标注
   */
  deleteSelectedTextAnnotation(): boolean {
    if (this.selectedTextIndex === null) return false
    
    const index = this.selectedTextIndex
    const annotation = this.textAnnotations[index]
    
    // 保存删除的记录到历史（用于撤销）
    this.deleteHistory.push({
      annotation: { ...annotation },
      index
    })
    
    this.textAnnotations.splice(index, 1)
    this.selectedTextIndex = null

    this.notifyChange('delete', index, annotation)
    
    // 调整编辑索引
    if (this.editingTextIndex !== null && this.editingTextIndex > index) {
      this.editingTextIndex--
    }
    
    return true
  }

  /**
   * 获取选中的文本标注信息
   */
  getSelectedTextAnnotation(): { index: number; data: TextAnnotation } | null {
    if (this.selectedTextIndex === null) return null
    const annotation = this.textAnnotations[this.selectedTextIndex]
    if (!annotation) return null
    return {
      index: this.selectedTextIndex,
      data: deepClone(annotation)
    }
  }

  /**
   * 销毁（清理 DOM）
   */
  destroy(): void {
    if (this.textInput && this.textInput.parentNode) {
      this.textInput.parentNode.removeChild(this.textInput)
    }
  }
}
