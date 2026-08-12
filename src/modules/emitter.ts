/**
 * 迷你事件发射器（零依赖）
 * 供 Drawer 对外提供 on/off 订阅能力
 */

import type { DrawerEventMap, DrawerEventName, DrawerListener } from './types'

export class Emitter {
  private listeners = new Map<DrawerEventName, Set<DrawerListener<DrawerEventName>>>()

  on<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as DrawerListener<DrawerEventName>)
  }

  off<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void {
    this.listeners.get(event)?.delete(listener as DrawerListener<DrawerEventName>)
  }

  emit<K extends DrawerEventName>(event: K, payload: DrawerEventMap[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload))
  }

  /** 清空所有监听器（destroy 时调用） */
  clear(): void {
    this.listeners.clear()
  }
}
