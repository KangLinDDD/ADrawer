# 标注标题换行与手动拖拽布局 设计文档

- 日期：2026-10-30
- 状态：已实现（v1.3.10）
- 关联：建立在 2026-10-09「标注标题设置时边缘自适应」之上
- 相关文件：`src/modules/renderers/title-layout.ts`、`src/modules/renderer.ts`、`src/modules/annotation-store.ts`、`src/modules/events.ts`、`src/modules/types.ts`、`src/index.ts`

## 背景

标题目前**不换行**：设置标题时按 `measureText(title)` 的整行宽度计算标题框，再用 `offsetX` 把它水平夹进图片。

这留下一个洞：**当标题框本身比图片还宽时**，clamp 只能把左边缘贴到图片左侧，右边仍然超出图片，交互画布上会画到图片外，导出图（画布尺寸 = 原图尺寸）里直接被裁掉，文字完全看不见。

同时，垂直方向只有「上方放不下翻到下方」一次翻转。若标注框和图片等高（上下都放不下），`autoAdjustTitlePosition` 只写回 `vertical`，渲染时仍按 `anchor.y + height + gap` 计算，标题会落到图片下方。

产品要求：

1. 标题放不下就**换行**，不能有文字跑到图片外面；
2. **不允许截断**，所有文字必须显示；
3. 用户能**拖拽标题改宽度（触发重新换行）和移动位置**。

## 目标

1. 标题框宽度永不超过图片宽度（外置）或标注框宽度（内部），超出部分换行而不是被裁。
2. 上方、下方都放不下时，标题落到标注内部顶边（`inside-top`），并把结果写回标注。
3. 不截断：所有文字参与渲染，宁可纵向生长。
4. 选中标注后可直接拖拽标题：右边缘把手改宽度并实时换行，框体拖动改位置。
5. 手动调整优先于自动布局，可重置；画布、导出、设置时三处布局一致。
6. 提供正式的导入入口 `setAnnotations` / `addAnnotation`，导入的标注与手画标注展示一致。

## 非目标

- 不提供字号拖拽（字号仍由 `setTitleStyle` / `setAnnotationTitleStyle` 控制）。
- 不处理文本标注（`TextAnnotation`）的换行。
- 不支持触摸 / 移动端拖拽。
- 不新增标题布局的撤销/重做。
- 不改变现有标题样式快照语义。

## 已确认决策

| 决策点 | 结论 |
| --- | --- |
| 是否换行 | 是，按宽度自动换行 |
| 外置标题换行宽度 | 图片宽度（初始显示画布像素） |
| 内部标题换行宽度 | 标注框宽度（初始显示画布像素） |
| 上下都放不下 | 落到标注内部顶边，写回 `vertical: 'inside-top'` |
| 是否截断 | 不截断，文字全部显示 |
| 手动控制 | 拖右边缘改宽度、拖框体移动 |
| 手动 vs 自动 | 手动调整后该标题停止自动兜底，可 API 重置 |
| API 注入的标注 | 绘制前自动补算一次布局，与手画标注一致 |
| 导入入口 | 新增 `setAnnotations` / `addAnnotation`，并接入标题布局 |
| 字号 | 不参与拖拽 |

## 设计

### 1. 坐标与单位

所有标题布局量（字号、padding、`offsetX`、`offsetY`、新增的手动宽度）统一使用**初始显示比例下的画布像素**：

```
s = initialScale > 0 ? initialScale : (scale > 0 ? scale : 1)
图片画布宽 = originalWidth * s
标注画布宽 = 标注图像宽度 * s
```

渲染时这些量**不随缩放重算**，与现有「标题位置固定、缩放不跳」的约定一致；导出时统一乘 `ratio = 1 / scale`，与现有标题偏移、间距的换算方式相同。

### 2. 纯函数：`title-layout.ts`

新增：

```ts
export type TitleTextLayout = {
  lines: string[]
  lineHeight: number
  boxWidth: number      // 含 paddingX
  boxHeight: number     // 含 paddingY
  textWidth: number     // 最宽一行（不含 padding）
}

export function wrapTitleText(
  text: string,
  maxTextWidth: number,
  measure: (text: string) => number
): string[]

export function layoutTitleText(input: {
  text: string
  font: string
  paddingX?: number
  paddingY?: number
  /** 自动模式：行内最大宽度（不含 padding）；Infinity = 不换行 */
  maxTextWidth?: number
  /** 手动模式：标题框总宽（含 padding），优先于 maxTextWidth */
  boxWidth?: number
  measure: (text: string) => number
}): TitleTextLayout
```

