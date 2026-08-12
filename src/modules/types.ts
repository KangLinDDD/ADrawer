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
  /** 稳定唯一 ID（入库时生成） */
  id?: string
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

/** 标题样式 */
export type TitleStyle = {
  /** 字体样式，如 "bold 12px Arial" */
  font?: string
  /** 文字颜色 */
  color?: string
  /** 背景颜色 */
  backgroundColor?: string
  /** 水平内边距 */
  paddingX?: number
  /** 垂直内边距 */
  paddingY?: number
  /** 圆角半径 */
  borderRadius?: number
  /** 标题输入框的占位提示文本（随标题样式快照存入标注） */
  placeholder?: string
}

/** 标题位置 */
export type TitlePosition = {
  /** 垂直位置：top=标注上方, bottom=标注下方, inside-top=标注内部上方 */
  vertical?: 'top' | 'bottom' | 'inside-top'
  /** 水平对齐：left/center/right */
  align?: 'left' | 'center' | 'right'
  /** 水平偏移（像素，图像坐标） */
  offsetX?: number
  /** 垂直偏移（像素，图像坐标） */
  offsetY?: number
}

/** 标注样式 */
export type AnnotationStyle = {
  strokeColor: string
  lineWidth: number
  lineStyle?: LineStyle
  vertexStyle?: VertexStyle
  /** 标注标题样式（覆盖全局默认） */
  titleStyle?: TitleStyle
  /** 标注标题位置（覆盖全局默认） */
  titlePosition?: TitlePosition
}

/** 操作记录 */
export type Operate<T extends Shape> = {
  /** 稳定唯一 ID（入库时生成；绘制中的临时对象无 id） */
  id?: string
  type: "rect" | "polygon" | "drag" | "text" | ""
  data: T[]
  status: "fullfilled" | "pending"
  style?: AnnotationStyle
  /** 标注标题 */
  title?: string
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
  /** 是否启用标注标题功能（默认 false，需显式开启） */
  enableTitle?: boolean
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

/** 标注变更事件载荷（create/delete/update 共用） */
export type ShapeChangePayload =
  | { id: string; type: 'rect' | 'polygon'; index: number; data: Operate<Rect | Polygon> }
  | { id: string; type: 'text'; index: number; data: TextAnnotation }

/** Drawer 事件表 */
export type DrawerEventMap = {
  /** 新标注画完入库 */
  create: ShapeChangePayload
  /** 标注被删除 */
  delete: ShapeChangePayload
  /** 标注数据变化（移动/缩放结束、标题/文本/样式修改） */
  update: ShapeChangePayload
  /** 清空所有标注 */
  clear: undefined
  /** 撤销成功 */
  undo: undefined
}

export type DrawerEventName = keyof DrawerEventMap
export type DrawerListener<K extends DrawerEventName> = (payload: DrawerEventMap[K]) => void

/** 标注变更通知回调（manager 内部上报给 Drawer 使用） */
export type ChangeNotify = (event: 'create' | 'delete' | 'update', payload: ShapeChangePayload) => void
