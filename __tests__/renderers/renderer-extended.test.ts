import Drawer from '../../src/index'

describe('renderer.ts 背景与标题绘制', () => {
  let container: HTMLDivElement
  let drawer: Drawer

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'render-ext-container'
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    drawer = new Drawer({ id: 'render-ext-container', useEvents: false, enableTitle: true })
  })

  afterEach(() => {
    drawer.destroy()
    if (container.parentNode) container.parentNode.removeChild(container)
  })

  const getCtx = () => (drawer as any).ctx
  const pushRect = () => {
    (drawer as any).annotationManager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled'
    })
  }

  it('有背景图片时 render 调用 drawImage', () => {
    getCtx().drawImage.mockClear()
    ;(drawer as any).bgImage = new Image()
    ;(drawer as any).render()
    expect(getCtx().drawImage).toHaveBeenCalled()
  })

  it('设置标题后 render 用 fillText 绘制标题', () => {
    pushRect()
    const manager = (drawer as any).annotationManager
    manager.setTitle(0, '标题A')
    getCtx().fillText.mockClear()
    ;(drawer as any).render()
    expect(getCtx().fillText).toHaveBeenCalledWith('标题A', expect.any(Number), expect.any(Number))
  })

  it.each(['top', 'bottom', 'inside-top'] as const)('标题 vertical=%s 均能绘制', (vertical) => {
    pushRect()
    const manager = (drawer as any).annotationManager
    manager.setTitle(0, '标题A')
    manager.setAnnotationTitlePosition(0, { vertical })
    getCtx().fillText.mockClear()
    ;(drawer as any).render()
    expect(getCtx().fillText).toHaveBeenCalledWith('标题A', expect.any(Number), expect.any(Number))
  })

  it.each(['left', 'center', 'right'] as const)('标题 align=%s 均能绘制', (align) => {
    pushRect()
    const manager = (drawer as any).annotationManager
    manager.setTitle(0, '标题A')
    manager.setAnnotationTitlePosition(0, { align })
    getCtx().fillText.mockClear()
    ;(drawer as any).render()
    expect(getCtx().fillText).toHaveBeenCalledWith('标题A', expect.any(Number), expect.any(Number))
  })

  it('标注贴图片上边缘时标题翻转回图片内（画布）', () => {
    const vp = (drawer as any).viewport
    vp.originalWidth = 200
    vp.originalHeight = 200
    vp.scale = 1
    vp.offset = { x: 0, y: 0 }
    ;(drawer as any).annotationManager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
      status: 'fullfilled'
    })
    const manager = (drawer as any).annotationManager
    manager.setTitle(0, 'A')
    manager.setAnnotationTitlePosition(0, { vertical: 'top', align: 'center' })
    getCtx().fillText.mockClear()
    ;(drawer as any).render()
    const call = getCtx().fillText.mock.calls.find((c: any[]) => c[0] === 'A')
    expect(call).toBeTruthy()
    // 上方不足 → 翻转到下方：bgY = 2 + 50 + 4 = 56；paddingY = 3 → fillText y = 59
    expect(call![2]).toBe(59)
  })
})

describe('renderer.ts 导出 drawForExport', () => {
  let container: HTMLDivElement
  let drawer: Drawer

  beforeEach(() => {
    container = document.createElement('div')
    container.id = 'render-export-container'
    container.style.width = '800px'
    container.style.height = '600px'
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    drawer = new Drawer({ id: 'render-export-container', useEvents: false, enableTitle: true })
  })

  afterEach(() => {
    drawer.destroy()
    if (container.parentNode) container.parentNode.removeChild(container)
  })

  const getCtx = () => (drawer as any).ctx
  const renderer = () => (drawer as any).renderer
  const img = () => new Image()

  it('导出矩形标注调用 strokeRect（原始坐标）', () => {
    (drawer as any).annotationManager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled'
    })
    getCtx().strokeRect.mockClear()
    renderer().drawForExport(getCtx(), img(), 800, 600)
    expect(getCtx().strokeRect).toHaveBeenCalledWith(100, 100, 100, 100)
  })

  it('导出多边形标注不报错且调用 stroke', () => {
    (drawer as any).annotationManager.recordList.push({
      type: 'polygon',
      data: [
        { point: { x: 0, y: 0 } },
        { point: { x: 100, y: 0 } },
        { point: { x: 50, y: 100 } }
      ],
      status: 'fullfilled'
    })
    getCtx().stroke.mockClear()
    expect(() => renderer().drawForExport(getCtx(), img(), 800, 600)).not.toThrow()
    expect(getCtx().stroke).toHaveBeenCalled()
  })

  it('导出文本标注调用 fillText', () => {
    (drawer as any).textManager.addTextAnnotation(50, 50, '文本')
    ;(drawer as any).textManager.finishEditing()
    getCtx().fillText.mockClear()
    renderer().drawForExport(getCtx(), img(), 800, 600)
    expect(getCtx().fillText).toHaveBeenCalledWith('文本', expect.any(Number), expect.any(Number))
  })

  it('启用标题时导出含标题的标注', () => {
    (drawer as any).annotationManager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled'
    })
    ;(drawer as any).annotationManager.setTitle(0, '标题A')
    getCtx().fillText.mockClear()
    renderer().drawForExport(getCtx(), img(), 800, 600)
    expect(getCtx().fillText).toHaveBeenCalledWith('标题A', expect.any(Number), expect.any(Number))
  })

  it('标注贴图片上边缘时标题翻转回图片内（导出）', () => {
    ;(drawer as any).annotationManager.recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 2 }, width: 100, height: 50 }],
      status: 'fullfilled'
    })
    const manager = (drawer as any).annotationManager
    manager.setTitle(0, 'A')
    manager.setAnnotationTitlePosition(0, { vertical: 'top' })
    getCtx().fillText.mockClear()
    renderer().drawForExport(getCtx(), img(), 200, 200)
    const call = getCtx().fillText.mock.calls.find((c: any[]) => c[0] === 'A')
    expect(call).toBeTruthy()
    // bounds maxY = 200，上方不足 → 翻转到下方 bgY = 56；paddingY = 3 → 59
    expect(call![2]).toBe(59)
  })
})
