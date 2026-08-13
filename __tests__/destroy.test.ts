/**
 * Drawer.destroy() 生命周期清理测试
 * 验证销毁实例后，挂在 document 上的全局 keydown 监听被正确移除，
 * 不再响应全局按键（修复既有 bug：多实例时已销毁实例仍广播响应按键）。
 */

import Drawer from '../src/index'

function dispatchKey(key: string) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

async function createDrawer(id: string) {
  const container = document.createElement('div')
  container.id = id
  container.style.width = '800px'
  container.style.height = '600px'
  Object.defineProperty(container, 'clientWidth', { value: 800 })
  Object.defineProperty(container, 'clientHeight', { value: 600 })
  document.body.appendChild(container)
  const drawer = new Drawer({ id, useEvents: true })
  return { drawer, container }
}

describe('Drawer.destroy 资源清理', () => {
  afterEach(() => {
    // 清理测试残留的容器节点
    document.querySelectorAll('div[id^="destroy-"]').forEach((el) => el.remove())
  })

  it('destroy 后移除 document keydown 监听，不再响应全局按键', async () => {
    const d1 = await createDrawer('destroy-1')
    const d2 = await createDrawer('destroy-2')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy1 = jest.spyOn((d1.drawer as any).eventHandler, 'handleKeyDown')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spy2 = jest.spyOn((d2.drawer as any).eventHandler, 'handleKeyDown')

    d1.drawer.destroy()

    dispatchKey('Delete')

    // 已销毁实例的 handler 不应再被调用；存活实例的应正常响应
    expect(spy1).not.toHaveBeenCalled()
    expect(spy2).toHaveBeenCalledTimes(1)

    spy1.mockRestore()
    spy2.mockRestore()
    d2.drawer.destroy()
  })
})
