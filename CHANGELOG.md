# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.4] - 2026-10-15

### Fixed - 导出图里的标注文字过小

`drawForExport()` 把标注画在**原始图像分辨率**的离屏 canvas 上，但字号 / 线宽 / 内边距 /
圆角 / 顶点半径 / 标题间距与偏移仍然沿用**交互画布像素**常量：弹窗画布只有 ~950px 宽时
14px 的字看着正常，导出成 1920 / 4000px 原图后相对整张图只剩 0.35%~0.73%，业务页面再把
这张原图缩进 ~570px 宽的小面板显示，字形被重采样到 **1~3px**，看起来像"文本没画出来"。

- `drawForExport()` 现在按 `1 / viewport.scale` 换算所有「画布像素量」：标题字号/内边距/圆角、
  线宽、多边形顶点半径、标题间距与偏移、文本标注字号与内边距。导出图 = 当前视图的 `1/scale`
  倍放大，换算后导出结果与所见一致（WYSIWYG）。
- 文本标注背景框宽度改用**缩放后的字体重新测量**（`textMetrics.width`），不再使用按原字号
  存下的 `textData.width`。
- 顺带：新增 `parseFontSize` 统一解析字号，兼容 `bold 14px Arial` / `13.5px Arial`
  （原 `(\d+)px` 会把 `13.5px` 误解析为 `5`）。
- 仅改**导出路径**，`render()` 交互路径行为不变。

### Tests

- 新增 `__tests__/renderers/export-scaling.test.ts` 6 条：`scale = 1` 时保持原有导出行为、
  `scale = 0.5` 时字号/内边距/圆角/线宽翻倍、标题位置含 gap 与偏移换算、多边形顶点半径
  4→8、文本标注字号与背景框、`viewport.scale = 0` 退化为 1 倍且不产生 NaN。

## [1.3.3] - 2026-10-14

### Fixed - 拖拽 / 缩放后标题跑到图片外

- **操作结束时补做标题边缘自适应**：标题按「标注锚点 + 存储的 `titlePosition`」绘制，且自 1.3.1 起
  拖动/缩放过程中不再实时重算（避免标题乱跳）；因此把标注拖到或缩到贴边后，
  标题会留在图片之外，且不会自行恢复。
- 现在在 `finishMovingAnnotation()`（拖动与缩放**共同的结束钩子**）里，对当前标注补做一次
  边缘自适应，把标题拉回图内：
  - 拖动**过程**中仍不重算 —— 保持 1.3.1「拖动不乱跳」的手感，只在松手/结束时收敛
  - 仅作用于**未显式设置位置**的标题（`autoAdjustTitlePosition` 内部已判断 `titlePositionExplicit`）
  - 无标题、图片未加载时跳过
- **拖拽/缩放结束时主动重绘**：事件层只在 `mousemove` 时重绘，`mouseup` 只 emit `update` 事件，
  于是上面写回的标题位置要等到下一次 render（例如取消选中）才可见 —— 表现为
  「松手后标题没回到图内，点了别处才跳回来」。现在在结束钩子里补一次 `renderCallback()`，
  标题位置在松手当下即生效。

### Tests

- `__tests__/title-edge.test.ts` 新增 5 条：拖到顶部后标题翻转为 `bottom`、
  拖动中途不重算、显式设置过位置不被改写、缩放到贴顶后同样被拉回、
  **结束时主动重绘**（且未发生移动/缩放时不多余重绘）

## [1.3.2] - 2026-10-14

### Fixed - 移动 / 缩放已有标注时的边界约束

- **补齐 clamp 覆盖范围**：`clampToImageBounds` 此前只在「绘制入口」生效，已有标注仍可被拖到/缩到图片外；现在覆盖：
  - `moveSelectedAnnotation`（鼠标拖动与 API 调用）：按**整个形状**夹回图片内
    - 矩形：先把尺寸限制到不超过图片，再把左上角夹到 `[0, w-width] × [0, h-height]`
    - 多边形：按包围盒整体平移；比图片还大时贴左上角
  - `resizeRect`：鼠标点先经 `clampToImageBounds` 再参与计算
  - `resizePolygon`：顶点位置同样先 clamp
