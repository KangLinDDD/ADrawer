import { clampPoint, notifyShapeChange } from '../../src/modules/shapes/shared'
import { ViewportManager } from '../../src/modules/viewport'

describe('clampPoint', () => {
  it('enabled=false 原样返回', () => {
    const v = new ViewportManager(); v.setOriginalSize(800, 600)
    expect(clampPoint(v, { x: -5, y: 999 }, false)).toEqual({ x: -5, y: 999 })
  })
  it('图片未加载（0 尺寸）原样返回', () => {
    const v = new ViewportManager()
    expect(clampPoint(v, { x: -5, y: 999 }, true)).toEqual({ x: -5, y: 999 })
  })
  it('clamp 到 [0, W]x[0, H]', () => {
    const v = new ViewportManager(); v.setOriginalSize(800, 600)
    expect(clampPoint(v, { x: -5, y: 999 }, true)).toEqual({ x: 0, y: 600 })
  })
})

describe('notifyShapeChange', () => {
  it('无 cb 或 record 无 id 不调用', () => {
    const cb = jest.fn()
    notifyShapeChange(undefined, 'rect', 'create', 0, { id: 'a' })
    notifyShapeChange(cb, 'rect', 'create', 0, {})
    expect(cb).not.toHaveBeenCalled()
  })
  it('正常触发且 data 为深拷贝', () => {
    const cb = jest.fn()
    const record = { id: 'a', nested: { x: 1 } }
    notifyShapeChange(cb, 'rect', 'create', 0, record)
    expect(cb).toHaveBeenCalledTimes(1)
    const payload = cb.mock.calls[0][1]
    expect(payload).toMatchObject({ id: 'a', type: 'rect', index: 0 })
    expect(payload.data).not.toBe(record)
    expect(payload.data.nested).not.toBe(record.nested)
  })
})
