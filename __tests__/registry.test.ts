import { AnnotationManager } from '../src/modules/annotations'
import { TextAnnotationManager } from '../src/modules/shapes/text-manager'
import { ViewportManager } from '../src/modules/viewport'
import { ShapeRegistry } from '../src/modules/registry'

/**
 * Task 6: ShapeRegistry 统一选中互斥原语 + 锁定选中态
 * - AnnotationStore.selectAnnotation(ref, { lock }) 写入 locked
 * - 锁定时 getHandleAtPoint 返回 null（无 resize 入口）
 * - selectShapeExclusive：shape/text 选中互斥
 * - deselectAll / withdrawAll 编排
 */
describe('Task 6: registry 统一选中 + 锁定态', () => {
  const createStore = () => {
    const viewport = new ViewportManager()
    viewport.setOriginalSize(800, 600)
    const store = new AnnotationManager(viewport, undefined, undefined, undefined)
    return { store, viewport }
  }

  const createTextManager = () => {
    const viewport = new ViewportManager()
    viewport.setOriginalSize(800, 600)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const textManager = new TextAnnotationManager(viewport, container, canvas.getContext('2d')!)
    return { textManager, container }
  }

  /** 画一个 rect：图像坐标 (10,10) 起，100x50；scale=1/offset=0 时画布坐标一致 */
  const drawRect = (store: AnnotationManager) => {
    store.startRectDrawing({ x: 10, y: 10 })
    store.updateRectDrawing({ x: 110, y: 60 })
    store.finishRectDrawing()
  }

  /** 添加一条非空文本并退出编辑态，返回索引 */
  const addSettledText = (textManager: TextAnnotationManager, text = 'hello'): number => {
    const index = textManager.addTextAnnotation(10, 20, text)
    textManager.finishEditing()
    return index
  }

  describe('selectAnnotation 锁定态', () => {
    it('selectAnnotation(0, { lock: true }) 后 selectedAnnotation.locked === true', () => {
      const { store } = createStore()
      drawRect(store)

      const ok = store.selectAnnotation(0, { lock: true })

      expect(ok).toBe(true)
      expect(store.selectedAnnotation).not.toBe(null)
      expect(store.selectedAnnotation!.locked).toBe(true)
    })

    it('缺省参数时 locked 为 false，行为与现状一致', () => {
      const { store } = createStore()
      drawRect(store)

      const ok = store.selectAnnotation(0)

      expect(ok).toBe(true)
      expect(store.selectedAnnotation!.locked).toBe(false)
    })

    it('{ lock: false } 时 locked 为 false，行为与现状一致', () => {
      const { store } = createStore()
      drawRect(store)

      const ok = store.selectAnnotation(0, { lock: false })

      expect(ok).toBe(true)
      expect(store.selectedAnnotation!.locked).toBe(false)
    })

    it('索引越界仍 deselect + return false（不受 options 影响）', () => {
      const { store } = createStore()
      drawRect(store)
      store.selectAnnotation(0, { lock: true })

      const ok = store.selectAnnotation(99, { lock: true })

      expect(ok).toBe(false)
      expect(store.selectedAnnotation).toBe(null)
    })
  })

  describe('getHandleAtPoint 锁定守卫', () => {
    it('锁定选中时对角点画布坐标返回 null', () => {
      const { store } = createStore()
      drawRect(store)
      store.selectAnnotation(0, { lock: true })

      // rect 角点 3 画布坐标：(10+100, 10+50) = (110, 60)
      expect(store.getHandleAtPoint(110, 60)).toBe(null)
      // 角点 0：(10, 10)
      expect(store.getHandleAtPoint(10, 10)).toBe(null)
    })

    it('非锁定（缺省）时正常返回 handle', () => {
      const { store } = createStore()
      drawRect(store)
      store.selectAnnotation(0)

      expect(store.getHandleAtPoint(110, 60)).toEqual({ type: 'rect-corner', index: 3 })
      expect(store.getHandleAtPoint(10, 10)).toEqual({ type: 'rect-corner', index: 0 })
    })

    it('{ lock: false } 时正常返回 handle', () => {
      const { store } = createStore()
      drawRect(store)
      store.selectAnnotation(0, { lock: false })

      expect(store.getHandleAtPoint(110, 60)).toEqual({ type: 'rect-corner', index: 3 })
    })

    it('deselectAnnotation 后锁定失效：重新普通选中可正常取 handle', () => {
      const { store } = createStore()
      drawRect(store)
      store.selectAnnotation(0, { lock: true })
      expect(store.getHandleAtPoint(110, 60)).toBe(null)

      store.deselectAnnotation()
      expect(store.selectedAnnotation).toBe(null)

      store.selectAnnotation(0)
      expect(store.selectedAnnotation!.locked).toBe(false)
      expect(store.getHandleAtPoint(110, 60)).toEqual({ type: 'rect-corner', index: 3 })
    })
  })

  describe('selectShapeExclusive 互斥', () => {
    it('选中 shape 时取消 text 选中，并写入 locked', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      const textIndex = addSettledText(textManager)
      textManager.selectTextAnnotation(textIndex)
      expect(textManager.selectedTextIndex).toBe(textIndex)

      const registry = new ShapeRegistry()
      const ok = registry.selectShapeExclusive(store, textManager, { kind: 'shape', ref: 0, locked: true })

      expect(ok).toBe(true)
      expect(store.selectedAnnotation).not.toBe(null)
      expect(store.selectedAnnotation!.locked).toBe(true)
      expect(textManager.selectedTextIndex).toBe(null)
    })

    it('shape 选中后切 text：store.selectedAnnotation 为 null 且 selectedTextIndex 正确', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      const textIndex = addSettledText(textManager)
      store.selectAnnotation(0)
      expect(store.selectedAnnotation).not.toBe(null)

      const registry = new ShapeRegistry()
      const ok = registry.selectShapeExclusive(store, textManager, { kind: 'text', index: textIndex })

      expect(ok).toBe(true)
      expect(store.selectedAnnotation).toBe(null)
      expect(textManager.selectedTextIndex).toBe(textIndex)
    })

    it('text 选中后切 shape：selectedTextIndex 为 null 且 store.selectedAnnotation 正确', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      const textIndex = addSettledText(textManager)
      textManager.selectTextAnnotation(textIndex)

      const registry = new ShapeRegistry()
      const ok = registry.selectShapeExclusive(store, textManager, { kind: 'shape', ref: 0 })

      expect(ok).toBe(true)
      expect(textManager.selectedTextIndex).toBe(null)
      expect(store.selectedAnnotation).not.toBe(null)
      expect(store.selectedAnnotation!.locked).toBe(false)
    })

    it('shape 目标无效时返回 false，且双方均无选中', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      const textIndex = addSettledText(textManager)
      textManager.selectTextAnnotation(textIndex)

      const registry = new ShapeRegistry()
      const ok = registry.selectShapeExclusive(store, textManager, { kind: 'shape', ref: 99 })

      expect(ok).toBe(false)
      expect(store.selectedAnnotation).toBe(null)
      expect(textManager.selectedTextIndex).toBe(null)
    })
  })

  describe('deselectAll', () => {
    it('双方选中均被取消', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      const textIndex = addSettledText(textManager)
      store.selectAnnotation(0, { lock: true })
      textManager.selectTextAnnotation(textIndex)

      const registry = new ShapeRegistry()
      registry.deselectAll(store, textManager)

      expect(store.selectedAnnotation).toBe(null)
      expect(textManager.selectedTextIndex).toBe(null)
    })
  })

  describe('withdrawAll', () => {
    it('store 无可撤销（空 recordList/无删除历史/无绘制中）时回退 textManager.withdraw()', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      addSettledText(textManager)
      expect(textManager.textAnnotations.length).toBe(1)

      const registry = new ShapeRegistry()
      const ok = registry.withdrawAll(store, textManager)

      expect(ok).toBe(true)
      expect(textManager.textAnnotations.length).toBe(0)
    })

    it('store 可撤销时撤销 store，不碰 textManager', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()
      drawRect(store)
      addSettledText(textManager)
      const textWithdrawSpy = jest.spyOn(textManager, 'withdraw')

      const registry = new ShapeRegistry()
      const ok = registry.withdrawAll(store, textManager)

      expect(ok).toBe(true)
      expect(store.recordList.length).toBe(0)
      expect(textWithdrawSpy).not.toHaveBeenCalled()
      expect(textManager.textAnnotations.length).toBe(1)
    })

    it('双方均无可撤销时返回 false', () => {
      const { store } = createStore()
      const { textManager } = createTextManager()

      const registry = new ShapeRegistry()
      expect(registry.withdrawAll(store, textManager)).toBe(false)
    })
  })
})
