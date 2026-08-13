/**
 * 形状策略注册表
 * 按形状类型分发 ShapeStrategy；默认注册 rect/polygon 单例。
 * 另承载 shape/text 双轨系统的统一选中互斥与撤销编排原语（Task 6）。
 */
import type { ShapeStrategy } from './shapes/shape-strategy'
import { rectStrategy } from './shapes/rect-strategy'
import { polygonStrategy } from './shapes/polygon-strategy'
import type { AnnotationStore } from './annotation-store'
import type { TextAnnotationManager } from './shapes/text-manager'

/** 统一选中目标：shape（按索引/id，可带锁定）或 text（按索引） */
export type ExclusiveSelectTarget =
  | { kind: 'shape'; ref: number | string; locked?: boolean }
  | { kind: 'text'; index: number }

export class ShapeRegistry {
  private strategies = new Map<'rect' | 'polygon', ShapeStrategy>()

  register(s: ShapeStrategy): void {
    this.strategies.set(s.type, s)
  }

  get(type: 'rect' | 'polygon'): ShapeStrategy {
    const s = this.strategies.get(type)
    if (!s) throw new Error(`No strategy registered for shape type: ${type}`)
    return s
  }

  /**
   * 统一互斥选中：选中目标前自动取消另一方选中。
   * - target 为 shape：先 textManager.deselectTextAnnotation()，再 store.selectAnnotation(ref, { lock })
   * - target 为 text：先 store.deselectAnnotation()，再 textManager.selectTextAnnotation(index)
   * @returns 目标选中是否成功
   */
  selectShapeExclusive(
    store: AnnotationStore,
    textManager: TextAnnotationManager,
    target: ExclusiveSelectTarget
  ): boolean {
    if (target.kind === 'shape') {
      textManager.deselectTextAnnotation()
      return store.selectAnnotation(target.ref, { lock: target.locked })
    }
    store.deselectAnnotation()
    return textManager.selectTextAnnotation(target.index)
  }

  /** 双方同时取消选中 */
  deselectAll(store: AnnotationStore, textManager: TextAnnotationManager): void {
    store.deselectAnnotation()
    textManager.deselectTextAnnotation()
  }

  /** 统一撤销：store 优先，store 无可撤销时回退 textManager（保持现有顺序） */
  withdrawAll(store: AnnotationStore, textManager: TextAnnotationManager): boolean {
    return store.withdraw() || textManager.withdraw()
  }
}

/** 默认注册表：内置 rect/polygon 策略单例 */
export const defaultShapeRegistry = new ShapeRegistry()
defaultShapeRegistry.register(rectStrategy)
defaultShapeRegistry.register(polygonStrategy)
