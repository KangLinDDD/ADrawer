# 标注变更事件（Emitter + 稳定 ID + 深拷贝快照）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Drawer 增加标注生命周期事件订阅（create/delete/update/clear/undo），载荷携带稳定 id 与深拷贝快照，修改类 API 支持 id 定位。

**Architecture:** 新增零依赖迷你 `Emitter`；`AnnotationManager` / `TextAnnotationManager` 在数据写入口通过注入的 `ChangeNotify` 回调上报变更（payload 为深拷贝快照）；`Drawer` 组合 emitter 暴露 `on`/`off`，并负责 `clear`/`undo` 事件的编排触发。所有出站数据经 `deepClone`，杜绝 Vue 响应式污染内部状态。

**Tech Stack:** TypeScript、Jest + jsdom（现有测试体系，`npx jest`）。

**Spec:** `docs/superpowers/specs/2026-08-11-annotation-change-events-design.md`

## Global Constraints

- 零新增 npm 依赖。
- 现有基于 index 的 API 签名改为 `number | string`，传 number 行为完全不变（向后兼容）。
- 凡入库的标注必须有 `id`；绘制中的临时 `operate` 对象不分配 id。
- 出站数据（事件载荷 `data`、`getAnnotations()`、`getTextAnnotations()`、`getSelectedAnnotation()`、`getSelectedTextAnnotation()`）一律深拷贝。
- 拖拽移动/缩放过程中不触发事件，只在松手（`finishMovingAnnotation` / `finishMoving`）时触发一次 `update`。
- 不改 `renderer.ts`、不改现有内部 `renderCallback` 机制。
- 测试命令：`npx jest`（全量）、`npx jest __tests__/<file> -v`（单文件）。

---

### Task 1: 类型定义与工具函数（id 字段、事件类型、deepClone、generateId）

**Files:**
- Modify: `src/modules/types.ts`
- Modify: `src/modules/utils.ts`
- Test: `__tests__/events.test.ts`（新建，本任务先放工具函数用例，后续任务继续追加）

**Interfaces:**
- Produces（后续任务依赖）:
  - `Operate<T>` 与 `TextAnnotation` 新增 `id?: string`
  - `ShapeChangePayload`、`DrawerEventMap`、`DrawerEventName`、`DrawerListener<K>`、`ChangeNotify`（types.ts）
  - `deepClone<T>(value: T): T`、`generateId(): string`（utils.ts）

- [ ] **Step 1: 写失败测试**

新建 `__tests__/events.test.ts`：

```typescript
import { deepClone, generateId } from '../src/modules/utils'

describe('deepClone', () => {
  it('返回深拷贝，修改副本不影响原对象', () => {
    const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } }
    const copy = deepClone(original)
    copy.nested.b[0] = 99
    ;(copy.nested.b[2] as { c: number }).c = 100
    expect(original.nested.b[0]).toBe(1)
    expect((original.nested.b[2] as { c: number }).c).toBe(3)
    expect(copy).toEqual(original) // 结构相等但引用不同
    expect(copy.nested).not.toBe(original.nested)
  })
})

describe('generateId', () => {
  it('生成非空字符串且两次调用不重复', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(typeof id1).toBe('string')
    expect(id1.length).toBeGreaterThan(0)
    expect(id1).not.toBe(id2)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx jest __tests__/events.test.ts -v`
Expected: FAIL（`deepClone is not a function` / 模块无导出）

- [ ] **Step 3: 实现**

`src/modules/utils.ts` 末尾追加：

```typescript
/**
 * 深拷贝（优先 structuredClone，回退 JSON 序列化）
 * 仅用于纯 JSON 安全数据（标注数据均为数字/字符串/普通对象）
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * 生成标注唯一 ID（优先 crypto.randomUUID，旧环境回退随机串）
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
```

`src/modules/types.ts` 修改：

`TextAnnotation` 类型增加 id 字段：

```typescript
/** 文本标注 */
export type TextAnnotation = {
  /** 稳定唯一 ID（入库时生成） */
  id?: string
  position: { x: number; y: number }
  text: string
  width: number
  height: number
  /** 文本标注的独立样式 */
  style?: Pick<TextStyle, 'font' | 'color' | 'backgroundColor'>
}
```

`Operate` 类型增加 id 字段：

