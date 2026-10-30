import Drawer from '../src/index'
import { createDrawerWithImage } from './helpers'

const am = (d: Drawer) => (d as any).annotationManager

describe('setAnnotations 导入入口', () => {
  const cleanup: (() => void)[] = []
  const open = async (id: string) => {
    const created = await createDrawerWithImage(id)
    cleanup.push(() => {
      created.drawer.destroy()
      if (created.container.parentNode) created.container.parentNode.removeChild(created.container)
    })
    return created
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  it('补 id / status / 样式并返回落库快照', async () => {
    const { drawer } = await open('import-basic')
    const result = drawer.setAnnotations([
      { type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 20, height: 30 }], status: 'pending' },
      {
        type: 'polygon',
        data: [
          { point: { x: 10, y: 10 } },
          { point: { x: 40, y: 10 } },
          { point: { x: 20, y: 40 } }
        ],
        status: 'fullfilled'
      }
    ])

    expect(result).toHaveLength(2)
    expect(typeof result[0].id).toBe('string')
    expect(result[0].id).toBeTruthy()
    expect(result[0].status).toBe('fullfilled')
    expect(result[0].style?.strokeColor).toBe('red')
    expect(typeof result[1].id).toBe('string')
  })

  it('保留调用方唯一 id，重复 id 重新生成', async () => {
    const { drawer } = await open('import-id')
    const result = drawer.setAnnotations([
      { id: 'keep-me', type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 20, height: 20 }], status: 'fullfilled' },
      { id: 'keep-me', type: 'rect', data: [{ start: { x: 50, y: 50 }, width: 20, height: 20 }], status: 'fullfilled' }
    ])
    expect(result[0].id).toBe('keep-me')
    expect(result[1].id).not.toBe('keep-me')
  })

  it('跳过非法条目', async () => {
    const { drawer } = await open('import-invalid')
    const result = drawer.setAnnotations([
      { type: 'rect', data: [], status: 'pending' },
      { type: 'polygon', data: [{ point: { x: 0, y: 0 } }, { point: { x: 1, y: 1 } }], status: 'pending' },
      { type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 20, height: 20 }], status: 'fullfilled' }
    ] as any)

    expect(result).toHaveLength(1)
  })

  it('替换列表、清空选中并 emit load', async () => {
    const { drawer } = await open('import-load')
    drawer.setAnnotations([
      { type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 20, height: 20 }], status: 'fullfilled' }
    ])
    drawer.selectAnnotation(0)

    const listener = jest.fn()
    drawer.on('load', listener)
    const result = drawer.setAnnotations([
      { type: 'rect', data: [{ start: { x: 50, y: 50 }, width: 30, height: 30 }], status: 'fullfilled' }
    ])

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].annotations).toHaveLength(1)
    expect(result).toHaveLength(1)
    expect(drawer.getSelectedAnnotation()).toBeNull()
  })

  it('按 clampToImageBounds 夹回图片内', async () => {
    const { drawer } = await open('import-clamp')
    const result = drawer.setAnnotations([
      { type: 'rect', data: [{ start: { x: 900, y: 10 }, width: 100, height: 100 }], status: 'fullfilled' }
    ])
    expect(result[0].data[0]).toEqual({ start: { x: 700, y: 10 }, width: 100, height: 100 })
  })

  it('深拷贝入参，修改原对象不影响已导入数据', async () => {
    const { drawer } = await open('import-deep')
    const input: any = {
      type: 'rect',
      data: [{ start: { x: 10, y: 10 }, width: 20, height: 20 }],
      status: 'fullfilled'
    }
    drawer.setAnnotations([input])
    input.data[0].start.x = 500
    expect((drawer.getAnnotations()[0].data[0] as any).start.x).toBe(10)
  })

  it('图片加载前导入的标题，在图片加载后补做布局', async () => {
    const container = document.createElement('div')
    container.id = 'import-before-image'
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    const drawer = new Drawer({ id: 'import-before-image', useEvents: false, enableTitle: true })
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })

    drawer.setAnnotations([
      {
        type: 'rect',
        data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
        status: 'fullfilled',
        title: 'A'
      }
    ])
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('top')

    drawer.drawImage('test.jpg')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('bottom')
  })

  it('refreshTitleLayouts 对原地修改的坐标重新布局', async () => {
    const { drawer } = await open('import-refresh-inplace')
    drawer.setAnnotations([
      {
        type: 'rect',
        data: [{ start: { x: 100, y: 300 }, width: 100, height: 50 }],
        status: 'fullfilled',
        title: 'A'
      }
    ])
    expect(am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0]).vertical).toBe('top')

    // 原地把标注移到贴顶，再强制重排
    const record = am(drawer).recordList[0]
    record.data[0].start.y = 2
    drawer.refreshTitleLayouts()

    expect(am(drawer).getEffectiveTitlePosition(record).vertical).toBe('bottom')
  })

  it('导入的标题与图片等高的标注会落到内部顶边', async () => {
    const { drawer } = await open('import-title')
    drawer.setAnnotations([
      {
        type: 'rect',
        data: [{ start: { x: 100, y: 0 }, width: 100, height: 600 }],
        status: 'fullfilled',
        title: 'A'
      }
    ])
    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.vertical).toBe('inside-top')
  })
})

describe('addAnnotation 追加入口', () => {
  const cleanup: (() => void)[] = []
  const open = async (id: string) => {
    const created = await createDrawerWithImage(id)
    cleanup.push(() => {
      created.drawer.destroy()
      if (created.container.parentNode) created.container.parentNode.removeChild(created.container)
    })
    return created
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  it('追加并返回带 id 的快照，emit create', async () => {
    const { drawer } = await open('add-basic')
    const listener = jest.fn()
    drawer.on('create', listener)

    const record = drawer.addAnnotation({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 50, height: 50 }],
      status: 'pending'
    })

    expect(record).not.toBeNull()
    expect(record!.id).toBeTruthy()
    expect(record!.status).toBe('fullfilled')
    expect(drawer.getAnnotations()).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].index).toBe(0)
    expect(listener.mock.calls[0][0].data.id).toBe(record!.id)
  })

  it('非法数据返回 null 且不落库', async () => {
    const { drawer } = await open('add-invalid')
    expect(drawer.addAnnotation({ type: 'drag', data: [], status: 'pending' } as any)).toBeNull()
    expect(drawer.getAnnotations()).toHaveLength(0)
  })
})
