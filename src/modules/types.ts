/**
 * 类型定义模块
 * 包含所有标注库的类型定义
 */

/** 点坐标 */
export type Point = {
  x: number
  y: number
}

/** 矩形标注 */
export type Rect = {
  start: Point
  width: number
  height: number
}

/** 多边形顶点 */
export type Polygon = {
  point: Point
}

/** 文本标注 */
export type TextAnnotation = {
  position: { x: number; y: number }
  text: string
  width: number
  height: number
  /** 文本标注的独立样式 */
  style?: Pick<TextStyle, 'font' | 'color' | 'backgroundColor'>
}

/** 标注类型联合 */
export type Shape = Rect | Polygon | TextAnnotation

/** 边线样式 */
export type LineStyle = 'solid' | 'dashed' | 'dotted'

/** 顶点样式 */
export type VertexStyle = {
  size: number
  fillColor: string
  strokeColor: string
  strokeWidth: number
  shape: 'circle' | 'square' | 'diamond'
}

/** 标注样式 */
export type AnnotationStyle = {
  strokeColor: string
  lineWidth: number
  lineStyle?: LineStyle
  vertexStyle?: VertexStyle
}

/** 操作记录 */
export type Operate<T extends Shape> = {
  type: "rect" | "polygon" | "drag" | "text" | ""
  data: T[]
  status: "fullfilled" | "pending"
  style?: AnnotationStyle
}

/** 绘制类型 */
export type DrawType = "rect" | "polygon" | "drag" | "text" | ""

/** 抽屉选项 */
export type DrawerOptions = {
  id: string
  drawType?: DrawType
  useEvents?: boolean
  /** 标注颜色配置 */
  annotationColor?: string | ColorConfig
  /** 边线样式 */
  lineStyle?: LineStyle
  /** 顶点样式 */
  vertexStyle?: Partial<VertexStyle>
  /** 文本样式 */
  textStyle?: Partial<TextStyle>
}

/** 选中标注信息 */
export type SelectedAnnotation = {
  index: number
  type: "rect" | "polygon" | "text"
}

/** 控制点信息 */
export type ActiveHandle = {
  type: "rect-corner" | "polygon-vertex"
  index: number
}

/** 事件处理器类型 */
export type WheelEventListener = (event: WheelEvent) => void
export type MouseEventListener = (event: MouseEvent) => void
export type KeyboardEventListener = (event: KeyboardEvent) => void

/** 抽屉事件处理器集合 */
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

/** 文本输入框样式 */
export type TextInputStyle = {
  border: string
  borderRadius: string
  padding: string
  fontSize: string
  fontFamily: string
  backgroundColor: string
  color: string
  boxShadow: string
  minWidth: string
  maxWidth: string
}

/** 文本样式配置 */
export type TextStyle = {
  font: string
  color: string
  padding: number
  backgroundColor: string
  borderRadius: number
  selectedBorderColor: string
  selectedBackgroundColor: string
  /** 文本输入框样式 */
  inputStyle?: Partial<TextInputStyle>
}

/** 选中样式配置 */
export type SelectionStyle = {
  strokeColor: string
  fillColor: string
  handleSize: number
  handleColor: string
}



/** 颜色配置 */
export type ColorConfig = {
  rect?: string
  polygon?: string
  text?: string
  default?: string
}

/** 视口尺寸 */
export type ViewportSize = {
  width: number
  height: number
}

/** 视图偏移 */
export type ViewportOffset = {
  x: number
  y: number
}
