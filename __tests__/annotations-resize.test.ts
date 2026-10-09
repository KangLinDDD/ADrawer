import { AnnotationManager } from '../src/modules/annotations'
import { ViewportManager } from '../src/modules/viewport'

describe('annotations.ts resize 方法', () => {
  let container: HTMLDivElement
  let manager: AnnotationManager

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    manager = new AnnotationManager(new ViewportManager(), container, () => {}, () => {})
  })

  afterEach(() => {
    if (container.parentNode) container.parentNode.removeChild(container)
  })

  const pushRect = () => {
    manager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled'
    })
  }

  const pushPolygon = (vertexCount = 3) => {
    const data = Array.from({ length: vertexCount }, (_, i) => ({
      point: { x: 100 + i * 50, y: 100 + (i % 2) * 50 }
    }))
    manager.recordList.push({ type: 'polygon', data, status: 'fullfilled' })
  }

  it('startResizing 无选中时返回 false', () => {
    expect(manager.startResizing({ type: 'rect-corner', index: 0 }, { x: 0, y: 0 })).toBe(false)
  })

  it('startResizing 选中矩形后记录 originalRect 快照', () => {
    pushRect()
    manager.selectAnnotation(0)
    expect(manager.startResizing({ type: 'rect-corner', index: 3 }, { x: 0, y: 0 })).toBe(true)
    expect(manager.isResizing).toBe(true)
    expect(manager.activeHandle).toEqual({ type: 'rect-corner', index: 3 })
    expect(manager.originalRect).toEqual({ start: { x: 100, y: 100 }, width: 100, height: 100 })
  })

  it('resizeRect 越界 handle index 返回 false', () => {
    pushRect()
    manager.selectAnnotation(0)
    manager.startResizing({ type: 'rect-corner', index: 3 }, { x: 0, y: 0 })
    manager.activeHandle!.index = 99
    expect(manager.resizeRect({ x: 250, y: 250 })).toBe(false)
  })

  it('resizeRect 右下角拖拽正确更新宽高', () => {
    pushRect()
    manager.selectAnnotation(0)
    manager.startResizing({ type: 'rect-corner', index: 3 }, { x: 0, y: 0 })
    manager.resizeRect({ x: 250, y: 250 })
    const rect = manager.recordList[0].data[0] as { width: number; height: number }
    expect(rect.width).toBe(150)
    expect(rect.height).toBe(150)
  })

  it('resizeRect 越过对角点时交换 handle index（写回 activeHandle.index）', () => {
    pushRect()
    manager.selectAnnotation(0)
    // 拖左上角 index 0 到右下 (250,250)，越过固定对角 (200,200)
    manager.startResizing({ type: 'rect-corner', index: 0 }, { x: 0, y: 0 })
    manager.resizeRect({ x: 250, y: 250 })
    expect(manager.activeHandle!.index).toBe(3)
  })

  it('resizePolygon 直接改写指定顶点', () => {
    pushPolygon(3)
    manager.selectAnnotation(0)
    manager.startResizing({ type: 'polygon-vertex', index: 2 }, { x: 0, y: 0 })
    expect(manager.resizePolygon({ x: 180, y: 220 })).toBe(true)
    expect((manager.recordList[0].data[2] as { point: { x: number; y: number } }).point).toEqual({ x: 180, y: 220 })
  })

  it('resizePolygon 顶点索引越界返回 false', () => {
    pushPolygon(3)
    manager.selectAnnotation(0)
    manager.startResizing({ type: 'polygon-vertex', index: 99 }, { x: 0, y: 0 })
    expect(manager.resizePolygon({ x: 0, y: 0 })).toBe(false)
  })

  it('getHandleAtPoint 锁定选中返回 null', () => {
    pushRect()
    manager.selectAnnotation(0, { lock: true })
    expect(manager.getHandleAtPoint(100, 100)).toBeNull()
  })

  it('getHandleAtPoint 未命中任何控制点返回 null', () => {
    pushRect()
    manager.selectAnnotation(0)
    expect(manager.getHandleAtPoint(300, 300)).toBeNull()
  })

  it('getHandleAtPoint 命中左上控制点返回 rect-corner index 0', () => {
    pushRect()
    manager.selectAnnotation(0)
    expect(manager.getHandleAtPoint(100, 100)).toEqual({ type: 'rect-corner', index: 0 })
  })
})
