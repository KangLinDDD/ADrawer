import Drawer from '../src/index'
import { createDrawerWithImage, dispatchDoubleClick, dispatchMouse } from './helpers'

const am = (d: Drawer) => (d as any).annotationManager

describe('标题拖拽（命中 / 移动 / 改宽）', () => {
  const cleanup: (() => void)[] = []
  const open = async (id: string, options: Record<string, unknown> = {}) => {
    const created = await createDrawerWithImage(id, { enableTitle: true, ...options })
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

  const pushRect = (drawer: Drawer, start: { x: number; y: number }, width = 100, height = 50) => {
    am(drawer).recordList.push({ type: 'rect', data: [{ start, width, height }], status: 'fullfilled' })
  }

  const setup = async (id: string) => {
    const created = await open(id)
    pushRect(created.drawer, { x: 300, y: 300 })
    created.drawer.setAnnotationTitle(0, 'A')
    created.drawer.selectAnnotation(0)
    return created
  }

  it('命中框体 / 右边缘把手，空白处不命中', async () => {
    const { drawer } = await setup('drag-hit')
    const box = am(drawer).getTitleBoxRect(0)

    expect(am(drawer).hitTestTitle(box.x + 5, box.y + 5)).toEqual({ index: 0, part: 'body' })
    expect(am(drawer).hitTestTitle(box.x + box.width - 2, box.y + 5)).toEqual({
      index: 0,
      part: 'handle'
    })
    expect(am(drawer).hitTestTitle(0, 0)).toBeNull()
  })

  it('拖动框体改变 offset，并标记为显式布局', async () => {
    const { drawer } = await setup('drag-move')
    const box = am(drawer).getTitleBoxRect(0)
    const start = { x: box.x + 5, y: box.y + 5 }

    expect(am(drawer).startTitleDrag('body', 0, start)).toBe(true)
    expect(am(drawer).updateTitleDrag({ x: start.x + 30, y: start.y + 10 })).toBe(true)

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.offsetX).toBeCloseTo(30)
    expect(pos.offsetY).toBeCloseTo(10)
    expect(am(drawer).recordList[0].style.titlePositionExplicit).toBe(true)

    const moved = am(drawer).getTitleBoxRect(0)
    expect(moved.x).toBeCloseTo(box.x + 30)
    expect(moved.y).toBeCloseTo(box.y + 10)
  })

  it('位移小于 3px 视为点击，不标记显式布局', async () => {
    const { drawer } = await setup('drag-threshold')
    const box = am(drawer).getTitleBoxRect(0)
    const start = { x: box.x + 5, y: box.y + 5 }

    am(drawer).startTitleDrag('body', 0, start)
    expect(am(drawer).updateTitleDrag({ x: start.x + 2, y: start.y + 1 })).toBe(false)
    expect(am(drawer).recordList[0].style?.titlePositionExplicit).toBeFalsy()
    expect(am(drawer).finishTitleDrag()).toBe(false)
  })

  it('拖出图片时 clamp 回图片内', async () => {
    const { drawer } = await setup('drag-clamp')
    const box = am(drawer).getTitleBoxRect(0)
    const start = { x: box.x + 5, y: box.y + 5 }

    am(drawer).startTitleDrag('body', 0, start)
    am(drawer).updateTitleDrag({ x: start.x + 10000, y: start.y + 10000 })
    am(drawer).finishTitleDrag()

    const clamped = am(drawer).getTitleBoxRect(0)
    expect(clamped.x).toBeGreaterThanOrEqual(0)
    expect(clamped.y).toBeGreaterThanOrEqual(0)
    expect(clamped.x + clamped.width).toBeLessThanOrEqual(800)
    expect(clamped.y + clamped.height).toBeLessThanOrEqual(600)
  })

  it('拖右边缘改宽并重新换行', async () => {
    const { drawer } = await setup('drag-resize')
    drawer.setAnnotationTitle(0, '一二三四五六七八九十')
    const box = am(drawer).getTitleBoxRect(0)
    const handle = { x: box.x + box.width - 2, y: box.y + 5 }

    expect(am(drawer).startTitleDrag('handle', 0, handle)).toBe(true)
    expect(am(drawer).updateTitleDrag({ x: handle.x - 50, y: handle.y })).toBe(true)
    am(drawer).finishTitleDrag()

    const resized = am(drawer).getTitleBoxRect(0)
    expect(resized.width).toBe(42) // 92 - 50
    expect(resized.height).toBe(63) // 4 行：12 + 3*15 + 6
    expect(am(drawer).recordList[0].style.titlePositionExplicit).toBe(true)
  })

  it('未选中的标题不开始拖拽', async () => {
    const { drawer } = await setup('drag-unselected')
    const box = am(drawer).getTitleBoxRect(0)
    am(drawer).deselectAnnotation()

    expect(am(drawer).hitTestTitle(box.x + 5, box.y + 5)).toEqual({ index: 0, part: 'body' })
    expect(am(drawer).startTitleDrag('body', 0, { x: box.x + 5, y: box.y + 5 })).toBe(false)
  })

  it('锁定标注不可拖拽标题', async () => {
    const { drawer } = await setup('drag-locked')
    const box = am(drawer).getTitleBoxRect(0)
    drawer.selectAnnotation(0, { lock: true })

    expect(
      am(drawer).startTitleDrag('body', 0, { x: box.x + 5, y: box.y + 5 })
    ).toBe(false)
  })

  it('enableTitleDragging=false 时不命中、不拖拽', async () => {
    const { drawer } = await open('drag-disabled', { enableTitleDragging: false })
    pushRect(drawer, { x: 300, y: 300 })
    drawer.setAnnotationTitle(0, 'A')
    drawer.selectAnnotation(0)
    const box = am(drawer).getTitleBoxRect(0)

    expect(am(drawer).hitTestTitle(box.x + 5, box.y + 5)).toBeNull()
    expect(am(drawer).startTitleDrag('body', 0, { x: box.x + 5, y: box.y + 5 })).toBe(false)
  })

  it('鼠标事件：按下 → 移动 → 松开 完成标题移动', async () => {
    const { drawer, canvas } = await setup('drag-events')
    const box = am(drawer).getTitleBoxRect(0)

    dispatchMouse(canvas, 'mousedown', box.x + 5, box.y + 5)
    dispatchMouse(canvas, 'mousemove', box.x + 35, box.y + 15)
    dispatchMouse(canvas, 'mouseup', box.x + 35, box.y + 15)

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(pos.offsetX).toBeCloseTo(30)
    expect(pos.offsetY).toBeCloseTo(10)
  })

  it('悬停光标：把手 ew-resize、框体 move、未选中 pointer', async () => {
    const { drawer, canvas } = await setup('drag-cursor')
    const box = am(drawer).getTitleBoxRect(0)

    dispatchMouse(canvas, 'mousemove', box.x + box.width - 2, box.y + 5)
    expect(canvas.style.cursor).toBe('ew-resize')

    dispatchMouse(canvas, 'mousemove', box.x + 5, box.y + 5)
    expect(canvas.style.cursor).toBe('move')

    am(drawer).deselectAnnotation()
    dispatchMouse(canvas, 'mousemove', box.x + 5, box.y + 5)
    expect(canvas.style.cursor).toBe('pointer')
  })

  it('双击标题进入文字编辑', async () => {
    const { drawer, canvas } = await setup('drag-dblclick')
    const box = am(drawer).getTitleBoxRect(0)

    dispatchDoubleClick(canvas, box.x + 5, box.y + 5)

    expect(am(drawer).editingTitleIndex).toBe(0)
  })

  it('真实拖拽后的 click 不会和下一次拖拽凑成双击', async () => {
    const { drawer, canvas } = await setup('drag-no-dblclick')
    const drag = (box: { x: number; y: number; width: number; height: number }) => {
      dispatchMouse(canvas, 'mousedown', box.x + 5, box.y + 5)
      dispatchMouse(canvas, 'mousemove', box.x + 35, box.y + 5)
      dispatchMouse(canvas, 'mouseup', box.x + 35, box.y + 5)
      dispatchMouse(canvas, 'click', box.x + 35, box.y + 5)
    }

    drag(am(drawer).getTitleBoxRect(0))
    drag(am(drawer).getTitleBoxRect(0))
    await new Promise((resolve) => setTimeout(resolve, 350))

    expect(am(drawer).editingTitleIndex).toBeNull()
  })

  it('原地两次点击标题仍能进入编辑（点击不算拖拽）', async () => {
    const { drawer, canvas } = await setup('drag-click-edit')
    const box = am(drawer).getTitleBoxRect(0)
    const click = () => {
      dispatchMouse(canvas, 'mousedown', box.x + 5, box.y + 5)
      dispatchMouse(canvas, 'mouseup', box.x + 5, box.y + 5)
      dispatchMouse(canvas, 'click', box.x + 5, box.y + 5)
    }

    click()
    click()

    expect(am(drawer).editingTitleIndex).toBe(0)
  })

  it('resetAnnotationTitleLayout 恢复自动布局', async () => {
    const { drawer } = await setup('drag-reset')
    const box = am(drawer).getTitleBoxRect(0)
    const start = { x: box.x + 5, y: box.y + 5 }
    am(drawer).startTitleDrag('body', 0, start)
    am(drawer).updateTitleDrag({ x: start.x + 40, y: start.y })
    am(drawer).finishTitleDrag()

    expect(am(drawer).recordList[0].style.titlePositionExplicit).toBe(true)
    expect(drawer.resetAnnotationTitleLayout(0)).toBe(true)

    const pos = am(drawer).getEffectiveTitlePosition(am(drawer).recordList[0])
    expect(am(drawer).recordList[0].style.titlePositionExplicit).toBe(false)
    expect(pos.offsetX).toBe(0)
    expect(pos.offsetY).toBe(0)
  })
})
