export type Shape = Rect | Polygon | TextAnnotation
export type Point = {
  x: number
  y: number
}
export type Rect = {
  start: Point
  width: number
  height: number
}
export type Polygon = {
  point: Point
}
export type TextAnnotation = {
  position: { x: number; y: number }
  text: string
  width: number
  height: number
}
export type Operate<T extends Shape> = {
  type: "rect" | "polygon" | "drag" | "text" | ""
  data: T[]
  status: "fullfilled" | "pending"
}
export type DrawerOptions = {
  id: string
  drawType?: "rect" | "polygon" | "drag" | "text" | ""
  useEvents?: boolean
}

type WheelEventListener = (event: WheelEvent) => void
type MouseEventListener = (event: MouseEvent) => void
type KeyboardEventListener = (event: KeyboardEvent) => void

export type DrawerEventHandlers = {
  wheel: WheelEventListener
  mousedown: MouseEventListener
  mousemove: MouseEventListener
  mouseup: MouseEventListener
  mouseleave: MouseEventListener
  dblclick: MouseEventListener
  click: MouseEventListener
  keydown: KeyboardEventListener
}

export default class Drawer {
  private canvas = document.createElement("canvas")
  private ctx = null as unknown as CanvasRenderingContext2D
  private events: DrawerEventHandlers
  // 绘制相关属性
  public drawType: "rect" | "polygon" | "drag" | "text" | "" = ""
  private recordList: Operate<Rect | Polygon | TextAnnotation>[] = []
  // 新增：存储文本标注
  private textAnnotations: TextAnnotation[] = []
  private operate: Operate<Rect | Polygon | TextAnnotation> = {
    type: "rect",
    data: [],
    status: "pending",
  }
  private drawStartPoint = { x: 0, y: 0 }
  private isDrawing = false
  private tempPolygonPoint: { x: number; y: number } | null = null

  // 图像相关属性
  private bgImage: HTMLImageElement | null = null
  private originalSize = { width: 0, height: 0 }
  private viewport = { width: 0, height: 0 }
  private strokeStyle = "red"
  private lineWidth = 5
  private bgImageSrc = ""
  private bgImageExt = "jpeg"

  // 视图变换属性
  private scale = 1
  private minScale = 1 // 会在初始化时更新
  private maxScale = 10
  private offset = { x: 0, y: 0 }
  private isDragging = false
  private dragStart = { x: 0, y: 0 }

  // 初始视图状态
  private initialScale = 1
  private initialOffset = { x: 0, y: 0 }
  private isInitialScale = true // 添加初始状态标志

  // 边界约束
  private minOffsetX = 0
  private minOffsetY = 0
  private maxOffsetX = 0
  private maxOffsetY = 0

  // 新增：文本相关属性
  private textInput: HTMLInputElement | null = null
  private editingTextIndex: number | null = null
  private isTextMoving = false
  private textMoveStart = { x: 0, y: 0 }
  private textBeforeEditing: string = "" // 保存编辑前的文本，用于取消编辑
  private textStyle = {
    font: "16px Arial",
    color: "#FFD700", // 金黄色，更醒目
    padding: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    selectedBorderColor: "#00D9FF", // 青色选中边框
    selectedBackgroundColor: "rgba(0,217,255,0.15)", // 选中时的背景色
  }

  // 新增：标注选中移动相关属性
  private selectedAnnotation: { index: number; type: "rect" | "polygon" } | null = null
  private isMovingAnnotation = false
  private annotationMoveStart = { x: 0, y: 0 }
  private annotationMoveOffset = { x: 0, y: 0 }
  private selectionStyle = {
    strokeColor: "#00D9FF", // 青色选中边框
    fillColor: "rgba(0,217,255,0.15)", // 半透明填充
    handleSize: 12, // 控制点大小（增加以便更容易点击）
    handleColor: "#00D9FF",
  }
  
  // 控制点编辑相关属性
  private activeHandle: { type: "rect-corner" | "polygon-vertex"; index: number } | null = null
  private isResizing = false
  private resizeStartPoint = { x: 0, y: 0 }
  private originalRect: Rect | null = null
  private originalPolygon: Polygon[] | null = null
  
  // 防止移动/调整大小后触发 click 绘制
  private justFinishedMove = false
  
  // 保存确定的编辑索引，防止 deselectAll 后无法保存
  private currentEditingIndex: number | null = null

  constructor(options: DrawerOptions) {
    this.events = {
      wheel: (e: WheelEvent) => this.handleWheel(e),
      mousedown: (e: MouseEvent) => this.handleMouseDown(e),
      mousemove: (e: MouseEvent) => this.handleMouseMove(e),
      mouseup: (e: MouseEvent) => this.handleMouseUp(e),
      mouseleave: (e: MouseEvent) => this.handleMouseLeave(e),
      dblclick: (e: MouseEvent) => this.handleMouseDoubleClick(e),
      click: (e: MouseEvent) => this.handleMouseClick(e),
      keydown: (e: KeyboardEvent) => this.handleKeyDown(e),
    }
    this.init(options)
  }

  private init(options: DrawerOptions) {
    const { drawType, useEvents = true, id = "container" } = options
    const container = document.getElementById(id)
    if (!container) throw new Error(`Container with id "${id}" not found`)
    
    // 确保 container 有相对定位，以便正确定位文本输入框
    if (container.style.position !== "absolute" && container.style.position !== "fixed" && container.style.position !== "relative") {
      container.style.position = "relative"
    }
    
    this.viewport = {
      width: container.clientWidth,
      height: container.clientHeight,
    }

    // 设置canvas尺寸
    this.canvas.width = this.viewport.width
    this.canvas.height = this.viewport.height
    this.canvas.style.width = `${this.viewport.width}px`
    this.canvas.style.height = `${this.viewport.height}px`
    this.canvas.style.cursor = "default"
    this.canvas.style.display = "block"
    container.appendChild(this.canvas)

    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D
    this.setDrawType(drawType || "")

    // 新增：创建文本输入框
    this.textInput = document.createElement("input")
    this.textInput.type = "text"
    this.textInput.style.position = "absolute"
    this.textInput.style.zIndex = "99999"
    this.textInput.style.display = "none"
    this.textInput.style.border = "2px solid #00D9FF"
    this.textInput.style.borderRadius = "6px"
    this.textInput.style.padding = "6px 10px"
    this.textInput.style.fontSize = "16px"
    this.textInput.style.fontFamily = "Arial, sans-serif"
    this.textInput.style.backgroundColor = "#ffffff"
    this.textInput.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)"
    this.textInput.style.outline = "none"
    this.textInput.style.width = "fit-content"
    this.textInput.style.minWidth = "60px"
    this.textInput.style.maxWidth = "200px"
    this.textInput.style.color = "#333"
    this.textInput.placeholder = "输入文字..."

    // 失去焦点时完成编辑
    this.textInput.addEventListener("blur", () => this.finishTextEditing())

    // 键盘事件处理
    this.textInput.addEventListener("keydown", (e) => {
      e.stopPropagation()

      if (e.key === "Enter") {
        // Enter 完成编辑
        this.finishTextEditing()
      } else if (e.key === "Escape") {
        // ESC 取消编辑，恢复原文本
        e.preventDefault()
        this.cancelTextEditing()
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // 如果文本为空且按 Delete/Backspace，删除该标注
        if (this.textInput!.value === "" && e.key === "Delete") {
          e.preventDefault()
          this.deleteEditingTextAnnotation()
        }
      }
    })

    // 输入时自动调整宽度
    this.textInput.addEventListener("input", () => {
      this.adjustTextInputWidth()
    })

    container.appendChild(this.textInput)