- 完全在图内时**不做任何改动**（保留调用方原有坐标表示，例如负宽高）
- 继续遵循 `clampToImageBounds` 构造选项（`false` 时保持旧行为）与「图片未加载则跳过」的既有约定

### Fixed - 发布产物的类型声明

- `prepublishOnly` 原先为 `build && build:types && rm -rf dist/modules dist/*.map`：
  `rollup -c` 产出的 `dist/index.d.ts` 是**自包含**的，而 `build:types`（tsc）会把它覆盖成引用
  `./modules/types` 的版本，紧接着 `rm -rf dist/modules` 又删掉被引用的文件，
  导致**已发布包的 `index.d.ts` 引用不存在的模块**，调用方拿到的 `DrawerOptions` 实际未解析
  （在 `skipLibCheck: true` 下不会报错，但类型检查与补全全失效）
- 现改为 `npm run build && rm -rf dist/*.map`

## [1.3.1] - 2026-10-09

### Added - 标注标题设置时边缘自适应

- **设置标题时按图片初始尺寸自动判断一次**：调用 `setAnnotationTitle`（API）或双击编辑完成时，若标题会超出图片边界，自动调整并写回该标注的标题位置：
  - 垂直：`top` 上方放不下翻转为 `bottom`，`bottom` 下方放不下翻转为 `top`；`inside-top` 保持标注内部、不翻转
  - 水平：按 `align` 计算后自动贴左 / 右边界，通过 `offsetX` 记录补偿（保留对齐方式）
  - `offsetX` / `offsetY` 作为基准参与计算
  - 图片未加载（`originalWidth` / `originalHeight` 为 0）时先跳过，待图片加载完成后再补做一次判断；空多边形跳过
- **显式设置优先**：通过 `setAnnotationTitlePosition` 设置过位置的标注不参与自动判断，重新设置标题也不会被覆盖
- **渲染按存储位置固定绘制**：缩放、拖动不再重算标题位置
- 抽离纯函数 `computeTitleLayout` / `computeTitleBox` / `getTitleAnchor`，**画布渲染与导出复用同一套标题布局逻辑**，同时消除 `renderer.ts` 与渲染策略中重复的锚点代码

### Changed - 构建与工程配置

- 拆分构建配置：新增 `tsconfig.build.json`（用于生成类型声明），`tsconfig.json` 专注开发与测试的类型检查（`types: ["jest","node"]`，纳入 `__tests__`）
- `build:types` 脚本改用 `tsc -p tsconfig.build.json --emitDeclarationOnly`
- ESLint 对 `__tests__/**` 放行 `no-explicit-any`（测试访问私有成员的常规做法）
- 清理源码中未使用的参数（`events.ts` 的 `handleClick`、`renderer.ts` 的 `forEach` 索引）

### Tests

- 大幅补充测试覆盖：光标交互、滚轮缩放与视图拖拽、控制点缩放、双击与键盘、渲染策略、标题编辑流程
- 新增共享测试工具 `__tests__/helpers.ts`（事件派发、Drawer + 图片创建、标注直插）
- 新增 `computeTitleLayout` / `computeTitleBox` / `getTitleAnchor` 单元测试，以及「设置标题写回位置」的 API / UI 集成测试

## [1.3.0] - 2026-08-13

### Added - 图片边界约束（clamp）

- **新增 `clampToImageBounds` 构造选项（默认 `true`）**：绘制矩形、多边形、文本标注时，坐标自动约束在图片边界内（原图像素坐标系，`[0, originalWidth] × [0, originalHeight]`），避免存储负值或超出原图尺寸的坐标
- 约束作用于绘制入口：矩形起点/拖拽更新点、多边形起点/加点/临时点、文本放置点
- 图片未加载（`originalWidth` / `originalHeight` 为 0）时自动跳过约束
- 传 `clampToImageBounds: false` 可关闭，恢复旧行为