```typescript
/** 操作记录 */
export type Operate<T extends Shape> = {
  /** 稳定唯一 ID（入库时生成；绘制中的临时对象无 id） */
  id?: string
  type: "rect" | "polygon" | "drag" | "text" | ""
  data: T[]
  status: "fullfilled" | "pending"
  style?: AnnotationStyle
  /** 标注标题 */
  title?: string
}
```

`types.ts` 末尾追加事件类型：

```typescript
/** 标注变更事件载荷（create/delete/update 共用） */
export type ShapeChangePayload =
  | { id: string; type: 'rect' | 'polygon'; index: number; data: Operate<Rect | Polygon> }
  | { id: string; type: 'text'; index: number; data: TextAnnotation }

/** Drawer 事件表 */
export type DrawerEventMap = {
  /** 新标注画完入库 */
  create: ShapeChangePayload
  /** 标注被删除 */
  delete: ShapeChangePayload
  /** 标注数据变化（移动/缩放结束、标题/文本/样式修改） */
  update: ShapeChangePayload
  /** 清空所有标注 */
  clear: undefined
  /** 撤销成功 */
  undo: undefined
}

export type DrawerEventName = keyof DrawerEventMap
export type DrawerListener<K extends DrawerEventName> = (payload: DrawerEventMap[K]) => void

/** 标注变更通知回调（manager 内部上报给 Drawer 使用） */
export type ChangeNotify = (event: 'create' | 'delete' | 'update', payload: ShapeChangePayload) => void
```

- [ ] **Step 4: 运行确认通过**

