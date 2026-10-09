import { AnnotationManager } from '../src/modules/annotations'
import { TextAnnotationManager } from '../src/modules/shapes/text-manager'
import { ViewportManager } from '../src/modules/viewport'

describe('TextAnnotationManager 输入框按键', () => {
  const createTextManager = () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const manager = new TextAnnotationManager(new ViewportManager(), container, canvas.getContext('2d')!)
    return { manager, container }
  }

  it('Enter 键完成编辑并保存文本', () => {
    const { manager, container } = createTextManager()
    manager.addTextAnnotation(0, 0, '')
    ;(manager as any).textInput.value = '你好'
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    ;(manager as any).textInput.dispatchEvent(e)
    expect(manager.getTextAnnotations()[0].text).toBe('你好')
    expect((manager as any).editingTextIndex).toBeNull()
    container.parentNode?.removeChild(container)
  })

  it('Escape 键取消编辑恢复原文本', () => {
    const { manager, container } = createTextManager()
    manager.addTextAnnotation(0, 0, '原文')
    ;(manager as any).textInput.value = '改动'
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    ;(manager as any).textInput.dispatchEvent(e)
    expect(manager.getTextAnnotations()[0].text).toBe('原文')
    expect((manager as any).editingTextIndex).toBeNull()
    container.parentNode?.removeChild(container)
  })

  it('Delete 键删除空文本编辑中的标注', () => {
    const { manager, container } = createTextManager()
    manager.addTextAnnotation(0, 0, '')
    ;(manager as any).textInput.value = ''
    const e = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true })
    ;(manager as any).textInput.dispatchEvent(e)
    expect(manager.getTextAnnotations()).toHaveLength(0)
    container.parentNode?.removeChild(container)
  })

  it('removeTextAnnotation 删除前面的标注后移动索引下移', () => {
    const { manager, container } = createTextManager()
    manager.addTextAnnotation(0, 0, 'A')
    ;(manager as any).finishEditing()
    manager.addTextAnnotation(50, 50, 'B')
    ;(manager as any).finishEditing()
    // 正在移动 index 1（B）
    manager.startMoving({ clientX: 0, clientY: 0 } as MouseEvent, 1)
    expect((manager as any).movingTextIndex).toBe(1)
    // 删除 index 0（A）
    manager.removeTextAnnotation(0)
    expect((manager as any).movingTextIndex).toBe(0)
    container.parentNode?.removeChild(container)
  })
})

describe('AnnotationManager 标题编辑', () => {
  const createManager = () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const manager = new AnnotationManager(new ViewportManager(), container, () => {}, () => {})
    manager.enableTitle = true
    manager.initTitleSupport()
    return { manager, container }
  }
  const drawRect = (manager: AnnotationManager) => {
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
  }

  it('startTitleEditing 显示标题输入框并定位', () => {
    const { manager, container } = createManager()
    drawRect(manager)
    expect(manager.startTitleEditing(0)).toBe(true)
    expect((manager as any).titleInput.style.display).toBe('block')
    expect((manager as any).editingTitleIndex).toBe(0)
    container.parentNode?.removeChild(container)
  })

  it('finishTitleEditing 保存标题并重新选中', () => {
    const { manager, container } = createManager()
    drawRect(manager)
    manager.startTitleEditing(0)
    ;(manager as any).titleInput.value = '新标题'
    expect(manager.finishTitleEditing()).toBe(true)
    expect(manager.recordList[0].title).toBe('新标题')
    expect(manager.selectedAnnotation).not.toBeNull()
    container.parentNode?.removeChild(container)
  })

  it('finishTitleEditing 空标题清除标题', () => {
    const { manager, container } = createManager()
    drawRect(manager)
    manager.setTitle(0, '原标题')
    manager.startTitleEditing(0)
    ;(manager as any).titleInput.value = '   '
    manager.finishTitleEditing()
    expect(manager.recordList[0].title).toBeUndefined()
    container.parentNode?.removeChild(container)
  })

  it('cancelTitleEditing 恢复选中且不改标题', () => {
    const { manager, container } = createManager()
    drawRect(manager)
    manager.setTitle(0, '原标题')
    manager.startTitleEditing(0)
    ;(manager as any).titleInput.value = '改动'
    manager.cancelTitleEditing()
    expect(manager.recordList[0].title).toBe('原标题')
    expect(manager.selectedAnnotation).not.toBeNull()
    container.parentNode?.removeChild(container)
  })
})