规则：

- `fontSize = parseFontSize(font)`，`lineHeight = Math.round(fontSize * 1.25)`。
- 手动 `boxWidth`：内宽 = `max(1, boxWidth - 2*paddingX)`，返回的 `boxWidth` 就是设定值（即使文字更窄，框也保持一致宽度）。
- 自动模式：内宽 = `maxTextWidth`，返回的 `boxWidth = 最宽行 + 2*paddingX`（贴合文字）。
- `boxHeight = fontSize + (行数 - 1) * lineHeight + 2*paddingY`。
  **单行时与现状完全一致**（`fontSize + 2*paddingY`），短标题渲染零变化。
- 换行贪心：中文逐字断行；英文优先在最近空格断行；单个单词超过内宽时按字符硬断；行尾空白裁掉，不在行首留空格。
- 空文本返回 `['']`，`boxWidth = 2*paddingX`。

同时在 `title-layout.ts` 增加一个纯helper，用于「上/下/内部」判定：

```ts
export function resolveTitleVertical(input: {
  anchor: TitleAnchor
  boxHeight: number      // 外置标题框高
  base: 'top' | 'bottom' | 'inside-top'
  gap?: number
  offsetY?: number
  bounds: TitleBounds
}): 'top' | 'bottom' | 'inside-top'
```

规则：`inside-top` 直接返回；`top` 放不下翻 `bottom`，`bottom` 放不下翻 `top`；两者都放不下返回 `inside-top`。

`computeTitleLayout` / `computeTitleBox` 签名保持不变，继续负责「给定 vertical + 框尺寸 → x/y（含贴边补偿）」。

### 3. 设置标题时的布局：`autoAdjustTitlePosition`

替换现有的单行宽高计算：

1. 跳过条件不变：无标题、`titlePositionExplicit === true`、图片未加载、`measureTitleWidth` 未注入（无 measure 时退化为现有「只做垂直判断」）。
2. 计算外置标题框（换行宽度 = 图片宽）：
   - 若 `style.titlePosition.width > 0`（手动宽度）→ 用该宽度做**精确框宽**，并 `clamp(最小宽, 图片宽)`；
   - 否则 `maxTextWidth = 图片宽 - 2*paddingX`，自动贴合。
3. 用 `resolveTitleVertical` 得到实际 vertical。上下都放不下 → `inside-top`。
4. 若为 `inside-top`，重新计算内部标题框（换行宽度 = 标注宽，或手动宽度），再取尺寸。
5. 调 `computeTitleLayout` 计算 x / 贴边 `offsetX`（bounds = 图片矩形），写回：

```ts
annotation.style.titlePosition = {
  ...globalBase,          // 幂等：从全局默认重算
  width: manualWidth,     // 仅手动宽度存在时
  vertical,
  align,
  offsetX
}
```

`offsetY` 仍取全局默认，不写回补偿值（与现状一致；渲染按 vertical + 框高重算）。

触发时机：

- `setTitle()` / `finishTitleEditing()`（已有）；
- `finishMovingAnnotation()`（已有：拖拽/缩放结束）；
- `adjustTitlePositions()`（已有：图片加载完成）；
- **新增**：`setAnnotationTitleStyle()` 修改字号 / padding 后，对未显式设置的标注重跑一次（宽度属于 `TitlePosition.width`，不在此列）。

### 4. 渲染

`drawAnnotationTitle`（交互画布）与 `drawForExport`（导出）：

1. 用 `getEffectiveTitleStyle` / `getEffectiveTitlePosition` 取样式与位置。
2. 按 vertical 选择换行宽度：
   - `inside-top` → 标注宽（初始比例）；
   - 其它 → 图片宽（初始比例）；
   - 手动 `width` 优先。
3. `layoutTitleText` 得到 `lines / lineHeight / boxWidth / boxHeight`。
4. `computeTitleBox` 取背景框左上角（不传 bounds，固定位置绘图，与现状一致）。
5. 画背景（一次 `beginPath` + `roundRect` + `fill`，保留 1.3.5 的 `beginPath` 修复）。
6. 逐行 `fillText`：`x = bgX + paddingX`，`y = bgY + paddingY + i * lineHeight`，`textAlign = left`，`textBaseline = top`。
7. 导出时所有尺寸、条数按 `ratio` 换算：字号、padding、行高、圆角、手动宽度、偏移、间距；`lines` 用缩放后的字体重新计算，保证折行结果与画布一致。

