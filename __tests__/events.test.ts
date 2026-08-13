import { deepClone, generateId } from '../src/modules/utils'
import { Emitter } from '../src/modules/emitter'
import { AnnotationManager } from '../src/modules/annotations'
import { TextAnnotationManager } from '../src/modules/shapes/text-manager'
import { ViewportManager } from '../src/modules/viewport'
import Drawer from '../src/index'
import type { ShapeChangePayload } from '../src/modules/types'
import type { Rect } from '../src/modules/types'

describe('deepClone', () => {
  it('返回深拷贝，修改副本不影响原对象', () => {
    const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } }
    const copy = deepClone(original)
    expect(copy).toEqual(original) // 结构相等但引用不同
    expect(copy.nested).not.toBe(original.nested)
    copy.nested.b[0] = 99
    ;(copy.nested.b[2] as { c: number }).c = 100
    expect(original.nested.b[0]).toBe(1)
    expect((original.nested.b[2] as { c: number }).c).toBe(3)
  })
})

describe('generateId', () => {
  it('生成非空字符串且两次调用不重复', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
    expect(id1).not.toBe(id2)
  })
})

describe('Emitter', () => {
  it('on 注册的监听能被 emit 触发并收到载荷', () => {
    const emitter = new Emitter()
    const listener = jest.fn()
    emitter.on('create', listener)
    const payload = { id: 'a', type: 'rect' as const, index: 0, data: { type: 'rect' as const, data: [], status: 'fullfilled' as const } }
    emitter.emit('create', payload)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(payload)
  })

  it('支持多个监听者；off 解绑后不再触发', () => {
    const emitter = new Emitter()
    const l1 = jest.fn()
    const l2 = jest.fn()
    emitter.on('undo', l1)
    emitter.on('undo', l2)
    emitter.emit('undo', void 0)
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(1)
    emitter.off('undo', l1)
    emitter.emit('undo', void 0)
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(2)
  })

  it('clear 清空所有监听器', () => {
    const emitter = new Emitter()
    const listener = jest.fn()
    emitter.on('clear', listener)
    emitter.clear()
    emitter.emit('clear', void 0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('emit 无监听者的事件不报错', () => {
    const emitter = new Emitter()
    expect(() => emitter.emit('delete', { id: 'x', type: 'text', index: 0, data: { position: { x: 0, y: 0 }, text: '', width: 0, height: 0 } })).not.toThrow()
  })
})

describe('AnnotationManager 变更通知与 ID', () => {
  const createManager = () => {
    const events: { event: string; payload: ShapeChangePayload }[] = []
    const manager = new AnnotationManager(
      new ViewportManager(),
      void 0,
      void 0,
      (event, payload) => { events.push({ event, payload }) }
    )
    return { manager, events }
  }

  const drawRect = (manager: AnnotationManager) => {
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
  }

  it('矩形入库时生成 id 并触发 create，载荷含 id/type/index/data', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('create')
    const p = events[0].payload
    expect(p.type).toBe('rect')
    expect(p.index).toBe(0)
    expect(typeof p.id).toBe('string')
    expect(manager.recordList[0].id).toBe(p.id)
  })

  it('create 载荷 data 为深拷贝快照，修改不影响内部', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    const data = events[0].payload.data as { data: Rect[] }
    data.data[0].width = 9999
    expect((manager.recordList[0].data[0] as Rect).width).toBe(100)
  })

  it('过小矩形不入库、不触发 create', () => {
    const { manager, events } = createManager()
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 12, y: 12 })
    manager.finishRectDrawing()
    expect(manager.recordList).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('删除选中标注触发 delete，载荷 data 为被删标注快照', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    manager.selectAnnotation(0)
    manager.deleteSelectedAnnotation()
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
    expect(events[1].payload.id).toBe(events[0].payload.id)
    expect(events[1].payload.data).toBeDefined()
  })

  it('finishMovingAnnotation 触发一次 update（拖拽结束）', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    manager.selectAnnotation(0)
    manager.startMovingAnnotation({ clientX: 0, clientY: 0 } as MouseEvent)
    manager.moveSelectedAnnotation(5, 5) // 拖拽过程不触发
    expect(events.filter((e) => e.event === 'update')).toHaveLength(0)
    manager.finishMovingAnnotation()
    expect(events.filter((e) => e.event === 'update')).toHaveLength(1)
  })

  it('setTitle 支持 id 定位并触发 update；不存在的 id 返回 false', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id!
    expect(manager.setTitle(id, '标题A')).toBe(true)
    expect(manager.recordList[0].title).toBe('标题A')
    expect(events[events.length - 1].event).toBe('update')
    expect(manager.setTitle('不存在的id', 'x')).toBe(false)
    // number 入参保持原 index 行为
    expect(manager.setTitle(0, '标题B')).toBe(true)
    expect(manager.recordList[0].title).toBe('标题B')
  })

  it('selectAnnotation 支持 id 定位', () => {
    const { manager } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id!
    expect(manager.selectAnnotation(id)).toBe(true)
    expect(manager.selectedAnnotation?.index).toBe(0)
  })

  it('getAnnotations 返回深拷贝', () => {
    const { manager } = createManager()
    drawRect(manager)
    const list = manager.getAnnotations()
    ;(list[0].data[0] as Rect).width = 9999
    expect((manager.recordList[0].data[0] as Rect).width).toBe(100)
  })

  it('撤销恢复删除的标注时保留原 id', () => {
    const { manager } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id
    manager.selectAnnotation(0)
    manager.deleteSelectedAnnotation()
    manager.withdraw()
    expect(manager.recordList[0].id).toBe(id)
  })
})

