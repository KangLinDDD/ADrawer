import Drawer from '../src/index'
import { createDrawerWithImage } from './helpers'

const am = (d: Drawer) => (d as any).annotationManager

/**
 * 回退（withdraw）后的选中项一致性。
 *
 * 缺陷背景：选中最后一条后回退，recordList.pop() 移除了该条，而 selectedAnnotation 仍指向
 * 已不存在的索引；随后鼠标移动走 updateCursor → getHandleAtPoint → 策略 getHandles，
 * 读到 undefined.data 抛 TypeError（线上栈：Cannot read properties of undefined (reading 'data')）。
 */
describe('回退（withdraw）后的选中项一致性', () => {
  const cleanup: (() => void)[] = []
  const track = (drawer: Drawer, container: HTMLElement) => {
    cleanup.push(() => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
  }
  afterEach(() => {
    cleanup.forEach((fn) => fn())
    cleanup.length = 0
  })

  const pushRect = (drawer: Drawer, y: number) => {
    am(drawer).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y }, width: 100, height: 100 }],
      status: 'fullfilled',
    })
  }

  it('回退掉当前选中的最后一条时，选中项被清空（不留悬空索引）', async () => {
    const { drawer, container } = await createDrawerWithImage('withdraw-selected')
    track(drawer, container)
    pushRect(drawer, 100)
    pushRect(drawer, 300)
    am(drawer).selectAnnotation(1)

    drawer.withdraw()

    expect(am(drawer).recordList).toHaveLength(1)
    expect(am(drawer).selectedAnnotation).toBeNull()
  })

  it('回退掉的不是选中那条时，选中态保持（不被误清）', async () => {
    const { drawer, container } = await createDrawerWithImage('withdraw-unselected')
    track(drawer, container)
    pushRect(drawer, 100)
    pushRect(drawer, 300)
    am(drawer).selectAnnotation(0)

    drawer.withdraw()

    expect(am(drawer).recordList).toHaveLength(1)
    expect(am(drawer).selectedAnnotation).toEqual({ index: 0, type: 'rect', locked: false })
  })

  it('回退后鼠标取控制点不再抛错，返回 null', async () => {
    const { drawer, container } = await createDrawerWithImage('withdraw-no-throw')
    track(drawer, container)
    pushRect(drawer, 100)
    pushRect(drawer, 300)
    am(drawer).selectAnnotation(1)
    drawer.withdraw()

    expect(() => am(drawer).getHandleAtPoint(10, 10)).not.toThrow()
    expect(am(drawer).getHandleAtPoint(10, 10)).toBeNull()
  })

  it('悬空选中态下 resize 系列不抛错并自愈（兜底防护）', async () => {
    const { drawer, container } = await createDrawerWithImage('withdraw-dangling-guards')
    track(drawer, container)
    pushRect(drawer, 100)
    pushRect(drawer, 300)
    am(drawer).selectAnnotation(1)

    // 绕过 withdraw 直接制造悬空选中态，验证各入口的防护
    am(drawer).recordList.pop()

    expect(() => am(drawer).getHandleAtPoint(10, 10)).not.toThrow()
    expect(am(drawer).getHandleAtPoint(10, 10)).toBeNull()
    expect(am(drawer).selectedAnnotation).toBeNull()

    am(drawer).selectedAnnotation = { index: 1, type: 'rect', locked: false }
    expect(() => am(drawer).startResizing({ type: 'rect-corner', index: 0 }, { x: 0, y: 0 })).not.toThrow()
    expect(am(drawer).startResizing({ type: 'rect-corner', index: 0 }, { x: 0, y: 0 })).toBe(false)
    expect(() => am(drawer).resizeRect({ x: 10, y: 10 })).not.toThrow()
    expect(am(drawer).resizeRect({ x: 10, y: 10 })).toBe(false)
    expect(() => am(drawer).resizePolygon({ x: 10, y: 10 })).not.toThrow()
    expect(am(drawer).resizePolygon({ x: 10, y: 10 })).toBe(false)
  })

  it('回退恢复已删除的标注后，选中项仍然有效（不越界）', async () => {
    const { drawer, container } = await createDrawerWithImage('withdraw-restore')
    track(drawer, container)
    pushRect(drawer, 100)
    pushRect(drawer, 300)
    am(drawer).selectAnnotation(0)
    drawer.deleteSelectedAnnotation()

    drawer.withdraw()

    expect(am(drawer).recordList).toHaveLength(2)
    const selected = am(drawer).selectedAnnotation
    if (selected) {
      expect(selected.index).toBeGreaterThanOrEqual(0)
      expect(selected.index).toBeLessThan(am(drawer).recordList.length)
    }
    expect(() => am(drawer).getHandleAtPoint(10, 10)).not.toThrow()
  })
})
