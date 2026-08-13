import { TextAnnotationManager } from '../../src/modules/shapes/text-manager'
import { ViewportManager } from '../../src/modules/viewport'
import type { ChangeNotify } from '../../src/modules/types'

/**
 * TextAnnotationManager 移动态/编辑态拆分与新方法测试
 * movingTextIndex（拖动目标）与 editingTextIndex（DOM 编辑）语义分离
 */
describe('TextAnnotationManager 移动/编辑状态拆分', () => {
  const createManager = (onChange?: ChangeNotify) => {
    const viewport = new ViewportManager()
    viewport.setOriginalSize(800, 600)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const manager = new TextAnnotationManager(
      viewport,
      container,
      canvas.getContext('2d')!,
      undefined,
      onChange
    )
    return { manager, container, viewport }
  }

  /** 添加一条非空文本并退出编辑态，返回索引 */
  const addSettled = (manager: TextAnnotationManager, text = 'hello'): number => {
    const index = manager.addTextAnnotation(10, 20, text)
    manager.finishEditing()
    return index
  }

  describe('startMoving / moveAnnotation / finishMoving', () => {
    it('startMoving 后 movingTextIndex 为目标索引且 editingTextIndex 为 null', () => {
      const { manager } = createManager()
      const index = addSettled(manager)

      const ok = manager.startMoving({ clientX: 100, clientY: 100 } as MouseEvent, index)

      expect(ok).toBe(true)
      expect(manager.movingTextIndex).toBe(index)
      expect(manager.editingTextIndex).toBe(null)
      expect(manager.isTextMoving).toBe(true)
    })

    it('moveAnnotation 使用 movingTextIndex 定位移动目标', () => {
      const { manager } = createManager()
      addSettled(manager, 'a')
      const indexB = addSettled(manager, 'b')

      manager.startMoving({ clientX: 100, clientY: 100 } as MouseEvent, indexB)
      const moved = manager.moveAnnotation({ clientX: 130, clientY: 150 } as MouseEvent)

      expect(moved).toBe(true)
      // scale 默认为 1：dx=30, dy=50
      expect(manager.textAnnotations[indexB].position).toEqual({ x: 40, y: 70 })
      // 未移动目标不受影响
      expect(manager.textAnnotations[0].position).toEqual({ x: 10, y: 20 })
    })

    it('moveAnnotation 在非移动态返回 false', () => {
      const { manager } = createManager()
      addSettled(manager)
      expect(manager.moveAnnotation({ clientX: 1, clientY: 1 } as MouseEvent)).toBe(false)
    })

    it('finishMoving 清 movingTextIndex/isTextMoving 并触发 update 通知', () => {
      const onChange = jest.fn()
      const { manager } = createManager(onChange)
      const index = addSettled(manager)
      onChange.mockClear()

      manager.startMoving({ clientX: 100, clientY: 100 } as MouseEvent, index)
      manager.moveAnnotation({ clientX: 120, clientY: 130 } as MouseEvent)
      manager.finishMoving()

      expect(manager.isTextMoving).toBe(false)
      expect(manager.movingTextIndex).toBe(null)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange.mock.calls[0][0]).toBe('update')
      expect(onChange.mock.calls[0][1]).toMatchObject({ type: 'text', index })
    })
  })

  describe('endTextMoving', () => {
    it('isTextMoving=false 且 movingTextIndex=null，不触碰 editingTextIndex', () => {
      const { manager } = createManager()
      const index = addSettled(manager)

      // 同时处于编辑态与移动态
      manager.startEditing(index)
      manager.startMoving({ clientX: 100, clientY: 100 } as MouseEvent, index)

      manager.endTextMoving()

      expect(manager.isTextMoving).toBe(false)
      expect(manager.movingTextIndex).toBe(null)
      // 编辑态不受影响
      expect(manager.editingTextIndex).toBe(index)
      expect(manager.isEditingVisible()).toBe(true)
    })
  })

  describe('isEditingVisible', () => {
    it('初始（输入框隐藏）返回 false', () => {
      const { manager } = createManager()
      expect(manager.isEditingVisible()).toBe(false)
    })

    it('编辑中（textInput.style.display === "block"）返回 true', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, 'hello')
      expect(manager.isEditingVisible()).toBe(true)
    })

    it('结束编辑后返回 false', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, 'hello')
      manager.finishEditing()
      expect(manager.isEditingVisible()).toBe(false)
    })
  })

  describe('编辑流程回归（行为不变）', () => {
    it('addTextAnnotation 创建即进入编辑态', () => {
      const { manager } = createManager()
      const index = manager.addTextAnnotation(10, 20, 'hello')

      expect(index).toBe(0)
      expect(manager.textAnnotations.length).toBe(1)
      expect(manager.editingTextIndex).toBe(0)
      expect(manager.currentEditingIndex).toBe(0)
      expect(manager.isEditingVisible()).toBe(true)
    })

    it('finishEditing 空文本删除该标注并复位编辑态', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, '')

      manager.finishEditing()

      expect(manager.textAnnotations.length).toBe(0)
      expect(manager.editingTextIndex).toBe(null)
      expect(manager.currentEditingIndex).toBe(null)
    })

    it('finishEditing 非空文本保留标注并写入新内容', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, 'old')
      manager.textInput!.value = 'new text'

      manager.finishEditing()

      expect(manager.textAnnotations.length).toBe(1)
      expect(manager.textAnnotations[0].text).toBe('new text')
      expect(manager.editingTextIndex).toBe(null)
    })

    it('cancelEditing 空文本（新建）删除该标注', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, '')

      manager.cancelEditing()

      expect(manager.textAnnotations.length).toBe(0)
      expect(manager.editingTextIndex).toBe(null)
    })

    it('cancelEditing 非空原文本保留标注', () => {
      const { manager } = createManager()
      manager.addTextAnnotation(10, 20, 'keep')

      manager.cancelEditing()

      expect(manager.textAnnotations.length).toBe(1)
      expect(manager.textAnnotations[0].text).toBe('keep')
    })
  })
})
