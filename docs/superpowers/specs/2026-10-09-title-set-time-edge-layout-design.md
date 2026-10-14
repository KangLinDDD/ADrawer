# 标注标题「设置时」边缘自适应 设计文档

- 日期：2026-10-09
- 状态：已确认，待实现
- 关联：本文件替代旧的「渲染时自适应」设计（渲染时自适应将被撤除）
- 相关文件：`src/modules/renderers/title-layout.ts`、`src/modules/renderer.ts`、`src/modules/annotation-store.ts`、`src/modules/types.ts`、`src/index.ts`

## 背景

此前实现的标题边缘自适应发生在**渲染时**：每帧按当前视口边界判断是否翻转/贴边。这导致缩放时标题可能在「上方/下方」之间跳变，且画布与导出、不同缩放之间判定不一致。

用户希望：**只在设置标题的那一刻判断一次**（基于图片初始显示尺寸），把结果写入标注；之后缩放、拖动都不再重算，渲染始终按存储位置绘制。

## 目标

1. 设置标题时（API `setAnnotationTitle` 与 UI 双击编辑完成）自动判断是否靠边，并把调整结果 `{vertical, align, offsetX}` 写回该标注的 `titlePosition`。
2. 渲染改为「固定位置」：不再按视口边界翻转/贴边。
3. 尊重用户显式调用 `setAnnotationTitlePosition` 设置的位置（不覆盖）。
4. 判定基准为**图片初始显示尺寸**（`viewport.initialScale`），与当前缩放、拖动无关。
5. 不改变公开 API 签名；新增内部可选标记。

## 非目标

- 不在缩放/拖动时重算标题位置。
- 不处理标题被拖动后再越界的自动重排（按用户要求，渲染固定）。
- 不改标题框尺寸计算（字体、padding、圆角）。

## 已确认决策

| 决策点 | 结论 |
| --- | --- |
| 触发时机 | 设置标题时一次（API + UI 编辑） |
| 判定基准 | 图片初始显示尺寸（`initialScale`） |
| 写回 | 写回标注的 `titlePosition` |
| 显式设置 | 尊重，不覆盖 |
| 垂直 | 翻转优先（top↔bottom），`inside-top` 不翻转 |
| 水平 | 调整 `offsetX` 贴边（保留 `align`） |
| 渲染 | 固定位置，撤除渲染时自适应 |
| 图片未加载 | 跳过自动判断 |

## 设计

### 1. `title-layout.ts`

- 新增 `computeTitleLayout(input)` → `{ x, y, vertical, align, offsetX }`：
  - `vertical` 为翻转后实际采用值；`offsetX` 为贴边补偿后的值。
- `computeTitleBox(input)` 改为其薄封装，仅返回 `{x, y}`；`bounds` 变可选，缺省 `UNBOUNDED_TITLE_BOUNDS`。
- 新增共享纯函数 `getTitleAnchor(record, viewport?)`：矩形直接取 `start/width/height`；多边形取顶点包围盒（空返回 null）；传 viewport 时换算为画布坐标。两个渲染策略类改为委托它。
- 保留 `UNBOUNDED_TITLE_BOUNDS`。

### 2. `renderer.ts`（改为固定）

- `drawAnnotationTitle` 与 `drawForExport` 都改为 `computeTitleBox({ anchor, boxWidth, boxHeight, position: titlePos })`（不传 bounds）= 固定位置。
- 移除 `TitleBounds` / 视口边界相关导入与计算。

### 3. `annotation-store.ts`

- 新增可注入字段 `measureTitleWidth?: (text: string, font: string) => number`。
- `setAnnotationTitlePosition(ref, pos)`：除写入位置外，置 `annotation.style.titlePositionExplicit = true`。
- `captureTitleStyleSnapshot(annotation)`：仅在**非显式**时覆盖 `titlePosition`（保护显式设置）。
- `setTitle` 与 `finishTitleEditing`：写入非空标题后调用私有 `autoAdjustTitlePosition(annotation, title)`。
- `autoAdjustTitlePosition`：
  1. 若 `annotation.style?.titlePositionExplicit` → 返回。
  2. 若 `viewport.originalWidth <= 0 || originalHeight <= 0` → 返回。
  3. `s = viewport.initialScale || viewport.scale || 1`。
  4. `anchorImg = getTitleAnchor(annotation)`；空（空多边形）→ 返回。
  5. 换算到初始显示坐标：`anchor = { x: anchorImg.x*s, y: anchorImg.y*s, width: anchorImg.width*s, height: anchorImg.height*s }`，`bounds = { minX:0, minY:0, maxX: imgW*s, maxY: imgH*s }`。
  6. 标题框（屏幕像素）：`font = effectiveStyle.font || '12px Arial'`，`fontSize = 解析`，`boxH = fontSize + (paddingY??3)*2`，`boxW = measure ? measure(title, font) + (paddingX??6)*2 : （水平不约束）`。
  7. `base = { ...this.titlePosition }`（全局默认，保证幂等）。
  8. 调 `computeTitleLayout`；写回 `annotation.style.titlePosition = { ...base, vertical: r.vertical, align: r.align, offsetX: r.offsetX }`。
  - 未注入 measure 时，水平不受约束（`bounds.minX=-Infinity, maxX=Infinity`），仅做垂直判断。

### 4. `types.ts`

- `AnnotationStyle` 增加可选 `titlePositionExplicit?: boolean`（内部标记）。

### 5. `index.ts`

- 构造 `annotationManager` 后注入：`this.annotationManager.measureTitleWidth = (text, font) => { this.ctx.font = font; return this.ctx.measureText(text).width }`。

### 单位说明

自动判断与写回的 `offsetX` 为**初始显示下的屏幕像素**，与渲染端「固定位置 + 屏幕像素偏移」一致；因此初始显示时标题恰好落在图片内。导出与其它缩放下不再重算。

## 测试策略（TDD）

- `title-layout`：`computeTitleLayout` 的 vertical 翻转与 offsetX 贴边；`getTitleAnchor` 矩形/多边形/空多边形；`computeTitleBox` 缺省 bounds 时等价固定位置。
- `renderer`：固定渲染（贴图片上边缘但未显式调整时仍画在上方）；导出同理。
- store/API：靠上边 `setAnnotationTitle` 后写回 bottom；靠左/右边修正 offsetX；`setAnnotationTitlePosition` 后不被覆盖；`captureTitleStyleSnapshot` 不覆盖显式位置；图片未加载跳过；UI `finishTitleEditing` 同样触发。
- 回归：现有 renderers/title/events 套件全绿。

## 验证命令

```
npx jest __tests__/renderers/title-layout.test.ts __tests__/renderers/renderer-extended.test.ts __tests__/title.test.ts
npx tsc --noEmit
```

## 风险

| 风险 | 缓解 |
| --- | --- |
| 未注入 measure 时水平不调整 | 实机由 Drawer 注入；单测可手动注入验证 |
| 显式位置被快照覆盖 | `captureTitleStyleSnapshot` 跳过显式 |
| 现有测试依赖渲染时翻转 | 更新为先设置视口尺寸再 setTitle，或断言固定位置 |
| initialScale 与导出（scale=1）差异 | 按用户要求以初始显示为准；导出按已写入结果固定绘制 |