### Added - 锁定选中 API

- **`selectAnnotation(ref, { lock: true })`**：锁定选中某标注——显示选中高亮，但禁止鼠标拖动与控制点缩放（锁定态不绘制控制点、悬停不显示 move 光标）
- 锁定态属于"本次选中"：取消选中或选中其他标注后自动失效，不随标注持久化
- 仅限制鼠标交互，程序化 API（`moveSelectedAnnotation` 等）不受影响
- 缺省参数（`selectAnnotation(ref)`）行为不变，向后兼容

### Changed - 内部架构重构（形状策略 + 注册表）

- 将矩形/多边形/文本标注的**形状特异逻辑**从单体 `annotations.ts` / `text-annotation.ts` 拆分为独立策略模块（`src/modules/shapes/`、`src/modules/renderers/`），共享状态统一收敛到 `AnnotationStore`，由 `ShapeRegistry` 按形状类型分发
- 新增形状（如星型）只需新增一个策略文件 + 一行注册，事件层与渲染层零改动
- 顺带修复：删除 3 个从未被调用的死方法、收敛两处越权直写、多边形加点双通道收敛为单通道、拆分文本标注"编辑态"与"移动态"混用的索引
- **对外公共 API 与数据格式完全不变**（`Operate` / `Rect` / `Polygon` / `TextAnnotation` / 事件载荷均保持原样）

## [1.2.0] - 2026-08-12

### Added - 标注变更事件系统

- **事件订阅 API**：
  - `on(event, listener)` / `off(event, listener)` - 订阅/取消订阅标注变更事件
  - 内置零依赖 `Emitter`，`destroy()` 时自动清空所有监听器
- **事件类型**（`DrawerEventMap`）：
  - `create` - 新标注画完入库（矩形/多边形/文本）
  - `delete` - 标注被删除
  - `update` - 标注数据变化（拖拽/缩放结束、标题/文本/样式修改、程序化移动）
  - `clear` - 清空所有标注
  - `undo` - 撤销成功（含 Ctrl+Z 快捷键路径）
- **事件载荷**（`ShapeChangePayload`）：携带 `id`、`type`、`index` 及标注数据的**深拷贝快照**，外部修改不影响内部状态
- **导出类型**：`DrawerEventMap`、`DrawerEventName`、`DrawerListener`、`ShapeChangePayload`、`ChangeNotify`

### Added - 标注稳定 ID 与按 id 定位

- **稳定唯一 ID**：标注入库时自动生成 `id`（`Operate.id` / `TextAnnotation.id`），撤销、删除、重排后仍可稳定定位
- **新增 API**：
  - `getAnnotation(ref)` - 按索引或 id 获取单个矩形/多边形标注（深拷贝快照）
  - `getTextAnnotation(ref)` - 按索引或 id 获取单个文本标注（深拷贝快照）
- **既有 API 支持 id 定位**：以下方法的参数由 `index: number` 扩展为 `ref: number | string`，向后兼容：
  - `setAnnotationTitle` / `getAnnotationTitle`
  - `setAnnotationTitleStyle` / `setAnnotationTitlePosition`
  - `selectAnnotation`
  - `updateTextAnnotation` / `moveTextAnnotation` / `removeTextAnnotation` / `updateTextAnnotationStyle`
- **`updateSelectedAnnotationStyle(ref?)` 重载**：不传参时操作当前选中标注（原有行为）；传入索引或 id 时直接更新指定标注

### Changed

- `getAnnotations()` / `getSelectedAnnotation()` 返回值改为深拷贝快照，外部修改不再影响内部状态

### Fixed

- 第三种绘制完成路径（双击结束等）入库时未清空删除历史，现与 `finishRectDrawing` / `finishPolygonDrawing` 行为一致

## [1.1.0] - 2026-08-11

### Added - 标注标题功能

