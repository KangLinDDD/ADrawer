# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