Run: `npx jest __tests__/events.test.ts -v`
Expected: PASS（2 个用例）

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx jest`
Expected: 全部 PASS（现有用例不受类型新增影响）

```bash
git add src/modules/types.ts src/modules/utils.ts __tests__/events.test.ts
git commit -m "feat: add id field, event types, deepClone and generateId utils"
```

---

### Task 2: Emitter 类

**Files:**
- Create: `src/modules/emitter.ts`
- Test: `__tests__/events.test.ts`（追加 describe）

**Interfaces:**
- Consumes: `DrawerEventMap`、`DrawerEventName`、`DrawerListener`（Task 1）
- Produces: `Emitter` 类，方法 `on` / `off` / `emit` / `clear`（Task 5 的 Drawer 使用）

- [ ] **Step 1: 写失败测试**

`__tests__/events.test.ts` 顶部 import 追加 `import { Emitter } from '../src/modules/emitter'`，文件末尾追加：

```typescript
describe('Emitter', () => {
  it('on 注册的监听能被 emit 触发并收到载荷', () => {
    const emitter = new Emitter()
    const listener = jest.fn()
    emitter.on('create', listener)
    const payload = { id: 'a', type: 'rect' as const, index: 0, data: { type: 'rect' as const, data: [], status: 'fullfilled' as const } }
    emitter.emit('create', payload)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(payload)
  })

  it('支持多个监听者；off 解绑后不再触发', () => {
    const emitter = new Emitter()
    const l1 = jest.fn()
    const l2 = jest.fn()
    emitter.on('undo', l1)
    emitter.on('undo', l2)
    emitter.emit('undo', undefined)
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(1)
    emitter.off('undo', l1)
    emitter.emit('undo', undefined)
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(2)
  })

  it('clear 清空所有监听器', () => {
    const emitter = new Emitter()
    const listener = jest.fn()
    emitter.on('clear', listener)
    emitter.clear()
    emitter.emit('clear', undefined)
    expect(listener).not.toHaveBeenCalled()
  })

  it('emit 无监听者的事件不报错', () => {
    const emitter = new Emitter()
    expect(() => emitter.emit('delete', { id: 'x', type: 'text', index: 0, data: { position: { x: 0, y: 0 }, text: '', width: 0, height: 0 } })).not.toThrow()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx jest __tests__/events.test.ts -v`
Expected: FAIL（找不到模块 `../src/modules/emitter`）

- [ ] **Step 3: 实现**

新建 `src/modules/emitter.ts`：

```typescript
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
```

- [ ] **Step 4: 运行确认通过**

Run: `npx jest __tests__/events.test.ts -v`
Expected: PASS（累计 6 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/modules/emitter.ts __tests__/events.test.ts
git commit -m "feat: add minimal Emitter class"
```

---

### Task 3: AnnotationManager 改造（id 生成、深拷贝出站、resolveIndex、变更通知）

**Files:**
- Modify: `src/modules/annotations.ts`
- Test: `__tests__/events.test.ts`（追加 describe）

**Interfaces:**
- Consumes: `deepClone`、`generateId`（Task 1）、`ChangeNotify`、`ShapeChangePayload`（Task 1）
- Produces:
  - 构造函数第 4 参 `changeCallback?: ChangeNotify`
  - `resolveIndex(ref: number | string): number`（public）
  - `notifyUpdate(index: number): void`（public，供 Drawer 程序化移动后触发 update）
  - `setTitle` / `getTitle` / `setAnnotationTitleStyle` / `setAnnotationTitlePosition` / `selectAnnotation` 首参改为 `number | string`

- [ ] **Step 1: 写失败测试**

`__tests__/events.test.ts` 顶部 import 追加：

```typescript
import { AnnotationManager } from '../src/modules/annotations'
import { ViewportManager } from '../src/modules/viewport'
import type { ShapeChangePayload } from '../src/modules/types'
import type { Rect } from '../src/modules/types'
```

文件末尾追加：

```typescript
describe('AnnotationManager 变更通知与 ID', () => {
  const createManager = () => {
    const events: { event: string; payload: ShapeChangePayload }[] = []
    const manager = new AnnotationManager(
      new ViewportManager(),
      undefined,
      undefined,
      (event, payload) => { events.push({ event, payload }) }
    )
    return { manager, events }
  }

  const drawRect = (manager: AnnotationManager) => {
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
  }

  it('矩形入库时生成 id 并触发 create，载荷含 id/type/index/data', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('create')
    const p = events[0].payload
    expect(p.type).toBe('rect')
    expect(p.index).toBe(0)
    expect(typeof p.id).toBe('string')
    expect(manager.recordList[0].id).toBe(p.id)
  })

  it('create 载荷 data 为深拷贝快照，修改不影响内部', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    const data = events[0].payload.data as { data: Rect[] }
    data.data[0].width = 9999
    expect((manager.recordList[0].data[0] as Rect).width).toBe(100)
  })

  it('过小矩形不入库、不触发 create', () => {
    const { manager, events } = createManager()
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 12, y: 12 })
    manager.finishRectDrawing()
    expect(manager.recordList).toHaveLength(0)
    expect(events).toHaveLength(0)
  })

  it('删除选中标注触发 delete，载荷 data 为被删标注快照', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    manager.selectAnnotation(0)
    manager.deleteSelectedAnnotation()
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
    expect(events[1].payload.id).toBe(events[0].payload.id)
    expect(events[1].payload.data).toBeDefined()
  })

  it('finishMovingAnnotation 触发一次 update（拖拽结束）', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    manager.selectAnnotation(0)
    manager.startMovingAnnotation({ clientX: 0, clientY: 0 } as MouseEvent)
    manager.moveSelectedAnnotation(5, 5) // 拖拽过程不触发
    expect(events.filter((e) => e.event === 'update')).toHaveLength(0)
    manager.finishMovingAnnotation()
    expect(events.filter((e) => e.event === 'update')).toHaveLength(1)
  })

  it('setTitle 支持 id 定位并触发 update；不存在的 id 返回 false', () => {
    const { manager, events } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id!
    expect(manager.setTitle(id, '标题A')).toBe(true)
    expect(manager.recordList[0].title).toBe('标题A')
    expect(events[events.length - 1].event).toBe('update')
    expect(manager.setTitle('不存在的id', 'x')).toBe(false)
    // number 入参保持原 index 行为
    expect(manager.setTitle(0, '标题B')).toBe(true)
    expect(manager.recordList[0].title).toBe('标题B')
  })

  it('selectAnnotation 支持 id 定位', () => {
    const { manager } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id!
    expect(manager.selectAnnotation(id)).toBe(true)
    expect(manager.selectedAnnotation?.index).toBe(0)
  })

  it('getAnnotations 返回深拷贝', () => {
    const { manager } = createManager()
    drawRect(manager)
    const list = manager.getAnnotations()
    ;(list[0].data[0] as Rect).width = 9999
    expect((manager.recordList[0].data[0] as Rect).width).toBe(100)
  })

  it('撤销恢复删除的标注时保留原 id', () => {
    const { manager } = createManager()
    drawRect(manager)
    const id = manager.recordList[0].id
    manager.selectAnnotation(0)
    manager.deleteSelectedAnnotation()
    manager.withdraw()
    expect(manager.recordList[0].id).toBe(id)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx jest __tests__/events.test.ts -v`
Expected: FAIL（构造函数参数数量/type 报错、`setTitle` 不接受 string 等）

- [ ] **Step 3: 实现**

`src/modules/annotations.ts` 修改：

1) import 更新：

```typescript
import type {
  Rect,
  Polygon,
  Point,
  Operate,
  SelectedAnnotation,
  ActiveHandle,
  SelectionStyle,
  ColorConfig,
  AnnotationStyle,
  LineStyle,
  VertexStyle,
  TitleStyle,
  TitlePosition,
  ChangeNotify
} from './types'
import { isPointInRect, isPointInPolygon, deepClone, generateId } from './utils'
```

2) 构造函数加第 4 参：

```typescript
constructor(
  private viewport: ViewportManager,
  private container?: HTMLElement,
  private renderCallback?: () => void,
  private changeCallback?: ChangeNotify
) {
  this.applyColorConfig()
}
```

3) 新增私有通知方法与公共辅助方法（放在 `getCurrentStyle` 之后）：

```typescript
/**
 * 上报标注变更（载荷携带深拷贝快照）
 */
private notifyChange(event: 'create' | 'delete' | 'update', index: number, annotation: Operate<Rect | Polygon>): void {
  if (!this.changeCallback || !annotation.id) return
  this.changeCallback(event, {
    id: annotation.id,
    type: annotation.type as 'rect' | 'polygon',
    index,
    data: deepClone(annotation),
  })
}

/**
 * 供 Drawer 在程序化移动后触发 update（拖拽路径由 finishMovingAnnotation 触发）
 */
notifyUpdate(index: number): void {
  const annotation = this.recordList[index]
  if (annotation) this.notifyChange('update', index, annotation)
}

/**
 * 解析标注定位参数：number 按索引，string 按 id
 */
resolveIndex(ref: number | string): number {
  if (typeof ref === 'number') return ref
  return this.recordList.findIndex((a) => a.id === ref)
}
```

4) `finishRectDrawing` —— 入库分支生成 id 并通知：