- **标题能力**：
  - 矩形/多边形标注支持设置标题（画布上渲染文字 + 背景框）
  - 双击标注快速编辑标题，Enter 完成 / ESC 取消
  - `enableTitle` 选项显式开启（默认 false）
- **标题样式与位置**：
  - 字体、文字色、背景色、内边距、圆角均可配置
  - 位置支持上方 / 下方 / 内部上方，水平左中右对齐 + 像素偏移
  - 支持 rgba/hsla/8 位 hex 等任意 CSS 颜色（含透明度）
- **标题输入框 placeholder 自定义**：
  - 通过 `TitleStyle.placeholder` 配置，默认"输入标题..."
  - 修改全局 placeholder 只影响之后设置标题的标注（快照隔离）
  - 支持单个标注独立覆盖 placeholder
- **样式快照隔离**：设置标题时将当前全局样式快照存入标注，后续全局修改不影响已有标题
- **新增 API**：
  - `setAnnotationTitle(index, title)` / `getAnnotationTitle(index)` - 设置/获取标注标题
  - `setTitleStyle(style)` / `getTitleStyle()` - 全局标题样式
  - `setTitlePosition(position)` / `getTitlePosition()` - 全局标题位置
  - `setAnnotationTitleStyle(index, style)` - 单独设置某个标注的标题样式
  - `setAnnotationTitlePosition(index, position)` - 单独设置某个标注的标题位置

### Added - 标注选中与移动功能

- **选中功能**：
  - 点击标注即可选中（青色虚线边框 + 四个角控制点）
  - 支持矩形和多边形标注的选中
  - 碰撞检测（点在矩形内、射线法检测点在多边形内）
  - 支持负宽高矩形的检测（从右下往左上画的情况）
- **移动功能**：
  - 拖拽选中的标注即可移动位置
  - 实时渲染，流畅体验
- **快捷操作**：
  - Delete / Backspace - 删除选中的标注
  - ESC - 取消选中
  - 点击空白处 - 取消选中
  - 切换绘制模式自动取消选中
- **新增 API**：
  - `selectAnnotation(index)` - 选中指定索引的标注
  - `deselectAnnotation()` - 取消选中
  - `getSelectedAnnotation()` - 获取当前选中的标注
  - `deleteSelectedAnnotation()` - 删除选中的标注
  - `moveSelectedAnnotation(dx, dy)` - 移动选中的标注

### Improved - 文本标注易用性优化

- **默认空文本**：添加文本标注时默认为空字符串，不再是"双击编辑文字"
- **视觉优化**：
  - 圆角背景 + 阴影效果
  - 编辑状态青色发光边框
  - 选中时半透明背景高亮
  - 输入框美观样式（圆角、阴影、占位符）
- **快捷操作**：
  - Enter - 完成编辑
  - ESC - 取消编辑，恢复原状
  - Delete（文本为空时）- 删除标注
- **智能删除**：清空文本后确认，自动删除标注
- **自适应输入框**：输入时自动调整宽度适应内容
- **自动选中文本**：进入编辑模式时自动选中文本，方便直接替换
- **已有文本标注样式可更新**：新增 `updateTextAnnotationStyle(index, style)`，可将当前全局样式（如加粗）应用到指定文本标注，不影响全局默认和其他标注

### Fixed

- **键盘事件越界**：全局 `keydown` 处理器不再响应来自页面输入框（INPUT/TEXTAREA/SELECT/contentEditable）的按键，修复在输入框中按 Delete/Backspace 误删选中标注、按 Ctrl+Z 误撤销标注的问题

### Examples

- 示例页新增标题"占位提示"配置项（`examples/basic.html` / `basic-en.html`）
- 示例页调整文本/标题样式时，同步应用到当前选中的标注

## [1.0.0] - 2024-03-05

### Added
- Initial release
- Support for rectangle annotations
- Support for polygon annotations
- Support for text annotations
- Zoom and pan functionality
- Undo operation (Ctrl+Z)
- Export annotated images
- Keyboard shortcuts
- TypeScript support