### 5. 选中态标题框（交互提示）

当标注被选中且 `titleDraggable` 为真、且有标题时，在标题绘制完成后叠加：

- 1px 虚线边框（`selectionStyle.strokeColor`）；
- 右边缘中点一个 `6 × 20` 画布像素的实心把手（同上颜色）；
- 这些装饰**不导出**。

未选中时不画把手；但**悬停 / 点击标题仍然有效**（见交互），避免“看不到把手就点不中”。

### 6. 交互

新增命中检测（`AnnotationManager`）：

```ts
getTitleBoxRect(index: number): { x, y, width, height } | null
hitTestTitle(canvasX: number, canvasY: number): {
  index: number
  part: 'handle' | 'body'
} | null
```

- 盒子计算必须与渲染共用 `layoutTitleText` + `computeTitleBox`，避免“看到的位置点不中”。
- 从最后绘制的标注往前遍历，命中即返回。
- `handle` 判定：右边缘向内 8px、垂直方向在框高内。
- `selectedAnnotation.locked === true` 时只返回命中用于选中提示，不允许拖动。

事件层接入：

| 事件 | 行为 |
| --- | --- |
| `mousedown` | 最优先命中标题：命中已选中标注的 `handle` → 开始改宽；命中 `body` → 开始移动；命中未选中标注 → 选中该标注并返回（不绘制新形状） |
| `mousemove` | 拖拽中：换算增量并实时改 `width` / `offsetX` / `offsetY`，重绘；未拖拽：更新光标（handle → `ew-resize`，body → `move`，未选中 → `pointer`） |
| `mouseup` | 结束拖拽：写回并 emit `update`、重绘；置 `justFinishedMove` 防止触发 click |
| `mouseleave` | 视同 `mouseup` |
| `dblclick` | 命中标题框时进入文字编辑（优先于“双击标注框”）；`titleEditable` 为假时跳过 |
| `click` | 拖拽结束后的 click 跳过（加入 `isDraggingTitle` 守卫） |

拖拽数学（画布像素 1:1，保证光标跟手）：

```
offsetX' = startOffsetX + dx
offsetY' = startOffsetY + dy
width'   = startWidth + dx
```

- 标题框尺寸本身就是画布像素、不随缩放变，因此位移不做倍率换算，把手/框体与光标 1:1；
- 移动/改宽后，在**初始显示比例的图片矩形**里 clamp 盒子，再反推 `offsetX/offsetY`：
  初始视图下合法 ⇒ 任意放大后也合法（图片只会更大）。
- 宽度下限：`max(fontSize + 2*paddingX, 20)`；上限：图片宽。
- 拖动过程中**不**改 `vertical`；位移 < 3px 视为点击，不标记显式、不吞掉双击。
- 首次发生实际位移（≥ 3px）时置 `titlePositionExplicit = true`（移动与改宽都算），此后不再自动兜底。
- 真实拖拽结束后的 click 会被丢弃并重置双击计数（`suppressClick`）：
  否则连续两次拖拽（间隔 < 300ms）会被浏览器的 click 合成逻辑误判成双击，意外弹出标题编辑框。
- 拖拽结束（移动）或拖拽过程中（改宽）按新尺寸重排；`mouseup` 时 emit `update`。

### 7. 数据模型与 API

`TitlePosition` 新增：

```ts
/** 手动标题框宽度（初始显示比例的画布像素）；缺省为自动贴合文字 */
width?: number
```

`DrawerOptions` 新增：

```ts
/** 是否允许用户拖拽标题框（移动 + 改宽，默认 true；需 enableTitle: true） */
enableTitleDragging?: boolean
```

`Drawer` 新增：

```ts
/** 清除手动宽度/位置，恢复自动换行与自动上下/内部兜底 */
resetAnnotationTitleLayout(ref: number | string): boolean
```

`setAnnotationTitleStyle()` 修改字号/padding 后，对未显式设置的标注重跑自动布局（宽度由 `TitlePosition.width` 控制，不走样式）。
`setAnnotationTitlePosition(ref, { width })` 可直接程序化设定宽度（同时会被视为显式布局，不参与自动兜底）。

### 8. 外部数据 / API 设置的标注