```typescript
finishRectDrawing(): boolean {
  if (!this.isDrawing || this.operate.type !== "rect") return false

  const rect = this.operate.data[0] as Rect
  // 过滤无效矩形（太小）
  if (Math.abs(rect.width) > 5 && Math.abs(rect.height) > 5) {
    // 保存当前样式到标注
    const annotationWithStyle = {
      ...this.operate,
      id: generateId(),
      style: this.getCurrentStyle()
    }
    this.recordList.push(annotationWithStyle)
    // 添加新标注后清空删除历史
    this.deleteHistory = []
    this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)
  }

  this.operate.data = []
  this.isDrawing = false
  return true
}
```

5) `finishPolygonDrawing` —— 入库分支同样处理（`>= 3` 顶点分支内）：`annotationWithStyle` 对象加 `id: generateId()`，push 后调用 `this.notifyChange('create', this.recordList.length - 1, annotationWithStyle)`。

6) `cancelDrawing` —— 保存多边形分支（`>= 2` 顶点）同样加 id 并在 push 后 notifyChange('create', ...)。

7) `deleteSelectedAnnotation` —— splice 后通知：

```typescript
deleteSelectedAnnotation(): boolean {
  if (!this.selectedAnnotation) return false

  const index = this.selectedAnnotation.index
  const annotation = this.recordList[index]

  // 保存删除的记录到历史（用于撤销）
  this.deleteHistory.push({
    annotation: { ...annotation },
    index
  })

  // 删除标注
  this.recordList.splice(index, 1)
  this.deselectAnnotation()
  this.notifyChange('delete', index, annotation)
  return true
}
```

8) `finishMovingAnnotation` —— 拖拽/缩放结束触发 update：

```typescript
finishMovingAnnotation(): void {
  const wasMovingOrResizing = this.isMovingAnnotation || this.isResizing
  this.isMovingAnnotation = false
  this.isResizing = false
  this.activeHandle = null
  this.originalRect = null
  this.originalPolygon = null

  if (wasMovingOrResizing && this.selectedAnnotation) {
    this.notifyUpdate(this.selectedAnnotation.index)
  }
}
```

