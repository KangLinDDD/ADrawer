# Image Annotation Drawer

> 轻量级、零依赖的网页图片标注库

[English](./README.md) | [中文](./README.zh-CN.md)

[![npm version](https://badge.fury.io/js/image-annotation-drawer.svg)](https://www.npmjs.com/package/image-annotation-drawer)
[![Build Status](https://github.com/KangLinDDD/ADrawer/workflows/Test/badge.svg)](https://github.com/KangLinDDD/ADrawer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 功能特性

- 🎨 **多种标注类型**：矩形、多边形、文本标注
- 🔍 **视口操作**：鼠标滚轮缩放、拖拽平移
- 🎯 **选中与编辑**：选择、移动、调整大小、删除标注
- 🎨 **独立样式**：每个标注可拥有独立样式
- ↩️ **撤销/重做**：支持撤销操作
- 💾 **导出功能**：导出原始尺寸或当前视图的标注图片
- ⌨️ **键盘快捷键**：空格重置视图、ESC 取消、Delete 删除
- 📱 **TypeScript**：完整的类型支持
- 🪶 **零依赖**：轻量级，无外部依赖

## 安装

```bash
npm install image-annotation-drawer
```

```bash
yarn add image-annotation-drawer
```

```bash
pnpm add image-annotation-drawer
```

## 快速开始

### 基础用法

```typescript
import Drawer from 'image-annotation-drawer';

// 初始化
const drawer = new Drawer({
  id: 'container',        // 容器元素 ID
  drawType: 'rect',       // 默认绘制类型: 'rect' | 'polygon' | 'drag' | 'text' | ''
  useEvents: true,        // 启用鼠标/键盘事件
});

// 加载图片
drawer.drawImage('https://example.com/image.jpg');

// 程序化添加文本标注
drawer.addTextAnnotation(100, 100, 'Hello World');

// 获取所有标注
const annotations = drawer.getAnnotations();
const textAnnotations = drawer.getTextAnnotations();

// 导出
drawer.exportAnnotationImage().then(base64 => {
  console.log(base64); // data:image/jpeg;base64,...
});
```

### HTML 设置

```html
<div id="container" style="width: 800px; height: 600px;"></div>
```

## API 参考

### 构造选项

```typescript
interface DrawerOptions {
  id: string;                    // 容器元素 ID（必填）
  drawType?: DrawType;           // 默认绘制类型
  useEvents?: boolean;           // 启用事件（默认：true）
  annotationColor?: string | ColorConfig;  // 标注颜色
  lineStyle?: LineStyle;         // 边线样式: 'solid' | 'dashed' | 'dotted'
  vertexStyle?: Partial<VertexStyle>;      // 顶点样式
  textStyle?: Partial<TextStyle>;          // 文本样式
}
```

### 绘制类型

| 类型 | 说明 |
|------|------|
| `'rect'` | 绘制矩形 |
| `'polygon'` | 绘制多边形（单击添加顶点，双击完成） |
| `'drag'` | 拖拽平移图片 |
| `'text'` | 单击添加文本标注 |
| `''` | 默认模式（选择） |

### 方法

#### 绘制类型
```typescript
drawer.setDrawType('rect');           // 切换绘制类型
```

#### 图片操作
```typescript
drawer.drawImage('image.jpg');        // 加载图片
drawer.changeScale(true);             // 放大
drawer.changeScale(false);            // 缩小
```

#### 标注操作
```typescript
// 文本标注
drawer.addTextAnnotation(x, y, text);
drawer.updateTextAnnotation(index, text);
drawer.moveTextAnnotation(index, x, y);
drawer.removeTextAnnotation(index);
drawer.clearTextAnnotations();

// 选中操作
drawer.selectAnnotation(index);
drawer.deselectAnnotation();
drawer.deleteSelectedAnnotation();
drawer.moveSelectedAnnotation(dx, dy);

// 获取数据
const annotations = drawer.getAnnotations();
const textAnnotations = drawer.getTextAnnotations();
const selected = drawer.getSelectedAnnotation();
```

#### 样式设置
```typescript
// 标注颜色
drawer.setAnnotationColor('#FF0000');
drawer.setAnnotationColor({
  rect: '#FF0000',
  polygon: '#00FF00',
  default: '#0000FF'
});

// 边线样式
drawer.setLineStyle('dashed');  // 'solid' | 'dashed' | 'dotted'

// 顶点样式
drawer.setVertexStyle({
  size: 8,
  fillColor: '#FF0000',
  strokeColor: '#FFFFFF',
  strokeWidth: 2,
  shape: 'circle'  // 'circle' | 'square' | 'diamond'
});

// 文本样式
drawer.setTextStyle({
  font: '16px Arial',
  color: '#FFD700',
  backgroundColor: 'rgba(0,0,0,0.6)',
  padding: 6
});

// 更新选中标注的样式
drawer.updateSelectedAnnotationStyle();
```

#### 导出
```typescript
// 导出原始尺寸
drawer.exportAnnotationImage().then(base64 => { ... });

// 导出当前视图
drawer.exportCurrentViewImage().then(base64 => { ... });

// 转换为 File
const file = drawer.base64ToFile(base64, 'annotation.jpg');
```

#### 清除与撤销
```typescript
drawer.clear();                    // 清除所有，绘制类型设为 ''
drawer.clear('rect');             // 清除所有，绘制类型设为 'rect'
drawer.clearCanvas();             // 清除所有包括图片
drawer.clearAnnotations();        // 仅清除标注，保留图片
drawer.withdraw();                // 撤销上一步操作
```

#### 销毁
```typescript
drawer.destroy();                  // 清理资源
```

### 键盘快捷键

| 按键 | 功能 |
|-----|------|
| `空格` | 重置视图到初始状态 |
| `ESC` | 取消当前绘制 / 取消选中 |
| `Delete` / `Backspace` | 删除选中的标注 |
| `Ctrl+Z` | 撤销删除（针对文本标注） |

## 高级用法

### 每个标注独立样式

```typescript
// 设置全局样式（影响新标注）
drawer.setAnnotationColor('#00FF00');
drawer.setLineStyle('dashed');

// 添加标注 - 会使用当前全局样式
drawer.setDrawType('rect');
// ... 绘制矩形 ...

// 更改样式 - 只影响后续标注
drawer.setAnnotationColor('#FF0000');
drawer.setLineStyle('solid');

// 更新已有标注的样式：
drawer.selectAnnotation(0);
drawer.setAnnotationColor('#0000FF');
drawer.updateSelectedAnnotationStyle();  // 保存样式到选中的标注
```

### 事件处理

```typescript
// 禁用默认事件，手动处理
const drawer = new Drawer({
  id: 'container',
  useEvents: false  // 禁用默认事件绑定
});

// 需要时手动添加事件
drawer.addEventListeners();
```

### TypeScript 支持

```typescript
import Drawer, { 
  Rect, 
  Polygon, 
  TextAnnotation,
  DrawerOptions,
  VertexStyle 
} from 'image-annotation-drawer';

const options: DrawerOptions = {
  id: 'container',
  drawType: 'rect',
  vertexStyle: {
    size: 10,
    shape: 'diamond'
  } as Partial<VertexStyle>
};

const drawer = new Drawer(options);
```

## 浏览器支持

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 示例

- **在线演示 (中文)**: https://kanglinddd.github.io/ADrawer/zh.html
- **Live Demo (English)**: https://kanglinddd.github.io/ADrawer/
- **源码**: 查看 `examples/` 目录获取完整的工作示例。

## 参与贡献

欢迎提交 Pull Request！

1. Fork 本仓库 (https://github.com/KangLinDDD/ADrawer/fork)
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request (https://github.com/KangLinDDD/ADrawer/pulls)

## 开源协议

本项目采用 MIT 协议 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解版本历史。
