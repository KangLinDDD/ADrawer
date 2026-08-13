import { AnnotationManager } from '../src/modules/annotations'
import { TextAnnotationManager } from '../src/modules/shapes/text-manager'
import { ViewportManager } from '../src/modules/viewport'
import Drawer from '../src/index'
import type { Rect, Polygon } from '../src/modules/types'

/**
 * 图片边界约束（clamp）测试
 * 坐标系为原图像素坐标，原点是图片左上角
 * 图片尺寸：800 x 600
 */
describe('AnnotationManager 图片边界约束 (clamp)', () => {
  const IMG_W = 800
  const IMG_H = 600

  const createManager = (withImage = true) => {
    const viewport = new ViewportManager()
    if (withImage) {
      viewport.setOriginalSize(IMG_W, IMG_H)
    }
    const manager = new AnnotationManager(viewport, void 0, void 0, void 0)
    return { manager, viewport }
  }

  describe('矩形绘制 clamp', () => {
    it('起点在图外（负坐标）时 clamp 到 (0, 0)', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: -50, y: -20 })

      expect(manager.drawStartPoint).toEqual({ x: 0, y: 0 })
      const rect = manager.operate.data[0] as Rect
      expect(rect.start).toEqual({ x: 0, y: 0 })
    })

    it('起点超出右/下边界时 clamp 到图片尺寸', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: 900, y: 700 })

      expect(manager.drawStartPoint).toEqual({ x: IMG_W, y: IMG_H })
      const rect = manager.operate.data[0] as Rect
      expect(rect.start).toEqual({ x: IMG_W, y: IMG_H })
    })

    it('终点拖出右/下边界时，宽高被 clamp', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: 100, y: 100 })
      manager.updateRectDrawing({ x: 1200, y: 900 })

      const rect = manager.operate.data[0] as Rect
      expect(rect.width).toBe(IMG_W - 100)
      expect(rect.height).toBe(IMG_H - 100)
    })

    it('终点拖出左/上边界（负坐标）时，宽高被 clamp', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: 100, y: 100 })
      manager.updateRectDrawing({ x: -300, y: -200 })

      const rect = manager.operate.data[0] as Rect
      expect(rect.width).toBe(-100)
      expect(rect.height).toBe(-100)
    })

    it('起点与终点均在图内时不做修改', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: 10, y: 20 })
      manager.updateRectDrawing({ x: 300, y: 400 })

      expect(manager.drawStartPoint).toEqual({ x: 10, y: 20 })
      const rect = manager.operate.data[0] as Rect
      expect(rect.start).toEqual({ x: 10, y: 20 })
      expect(rect.width).toBe(290)
      expect(rect.height).toBe(380)
    })

    it('完整流程：图外起点 + 图外终点，finish 后存储坐标在图内', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: -50, y: -50 })
      manager.updateRectDrawing({ x: 1000, y: 1000 })
      manager.finishRectDrawing()

      expect(manager.recordList.length).toBe(1)
      const rect = manager.recordList[0].data[0] as Rect
      expect(rect.start.x).toBeGreaterThanOrEqual(0)
      expect(rect.start.y).toBeGreaterThanOrEqual(0)
      expect(rect.start.x + rect.width).toBeLessThanOrEqual(IMG_W)
      expect(rect.start.y + rect.height).toBeLessThanOrEqual(IMG_H)
    })
  })

  describe('多边形绘制 clamp', () => {
    it('startPolygonDrawing 起点在图外时 clamp', () => {
      const { manager } = createManager()
      manager.startPolygonDrawing({ x: -30, y: 700 })

      const first = manager.operate.data[0] as Polygon
      expect(first.point).toEqual({ x: 0, y: IMG_H })
      expect(manager.tempPolygonPoint).toEqual({ x: 0, y: IMG_H })
    })

    it('addPolygonPoint 添加图外点时 clamp', () => {
      const { manager } = createManager()
      manager.startPolygonDrawing({ x: 100, y: 100 })
      manager.addPolygonPoint({ x: 900, y: -50 })

      const second = manager.operate.data[1] as Polygon
      expect(second.point).toEqual({ x: IMG_W, y: 0 })
    })

    it('updatePolygonTempPoint 图外临时点 clamp', () => {
      const { manager } = createManager()
      manager.startPolygonDrawing({ x: 100, y: 100 })
      manager.updatePolygonTempPoint({ x: -10, y: 650 })

      expect(manager.tempPolygonPoint).toEqual({ x: 0, y: IMG_H })
    })

    it('完整流程：含图外点的多边形，finish 后所有顶点在图内', () => {
      const { manager } = createManager()
      manager.startPolygonDrawing({ x: -10, y: 10 })
      manager.addPolygonPoint({ x: 850, y: 10 })
      manager.addPolygonPoint({ x: 400, y: 700 })
      manager.finishPolygonDrawing()

      expect(manager.recordList.length).toBe(1)
      const polygon = manager.recordList[0].data as Polygon[]
      expect(polygon.length).toBe(3)
      polygon.forEach((p) => {
        expect(p.point.x).toBeGreaterThanOrEqual(0)
        expect(p.point.x).toBeLessThanOrEqual(IMG_W)
        expect(p.point.y).toBeGreaterThanOrEqual(0)
        expect(p.point.y).toBeLessThanOrEqual(IMG_H)
      })
    })
  })

  describe('图片未加载（originalWidth/Height 为 0）时跳过 clamp', () => {
    it('矩形起点保留原始值（含负坐标）', () => {
      const { manager } = createManager(false)
      manager.startRectDrawing({ x: -50, y: -20 })

      expect(manager.drawStartPoint).toEqual({ x: -50, y: -20 })
      const rect = manager.operate.data[0] as Rect
      expect(rect.start).toEqual({ x: -50, y: -20 })
    })

    it('矩形更新保留原始值', () => {
      const { manager } = createManager(false)
      manager.startRectDrawing({ x: 10, y: 10 })
      manager.updateRectDrawing({ x: 9999, y: 9999 })

      const rect = manager.operate.data[0] as Rect
      expect(rect.width).toBe(9999 - 10)
      expect(rect.height).toBe(9999 - 10)
    })

    it('多边形各入口均不 clamp', () => {
      const { manager } = createManager(false)
      manager.startPolygonDrawing({ x: -5, y: 5000 })
      manager.addPolygonPoint({ x: 5000, y: -5 })
      manager.updatePolygonTempPoint({ x: -1, y: -1 })

      const first = manager.operate.data[0] as Polygon
      expect(first.point).toEqual({ x: -5, y: 5000 })
      const second = manager.operate.data[1] as Polygon
      expect(second.point).toEqual({ x: 5000, y: -5 })
      expect(manager.tempPolygonPoint).toEqual({ x: -1, y: -1 })
    })
  })

  describe('边界值', () => {
    it('恰好等于图片尺寸的点是合法的，不被修改', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: IMG_W, y: IMG_H })

      expect(manager.drawStartPoint).toEqual({ x: IMG_W, y: IMG_H })
    })

    it('恰好为 (0, 0) 的点是合法的，不被修改', () => {
      const { manager } = createManager()
      manager.startRectDrawing({ x: 0, y: 0 })

      expect(manager.drawStartPoint).toEqual({ x: 0, y: 0 })
    })
  })

  describe('文本标注 clamp', () => {
    const createTextManager = (withImage = true) => {
      const viewport = new ViewportManager()
      if (withImage) {
        viewport.setOriginalSize(IMG_W, IMG_H)
      }
      const container = document.createElement('div')
      document.body.appendChild(container)
      const canvas = document.createElement('canvas')
      const manager = new TextAnnotationManager(viewport, container, canvas.getContext('2d')!)
      return { manager, container }
    }

    it('图外坐标（负值）clamp 到 (0, 0)', () => {
      const { manager } = createTextManager()
      manager.addTextAnnotation(-50, -20, 'test')

      expect(manager.textAnnotations[0].position).toEqual({ x: 0, y: 0 })
    })

    it('超出右/下边界 clamp 到图片尺寸', () => {
      const { manager } = createTextManager()
      manager.addTextAnnotation(900, 700, 'test')

      expect(manager.textAnnotations[0].position).toEqual({ x: IMG_W, y: IMG_H })
    })

    it('图内坐标不被修改', () => {
      const { manager } = createTextManager()
      manager.addTextAnnotation(100, 200, 'test')

      expect(manager.textAnnotations[0].position).toEqual({ x: 100, y: 200 })
    })

    it('图片未加载时跳过 clamp', () => {
      const { manager } = createTextManager(false)
      manager.addTextAnnotation(-50, 9999, 'test')

      expect(manager.textAnnotations[0].position).toEqual({ x: -50, y: 9999 })
    })
  })

  describe('clampEnabled 开关（默认 true）', () => {
    it('AnnotationManager.clampEnabled = false 时矩形/多边形不 clamp', () => {
      const { manager } = createManager()
      manager.clampEnabled = false

      manager.startRectDrawing({ x: -50, y: -20 })
      expect(manager.drawStartPoint).toEqual({ x: -50, y: -20 })

      manager.updateRectDrawing({ x: 1200, y: 900 })
      const rect = manager.operate.data[0] as Rect
      expect(rect.width).toBe(1200 - (-50))
      expect(rect.height).toBe(900 - (-20))
      manager.cancelDrawing()

      manager.startPolygonDrawing({ x: -30, y: 700 })
      expect((manager.operate.data[0] as Polygon).point).toEqual({ x: -30, y: 700 })
      manager.addPolygonPoint({ x: 900, y: -50 })
      expect((manager.operate.data[1] as Polygon).point).toEqual({ x: 900, y: -50 })
      manager.updatePolygonTempPoint({ x: -10, y: 650 })
      expect(manager.tempPolygonPoint).toEqual({ x: -10, y: 650 })
    })

    it('TextAnnotationManager.clampEnabled = false 时文本不 clamp', () => {
      const viewport = new ViewportManager()
      viewport.setOriginalSize(IMG_W, IMG_H)
      const container = document.createElement('div')
      document.body.appendChild(container)
      const canvas = document.createElement('canvas')
      const manager = new TextAnnotationManager(viewport, container, canvas.getContext('2d')!)
      manager.clampEnabled = false

      manager.addTextAnnotation(-50, 9999, 'test')
      expect(manager.textAnnotations[0].position).toEqual({ x: -50, y: 9999 })
    })
  })

  describe('Drawer 层 clampToImageBounds 选项', () => {
    const createDrawer = (options: Record<string, unknown> = {}) => {
      const container = document.createElement('div')
      container.id = `clamp-drawer-${Math.random().toString(36).slice(2)}`
      container.style.width = '800px'
      container.style.height = '600px'
      document.body.appendChild(container)
      const drawer = new Drawer({ id: container.id, useEvents: false, ...options })
      // 模拟图片已加载
      const viewport = (drawer as unknown as { viewport: ViewportManager }).viewport
      viewport.setOriginalSize(IMG_W, IMG_H)
      return { drawer, container }
    }

    it('默认开启：文本标注图外坐标被 clamp', () => {
      const { drawer } = createDrawer()
      drawer.addTextAnnotation(-50, 9999, 'test')

      const annotations = drawer.getTextAnnotations()
      expect(annotations[0].position).toEqual({ x: 0, y: IMG_H })
    })

    it('clampToImageBounds: false 时文本标注保留图外坐标', () => {
      const { drawer } = createDrawer({ clampToImageBounds: false })
      drawer.addTextAnnotation(-50, 9999, 'test')

      const annotations = drawer.getTextAnnotations()
      expect(annotations[0].position).toEqual({ x: -50, y: 9999 })
    })

    it('clampToImageBounds: false 时形状标注不 clamp（行为级）', () => {
      const { drawer } = createDrawer({ clampToImageBounds: false })
      const am = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager

      am.startRectDrawing({ x: -50, y: -20 })
      expect(am.drawStartPoint).toEqual({ x: -50, y: -20 })
    })

    it('默认开启：形状标注 clamp（行为级）', () => {
      const { drawer } = createDrawer()
      const am = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager

      am.startRectDrawing({ x: -50, y: -20 })
      expect(am.drawStartPoint).toEqual({ x: 0, y: 0 })
    })
  })
})