9) `selectAnnotation` 首参改 `number | string`：

```typescript
selectAnnotation(ref: number | string): boolean {
  const index = this.resolveIndex(ref)
  if (index < 0 || index >= this.recordList.length) {
    this.deselectAnnotation()
    return false
  }

  const annotation = this.recordList[index]
  this.selectedAnnotation = {
    index,
    type: annotation.type as "rect" | "polygon",
  }
  return true
}
```

10) `setTitle` / `getTitle` / `setAnnotationTitleStyle` / `setAnnotationTitlePosition` 首参改 `ref: number | string`，方法体首行改为 `const index = this.resolveIndex(ref)`，越界判断不变；其中 `setTitle`、`setAnnotationTitleStyle`、`setAnnotationTitlePosition` 在成功路径末尾加 `this.notifyUpdate(index)`。

11) `finishTitleEditing` —— 标题写入成功的分支（`index` 有效且写入了 `annotation.title` 后、`resetTitleEditingState()` 之前）加 `this.notifyUpdate(index)`。

12) `getAnnotations` 与 `getSelectedAnnotation` 深拷贝：

```typescript
getAnnotations(): Operate<Rect | Polygon>[] {
  return this.recordList.map((a) => deepClone(a))
}
```

`getSelectedAnnotation` 返回的 `data: annotation as Operate<Rect | Polygon>` 改为 `data: deepClone(annotation)`。

- [ ] **Step 4: 运行确认通过**