**问题**：自动布局目前只在三个入口触发——`setTitle()` / `finishTitleEditing()`、`finishMovingAnnotation()`、`drawImage()` 的 `adjustTitlePositions()`。如果业务方不是画出来的，而是把标注对象（带 `title` / `style`）直接塞进 `recordList` 或反序列化回来，标题不会经过自动布局：`vertical` 保持全局默认 `top`、`offsetX` 为 0，长标题/等高标注仍然会画到图片外。

**方案：绘制前保证布局已计算一次（lazy ensure）**

在 `AnnotationStore` 增加：

```ts
/** 对所有「有标题、未显式设置位置、尚未布局过」的标注补算一次布局（图片未加载时跳过） */
public ensureTitleLayouts(): void

/** 图片切换/清空时丢弃缓存 */
private titleLayoutSynced = new WeakSet<Operate<Rect | Polygon>>()
```

- `Renderer.render()` 与 `Renderer.drawForExport()` 开头调用 `ensureTitleLayouts()`；
- 以标注对象引用为 key 的 `WeakSet` 记录已布局，**每个标注只算一次**，不会在缩放/拖动时每帧重算（保持现有「标题位置固定」的行为）；
- 未显式设置位置、且图片已加载 → 调用 `autoAdjustTitlePosition()`；
- 显式位置（`titlePositionExplicit: true`）跳过，但仍参与换行；
- `drawImage()` / `clear()` 时重建 `WeakSet`，保证换图片后按新图尺寸重算；
- 这样**手画标注、API 注入标注、反序列化标注、先有标注后加载图片**，显示结果完全一致；拖拽/改宽/重置对它们同样生效。

**公开 API**：`drawer.refreshTitleLayouts(): void`

- 强制清空缓存并对所有未显式设置的标题重算 + 重绘；
- 用于业务方**原地修改**了标注坐标 / 字体 / 标题文字后没有走 `setTitle()` 的场景；
- `enableTitle` 从 false 切到 true 时，下一次 render 的 ensure 会自动补算，也可以主动调用它。

**约定**：

- API 注入的标注如果希望保持自己的位置，传 `titlePositionExplicit: true`（此时只换行，不自动上下/内部兜底）；
- API 注入的标注可以带 `titlePosition.width` 指定手动宽度，行为与拖拽设置一致；
- 不需要业务方在每次注入后手动调用 ensure——下一次 `render` 自动完成；`refreshTitleLayouts()` 只是“原地改数据”的显式兜底。

### 9. 导入 API：`setAnnotations` / `addAnnotation`

当前矩形/多边形只能鼠标画，没有对外入口。新增：

```ts
// 整体替换（导入 / 回填 / 反序列化）；批量只重绘一次
setAnnotations(annotations: Operate<Rect | Polygon>[]): Operate<Rect | Polygon>[]

// 追加一条；返回带 id 的落库快照
addAnnotation(annotation: Operate<Rect | Polygon>): Operate<Rect | Polygon> | null
```

归一化规则（两者共用）：

| 项目 | 规则 |
| --- | --- |
| 入参 | 深拷贝，不修改业务对象 |
| `type` | 只接受 `rect` / `polygon`，其余跳过 |
| 几何 | `rect` 需要 `data[0]` 且坐标有限；`polygon` 至少 3 个有限顶点 |
| `id` | 字符串且在当前列表内唯一则保留（与后端对齐）；缺失/重复则 `generateId()` |
| `status` | 未传或非法 → `'fullfilled'` |
| `style` | `{ ...getCurrentStyle(), ...annotation.style }`，保留 `titleStyle` / `titlePosition` |
| 边界 | `clampToImageBounds` 为真且图片已加载时调用 `clampRecordToImageBounds` |
| 标题 | 保留 `title`；布局由 `ensureTitleLayouts()` 在随后的 render 中补齐 |

行为：

- `setAnnotations`：清空选中与删除历史 → 替换 `recordList` → 重绘一次 → emit **新增**的 `load` 事件；
- `addAnnotation`：追加 → 清删除历史 → 重绘 → emit `create`（payload 与鼠标画完一致）；
- 两者都返回落库后的深拷贝快照（带最终 id），业务方可直接用于回填映射；
- `load` 事件载荷：`{ annotations: Operate<Rect | Polygon>[] }`（深拷贝快照），加入 `DrawerEventMap`。

### 10. 边界情况

