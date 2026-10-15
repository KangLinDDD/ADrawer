/**
 * 导出路径的「路径累积」缺陷回归测试。
 *
 * Canvas 的 `roundRect()` 是**追加**到当前路径的，而 `ctx.fill()` 填充的是**整条路径**。
 * 如果每个框之前不调用 `ctx.beginPath()`，路径会跨轮累积：
 *
 *   item1: roundRect(框1) → fill() 只填框1 → 画文字1
 *   item2: roundRect(框2) → 路径=[框1,框2] → fill() 把框1 重填一遍
 *                         → 框1 的半透明底色盖住了刚画的文字1（第一个标题变糊）
 *
 * 症状：第一个（越靠前越严重）标注标题的文字被自己的底色覆盖，导出图里发糊/看不见；
 * 交互画布不受影响，因为 text-renderer.ts 是正确调用了 beginPath() 的。
 */

import Drawer from '../../src/index'

/** 忠实建模 canvas 路径语义：beginPath 清空、roundRect 追加、fill 填充整条路径 */
function makePathCtx() {
  const path: number[][] = []
  const fills: number[][][] = []

  const ctx: Record<string, any> = {
    font: '10px sans-serif',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start',
    textBaseline: 'alphabetic',
    beginPath: jest.fn(() => {
      path.length = 0
    }),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn((x: number, y: number, w: number, h: number) => {
      path.push([x, y, w, h, 0])
    }),
    roundRect: jest.fn((x: number, y: number, w: number, h: number, r: number) => {
      path.push([x, y, w, h, r])
    }),
    fill: jest.fn(() => {
      // 快照：这次 fill 实际会填充哪些框
      fills.push(path.map((p) => [...p]))
    }),
    fillRect: jest.fn((x: number, y: number, w: number, h: number) => {
      // fillRect 不走路径，只填自己
      fills.push([[x, y, w, h, 0]])
    }),
    stroke: jest.fn(),
    strokeRect: jest.fn(),
    drawImage: jest.fn(),
    fillText: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    setLineDash: jest.fn(),
    measureText: jest.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4
    }))
  }
  return { ctx, fills }
}

function createDrawer(id: string, w: number, h: number, iw: number, ih: number) {
  const container = document.createElement('div')
  container.id = id
  Object.defineProperty(container, 'clientWidth', { value: w })
  Object.defineProperty(container, 'clientHeight', { value: h })
  document.body.appendChild(container)

  const drawer = new Drawer({ id, useEvents: false, enableTitle: true })
  const viewport = (drawer as any).viewport
  viewport.setSize(w, h)
  viewport.setOriginalSize(iw, ih)
  viewport.calculateInitialView()
  return { drawer, container }
}

function pushRectWithTitle(drawer: Drawer, title: string) {
  ;(drawer as any).annotationManager.recordList.push({
    type: 'rect',
    data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
    status: 'fullfilled',
    title
  })
}

describe('drawForExport：每次 fill 只能填自己那个框（beginPath 不能漏）', () => {
  const drawers: Array<{ drawer: Drawer; container: HTMLDivElement }> = []

  afterEach(() => {
    drawers.forEach(({ drawer, container }) => {
      drawer.destroy()
      if (container.parentNode) container.parentNode.removeChild(container)
    })
    drawers.length = 0
  })

  const open = (id: string) => {
    const created = createDrawer(id, 800, 600, 1600, 1200)
    drawers.push(created)
    return created.drawer
  }

  it('多个标题框：每次 fill 的路径里有且只有 1 个矩形', () => {
    const drawer = open('path-accum-title')
    pushRectWithTitle(drawer, '车')
    pushRectWithTitle(drawer, '人员')
    pushRectWithTitle(drawer, '裂缝')

    const { ctx, fills } = makePathCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    expect(fills.length).toBe(3)
    fills.forEach((filled, i) => {
      // 若路径累积，第 2 次 fill 会带上前一个框（长度 2），第 3 次长度 3
      expect({ fillIndex: i, boxCount: filled.length }).toEqual({ fillIndex: i, boxCount: 1 })
    })
  })

  it('多个文本标注：每次 fill 的路径里有且只有 1 个矩形', () => {
    const drawer = open('path-accum-text')
    const manager = (drawer as any).textManager
    manager.addTextAnnotation(50, 50, 'A')
    manager.finishEditing()
    manager.addTextAnnotation(50, 200, 'B')
    manager.finishEditing()

    const { ctx, fills } = makePathCtx()
    ;(drawer as any).renderer.drawForExport(ctx as any, new Image(), 1600, 1200)

    expect(fills.length).toBe(2)
    fills.forEach((filled, i) => {
      expect({ fillIndex: i, boxCount: filled.length }).toEqual({ fillIndex: i, boxCount: 1 })
    })
  })
})