    if (useEvents) {
      this.addEventListeners()
    }
  }

  public setDrawType(type: "rect" | "polygon" | "drag" | "text" | "") {
    // 检查当前是否正在绘制多边形
    if (this.drawType === "polygon" && this.isDrawing) {
      // 如果正在绘制多边形且还没有完成，则不允许切换模式
      if (this.operate.data.length > 0) {
        console.warn(
          "Cannot switch mode while polygon is being drawn. Please complete or cancel the polygon first.",
        )
        return
      }
    }
    // 如果切换到相同模式，不做任何操作
    if (this.drawType === type) return

    // 重置当前操作状态
    this.operate.data = []
    this.isDrawing = false
    this.tempPolygonPoint = null

    // 如果切换到绘制模式，取消选中状态
    if (type !== "") {
      this.deselectAnnotation()
    }

    // 更新操作类型和绘制类型
    this.operate.type = type
    this.drawType = type

    // 设置光标样式 - 根据初始状态调整拖拽模式的光标
    if (type === "drag") {
      this.canvas.style.cursor = "grab"
    } else if (type === "text") {
      this.canvas.style.cursor = "text"
    } else {
      this.canvas.style.cursor = "default"
    }
  }

  // 方法 2：使用 URL API 更健壮的解析
  private getImageTypeFromUrl(urlString: string): string {
    try {
      const url = new URL(urlString)
      const pathname = url.pathname.toLowerCase()
      if (pathname.endsWith(".png")) return "png"
      return "jpeg" // ✅ 强制统一为 jpeg
    } catch {
      return "jpeg"
    }
  }

  public drawImage(src: string) {
    this.bgImageSrc = src
    this.bgImageExt = this.getImageTypeFromUrl(src)
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = src
    img.onload = () => {
      this.bgImage = img
      this.originalSize = {
        width: img.width,
        height: img.height,
      }

      // 计算初始缩放比例和位置
      this.calculateInitialView()
      this.render()
    }
  }

  // 计算初始视图参数
  private calculateInitialView() {
    if (!this.bgImage) return
    // 计算缩放比例以适应容器
    const scaleX = this.viewport.width / this.originalSize.width
    const scaleY = this.viewport.height / this.originalSize.height
    this.scale = Math.min(scaleX, scaleY)
    this.initialScale = this.scale

    // 设置最小缩放为初始缩放比例
    this.minScale = this.initialScale

    // 计算居中位置
    this.offset = {
      x: (this.viewport.width - this.originalSize.width * this.scale) / 2,
      y: (this.viewport.height - this.originalSize.height * this.scale) / 2,
    }
    this.initialOffset = { ...this.offset }

    // 计算边界约束
    this.calculateBoundaries()

    // 标记为初始状态
    this.isInitialScale = true
  }

  // 计算边界约束
  private calculateBoundaries() {
    if (!this.bgImage) return

    const imgScaledWidth = this.originalSize.width * this.scale
    const imgScaledHeight = this.originalSize.height * this.scale

    // 最大偏移量（图像完全在视口内）
    this.maxOffsetX = 0
    this.maxOffsetY = 0

    // 最小偏移量（图像完全覆盖视口）
    this.minOffsetX = this.viewport.width - imgScaledWidth
    this.minOffsetY = this.viewport.height - imgScaledHeight

    // 确保最小值不大于最大值
    if (this.minOffsetX > this.maxOffsetX) {
      ;[this.minOffsetX, this.maxOffsetX] = [this.maxOffsetX, this.minOffsetX]
    }
    if (this.minOffsetY > this.maxOffsetY) {
      ;[this.minOffsetY, this.maxOffsetY] = [this.maxOffsetY, this.minOffsetY]
    }
  }

  // 将画布坐标转换为图像坐标
  private toImageCoordinates(x: number, y: number) {
    return {
      x: (x - this.offset.x) / this.scale,
      y: (y - this.offset.y) / this.scale,
    }
  }

  private render() {
    // 清除画布
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height)

    // 绘制背景图片（如果有）
    if (this.bgImage) {
      this.ctx.drawImage(
        this.bgImage,
        this.offset.x,
        this.offset.y,
        this.originalSize.width * this.scale,
        this.originalSize.height * this.scale,
      )
    }

    // 绘制标注（矩形、多边形）
    this.drawAnnotations()

    // 绘制文本标注
    this.drawTextAnnotations()
  }

  private drawAnnotations() {
    this.ctx.strokeStyle = this.strokeStyle
    this.ctx.lineWidth = this.lineWidth
    // 绘制已有标注
    this.recordList.forEach((item) => {
      if (item.type === "rect") {
        const rect = item.data[0] as Rect
        this.ctx.strokeRect(
          this.offset.x + rect.start.x * this.scale,
          this.offset.y + rect.start.y * this.scale,
          rect.width * this.scale,
          rect.height * this.scale,
        )
      } else if (item.type === "polygon") {
        this.ctx.beginPath()
        ;(item.data as Polygon[]).forEach((point, index) => {
          const x = this.offset.x + point.point.x * this.scale
          const y = this.offset.y + point.point.y * this.scale
          if (index === 0) {
            this.ctx.moveTo(x, y)
          } else {
            this.ctx.lineTo(x, y)
          }
        })

        // 闭合多边形
        if (item.status === "fullfilled" && item.data.length > 1) {
          const first = item.data[0] as Polygon
          this.ctx.lineTo(
            this.offset.x + first.point.x * this.scale,
            this.offset.y + first.point.y * this.scale,
          )
        }
        this.ctx.stroke()
        // 绘制多边形点标记
        ;(item.data as Polygon[]).forEach((point) => {
          const x = this.offset.x + point.point.x * this.scale
          const y = this.offset.y + point.point.y * this.scale
          this.ctx.beginPath()
          this.ctx.arc(x, y, 4, 0, Math.PI * 2)
          this.ctx.fillStyle = this.strokeStyle
          this.ctx.fill()
        })
      }
    })

    // 绘制当前操作
    if (this.operate.data.length > 0) {
      this.ctx.strokeStyle = this.strokeStyle
      if (this.operate.type === "rect") {
        const rect = this.operate.data[0] as Rect
        this.ctx.strokeRect(
          this.offset.x + rect.start.x * this.scale,
          this.offset.y + rect.start.y * this.scale,
          rect.width * this.scale,
          rect.height * this.scale,
        )
      } else if (this.operate.type === "polygon") {
        // 绘制多边形路径
        this.ctx.beginPath()
        ;(this.operate.data as Polygon[]).forEach((point, index) => {
          const x = this.offset.x + point.point.x * this.scale
          const y = this.offset.y + point.point.y * this.scale

          if (index === 0) {
            this.ctx.moveTo(x, y)
          } else {
            this.ctx.lineTo(x, y)
          }
        })

        // 绘制到临时点
        if (this.tempPolygonPoint) {
          const x = this.offset.x + this.tempPolygonPoint.x * this.scale
          const y = this.offset.y + this.tempPolygonPoint.y * this.scale
          this.ctx.lineTo(x, y)
        }

        this.ctx.stroke()

        // 绘制多边形点标记
        ;(this.operate.data as Polygon[]).forEach((point) => {
          const x = this.offset.x + point.point.x * this.scale
          const y = this.offset.y + point.point.y * this.scale

          this.ctx.beginPath()
          this.ctx.arc(x, y, 4, 0, Math.PI * 2)
          this.ctx.fillStyle = this.strokeStyle
          this.ctx.fill()
        })

        // 绘制临时点标记
        if (this.tempPolygonPoint) {
          const x = this.offset.x + this.tempPolygonPoint.x * this.scale
          const y = this.offset.y + this.tempPolygonPoint.y * this.scale

          this.ctx.beginPath()
          this.ctx.arc(x, y, 4, 0, Math.PI * 2)
          this.ctx.fillStyle = this.strokeStyle
          this.ctx.fill()
        }
      }
    }

    // 绘制选中状态的标注高亮
    this.drawSelectionHighlight()
  }

  // 绘制选中状态的标注高亮
  private drawSelectionHighlight() {
    if (!this.selectedAnnotation) return

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return

    this.ctx.save()

    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      const x = this.offset.x + rect.start.x * this.scale
      const y = this.offset.y + rect.start.y * this.scale
      const w = rect.width * this.scale
      const h = rect.height * this.scale

      // 绘制半透明填充
      this.ctx.fillStyle = this.selectionStyle.fillColor
      this.ctx.fillRect(x, y, w, h)

      // 绘制选中边框
      this.ctx.strokeStyle = this.selectionStyle.strokeColor
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([5, 5]) // 虚线边框
      this.ctx.strokeRect(x, y, w, h)

      // 绘制四个角的控制点
      const handleSize = this.selectionStyle.handleSize
      this.ctx.fillStyle = this.selectionStyle.handleColor

      // 左上
      this.ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      // 右上
      this.ctx.fillRect(x + w - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      // 左下
      this.ctx.fillRect(x - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
      // 右下
      this.ctx.fillRect(x + w - handleSize / 2, y + h - handleSize / 2, handleSize, handleSize)
    } else if (annotation.type === "polygon") {
      const polygon = annotation.data as Polygon[]

      // 绘制半透明填充
      this.ctx.beginPath()
      polygon.forEach((p, i) => {
        const x = this.offset.x + p.point.x * this.scale
        const y = this.offset.y + p.point.y * this.scale
        if (i === 0) {
          this.ctx.moveTo(x, y)
        } else {
          this.ctx.lineTo(x, y)
        }
      })
      this.ctx.closePath()
      this.ctx.fillStyle = this.selectionStyle.fillColor
      this.ctx.fill()

      // 绘制选中边框
      this.ctx.strokeStyle = this.selectionStyle.strokeColor
      this.ctx.lineWidth = 2
      this.ctx.setLineDash([5, 5])
      this.ctx.stroke()

      // 绘制顶点控制点
      const handleSize = this.selectionStyle.handleSize
      this.ctx.fillStyle = this.selectionStyle.handleColor
      polygon.forEach((p) => {
        const x = this.offset.x + p.point.x * this.scale
        const y = this.offset.y + p.point.y * this.scale
        this.ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize)
      })
    }

    this.ctx.restore()
  }

  // 绘制文本标注
  private drawTextAnnotations() {
    this.textAnnotations.forEach((textData, index) => {
      const isEditing = this.editingTextIndex === index
      
      // 如果正在编辑（输入框显示中），不在 canvas 上绘制文本
      if (isEditing && this.textInput && this.textInput.style.display !== "none") return
      
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale
      const boxWidth = textData.width + this.textStyle.padding * 2
      const boxHeight = textData.height + this.textStyle.padding * 2

      // 如果文本为空，不绘制背景和文本（包括正在编辑但还没输入的情况）
      if (!textData.text) {
        return // 空文本不绘制
      }

      // 如果文本被选中（在选择模式下），绘制选中边框
      if (isEditing && this.drawType === "") {
        this.ctx.save()
        this.ctx.strokeStyle = this.selectionStyle.strokeColor
        this.ctx.lineWidth = 2
        this.ctx.setLineDash([5, 5])
        this.ctx.strokeRect(
          canvasX - this.textStyle.padding - 2,
          canvasY - this.textStyle.padding - 2,
          boxWidth + 4,
          boxHeight + 4
        )
        this.ctx.restore()
      }

      // 绘制背景（带圆角效果用矩形模拟）
      this.ctx.fillStyle = this.textStyle.backgroundColor
      this.ctx.beginPath()
      const r = this.textStyle.borderRadius
      this.ctx.roundRect(
        canvasX - this.textStyle.padding,
        canvasY - this.textStyle.padding,
        boxWidth,
        boxHeight,
        r,
      )
      this.ctx.fill()

      // 绘制文本（如果文本为空，只绘制占位符在编辑状态下）
      this.ctx.font = this.textStyle.font
      this.ctx.fillStyle = this.textStyle.color
      if (textData.text) {
        this.ctx.fillText(textData.text, canvasX, canvasY + textData.height - 5)
      }
    })
  }

  public clear(type: "rect" | "polygon" | "drag" | "text" | "" = "") {
    this.recordList = []
    this.setDrawType(type)
    this.render()
  }

  public withdraw() {
    if (
      this.recordList.length === 0 &&
      this.operate.data.length === 0 &&
      this.textAnnotations.length === 0
    ) {
      return
    }

    // 优化：统一处理撤销逻辑
    if (this.operate.data.length > 0) {
      // 撤销当前操作中的点
      if (this.drawType === "polygon") {
        this.operate.data.pop()
      } else {
        this.operate.data = []
        this.isDrawing = false
      }
    } else if (this.textAnnotations.length > 0) {
      // 撤销文本
      this.textAnnotations.pop()
    } else {
      // 撤销已完成的操作
      this.recordList.pop()
    }

    this.render()
  }

  public addEventListeners() {
    this.canvas.addEventListener("mousedown", this.events.mousedown)
    this.canvas.addEventListener("mousemove", this.events.mousemove)
    this.canvas.addEventListener("mouseup", this.events.mouseup)
    this.canvas.addEventListener("mouseleave", this.events.mouseleave)
    this.canvas.addEventListener("wheel", this.events.wheel)
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault())
    document.addEventListener("keydown", this.events.keydown)
    this.handleClickEventListener()
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault()
    if (!this.bgImage) return

    const delta = e.deltaY > 0 ? -0.02 : 0.02
    const oldScale = this.scale

    // 计算新的缩放比例 - 使用动态最小缩放
    const newScale = Math.max(this.minScale, Math.min(oldScale + delta, this.maxScale))

    // 计算缩放中心（鼠标位置）
    const rect = this.canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    // 计算缩放前鼠标点在图像中的位置
    const imgX = (mouseX - this.offset.x) / oldScale
    const imgY = (mouseY - this.offset.y) / oldScale

    // 更新缩放比例
    this.scale = newScale

    // 计算缩放后鼠标点应该的位置
    const newMouseX = imgX * newScale + this.offset.x
    const newMouseY = imgY * newScale + this.offset.y

    // 调整偏移量以保持鼠标点不变
    this.offset.x += mouseX - newMouseX
    this.offset.y += mouseY - newMouseY

    // 更新边界约束
    this.calculateBoundaries()
    this.constrainViewport()

    // 缩放后不再是初始状态
    this.isInitialScale = this.scale === this.initialScale

    this.render()
  }

  // 确保视图在合理范围内
  private constrainViewport() {
    // 约束X轴
    if (this.offset.x > this.maxOffsetX) {
      this.offset.x = this.maxOffsetX
    } else if (this.offset.x < this.minOffsetX) {
      this.offset.x = this.minOffsetX
    }

    // 约束Y轴
    if (this.offset.y > this.maxOffsetY) {
      this.offset.y = this.maxOffsetY
    } else if (this.offset.y < this.minOffsetY) {
      this.offset.y = this.minOffsetY
    }
  }

  private handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return // 只处理左键

    // 优先处理：如果有选中的标注，检查是否点击了控制点（任何模式下都可以编辑）
    if (this.selectedAnnotation && this.bgImage) {
      const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
      const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.activeHandle = handle
        this.isResizing = true
        this.resizeStartPoint = imgCoords
        const annotation = this.recordList[this.selectedAnnotation.index]
        if (annotation.type === "rect") {
          this.originalRect = { ...(annotation.data[0] as Rect) }
        } else if (annotation.type === "polygon") {
          this.originalPolygon = (annotation.data as Polygon[]).map(p => ({ point: { ...p.point } }))
        }
        this.render()
        return
      }
    }

    // 文本标注模式
    if (this.drawType === "text") {
      this.handleTextModeClick(e)
      return
    }

    // 其他模式需要背景图片
    if (!this.bgImage) return

    const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
    
    if (this.drawType === "rect") {
      // 矩形模式：优先检测是否点击了文本（可以移动文本）
      const textHandled = this.checkTextClickForMove(e)
      if (textHandled) return
      
      // 检测是否点击了多边形（可以移动多边形）
      const polygonHandled = this.handlePolygonModeClickForMove(e, imgCoords)
      if (polygonHandled) return
      
      // 矩形模式：检测是否点击了已有矩形进行编辑
      const handled = this.handleRectModeClick(e, imgCoords)
      if (handled) return
      
      // 没有点击已有矩形，开始绘制新矩形
      this.isDrawing = true
      this.drawStartPoint = imgCoords
      this.operate = {
        type: "rect",
        data: [],
        status: "pending",
      }
      this.operate.data.push({
        start: { ...imgCoords },
        width: 0,
        height: 0,
      })
    } else if (this.drawType === "polygon") {
      // 多边形模式：优先检测是否点击了文本（可以移动文本）
      const textHandled = this.checkTextClickForMove(e)
      if (textHandled) return
      
      // 检测是否点击了矩形（可以移动矩形）
      const rectHandled = this.handleRectModeClickForMove(e, imgCoords)
      if (rectHandled) return
      
      // 多边形模式：检测是否点击了已有多边形的顶点或边
      const handled = this.handlePolygonModeClick(e, imgCoords)
      if (handled) return
      
      // 没有点击已有多边形，开始绘制新多边形
      if (!this.isDrawing) {
        this.isDrawing = true
        this.operate = {
          type: "polygon",
          data: [{ point: imgCoords }],
          status: "pending",
        }
      } else if (this.checkPolygonPointValid(e)) {
        this.operate.data.push({ point: imgCoords })
      }
      this.tempPolygonPoint = imgCoords
      this.render()
    } else if (this.drawType === "drag") {
      // 拖拽模式 - 检查是否点击了标注进行移动/调整，否则拖拽视图
      
      // 优先检查控制点（选中状态下的矩形/多边形）
      if (this.selectedAnnotation) {
        const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          this.activeHandle = handle
          this.isResizing = true
          this.resizeStartPoint = imgCoords
          const annotation = this.recordList[this.selectedAnnotation.index]
          if (annotation.type === "rect") {
            this.originalRect = { ...(annotation.data[0] as Rect) }
          } else if (annotation.type === "polygon") {
            this.originalPolygon = (annotation.data as Polygon[]).map(p => ({ point: { ...p.point } }))
          }
          this.render()
          return
        }
      }
      
      // 检查文本
      const textClicked = this.checkTextClickInDragMode(e)
      if (textClicked) return
      
      // 检查矩形（可选中移动和调整大小）
      const rectHandled = this.handleRectModeClick(e, imgCoords)
      if (rectHandled) return
      
      // 检查多边形（可选中移动和调整顶点）
      const polygonHandled = this.handlePolygonModeClick(e, imgCoords)
      if (polygonHandled) return
      
      // 没有点击任何标注，开始拖拽视图
      this.isDragging = true
      this.dragStart = { x: e.clientX, y: e.clientY }
      this.canvas.style.cursor = "grabbing"
    } else if (this.drawType === "") {
      // 无模式：可以选中和编辑所有类型的标注
      this.handleNoModeClick(e, imgCoords)
    }
  }

  // 拖拽模式下检查文本点击（用于移动文本）
  private checkTextClickInDragMode(e: MouseEvent): boolean {
    // 从后往前遍历，优先选中上层的文本
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale

      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        // 点击到了文本，进入移动模式
        this.isTextMoving = true
        this.editingTextIndex = i
        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.canvas.style.cursor = "grabbing"
        this.render()
        return true
      }
    }

    return false
  }

  // ==================== 新模式下的点击处理方法 ====================

  // 文本模式下的点击处理（单击选中，双击编辑）
  private handleTextModeClick(e: MouseEvent): boolean {
    // 检测是否点击了已有文本
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale

      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        // 点击到了文本，进入选中状态（不是立即编辑）
        this.editingTextIndex = i
        this.isTextMoving = true
        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.canvas.style.cursor = "grabbing"
        this.render()
        return true
      }
    }

    // 没有点击文本，创建新文本
    const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
    this.addTextAnnotation(imgCoords.x, imgCoords.y)
    return true
  }

  // 矩形模式下的点击处理（点击已有矩形进行编辑）
  private handleRectModeClick(e: MouseEvent, imgCoords: Point): boolean {
    // 如果有选中的矩形，先检查是否点击了控制点
    if (this.selectedAnnotation && this.selectedAnnotation.type === "rect") {
      const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.activeHandle = handle
        this.isResizing = true
        this.resizeStartPoint = imgCoords
        const annotation = this.recordList[this.selectedAnnotation.index]
        this.originalRect = { ...(annotation.data[0] as Rect) }
        this.render()
        return true
      }
    }

    // 检测是否点击到已有矩形
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]
      if (annotation.type === "rect") {
        const rect = annotation.data[0] as Rect
        if (this.isPointInRect(imgCoords, rect)) {
          // 选中该矩形并进入移动模式
          this.selectedAnnotation = { index: i, type: "rect" }
          this.isMovingAnnotation = true
          this.annotationMoveStart = { x: e.clientX, y: e.clientY }
          this.render()
          return true
        }
      }
    }

    // 没有点击已有矩形，取消选中
    this.deselectAnnotation()
    return false
  }

  // 多边形模式下的点击处理（点击已有多边形进行编辑）
  private handlePolygonModeClick(e: MouseEvent, imgCoords: Point): boolean {
    // 如果有选中的多边形，先检查是否点击了顶点
    if (this.selectedAnnotation && this.selectedAnnotation.type === "polygon") {
      const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle && handle.type === "polygon-vertex") {
        this.activeHandle = handle
        this.isResizing = true
        this.resizeStartPoint = imgCoords
        const annotation = this.recordList[this.selectedAnnotation.index]
        this.originalPolygon = (annotation.data as Polygon[]).map(p => ({ point: { ...p.point } }))
        this.render()
        return true
      }
    }

    // 检测是否点击到已有多边形
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]
      if (annotation.type === "polygon") {
        const polygon = annotation.data as Polygon[]
        if (this.isPointInPolygon(imgCoords, polygon)) {
          // 选中该多边形并进入移动模式
          this.selectedAnnotation = { index: i, type: "polygon" }
          this.isMovingAnnotation = true
          this.annotationMoveStart = { x: e.clientX, y: e.clientY }
          this.render()
          return true
        }
      }
    }

    // 没有点击已有多边形，取消选中
    this.deselectAnnotation()
    return false
  }

  // 纯移动检测：检测是否点击了矩形（仅用于多边形模式下移动矩形）
  private handleRectModeClickForMove(e: MouseEvent, imgCoords: Point): boolean {
    // 检测是否点击到已有矩形（只移动，不选中编辑）
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]
      if (annotation.type === "rect") {
        const rect = annotation.data[0] as Rect
        if (this.isPointInRect(imgCoords, rect)) {
          // 选中该矩形并进入移动模式
          this.selectedAnnotation = { index: i, type: "rect" }
          this.isMovingAnnotation = true
          this.annotationMoveStart = { x: e.clientX, y: e.clientY }
          this.render()
          return true
        }
      }
    }
    return false
  }

  // 纯移动检测：检测是否点击了多边形（仅用于矩形模式下移动多边形）
  private handlePolygonModeClickForMove(e: MouseEvent, imgCoords: Point): boolean {
    // 检测是否点击到已有多边形（只移动，不选中编辑）
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]
      if (annotation.type === "polygon") {
        const polygon = annotation.data as Polygon[]
        if (this.isPointInPolygon(imgCoords, polygon)) {
          // 选中该多边形并进入移动模式
          this.selectedAnnotation = { index: i, type: "polygon" }
          this.isMovingAnnotation = true
          this.annotationMoveStart = { x: e.clientX, y: e.clientY }
          this.render()
          return true
        }
      }
    }
    return false
  }

  // 纯移动检测：检测是否点击了文本（用于非文本模式下移动文本）
  private checkTextClickForMove(e: MouseEvent): boolean {
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale
      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        // 选中文本并进入移动模式
        this.editingTextIndex = i
        this.isTextMoving = true
        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.canvas.style.cursor = "grabbing"
        this.render()
        return true
      }
    }
    return false
  }

  // 无模式下的点击处理（可以编辑所有类型）
  private handleNoModeClick(e: MouseEvent, imgCoords: Point): void {
    // 先检查是否点击了文本
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale
      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        // 选中文本并可以移动
        this.editingTextIndex = i
        this.isTextMoving = true
        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.render()
        return
      }
    }

    // 再检查是否点击了矩形/多边形
    const handled = this.handleAnnotationSelection(e, imgCoords)
    if (!handled) {
      this.deselectAnnotation()
    }
  }

  // 检查文本点击（旧方法，用于拖拽模式）
  private checkTextClick(e: MouseEvent, forMove: boolean = false): boolean {
    const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
    let clickedTextIndex: number | null = null

    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale
      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        clickedTextIndex = i
        break
      }
    }

    if (clickedTextIndex !== null) {
      if (forMove) {
        this.isTextMoving = true
        this.editingTextIndex = clickedTextIndex
        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.canvas.style.cursor = "grabbing"
      } else {
        this.startTextEditing(clickedTextIndex)
      }
      return true
    }
    return false
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.bgImage) return

    // 处理拖拽
    if (this.isDragging && this.drawType === "drag") {
      const dx = e.clientX - this.dragStart.x
      const dy = e.clientY - this.dragStart.y

      this.offset.x += dx
      this.offset.y += dy

      this.dragStart = { x: e.clientX, y: e.clientY }
      this.constrainViewport()
      this.render()
      return
    }

    // 处理文本移动
    if (this.isTextMoving && this.editingTextIndex !== null) {
      const dx = e.clientX - this.textMoveStart.x
      const dy = e.clientY - this.textMoveStart.y

      const textData = this.textAnnotations[this.editingTextIndex]
      if (textData) {
        // 更新文本位置（在图像坐标系中）
        textData.position.x += dx / this.scale
        textData.position.y += dy / this.scale

        this.textMoveStart = { x: e.clientX, y: e.clientY }
        this.render()
      }
      return
    }

    // 处理标注移动或调整大小
    if ((this.isMovingAnnotation || this.isResizing) && this.selectedAnnotation) {
      this.handleAnnotationMove(e)
      return
    }

    // 检测光标样式（在没有拖拽/调整时）
    if (!this.isMovingAnnotation && !this.isResizing && !this.isTextMoving) {
      this.updateCursor(e)
    }

    // 处理矩形绘制（在绘制模式下）
    if (this.isDrawing && this.operate.type === "rect") {
      const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
      const rect = this.operate.data[0] as Rect
      rect.width = imgCoords.x - this.drawStartPoint.x
      rect.height = imgCoords.y - this.drawStartPoint.y
      this.render()
    }

    // 处理多边形临时点
    if (this.drawType === "polygon" && this.isDrawing) {
      this.tempPolygonPoint = this.toImageCoordinates(e.offsetX, e.offsetY)
      this.render()
    }
  }

  // 更新鼠标光标样式
  private updateCursor(e: MouseEvent): void {
    // 文本模式：检测文本悬停
    if (this.drawType === "text") {
      for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
        const textData = this.textAnnotations[i]
        const canvasX = this.offset.x + textData.position.x * this.scale
        const canvasY = this.offset.y + textData.position.y * this.scale
        if (
          e.offsetX >= canvasX - this.textStyle.padding &&
          e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
          e.offsetY >= canvasY - this.textStyle.padding &&
          e.offsetY <= canvasY + textData.height + this.textStyle.padding
        ) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      this.canvas.style.cursor = "crosshair"
      return
    }

    // 矩形模式：检测矩形（控制点）、多边形和文本
    if (this.drawType === "rect" && this.bgImage) {
      // 先检查控制点
      if (this.selectedAnnotation?.type === "rect") {
        const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
          return
        }
      }
      // 再检查是否在矩形上
      const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
      for (let i = this.recordList.length - 1; i >= 0; i--) {
        const annotation = this.recordList[i]
        if (annotation.type === "rect" && this.isPointInRect(imgCoords, annotation.data[0] as Rect)) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      // 检查多边形（可移动）
      for (let i = this.recordList.length - 1; i >= 0; i--) {
        const annotation = this.recordList[i]
        if (annotation.type === "polygon" && this.isPointInPolygon(imgCoords, annotation.data as Polygon[])) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      // 检查文本（可移动）
      for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
        const textData = this.textAnnotations[i]
        const canvasX = this.offset.x + textData.position.x * this.scale
        const canvasY = this.offset.y + textData.position.y * this.scale
        if (
          e.offsetX >= canvasX - this.textStyle.padding &&
          e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
          e.offsetY >= canvasY - this.textStyle.padding &&
          e.offsetY <= canvasY + textData.height + this.textStyle.padding
        ) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      this.canvas.style.cursor = "crosshair"
      return
    }

    // 多边形模式：检测多边形（顶点）、矩形和文本
    if (this.drawType === "polygon" && this.bgImage) {
      // 先检查顶点
      if (this.selectedAnnotation?.type === "polygon") {
        const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          this.canvas.style.cursor = "crosshair"
          return
        }
      }
      // 再检查是否在多边形上
      const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
      for (let i = this.recordList.length - 1; i >= 0; i--) {
        const annotation = this.recordList[i]
        if (annotation.type === "polygon" && this.isPointInPolygon(imgCoords, annotation.data as Polygon[])) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      // 检查矩形（可移动）
      for (let i = this.recordList.length - 1; i >= 0; i--) {
        const annotation = this.recordList[i]
        if (annotation.type === "rect" && this.isPointInRect(imgCoords, annotation.data[0] as Rect)) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      // 检查文本（可移动）
      for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
        const textData = this.textAnnotations[i]
        const canvasX = this.offset.x + textData.position.x * this.scale
        const canvasY = this.offset.y + textData.position.y * this.scale
        if (
          e.offsetX >= canvasX - this.textStyle.padding &&
          e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
          e.offsetY >= canvasY - this.textStyle.padding &&
          e.offsetY <= canvasY + textData.height + this.textStyle.padding
        ) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      this.canvas.style.cursor = "crosshair"
      return
    }

    // 拖拽模式：检测文本、矩形、多边形
    if (this.drawType === "drag") {
      // 检查控制点（选中状态下）
      if (this.selectedAnnotation) {
        const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          if (handle.type === "rect-corner") {
            this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
          } else {
            this.canvas.style.cursor = "crosshair"
          }
          return
        }
      }
      
      // 检查文本
      for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
        const textData = this.textAnnotations[i]
        const canvasX = this.offset.x + textData.position.x * this.scale
        const canvasY = this.offset.y + textData.position.y * this.scale
        if (
          e.offsetX >= canvasX - this.textStyle.padding &&
          e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
          e.offsetY >= canvasY - this.textStyle.padding &&
          e.offsetY <= canvasY + textData.height + this.textStyle.padding
        ) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      
      // 检查矩形和多边形
      if (this.bgImage) {
        const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
        const annotation = this.getAnnotationAtPoint(imgCoords)
        this.canvas.style.cursor = annotation ? "move" : "grab"
        return
      }
      
      this.canvas.style.cursor = "grab"
      return
    }

    // 无模式：检测所有类型
    if (this.drawType === "") {
      // 检查控制点
      if (this.selectedAnnotation) {
        const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
        if (handle) {
          if (handle.type === "rect-corner") {
            this.canvas.style.cursor = handle.index === 0 || handle.index === 3 ? "nwse-resize" : "nesw-resize"
          } else {
            this.canvas.style.cursor = "crosshair"
          }
          return
        }
      }
      // 检查文本
      for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
        const textData = this.textAnnotations[i]
        const canvasX = this.offset.x + textData.position.x * this.scale
        const canvasY = this.offset.y + textData.position.y * this.scale
        if (
          e.offsetX >= canvasX - this.textStyle.padding &&
          e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
          e.offsetY >= canvasY - this.textStyle.padding &&
          e.offsetY <= canvasY + textData.height + this.textStyle.padding
        ) {
          this.canvas.style.cursor = "move"
          return
        }
      }
      // 检查矩形/多边形
      if (this.bgImage) {
        const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
        const annotation = this.getAnnotationAtPoint(imgCoords)
        this.canvas.style.cursor = annotation ? "move" : "default"
        return
      }
    }

    this.canvas.style.cursor = "default"
  }

  private handleMouseUp(e: MouseEvent) {
    if (this.isDragging) {
      this.isDragging = false
      // 恢复拖拽模式的光标样式 - 考虑初始状态
      if (this.drawType === "drag") {
        this.canvas.style.cursor = "grab"
      } else {
        this.canvas.style.cursor = "default"
      }
      return
    }

    if (this.isTextMoving) {
      this.justFinishedMove = true
      this.isTextMoving = false
      // 在选择模式下，保留 editingTextIndex 以保持选中状态，方便双击编辑
      // 在拖拽模式下，清除 editingTextIndex
      if (this.drawType === "drag") {
        this.editingTextIndex = null
        this.canvas.style.cursor = "grab"
      } else if (this.drawType === "") {
        // 选择模式下保持光标为移动样式
        this.canvas.style.cursor = "move"
      } else {
        // 其他模式（矩形/多边形）下清除选中状态
        this.editingTextIndex = null
        this.canvas.style.cursor = "default"
      }
    }

    // 结束标注移动或调整大小
    if (this.isMovingAnnotation || this.isResizing) {
      this.justFinishedMove = true
      this.finishAnnotationMove()
      this.canvas.style.cursor = this.selectedAnnotation ? "move" : "default"
    }

    if (this.isDrawing && this.operate.type === "rect") {
      const rect = this.operate.data[0] as Rect

      // 过滤无效矩形（太小）
      if (Math.abs(rect.width) > 5 && Math.abs(rect.height) > 5) {
        this.recordList.push({ ...this.operate })
      }

      this.operate.data = []
      this.isDrawing = false
      this.render()
    }
  }

  private handleMouseLeave(e: MouseEvent) {
    if (this.isDragging || this.isTextMoving || this.isResizing || this.isMovingAnnotation) {
      this.handleMouseUp(e)
    }
    this.deselectAnnotation()
  }

  private handleClickEventListener() {
    let clickTimeout: number | null = null
    let clickCount = 0

    this.canvas.addEventListener("click", (e) => {
      // 跳过拖拽/移动/调整大小/文本移动结束后的点击
      if (this.isDragging || this.isMovingAnnotation || this.isResizing || this.isTextMoving) return
      
      // 检查是否需要跳过这次点击（因为刚刚完成移动/调整大小/文本移动）
      const shouldSkip = this.justFinishedMove
      if (shouldSkip) {
        this.justFinishedMove = false
      }

      clickCount++
      if (clickCount === 1) {
        clickTimeout = window.setTimeout(() => {
          if (clickCount === 1 && !shouldSkip) {
            this.handleMouseClick(e)
          }
          clickCount = 0
          clickTimeout = null
        }, 300)
      } else if (clickCount === 2) {
        // 双击时清除 justFinishedMove，确保双击操作正常
        this.justFinishedMove = false
        this.handleMouseDoubleClick(e)
        clickCount = 0
        if (clickTimeout !== null) {
          clearTimeout(clickTimeout)
          clickTimeout = null
        }
      }
    })
  }
  private checkPolygonPointValid(e: MouseEvent) {
    const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
    // 优化：避免添加重复点
    const lastPoint: Polygon = (
      this.operate.data.length > 0 ? this.operate.data[this.operate.data.length - 1] : null
    ) as Polygon
    return (
      !lastPoint ||
      Math.abs(lastPoint.point.x - imgCoords.x) > 5 ||
      Math.abs(lastPoint.point.y - imgCoords.y) > 5
    )
  }

  private handleMouseClick = (e: MouseEvent) => {
    if (!this.bgImage || this.drawType !== "polygon" || this.isDragging || this.isMovingAnnotation || this.isResizing || this.isTextMoving) return
    const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
    // 判断不是重复点
    if (this.checkPolygonPointValid(e)) {
      if (!this.isDrawing) {
        // 开始新的多边形
        this.isDrawing = true
        this.operate = {
          type: "polygon",
          data: [{ point: imgCoords }],
          status: "pending",
        }
      } else {
        // 添加新点
        this.operate.data.push({ point: imgCoords })
      }
    }

    // 设置临时点为当前鼠标位置
    this.tempPolygonPoint = imgCoords

    this.render()
  }

  private handleMouseDoubleClick(e: MouseEvent) {
    if (!this.bgImage) return
    
    // 清除 justFinishedMove 标志，允许双击操作
    this.justFinishedMove = false

    // 优先检查是否双击了文本（所有模式下都支持双击编辑文本）
    let textDoubleClicked = false
    for (let i = this.textAnnotations.length - 1; i >= 0; i--) {
      const textData = this.textAnnotations[i]
      const canvasX = this.offset.x + textData.position.x * this.scale
      const canvasY = this.offset.y + textData.position.y * this.scale

      if (
        e.offsetX >= canvasX - this.textStyle.padding &&
        e.offsetX <= canvasX + textData.width + this.textStyle.padding &&
        e.offsetY >= canvasY - this.textStyle.padding &&
        e.offsetY <= canvasY + textData.height + this.textStyle.padding
      ) {
        this.startTextEditing(i)
        textDoubleClicked = true
        break
      }
    }
    
    // 如果双击了文本，直接返回
    if (textDoubleClicked) return

    // 多边形模式下双击结束绘制
    if (this.drawType === "polygon") {
      if (this.isDrawing && this.operate.data.length <= 2) {
        return
      }
      // 结束多边形
      this.operate.status = "fullfilled"

      // 过滤无效多边形（点数太少）
      if (this.operate.data.length >= 3) {
        this.recordList.push({ ...this.operate })
      }

      // 重置状态
      this.operate = {
        type: "polygon",
        data: [],
        status: "pending",
      }
      this.isDrawing = false
      this.tempPolygonPoint = null

      this.render()
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    // 撤销操作
    if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      this.withdraw()
      return
    }

    // 空格键重置视图 - 恢复初始状态
    if (e.key === " ") {
      this.resetViewToInitial()
      return
    }

    // ESC键取消当前绘制或取消选中
    if (e.key === "Escape") {
      if (this.isDrawing) {
        if (this.drawType === "polygon" && this.operate.data.length > 0) {
          // 如果多边形至少有两个点，才保存
          if (this.operate.data.length >= 2) {
            this.operate.status = "fullfilled"
            this.recordList.push({ ...this.operate })
          }
        }
        this.operate.data = []
        this.isDrawing = false
        this.tempPolygonPoint = null
        this.render()
      } else if (this.selectedAnnotation) {
        // ESC 取消选中
        this.deselectAnnotation()
      }
      return
    }

    // Delete 键删除选中的标注
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.drawType === "") {
        // 优先删除选中的文本标注
        if (this.editingTextIndex !== null) {
          this.textAnnotations.splice(this.editingTextIndex, 1)
          this.editingTextIndex = null
          this.render()
          return
        }
        // 删除选中的矩形/多边形标注
        if (this.selectedAnnotation) {
          this.deleteSelectedAnnotation()
          return
        }
      }
    }
  }

  // 重置视图到初始状态
  private resetViewToInitial() {
    this.scale = this.initialScale
    this.offset = { ...this.initialOffset }
    this.calculateBoundaries()

    // 重置初始状态标志
    this.isInitialScale = true

    // 更新拖拽模式的光标
    if (this.drawType === "drag") {
      this.canvas.style.cursor = "default"
    }

    this.render()
  }
  private getZoomDelta(currentScale: number, zoomIn: boolean) {
    if (currentScale < 2) {
      return zoomIn ? 0.1 : -0.1 // 小比例时快速变化
    } else if (currentScale < 5) {
      return zoomIn ? 0.05 : -0.05 // 中等比例时中等速度
    } else {
      return zoomIn ? 0.02 : -0.02 // 大比例时精细调整
    }
  }

  /**
   * 改变缩放比例
   * @param zoomIn true: 放大, false: 缩小
   */
  public changeScale(zoomIn: boolean) {
    if (!this.bgImage) return

    // const delta = zoomIn ? 0.2 : -0.2
    const oldScale = this.scale

    // 计算新的缩放比例 - 使用动态最小缩放
    // const newScale = Math.max(this.minScale, Math.min(oldScale + delta, this.maxScale))
    const newScale = this.getZoomDelta(oldScale, zoomIn)

    // 计算缩放中心（画布中心）
    const centerX = this.viewport.width / 2
    const centerY = this.viewport.height / 2

    // 计算缩放前中心点在图像中的位置
    const centerImgX = (centerX - this.offset.x) / oldScale
    const centerImgY = (centerY - this.offset.y) / oldScale

    // 更新缩放比例
    this.scale = newScale

    // 计算缩放后中心点应该的位置
    const newCenterX = centerImgX * newScale + this.offset.x
    const newCenterY = centerImgY * newScale + this.offset.y

    // 调整偏移量以保持中心点不变
    this.offset.x += centerX - newCenterX
    this.offset.y += centerY - newCenterY

    // 更新边界约束
    this.calculateBoundaries()
    this.constrainViewport()

    // 缩放后如果缩放倍数不是1，则不是初始状态
    this.isInitialScale = this.scale === this.initialScale
    this.render()
  }

  /**
   * 清除整个画布，包括背景图片和所有绘制的矩形、多边形
   */
  public clearCanvas() {
    // 清除背景图片
    this.bgImage = null
    this.originalSize = { width: 0, height: 0 }

    // 清除所有标注记录
    this.recordList = []

    // 新增：清除文本标注
    this.textAnnotations = []

    // 清除当前操作
    this.operate = {
      type: this.drawType,
      data: [],
      status: "pending",
    }
    this.isDrawing = false
    this.tempPolygonPoint = null

    // 重置视图状态
    this.scale = 1
    this.minScale = 1
    this.offset = { x: 0, y: 0 }
    this.initialScale = 1
    this.initialOffset = { x: 0, y: 0 }
    this.isInitialScale = true

    // 清除边界约束
    this.minOffsetX = 0
    this.minOffsetY = 0
    this.maxOffsetX = 0
    this.maxOffsetY = 0

    // 清除画布内容
    this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height)

    // 更新拖拽模式的光标
    if (this.drawType === "drag") {
      this.canvas.style.cursor = "default"
    }
    this.editingTextIndex = null
    this.isTextMoving = false
  }

  /**
   * 获取当前所有标注数据（原始坐标）
   */
  public getAnnotations(): Operate<Rect | Polygon | TextAnnotation>[] {
    return [...this.recordList]
  }

  // 新增：获取文本标注
  public getTextAnnotations(): TextAnnotation[] {
    return [...this.textAnnotations]
  }

  public exportAnnotationImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.bgImage) {
        reject(new Error("No background image loaded"))
        return
      }

      // 创建离屏Canvas
      const offscreenCanvas = document.createElement("canvas")
      offscreenCanvas.width = this.originalSize.width
      offscreenCanvas.height = this.originalSize.height
      const offscreenCtx = offscreenCanvas.getContext("2d")
      if (!offscreenCtx) {
        reject(new Error("Could not create offscreen canvas context"))
        return
      }
      const image = new Image()
      image.src = this.bgImageSrc
      image.crossOrigin = "anonymous"
      image.onload = () => {
        // 绘制原始背景图片 解决跨域问题
        offscreenCtx.drawImage(image, 0, 0, this.originalSize.width, this.originalSize.height)
        // 绘制所有标注（使用原始坐标）
        offscreenCtx.strokeStyle = this.strokeStyle
        offscreenCtx.lineWidth = this.lineWidth
        this.recordList.forEach((item) => {
          if (item.type === "rect") {
            const rect = item.data[0] as Rect
            offscreenCtx.strokeRect(rect.start.x, rect.start.y, rect.width, rect.height)
          } else if (item.type === "polygon" && item.status === "fullfilled") {
            offscreenCtx.beginPath()
            ;(item.data as Polygon[]).forEach((point, index) => {
              if (index === 0) {
                offscreenCtx.moveTo(point.point.x, point.point.y)
              } else {
                offscreenCtx.lineTo(point.point.x, point.point.y)
              }
            })
            // 闭合多边形
            const first = item.data[0] as Polygon
            offscreenCtx.lineTo(first.point.x, first.point.y)
            offscreenCtx.stroke()

            // 绘制多边形点标记
            ;(item.data as Polygon[]).forEach((point) => {
              offscreenCtx.beginPath()
              offscreenCtx.arc(point.point.x, point.point.y, 4, 0, Math.PI * 2)
              offscreenCtx.fillStyle = this.strokeStyle
              offscreenCtx.fill()
            })
          }
        })

        // 新增：绘制文本标注
        offscreenCtx.font = this.textStyle.font
        this.textAnnotations.forEach((textData) => {
          // 绘制圆角背景
          offscreenCtx.fillStyle = this.textStyle.backgroundColor
          const bgX = textData.position.x - this.textStyle.padding
          const bgY = textData.position.y - this.textStyle.padding
          const bgWidth = textData.width + this.textStyle.padding * 2
          const bgHeight = textData.height + this.textStyle.padding * 2
          const r = this.textStyle.borderRadius

          // 使用 roundRect 绘制圆角矩形（如果支持）
          if ((offscreenCtx as any).roundRect) {
            ;(offscreenCtx as any).roundRect(bgX, bgY, bgWidth, bgHeight, r)
            offscreenCtx.fill()
          } else {
            // 降级方案：普通矩形
            offscreenCtx.fillRect(bgX, bgY, bgWidth, bgHeight)
          }

          // 绘制文本
          offscreenCtx.fillStyle = this.textStyle.color
          offscreenCtx.fillText(
            textData.text,
            textData.position.x,
            textData.position.y + textData.height - 5,
          )
        })

        // 转换为base64字符串
        try {
          const base64 = offscreenCanvas.toDataURL(`image/${this.bgImageExt}`, 0.7)
          resolve(base64)
        } catch (e) {
          // 如果遇到跨域问题，使用当前视图作为备选方案
          this.exportCurrentViewImage()
            .then(resolve)
            .catch((err) => reject(new Error(`Both methods failed: ${err.message}`)))
        }
      }
    })
  }

  /**
   * @description 导出当前视图为base64图片
   * @returns 包含当前视图图片数据的base64字符串
   */
  public exportCurrentViewImage(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const base64 = this.canvas.toDataURL(`image/${this.bgImageExt}`)
        resolve(base64)
      } catch (e: any) {
        reject(new Error(`Failed to export current view: ${e.message}`))
      }
    })
  }

  public base64ToFile(base64Data: string, filename: string): File {
    // 将base64的数据部分提取出来
    const parts = base64Data.split(";base64,")
    const contentType = parts[0].split(":")[1]
    const raw = window.atob(parts[1])
    // 将原始数据转换为Uint8Array
    const rawLength = raw.length
    const uInt8Array = new Uint8Array(rawLength)
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i)
    }

    // 使用Blob创建一个新的文件
    const blob = new Blob([uInt8Array], { type: contentType })
    // 创建File对象
    const file = new File([blob], filename, { type: contentType })
    return file
  }

  /**
   * 将base64字符串转换为Blob对象（用于上传）
   * @param base64 图片的base64字符串
   * @returns Blob对象
   */
  public static base64ToBlob(base64: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // 提取MIME类型和base64数据
      const parts = base64.split(";base64,")
      if (parts.length < 2) {
        reject(new Error("Invalid base64 string"))
        return
      }

      const mime = parts[0].split(":")[1]
      const byteString = atob(parts[1])
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const uint8Array = new Uint8Array(arrayBuffer)

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }

      resolve(new Blob([arrayBuffer], { type: mime }))
    })
  }

  /**
   * 添加文本标注
   * @param x 图像坐标X
   * @param y 图像坐标Y
   * @param text 初始文本（可选，默认为空字符串）
   */
  public addTextAnnotation(x: number, y: number, text: string = "") {
    // 测量文本尺寸（如果文本为空，使用占位符计算最小宽度）
    this.ctx.font = this.textStyle.font
    const measureText = text || "输入文字..."
    const metrics = this.ctx.measureText(measureText)
    const textAnnotation: TextAnnotation = {
      position: { x, y },
      text,
      width: Math.max(metrics.width, 60), // 最小宽度 60px
      height: parseInt(this.textStyle.font) * 1.2,
    }
    this.textAnnotations.push(textAnnotation)
    // 直接进入编辑模式
    this.startTextEditing(this.textAnnotations.length - 1)
    this.render()
  }

  /**
   * 更新文本标注内容
   * @param index 文本标注索引
   * @param text 新文本内容
   */
  public updateTextAnnotation(index: number, text: string) {
    if (index < 0 || index >= this.textAnnotations.length) return

    const textAnnotation = this.textAnnotations[index]
    textAnnotation.text = text

    // 更新文本尺寸
    this.ctx.font = this.textStyle.font
    const metrics = this.ctx.measureText(text)
    textAnnotation.width = metrics.width
    textAnnotation.height = parseInt(this.textStyle.font) * 1.2

    this.render()
  }

  /**
   * 移动文本标注位置
   * @param index 文本标注索引
   * @param x 新位置X（图像坐标）
   * @param y 新位置Y（图像坐标）
   */
  public moveTextAnnotation(index: number, x: number, y: number) {
    if (index < 0 || index >= this.textAnnotations.length) return

    this.textAnnotations[index].position = { x, y }
    this.render()
  }

  /**
   * 删除文本标注
   * @param index 文本标注索引
   */
  public removeTextAnnotation(index: number) {
    if (index < 0 || index >= this.textAnnotations.length) return

    this.textAnnotations.splice(index, 1)
    this.render()
  }

  /**
   * 清除所有文本标注
   */
  public clearTextAnnotations() {
    this.textAnnotations = []
    this.render()
  }

  // 文本编辑相关私有方法
  private startTextEditing(index: number) {
    if (!this.textInput || index < 0 || index >= this.textAnnotations.length) {
      return
    }

    const textData = this.textAnnotations[index]
    this.editingTextIndex = index
    this.currentEditingIndex = index  // 保存确定的编辑索引
    this.textBeforeEditing = textData.text // 保存原文本，用于取消编辑

    // 计算画布位置
    const canvasX = this.offset.x + textData.position.x * this.scale
    const canvasY = this.offset.y + textData.position.y * this.scale

    // 定位输入框
    this.textInput.value = textData.text
    this.textInput.style.left = `${canvasX - this.textStyle.padding}px`
    this.textInput.style.top = `${canvasY - this.textStyle.padding}px`
    this.textInput.style.display = "block"

    // 调整输入框宽度
    this.adjustTextInputWidth()

    // 延迟聚焦，避免 blur 事件立即触发导致输入框被隐藏
    setTimeout(() => {
      if (this.textInput) {
        this.textInput.focus()
        this.textInput.select()
      }
    }, 10)

    this.render()
  }

  // 调整输入框宽度以适应内容
  private adjustTextInputWidth() {
    if (!this.textInput || this.editingTextIndex === null) return

    // 使用 canvas 测量文本宽度（不乘以 scale，因为输入框是固定 CSS 像素）
    this.ctx.font = this.textStyle.font
    const text = this.textInput.value || this.textInput.placeholder || ""
    const metrics = this.ctx.measureText(text)
    const textWidth = metrics.width

    // 设置最小宽度和最大宽度，并根据内容调整
    const minWidth = 60
    const maxWidth = 200
    const newWidth = Math.min(Math.max(textWidth + 24, minWidth), maxWidth) // 24px padding
    this.textInput.style.width = `${newWidth}px`
  }

  private finishTextEditing() {
    if (!this.textInput) return

    // 使用 currentEditingIndex 确保即使 editingTextIndex 被重置也能正确保存
    const index = this.currentEditingIndex
    const newText = this.textInput.value.trim()
    
    if (index === null || index < 0 || index >= this.textAnnotations.length) {
      // 清理状态
      this.textInput.style.display = "none"
      this.editingTextIndex = null
      this.currentEditingIndex = null
      this.textBeforeEditing = ""
      return
    }

    if (index >= 0 && index < this.textAnnotations.length) {
      if (newText === "") {
        // 如果文本为空，删除该标注
        this.textAnnotations.splice(index, 1)
      } else {
        const textData = this.textAnnotations[index]
        textData.text = newText

        // 更新文本尺寸
        this.ctx.font = this.textStyle.font
        const metrics = this.ctx.measureText(textData.text)
        textData.width = metrics.width
        textData.height = parseInt(this.textStyle.font) * 1.2
      }
    }

    this.textInput.style.display = "none"
    this.editingTextIndex = null
    this.currentEditingIndex = null
    this.textBeforeEditing = ""
    this.render()
  }

  // 取消编辑，恢复原文本
  private cancelTextEditing() {
    if (!this.textInput || this.editingTextIndex === null) return

    // 恢复原文本
    this.textInput.value = this.textBeforeEditing

    // 如果原文本为空且这是新创建的标注，删除它
    const index = this.editingTextIndex
    if (index >= 0 && index < this.textAnnotations.length) {
      const textData = this.textAnnotations[index]
      if (textData.text === "" && this.textBeforeEditing === "") {
        this.textAnnotations.splice(index, 1)
      }
    }

    this.textInput.style.display = "none"
    this.editingTextIndex = null
    this.currentEditingIndex = null
    this.textBeforeEditing = ""
    this.render()
  }

  // 删除正在编辑的文本标注
  private deleteEditingTextAnnotation() {
    if (this.editingTextIndex === null) return

    const index = this.editingTextIndex

    // 隐藏输入框
    if (this.textInput) {
      this.textInput.style.display = "none"
    }

    // 删除标注
    if (index >= 0 && index < this.textAnnotations.length) {
      this.textAnnotations.splice(index, 1)
    }

    this.editingTextIndex = null
    this.currentEditingIndex = null
    this.textBeforeEditing = ""
    this.render()
  }

  // ==================== 标注选中移动功能 ====================

  /**
   * 检测点是否在矩形内
   */
  private isPointInRect(point: Point, rect: Rect): boolean {
    // 处理负宽高的情况（从右下往左上画）
    const x = rect.width >= 0 ? rect.start.x : rect.start.x + rect.width
    const y = rect.height >= 0 ? rect.start.y : rect.start.y + rect.height
    const w = Math.abs(rect.width)
    const h = Math.abs(rect.height)

    return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h
  }

  /**
   * 检测点是否在多边形内（射线法）
   */
  private isPointInPolygon(point: Point, polygon: Polygon[]): boolean {
    if (polygon.length < 3) return false

    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].point.x
      const yi = polygon[i].point.y
      const xj = polygon[j].point.x
      const yj = polygon[j].point.y

      const intersect =
        yi > point.y !== yj > point.y &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

      if (intersect) inside = !inside
    }

    return inside
  }

  /**
   * 获取点击位置对应的标注索引
   */
  private getAnnotationAtPoint(imgCoords: Point): { index: number; type: "rect" | "polygon" } | null {
    // 从后往前遍历，优先选中上层标注
    for (let i = this.recordList.length - 1; i >= 0; i--) {
      const annotation = this.recordList[i]

      if (annotation.type === "rect") {
        const rect = annotation.data[0] as Rect
        if (this.isPointInRect(imgCoords, rect)) {
          return { index: i, type: "rect" }
        }
      } else if (annotation.type === "polygon") {
        const polygon = annotation.data as Polygon[]
        if (this.isPointInPolygon(imgCoords, polygon)) {
          return { index: i, type: "polygon" }
        }
      }
    }

    return null
  }

  /**
   * 选中指定索引的标注
   */
  public selectAnnotation(index: number): void {
    if (index < 0 || index >= this.recordList.length) {
      this.deselectAnnotation()
      return
    }

    const annotation = this.recordList[index]
    this.selectedAnnotation = {
      index,
      type: annotation.type as "rect" | "polygon",
    }
    this.render()
  }

  /**
   * 取消选中
   */
  public deselectAnnotation(): void {
    this.selectedAnnotation = null
    this.isMovingAnnotation = false
    this.editingTextIndex = null // 同时清除文本选中状态
    this.render()
  }

  /**
   * 获取当前选中的标注
   */
  public getSelectedAnnotation(): { index: number; type: "rect" | "polygon"; data: Operate<Rect | Polygon> } | null {
    if (!this.selectedAnnotation) return null

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return null

    return {
      index: this.selectedAnnotation.index,
      type: this.selectedAnnotation.type,
      data: annotation as Operate<Rect | Polygon>,
    }
  }

  /**
   * 删除选中的标注
   */
  public deleteSelectedAnnotation(): void {
    if (!this.selectedAnnotation) return

    const index = this.selectedAnnotation.index
    this.recordList.splice(index, 1)
    this.deselectAnnotation()
  }

  /**
   * 移动选中的标注
   */
  public moveSelectedAnnotation(dx: number, dy: number): void {
    if (!this.selectedAnnotation) return

    const annotation = this.recordList[this.selectedAnnotation.index]
    if (!annotation) return

    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      rect.start.x += dx
      rect.start.y += dy
    } else if (annotation.type === "polygon") {
      const polygon = annotation.data as Polygon[]
      polygon.forEach((p) => {
        p.point.x += dx
        p.point.y += dy
      })
    }

    this.render()
  }

  // 处理标注选中和移动的开始
  private handleAnnotationSelection(e: MouseEvent, imgCoords: Point): boolean {
    // 如果正在绘制，不处理选中
    if (this.isDrawing) return false

    // 如果有选中的标注，先检查是否点击了控制点
    if (this.selectedAnnotation) {
      const handle = this.getHandleAtPoint(e.offsetX, e.offsetY)
      if (handle) {
        this.activeHandle = handle
        this.isResizing = true
        this.resizeStartPoint = imgCoords
        
        // 保存原始数据用于计算
        const annotation = this.recordList[this.selectedAnnotation.index]
        if (annotation.type === "rect") {
          this.originalRect = { ...(annotation.data[0] as Rect) }
        } else if (annotation.type === "polygon") {
          this.originalPolygon = (annotation.data as Polygon[]).map(p => ({ point: { ...p.point } }))
        }
        
        this.render()
        return true
      }
    }

    // 检测是否点击到标注
    const clickedAnnotation = this.getAnnotationAtPoint(imgCoords)

    if (clickedAnnotation) {
      // 选中该标注
      this.selectedAnnotation = clickedAnnotation
      this.isMovingAnnotation = true
      this.annotationMoveStart = { x: e.clientX, y: e.clientY }
      this.annotationMoveOffset = { x: 0, y: 0 }

      // 记录移动前的位置用于计算偏移
      const annotation = this.recordList[clickedAnnotation.index]
      if (annotation.type === "rect") {
        const rect = annotation.data[0] as Rect
        this.annotationMoveOffset = { x: rect.start.x, y: rect.start.y }
      } else if (annotation.type === "polygon") {
        const polygon = annotation.data as Polygon[]
        this.annotationMoveOffset = { x: polygon[0].point.x, y: polygon[0].point.y }
      }

      this.render()
      return true
    } else {
      // 点击空白处，取消选中
      this.deselectAnnotation()
      return false
    }
  }

  // 获取点击位置的控制点
  private getHandleAtPoint(offsetX: number, offsetY: number): { type: "rect-corner" | "polygon-vertex"; index: number } | null {
    if (!this.selectedAnnotation) return null

    const annotation = this.recordList[this.selectedAnnotation.index]
    const handleSize = this.selectionStyle.handleSize
    const halfHandle = handleSize / 2

    if (annotation.type === "rect") {
      const rect = annotation.data[0] as Rect
      const x = this.offset.x + rect.start.x * this.scale
      const y = this.offset.y + rect.start.y * this.scale
      const w = rect.width * this.scale
      const h = rect.height * this.scale

      // 四个角的控制点
      const corners = [
        { x: x, y: y, index: 0 }, // 左上
        { x: x + w, y: y, index: 1 }, // 右上
        { x: x, y: y + h, index: 2 }, // 左下
        { x: x + w, y: y + h, index: 3 }, // 右下
      ]

      for (const corner of corners) {
        if (
          offsetX >= corner.x - halfHandle &&
          offsetX <= corner.x + halfHandle &&
          offsetY >= corner.y - halfHandle &&
          offsetY <= corner.y + halfHandle
        ) {
          return { type: "rect-corner", index: corner.index }
        }
      }
    } else if (annotation.type === "polygon") {
      const polygon = annotation.data as Polygon[]

      for (let i = 0; i < polygon.length; i++) {
        const p = polygon[i]
        const x = this.offset.x + p.point.x * this.scale
        const y = this.offset.y + p.point.y * this.scale

        if (
          offsetX >= x - halfHandle &&
          offsetX <= x + halfHandle &&
          offsetY >= y - halfHandle &&
          offsetY <= y + halfHandle
        ) {
          return { type: "polygon-vertex", index: i }
        }
      }
    }

    return null
  }

  // 处理标注移动或调整大小
  private handleAnnotationMove(e: MouseEvent): void {
    // 处理调整大小
    if (this.isResizing && this.selectedAnnotation && this.activeHandle) {
      const imgCoords = this.toImageCoordinates(e.offsetX, e.offsetY)
      
      if (this.selectedAnnotation.type === "rect" && this.originalRect) {
        this.resizeRect(imgCoords)
      } else if (this.selectedAnnotation.type === "polygon" && this.originalPolygon) {
        this.resizePolygon(imgCoords)
      }
      
      this.render()
      return
    }

    // 处理移动
    if (!this.isMovingAnnotation || !this.selectedAnnotation) return

    const dx = (e.clientX - this.annotationMoveStart.x) / this.scale
    const dy = (e.clientY - this.annotationMoveStart.y) / this.scale

    this.moveSelectedAnnotation(dx, dy)

    // 更新起始位置，实现连续移动
    this.annotationMoveStart = { x: e.clientX, y: e.clientY }
  }

  // 调整矩形大小 - 拖拽点和对角点确定新矩形，支持越过交换
  private resizeRect(imgCoords: Point): void {
    if (!this.selectedAnnotation || this.selectedAnnotation.type !== "rect" || !this.originalRect) return

    const annotation = this.recordList[this.selectedAnnotation.index]
    const rect = annotation.data[0] as Rect
    const original = this.originalRect

    // 原始矩形的四个角坐标
    const origLeft = original.start.x
    const origRight = original.start.x + original.width
    const origTop = original.start.y
    const origBottom = original.start.y + original.height

    // 根据当前控制点索引确定固定点
    let fixedX: number, fixedY: number
    switch (this.activeHandle!.index) {
      case 0: fixedX = origRight; fixedY = origBottom; break  // 左上 -> 固定右下
      case 1: fixedX = origLeft; fixedY = origBottom; break   // 右上 -> 固定左下
      case 2: fixedX = origRight; fixedY = origTop; break     // 左下 -> 固定右上
      case 3: fixedX = origLeft; fixedY = origTop; break      // 右下 -> 固定左上
      default: return
    }

    // 新矩形的边界由拖拽点和对角点决定
    const newLeft = Math.min(imgCoords.x, fixedX)
    const newRight = Math.max(imgCoords.x, fixedX)
    const newTop = Math.min(imgCoords.y, fixedY)
    const newBottom = Math.max(imgCoords.y, fixedY)

    rect.start.x = newLeft
    rect.start.y = newTop
    rect.width = newRight - newLeft
    rect.height = newBottom - newTop

    // 根据新的矩形边界，更新控制点索引（实现越过交换）
    // 新的控制点索引由拖拽点在新矩形中的位置决定
    const isLeft = imgCoords.x < fixedX
    const isTop = imgCoords.y < fixedY

    if (this.activeHandle!.index === 0) { // 原来是左上
      if (!isLeft && !isTop) this.activeHandle!.index = 3      // 变成右下
      else if (!isLeft && isTop) this.activeHandle!.index = 1  // 变成右上
      else if (isLeft && !isTop) this.activeHandle!.index = 2  // 变成左下
    } else if (this.activeHandle!.index === 1) { // 原来是右上
      if (isLeft && !isTop) this.activeHandle!.index = 2       // 变成左下
      else if (isLeft && isTop) this.activeHandle!.index = 0   // 变成左上
      else if (!isLeft && !isTop) this.activeHandle!.index = 3 // 变成右下
    } else if (this.activeHandle!.index === 2) { // 原来是左下
      if (!isLeft && isTop) this.activeHandle!.index = 1       // 变成右上
      else if (isLeft && isTop) this.activeHandle!.index = 0   // 变成左上
      else if (!isLeft && !isTop) this.activeHandle!.index = 3 // 变成右下
    } else if (this.activeHandle!.index === 3) { // 原来是右下
      if (isLeft && isTop) this.activeHandle!.index = 0        // 变成左上
      else if (!isLeft && isTop) this.activeHandle!.index = 1  // 变成右上
      else if (isLeft && !isTop) this.activeHandle!.index = 2  // 变成左下
    }

    // 更新 originalRect 为当前矩形，为下次拖拽做准备
    this.originalRect = { ...rect }
  }

  // 调整多边形顶点位置
  private resizePolygon(imgCoords: Point): void {
    if (!this.selectedAnnotation || this.selectedAnnotation.type !== "polygon" || !this.originalPolygon) return

    const annotation = this.recordList[this.selectedAnnotation.index]
    const polygon = annotation.data as Polygon[]
    const vertexIndex = this.activeHandle!.index

    if (vertexIndex >= 0 && vertexIndex < polygon.length) {
      polygon[vertexIndex].point.x = imgCoords.x
      polygon[vertexIndex].point.y = imgCoords.y
    }
  }

  // 结束标注移动或调整
  private finishAnnotationMove(): void {
    this.isMovingAnnotation = false
    this.isResizing = false
    this.activeHandle = null
    this.originalRect = null
    this.originalPolygon = null
  }
}