Run: `npx jest __tests__/events.test.ts -v`
Expected: PASS（本任务 9 个用例 + 之前 6 个）

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx jest`
Expected: 全部 PASS（`setTitle` 等签名变宽为 `number | string`，现有 number 调用不受影响）

```bash
git add src/modules/annotations.ts __tests__/events.test.ts
git commit -m "feat: AnnotationManager emits change events with id and deep-cloned payload"
```

---

### Task 4: TextAnnotationManager 改造

**Files:**
- Modify: `src/modules/text-annotation.ts`
- Test: `__tests__/events.test.ts`（追加 describe）

**Interfaces:**
- Consumes: 同 Task 3
- Produces:
  - 构造函数第 5 参 `changeCallback?: ChangeNotify`
  - `resolveIndex(ref: number | string): number`（public）
  - `updateTextAnnotation` / `moveTextAnnotation` / `removeTextAnnotation` / `updateTextAnnotationStyle` 首参改为 `number | string`

- [ ] **Step 1: 写失败测试**

`__tests__/events.test.ts` 顶部 import 追加 `import { TextAnnotationManager } from '../src/modules/text-annotation'`，文件末尾追加：

```typescript
describe('TextAnnotationManager 变更通知与 ID', () => {
  const createTextManager = () => {
    const events: { event: string; payload: ShapeChangePayload }[] = []
    const container = document.createElement('div')
    document.body.appendChild(container)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const manager = new TextAnnotationManager(
      new ViewportManager(),
      container,
      ctx,
      undefined,
      (event, payload) => { events.push({ event, payload }) }
    )
    return { manager, events, container }
  }

  it('addTextAnnotation 生成 id 并触发 create（type=text）', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('create')
    expect(events[0].payload.type).toBe('text')
    expect(events[0].payload.index).toBe(0)
    expect(manager.getTextAnnotations()[0].id).toBe(events[0].payload.id)
  })

  it('create 载荷 data 为深拷贝快照', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const data = events[0].payload.data as { text: string }
    data.text = '被外部篡改'
    expect(manager.getTextAnnotations()[0].text).toBe('你好')
  })

  it('updateTextAnnotation 支持 id 定位并触发 update；不存在的 id 返回 false', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const id = manager.getTextAnnotations()[0].id!
    expect(manager.updateTextAnnotation(id, '新文本')).toBe(true)
    expect(events[events.length - 1].event).toBe('update')
    expect(manager.updateTextAnnotation('不存在的id', 'x')).toBe(false)
  })

  it('removeTextAnnotation 支持 id 定位并触发 delete', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const id = manager.getTextAnnotations()[0].id!
    expect(manager.removeTextAnnotation(id)).toBe(true)
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
    expect(events[1].payload.id).toBe(id)
  })

  it('编辑时空文本导致标注被移除会触发 delete（finishEditing 分支）', () => {
    const { manager, events } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    manager.startEditing(0)
    ;(manager as unknown as { textInput: HTMLInputElement }).textInput.value = ''
    manager.finishEditing()
    expect(manager.getTextAnnotations()).toHaveLength(0)
    expect(events.map((e) => e.event)).toEqual(['create', 'delete'])
  })

  it('getTextAnnotations 返回深拷贝', () => {
    const { manager } = createTextManager()
    manager.addTextAnnotation(10, 20, '你好')
    const list = manager.getTextAnnotations()
    list[0].text = '被外部篡改'
    expect(manager.getTextAnnotations()[0].text).toBe('你好')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx jest __tests__/events.test.ts -v`
Expected: FAIL（构造函数参数、`updateTextAnnotation` 不接受 string 等）

- [ ] **Step 3: 实现**

`src/modules/text-annotation.ts` 修改：

1) import 更新：types 导入中追加 `ChangeNotify`；utils 导入 `deepClone`、`generateId`（当前文件无 utils 导入则新增一行 `import { deepClone, generateId } from './utils'`）。

2) 构造函数加第 5 参 `private changeCallback?: ChangeNotify`。

3) 新增方法（放在 `getCurrentStyle` 之后）：

```typescript
/**
 * 上报文本标注变更（载荷携带深拷贝快照）
 */
private notifyChange(event: 'create' | 'delete' | 'update', index: number, annotation: TextAnnotation): void {
  if (!this.changeCallback || !annotation.id) return
  this.changeCallback(event, {
    id: annotation.id,
    type: 'text',
    index,
    data: deepClone(annotation),
  })
}

/**
 * 解析文本标注定位参数：number 按索引，string 按 id
 */
resolveIndex(ref: number | string): number {
  if (typeof ref === 'number') return ref
  return this.textAnnotations.findIndex((a) => a.id === ref)
}
```

4) `addTextAnnotation`：`textAnnotation` 对象字面量加 `id: generateId()`；`this.textAnnotations.push(textAnnotation)` 之后加 `this.notifyChange('create', index, textAnnotation)`。

5) `updateTextAnnotation` / `moveTextAnnotation` / `removeTextAnnotation` / `updateTextAnnotationStyle` 首参改 `ref: number | string`，方法体首行 `const index = this.resolveIndex(ref)`；成功路径末尾分别加 `this.notifyUpdate`-等价调用：`updateTextAnnotation` / `moveTextAnnotation` / `updateTextAnnotationStyle` 加 `this.notifyChange('update', index, this.textAnnotations[index])`；`removeTextAnnotation` 在 splice 后加 `this.notifyChange('delete', index, annotation)`（`annotation` 为 splice 前已捕获的变量，现已有）。

6) `deleteSelectedTextAnnotation`：splice 后加 `this.notifyChange('delete', index, annotation)`。

7) `finishEditing`：空文本删除分支，splice 前捕获 `const removed = this.textAnnotations[index]`，splice 后 `this.notifyChange('delete', index, removed)`；非空更新分支末尾 `this.notifyChange('update', index, textData)`。

8) `cancelEditing`：新空标注被移除的分支，splice 前捕获、splice 后 `this.notifyChange('delete', index, removed)`。

9) `deleteEditingAnnotation`：splice 前捕获、splice 后 `this.notifyChange('delete', index, removed)`。

10) `finishMoving`：

```typescript
finishMoving(): void {
  this.isTextMoving = false
  if (this.editingTextIndex !== null) {
    const annotation = this.textAnnotations[this.editingTextIndex]
    if (annotation) this.notifyChange('update', this.editingTextIndex, annotation)
  }
}
```

11) `getTextAnnotations` 改 `return this.textAnnotations.map((a) => deepClone(a))`；`getSelectedTextAnnotation` 返回的 `data: annotation` 改 `data: deepClone(annotation)`。

- [ ] **Step 4: 运行确认通过**

Run: `npx jest __tests__/events.test.ts -v`
Expected: PASS

- [ ] **Step 5: 全量回归 + 提交**

Run: `npx jest`
Expected: 全部 PASS

```bash
git add src/modules/text-annotation.ts __tests__/events.test.ts
git commit -m "feat: TextAnnotationManager emits change events with id and deep-cloned payload"
```

---

### Task 5: Drawer 接线（on/off、clear/undo 事件、API 签名、destroy、导出）

**Files:**
- Modify: `src/index.ts`
- Modify: `src/modules/events.ts`
- Test: `__tests__/events.test.ts`（追加 describe）

**Interfaces:**
- Consumes: `Emitter`（Task 2）、两个 manager 的新构造函数签名与 `resolveIndex`/`notifyUpdate`（Task 3/4）
- Produces（对外公开 API）:
  - `drawer.on<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void`
  - `drawer.off<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void`
  - `setAnnotationTitle` / `getAnnotationTitle` / `setAnnotationTitleStyle` / `setAnnotationTitlePosition` / `selectAnnotation` / `updateTextAnnotation` / `moveTextAnnotation` / `removeTextAnnotation` / `updateTextAnnotationStyle` 首参 `number | string`

- [ ] **Step 1: 写失败测试**

`__tests__/events.test.ts` 顶部 import 追加 `import Drawer from '../src/index'`（或 `import { Drawer } from '../src/index'`，与现有 drawer.test.ts 的导入方式保持一致），文件末尾追加：

```typescript
describe('Drawer 事件订阅', () => {
  const createDrawer = () => {
    const container = document.createElement('div')
    container.id = `drawer-test-${Math.random().toString(36).slice(2)}`
    Object.defineProperty(container, 'clientWidth', { value: 800 })
    Object.defineProperty(container, 'clientHeight', { value: 600 })
    document.body.appendChild(container)
    const drawer = new Drawer({ id: container.id, useEvents: false })
    return { drawer, container }
  }

  it('on 订阅 create，画矩形后收到事件；off 后不再收到', () => {
    const { drawer } = createDrawer()
    const listener = jest.fn()
    drawer.on('create', listener)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].type).toBe('rect')
    expect(typeof listener.mock.calls[0][0].id).toBe('string')

    drawer.off('create', listener)
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('clear() 触发 clear 事件；withdraw() 成功触发 undo 事件', () => {
    const { drawer } = createDrawer()
    const onClear = jest.fn()
    const onUndo = jest.fn()
    drawer.on('clear', onClear)
    drawer.on('undo', onUndo)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()

    drawer.withdraw()
    expect(onUndo).toHaveBeenCalledTimes(1)

    drawer.clear()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('程序化 moveSelectedAnnotation 触发一次 update', () => {
    const { drawer } = createDrawer()
    const onUpdate = jest.fn()
    drawer.on('update', onUpdate)

    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()

    drawer.selectAnnotation(0)
    drawer.moveSelectedAnnotation(5, 5)
    expect(onUpdate).toHaveBeenCalledTimes(1)
  })

  it('setAnnotationTitle 支持 id 定位', () => {
    const { drawer } = createDrawer()
    const manager = (drawer as unknown as { annotationManager: AnnotationManager }).annotationManager
    manager.startRectDrawing({ x: 10, y: 10 })
    manager.updateRectDrawing({ x: 110, y: 110 })
    manager.finishRectDrawing()
    const id = drawer.getAnnotations()[0].id!
    expect(drawer.setAnnotationTitle(id, '标题X')).toBe(true)
    expect(drawer.getAnnotationTitle(id)).toBe('标题X')
  })

  it('destroy() 后监听器被清空', () => {
    const { drawer } = createDrawer()
    const listener = jest.fn()
    drawer.on('clear', listener)
    drawer.destroy()
    drawer.clear()
    expect(listener).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx jest __tests__/events.test.ts -v`
Expected: FAIL（`drawer.on is not a function` 等）

- [ ] **Step 3: 实现**

`src/modules/events.ts`：

1) 构造函数末尾追加参数 `private notifyUndo: () => void`。
2) Ctrl+Z 分支改为：

```typescript
// 撤销操作
if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
  const undone = this.annotationManager.withdraw() || this.textManager.withdraw()
  if (undone) this.notifyUndo()
  this.renderCallback()
  return
}
```

`src/index.ts`：

1) import 追加：

```typescript
import { Emitter } from './modules/emitter'
import { deepClone } from './modules/utils'
import type { DrawerEventName, DrawerListener } from './modules/types'
```

类型导出列表（文件顶部 `export type { ... }`）追加：`DrawerEventMap`、`DrawerEventName`、`DrawerListener`、`ShapeChangePayload`、`ChangeNotify`；模块导出区追加 `export { Emitter } from './modules/emitter'`。

2) `Drawer` 类加字段 `private emitter = new Emitter()`。

3) 构造函数中 manager 实例化改为：

```typescript
this.annotationManager = new AnnotationManager(
  this.viewport,
  this.container,
  () => this.render(),
  (event, payload) => this.emitter.emit(event, payload)
)
```

```typescript
this.textManager = new TextAnnotationManager(
  this.viewport,
  this.container,
  this.ctx,
  () => this.render(),
  (event, payload) => this.emitter.emit(event, payload)
)
```

EventHandler 实例化末尾追加实参 `() => this.emitter.emit('undo', undefined)`。

4) 新增公共方法（放在 `getAnnotations` 附近）：

```typescript
/**
 * 订阅标注变更事件
 * @example
 * drawer.on('create', ({ id, type, index, data }) => console.log('新标注', id, data))
 */
public on<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void {
  this.emitter.on(event, listener)
}

/**
 * 取消订阅
 */
public off<K extends DrawerEventName>(event: K, listener: DrawerListener<K>): void {
  this.emitter.off(event, listener)
}
```

5) `clear()` 末尾（`this.render()` 后）加 `this.emitter.emit('clear', undefined)`；`clearCanvas()` 在清除标注逻辑后加 `this.emitter.emit('clear', undefined)`（`clearAnnotations()` 走 `clearCanvas`，不重复加）。

6) `withdraw()`：

```typescript
public withdraw(): void {
  const annotationWithdrawn = this.annotationManager.withdraw()
  const textWithdrawn = this.textManager.withdraw()

  if (annotationWithdrawn || textWithdrawn) {
    this.render()
    this.emitter.emit('undo', undefined)
  }
}
```

7) `moveSelectedAnnotation`：

```typescript
public moveSelectedAnnotation(dx: number, dy: number): void {
  if (this.annotationManager.moveSelectedAnnotation(dx, dy)) {
    const selected = this.annotationManager.selectedAnnotation
    if (selected) {
      this.annotationManager.notifyUpdate(selected.index)
    }
    this.render()
  }
}
```

8) 签名升级（仅改首参类型并透传，manager 内部已 resolveIndex）：
`setAnnotationTitle(index: number | string, title: string)`、`getAnnotationTitle(index: number | string)`、`setAnnotationTitleStyle(index: number | string, ...)`、`setAnnotationTitlePosition(index: number | string, ...)`、`selectAnnotation(index: number | string)`、`updateTextAnnotation(index: number | string, ...)`、`moveTextAnnotation(index: number | string, ...)`、`removeTextAnnotation(index: number | string)`、`updateTextAnnotationStyle(index: number | string, ...)`。JSDoc 中 `@param index` 改为 `@param index - 标注索引或标注 id`。

9) `destroy()` 开头加 `this.emitter.clear()`。

- [ ] **Step 4: 运行确认通过**

Run: `npx jest __tests__/events.test.ts -v`
Expected: PASS

- [ ] **Step 5: 全量回归 + 构建 + 提交**

Run: `npx jest && npx tsc --noEmit`
Expected: 全部 PASS，无类型错误

```bash
git add src/index.ts src/modules/events.ts __tests__/events.test.ts
git commit -m "feat: Drawer exposes on/off event subscription with clear/undo events"
```

---

## Self-Review 结论

- **Spec 覆盖**：emitter（Task 2/5）、五类事件与触发时机（Task 3/4/5）、深拷贝出站（Task 1/3/4）、稳定 id（Task 1/3/4）、id 定位 API（Task 3/4/5）、destroy 清理（Task 5）、测试清单（各任务 Step 1）——均有对应任务。spec 中"修改类 API 支持 id 定位"一节列出的 9 个 API 全部在 Task 5 Step 3.8 覆盖。
- **类型一致性**：`ChangeNotify`、`notifyUpdate`、`resolveIndex`、构造函数参数顺序在 Task 3/4/5 间一致；`DrawerEventMap` 等类型在 Task 1 定义、Task 2/5 消费，名称一致。
- **已知留白（有意为之）**：`update` 不携带 `previous` 快照（spec 已声明）；修改类 API 仅 `number | string` 入参，不新增独立 id 专用方法。