describe('TextAnnotationManager 变更通知与 ID', () => {
  const createTextManager = () => {
    const events: { event: string; payload: ShapeChangePayload }[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const manager = new TextAnnotationManager(
      new ViewportManager(),
      container,
      ctx,
      void 0,
      (event, payload) => { events.push({ event, payload }) }
    )
    return { manager, events, container }
  }

  it('addTextAnnotation 生成 id 并触发 create（type=text）', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('create')
    expect(events[0].payload.type).toBe('text')
    expect(events[0].payload.index).toBe(0)
    expect(manager.getTextAnnotations()[0].id).toBe(events[0].payload.id)
  })

  it('create 载荷 data 为深拷贝快照', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const data = events[0].payload.data as { text: string }
    data.text = '被外部篡改'
    expect(manager.getTextAnnotations()[0].text).toBe('你好')
  })

  it('updateTextAnnotation 支持 id 定位并触发 update；不存在的 id 返回 false', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const id = manager.getTextAnnotations()[0].id!
    expect(manager.updateTextAnnotation(id, '新文本')).toBe(true)
    expect(events[events.length - 1].event).toBe('update')
    expect(manager.updateTextAnnotation('不存在的id', 'x')).toBe(false)
  })

  it('removeTextAnnotation 支持 id 定位并触发 delete', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const id = manager.getTextAnnotations()[0].id!
    expect(manager.removeTextAnnotation(id)).toBe(true)
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
    expect(events[1].payload.id).toBe(id)
  })

  it('编辑时空文本导致标注被移除会触发 delete（finishEditing 分支）', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    manager.startEditing(0)
    ;(manager as unknown as { textInput: HTMLInputElement }).textInput.value = ''
    manager.finishEditing()
    expect(manager.getTextAnnotations()).toHaveLength(0)
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
  })

  it('getTextAnnotations 返回深拷贝', () => {
    const { manager } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const list = manager.getTextAnnotations()
    list[0].text = '被外部篡改'
    expect(manager.getTextAnnotations()[0].text).toBe('你好')
  })
})