| 情况 | 行为 |
| --- | --- |
| 标题比图片宽 | 按图片宽换行，全部文字显示 |
| 标注和图片等高 | `inside-top`，标题在标注内顶部 |
| 标注很窄、长标题 | 内部按标注宽换行；纵向全部显示（允许超出标注高度，仍尽量留在图片内） |
| 内部文字多到超过图片高 | 文字全部绘制；位置 clamp 到图片内（极端情况仍可能溢出，属于画布物理上限） |
| 手动宽度小于一个字符 | 宽度下限兜底，单字可能轻微超出框，但不裁字 |
| 手动拖出图片 | 实时 clamp 回图片内 |
| `titleDraggable: false` | 不画把手、不命中标题，行为与 1.3.9 一致 |
| 锁定标注 | 不可拖动标题 |
| 图片未加载 | 自动布局跳过；渲染不换行（宽度上限按 Infinity 处理） |
| API 注入（图片已加载） | 下次 render/export 前补算布局，与手画标注一致 |
| API 注入（图片未加载） | 图片 onload 后由 `adjustTitlePositions()` 补算 |
| API 注入且显式位置 | 保留位置，只参与换行 |
| 原地修改坐标/字体/标题 | 调 `drawer.refreshTitleLayouts()` 强制重算 |

## 测试策略（TDD）

1. `title-layout` 纯函数：
   - 放得下不换行；中文逐字换行；英文按空格；超长单词硬断；
   - 手动宽度精确生效；单行 `boxHeight` 与旧值一致；行高；
   - `resolveTitleVertical` 的 top/bottom/inside 判定（含 offsetY）。
2. 设置时布局：
   - 超宽标题写回后盒子在图片内；和图片等高 → `inside-top`；
   - 内部标题每行宽度 ≤ 标注宽；文字全部保留（无空格中文标题 `lines.join('')` 等于原文；英文只允许在空格处断行并裁掉行首尾空格）；
   - 手动 `width` 生效；`setAnnotationTitleStyle` 改字号后重新贴合；
   - `resetAnnotationTitleLayout` 恢复自动。
3. 渲染：
   - spy `fillText`：长标题多行、每行在图片内；等高标注画在标注内部；
   - 导出多行、宽高按 `ratio` 换算、不越界。
4. 交互：
   - 命中 handle/body；拖动移动后 `offsetX/offsetY` 与显式标记正确；
   - 拖出图片被 clamp；改宽后行数变化且实时重绘；
   - 未选中点击标题只选中、不移动；`dblclick` 进入编辑；
   - `enableTitleDragging: false` 与锁定标注不响应。
5. API / 外部数据：
   - 直接 push 带 title 的标注（图片已加载）→ 下次 render 自动得到 `top/inside-top`、`offsetX`，与 `setAnnotationTitle` 结果一致；
   - 图片加载前 push → onload 后补算；
   - `titlePositionExplicit: true` 不被改写；
   - 换图片后重新按新尺寸布局；
   - `refreshTitleLayouts()` 对原地改数据生效且不重复布局（WeakSet 只算一次）。
6. 导入 API：
   - `setAnnotations` 深拷贝、保留唯一 id / 补 id、补 status/style、clamp、替换后只重绘一次、emit `load`；
   - 非法条目被跳过并返回有效条目；
   - `addAnnotation` 返回带 id 的快照、emit `create`、追加索引正确；
   - 导入带 `title` 且标注和图片等高 → render 后 `inside-top`，长标题换行不越界；
   - `setAnnotations` 清空选中与删除历史。
7. 回归：`npx jest` 全量；`npx tsc --noEmit`；`npx eslint --ext .ts src/`。

## 验证命令

```bash
npx jest
npx tsc --noEmit
npx eslint --ext .ts src/
```

## 风险

| 风险 | 缓解 |
| --- | --- |
| 标题命中与形状拖拽冲突 | 标题优先；未选中标注只选中不拖拽；锁定态禁用 |
| 内部标题遮挡标注 | 只在选中时显示把手；标注仍可从边框/其他区域拖动 |
| 缩放后手动标题相对标注漂移 | 偏移/宽度按画布像素 1:1 存储，clamp 用初始显示比例的图片矩形；手动位置属于屏幕空间，缩放后可用 reset 恢复自动 |
| 折行在画布与导出不一致 | 两端共用 `layoutTitleText`；导出按同一套倍率换算后重算 |
| 长文本折行性能 | 按字符宽度累加断行（O(n)），每行结束后再精确测量一次 |
| 默认开启拖拽改变既有交互 | 仅在 `enableTitle: true` 且命中标题时生效；提供 `enableTitleDragging: false` 关闭 |
