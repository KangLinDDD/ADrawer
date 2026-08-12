# 标注变更事件（Event Emitter）设计

日期：2026-08-11
状态：已确认方案，待评审

## 背景

当前库在画完标注（矩形 mouseup 完成、多边形双击完成）后，只在内部 push 到 `recordList` 并重绘，没有任何对外通知机制，使用者只能主动调用 `getAnnotations()` 拉取。

## 目标

为 `Drawer` 增加事件订阅能力，让外部可以监听标注的增、删、改、清空、撤销。

## 方案：内置迷你 Event Emitter

新增 `src/modules/emitter.ts`（约 30 行，零依赖），`Drawer` 组合使用。

### API

```typescript
// 订阅 / 解绑
drawer.on('create', listener)
drawer.off('create', listener)

// 事件与载荷
export type DrawerEventMap = {
  /** 新标注画完入库 */
  create: { id: string; type: 'rect' | 'polygon'; index: number; data: Operate<Rect | Polygon> }
        | { id: string; type: 'text'; index: number; data: TextAnnotation }
  /** 标注被删除 */
  delete: { id: string; type: 'rect' | 'polygon'; index: number; data: Operate<Rect | Polygon> }
        | { id: string; type: 'text'; index: number; data: TextAnnotation }
  /** 标注数据变化（移动/缩放结束、标题/文本/样式修改） */
  update: { id: string; type: 'rect' | 'polygon'; index: number; data: Operate<Rect | Polygon> }
        | { id: string; type: 'text'; index: number; data: TextAnnotation }
  /** 清空所有标注 */
  clear: undefined
  /** 撤销成功 */
  undo: undefined
}

export type DrawerEventName = keyof DrawerEventMap
export type DrawerListener<K extends DrawerEventName> = (payload: DrawerEventMap[K]) => void
```

- `index` 为对应列表中的索引（rect/polygon 在 `recordList`，text 在文本标注列表），与 `getAnnotations()` / `getTextAnnotations()` 的索引语义一致。**注意：删除/撤销后 index 会漂移，跨事件定位标注请用 `id`。**
- `id` 为该标注的稳定唯一标识（见"标注稳定 ID"一节）。
- `data` 为该标注的**深拷贝快照**（见"数据出站安全"一节）。

### 标注稳定 ID

借鉴 Annotorious（UUID）与 Excalidraw（元素 id）的做法，为每条标注生成稳定唯一 ID，解决数组下标漂移问题：

1. `Operate<T>` 与 `TextAnnotation` 类型各增加可选字段 `id?: string`（类型上可选是因为绘制中的临时 `operate` 对象也是 `Operate` 类型；但**凡入库的标注必然有 id**，事件载荷与 `getAnnotations()` 返回值中 id 一定存在）。
2. 新增工具函数 `generateId()`：`crypto.randomUUID()` 优先，旧环境回退 `Math.random` 拼接。
3. 赋值时机：标注**入库时**生成——`finishRectDrawing` / `finishPolygonDrawing` / `cancelDrawing`（保存多边形分支）/ 文本标注创建。绘制过程中的临时对象不分配 id。
4. 撤销（`withdraw`）恢复标注时保留原 id（id 跟随标注本体，不重新生成）。
5. 兼容性：`id` 为新增字段，旧数据/旧调用方不受影响。
6. **修改入口纪律**：事件载荷与 getter 只提供深拷贝快照，外部不允许（也无法）直接改库内部源数据；所有修改必须走库提供的 API。

### 修改类 API 支持 id 定位

现有的 index 系修改 API 统一升级为接受 `number | string`：

- 传 `number` → 按 index 定位（保持现有行为，完全向后兼容）
- 传 `string` → 按标注 id 定位，内部先解析为当前 index 再执行；找不到则返回失败（false / undefined，与各 API 现有失败语义一致）

涉及 API：`setAnnotationTitle` / `getAnnotationTitle` / `setAnnotationTitleStyle` / `setAnnotationTitlePosition` / `selectAnnotation` / `updateTextAnnotation` / `moveTextAnnotation` / `removeTextAnnotation` / `updateTextAnnotationStyle`。

实现：在 `AnnotationManager` / `TextAnnotationManager` 内各加一个 `resolveIndex(ref: number | string): number` 私有方法，上述 API 入口统一过它。`deleteSelectedAnnotation` / `moveSelectedAnnotation` 操作的是"当前选中项"，无需 id 参数，保持不变。

### 数据出站安全（防止 Vue 响应式污染内部状态）

库内部持有的标注对象绝不直接暴露给外部，所有出站数据一律深拷贝：

1. 事件载荷中的 `data` 是深拷贝快照。外部（如 Vue `reactive()`/`ref()`）包响应式、任意修改都只影响副本，不会穿透污染 `recordList`。
2. 顺带修复存量问题：`getAnnotations()` / `getTextAnnotations()` 目前是 `[...list]` 浅拷贝，数组内对象仍是内部引用，存在同样的泄漏，一并改为返回深拷贝。

实现：新增工具函数 `deepClone`，优先 `structuredClone`，回退 `JSON.parse(JSON.stringify())`（标注数据为纯 JSON 安全结构，数据量小，性能开销可忽略）。

### 触发时机（同步触发，无防抖）

| 场景 | 事件 |
|---|---|
| 矩形 mouseup 校验通过（宽、高均 > 5）入库 | `create` |
| 多边形双击完成（顶点 ≥ 3）入库 | `create` |
| ESC 取消绘制时保存了多边形（顶点 ≥ 2） | `create` |
| 文本标注创建 | `create` |
| 删除选中标注 / 删除文本标注 | `delete` |
| 拖拽移动、缩放手柄**松手时**（移动过程中不触发） | `update` |
| `setAnnotationTitle` / 文本内容、位置、样式修改成功 | `update` |
| `clear()` / `clearCanvas()` / `clearAnnotations()` | `clear` |
| `withdraw()` 实际撤销成功 | `undo` |

### 实现要点

1. `Emitter` 类：`on` / `off` / `emit`，内部 `Map<event, Set<listener>>`。
2. `Drawer` 持有 emitter，暴露 `on` / `off` 两个公共方法（不暴露 `emit`）。
3. `Drawer` 构造时把 `emit` 函数注入 `AnnotationManager`、`TextAnnotationManager`、`EventHandler`，各模块在上述写入口调用。
4. `destroy()` 中清空所有监听器。
5. 原有内部 `renderCallback` 机制保持不变，两者互不干扰。

### 测试（`__tests__`）

- 画矩形完成触发一次 `create`，载荷 `{ id, type: 'rect', index: 0, data }`，且修改 `data` 不影响内部 `recordList`
- 多边形双击完成触发 `create`
- 同一标注的 `create`/`update`/`delete` 事件中 id 一致；撤销恢复后 id 不变
- 移动标注：mousemove 过程中不触发，mouseup 触发一次 `update`
- 删除选中标注触发 `delete`；`withdraw()` 触发 `undo`；`clear()` 触发 `clear`
- `off` 解绑后不再触发；`destroy()` 后所有监听器被清理
- `getAnnotations()` 返回深拷贝：修改返回值不影响内部状态
- id 定位：`setAnnotationTitle(id, ...)` 等 API 传字符串 id 生效；传不存在的 id 返回失败；传 number 保持原 index 行为

### 不做的事（YAGNI）

- 不做事件防抖/节流（需要的使用者自行在监听端处理）
- 不做一次性 `once` 订阅（当前无场景）
- 不用 `Object.freeze` 防篡改（冻结会妨碍库自身对标注的移动/缩放修改，且对 Proxy 包装无约束力；深拷贝快照才是正解）