describe('Drawer 事件订阅', () => {
  const createDrawer = () => {
    const container = document.createElement('div')
    container.id = `drawer-test-${Math.random().toString(36).slice(2)}`
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    const drawer = new Drawer({ id: container.id, useEvents: false })
    return { drawer, container }
  }

  it('on 订阅 create，画矩形后收到事件；off 后不再收到', () => {
    const { drawer } = createDrawer()
    const listener = jest.fn()
    drawer.on('create', listener)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].type).toBe('rect')
    expect(typeof listener.mock.calls[0][0].id).toBe('string')

    drawer.off('create', listener)
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clear() 触发 clear 事件；withdraw() 成功触发 undo 事件', () => {
    const { drawer } = createDrawer()
    const onClear = jest.fn()
    const onUndo = jest.fn()
    drawer.on('clear', onClear)
    drawer.on('undo', onUndo)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()

    drawer.withdraw()
    expect(onUndo).toHaveBeenCalledTimes(1)

    drawer.clear()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('程序化 moveSelectedAnnotation 触发一次 update', () => {
    const { drawer } = createDrawer()
    const onUpdate = jest.fn()
    drawer.on('update', onUpdate)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()

    drawer.selectAnnotation(0)
    drawer.moveSelectedAnnotation(5, 5)
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('updateSelectedAnnotationStyle 触发一次 update', () => {
    const { drawer } = createDrawer()
    const onUpdate = jest.fn()
    drawer.on('update', onUpdate)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()

    drawer.selectAnnotation(0)
    expect(drawer.updateSelectedAnnotationStyle()).toBe(true)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][0].type).toBe('rect')
  })

  it('setAnnotationTitle 支持 id 定位', () => {
    const { drawer } = createDrawer()
    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    const id = drawer.getAnnotations()[0].id!
    expect(drawer.setAnnotationTitle(id, '标题X')).toBe(true)
    expect(drawer.getAnnotationTitle(id)).toBe('标题X')
  })

  it('destroy() 后监听器被清空', () => {
    const { drawer } = createDrawer()
    const listener = jest.fn()
    drawer.on('clear', listener)
    drawer.destroy()
    drawer.clear()
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('既有 bug 修复回归', () => {
  it('删除编辑中的空文本标注不会误删下移的标注', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const manager = new TextAnnotationManager(new ViewportManager(), container, canvas.getContext('2d')!)

    // A、B 两条标注，内容都置空
    manager.addTextAnnotation(0, 0, 'A')
    manager.finishEditing()
    manager.addTextAnnotation(50, 50, 'B')
    manager.finishEditing()
    manager.updateTextAnnotation(0, '')
    manager.updateTextAnnotation(1, '')

    // 编辑 A（textBeforeEditing 为 ''），然后删除 A
    manager.startEditing(0)
    manager.removeTextAnnotation(0)

    // 期望：只剩 B；bug 行为：B 被连带误删（长度 0）
    expect(manager.getTextAnnotations()).toHaveLength(1)
    expect(manager.getTextAnnotations()[0].text).toBe('')

    manager.destroy()
    document.body.removeChild(container)
  })

  it('ESC 取消保存多边形后，撤销不会幽灵恢复早先删除的标注', () => {
    const manager = new AnnotationManager(new ViewportManager())

    // 画一个矩形并删除（进入 deleteHistory）
    manager.startRectDrawing({ x: 0, y: 0 })
    manager.updateRectDrawing({ x: 100, y: 100 })
    manager.finishRectDrawing()
    manager.selectAnnotation(0)
    manager.deleteSelectedAnnotation()
    expect(manager.recordList).toHaveLength(0)

    // 画多边形两个点后 ESC 取消（保存入库）
    manager.operate = { type: 'polygon', data: [], status: 'pending' }
    manager.startPolygonDrawing({ x: 0, y: 0 })
    manager.addPolygonPoint({ x: 50, y: 50 })
    manager.cancelDrawing()
    expect(manager.recordList).toHaveLength(1)

    // 撤销：应撤销多边形本身；bug 行为：deleteHistory 残留导致先幽灵恢复被删矩形
    manager.withdraw()
    expect(manager.recordList).toHaveLength(0)
  })
})

describe('获取标注与设置样式的 id 定位', () => {
  const createDrawer = () => {
    const container = document.createElement('div')
    container.id = `drawer-test-${Math.random().toString(36).slice(2)}`
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    return new Drawer({ id: container.id, useEvents: false })
  }

  const drawRectOn = (drawer: InstanceType<typeof Drawer>) => {
    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    return manager
  }

  it('getAnnotation 支持 id 和 index，返回深拷贝快照', () => {
    const drawer = createDrawer()
    drawRectOn(drawer)
    const id = drawer.getAnnotations()[0].id!

    const byId = drawer.getAnnotation(id)
    const byIndex = drawer.getAnnotation(0)
    expect(byId).toBeDefined()
    expect(byIndex).toBeDefined()
    expect(byId!.id).toBe(id)
    expect(byIndex!.id).toBe(id)

    // 深拷贝：篡改返回值不影响内部
    ;(byId!.data[0] as Rect).width = 9999
    expect((drawer.getAnnotations()[0].data[0] as Rect).width).toBe(100)

    // 不存在的 id / 越界 index
    expect(drawer.getAnnotation('不存在的id')).toBeUndefined()
    expect(drawer.getAnnotation(99)).toBeUndefined()
  })

  it('getTextAnnotation 支持 id 和 index，返回深拷贝快照', () => {
    const drawer = createDrawer()
    const textManager = (drawer as unknown as { textManager: TextAnnotationManager }).textManager
    textManager.addTextAnnotation(10, 20, '你好')
    const id = drawer.getTextAnnotations()[0].id!

    const byId = drawer.getTextAnnotation(id)
    expect(byId).toBeDefined()
    expect(byId!.text).toBe('你好')
    expect(drawer.getTextAnnotation(0)!.id).toBe(id)

    byId!.text = '被外部篡改'
    expect(drawer.getTextAnnotations()[0].text).toBe('你好')

    expect(drawer.getTextAnnotation('不存在的id')).toBeUndefined()
  })

  it('updateSelectedAnnotationStyle 支持传 id/index 直接指定标注，并触发 update', () => {
    const drawer = createDrawer()
    drawRectOn(drawer)
    drawRectOn(drawer)
    const id = drawer.getAnnotations()[1].id!

    const onUpdate = jest.fn()
    drawer.on('update', onUpdate)

    // 不选中任何标注，直接按 id 更新第二个标注的样式
    drawer.setAnnotationColor('#00FF00')
    expect(drawer.updateSelectedAnnotationStyle(id)).toBe(true)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate.mock.calls[0][0].id).toBe(id)
    expect(drawer.getAnnotation(id)!.style!.strokeColor).toBe('#00FF00')

    // 传 index 也可以
    expect(drawer.updateSelectedAnnotationStyle(0)).toBe(true)
    expect(onUpdate).toHaveBeenCalledTimes(2)

    // 不存在的 id 返回 false，不发事件
    expect(drawer.updateSelectedAnnotationStyle('不存在的id')).toBe(false)
    expect(onUpdate).toHaveBeenCalledTimes(2)

    // 不传参保持原行为（操作当前选中）
    drawer.selectAnnotation(0)
    expect(drawer.updateSelectedAnnotationStyle()).toBe(true)
    expect(onUpdate).toHaveBeenCalledTimes(3)
  })
})
