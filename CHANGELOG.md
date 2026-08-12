# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
