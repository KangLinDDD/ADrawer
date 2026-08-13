/**
 * 形状共享工具
 */
import type { Point, ChangeNotify } from '../types'
import type { ViewportManager } from '../viewport'
import { deepClone } from '../utils'

/** 将点约束到图片边界内；enabled=false 或图片未加载（0 尺寸）时原样返回 */
export function clampPoint(viewport: ViewportManager, point: Point, enabled: boolean): Point {
  if (!enabled) return point
  const { originalWidth, originalHeight } = viewport
  if (!originalWidth || !originalHeight) return point
  return {
    x: Math.max(0, Math.min(point.x, originalWidth)),
    y: Math.max(0, Math.min(point.y, originalHeight)),
  }
}

/** 统一的标注变更通知（载荷携带深拷贝快照；无 cb 或 record 无 id 时静默跳过） */
export function notifyShapeChange(
  cb: ChangeNotify | undefined,
  type: 'rect' | 'polygon' | 'text',
  event: 'create' | 'delete' | 'update',
  index: number,
  record: { id?: string }
): void {
  if (!cb || !record.id) return
  cb(event, { id: record.id, type, index, data: deepClone(record) } as Parameters<ChangeNotify>[1])
}
