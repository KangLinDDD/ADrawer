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
  id: string;                          // 容器元素 ID（必填）
  drawType?: DrawType;                 // 默认绘制类型（默认：''）
  useEvents?: boolean;                 // 启用事件（默认：true）
  annotationColor?: string | ColorConfig;  // 标注颜色（默认：'red'）
  lineStyle?: LineStyle;               // 边线样式: 'solid' | 'dashed' | 'dotted'
  vertexStyle?: Partial<VertexStyle>;  // 顶点样式
  textStyle?: Partial<TextStyle>;      // 文本样式
  enableTitle?: boolean;               // 启用标注标题功能（默认：false）
  enableTitleEditing?: boolean;        // 是否允许双击编辑标题文字（默认：true）
  enableTitleDragging?: boolean;       // 是否允许拖拽标题框改宽/移动（默认：true）
  clampToImageBounds?: boolean;        // 绘制坐标约束在图片边界内（默认：true）
}
```

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | —（必填） | 容器元素 ID |
| `drawType` | `DrawType` | `''` | 默认绘制类型：`'rect'` / `'polygon'` / `'drag'` / `'text'` / `''` |
| `useEvents` | `boolean` | `true` | 启用鼠标/键盘事件绑定 |
| `annotationColor` | `string \| ColorConfig` | `'red'` | 标注颜色，可分别配置矩形/多边形颜色 |
| `lineStyle` | `LineStyle` | `'solid'` | 边线样式：`'solid'` / `'dashed'` / `'dotted'` |
| `vertexStyle` | `Partial<VertexStyle>` | 见 `VertexStyle` | 多边形顶点样式（大小、颜色、形状等） |
| `textStyle` | `Partial<TextStyle>` | 见 `TextStyle` | 文本标注样式（字体、颜色、背景等） |
| `enableTitle` | `boolean` | `false` | 启用标注标题功能（需显式开启） |
| `enableTitleEditing` | `boolean` | `true` | 双击已选中的标注是否弹出标题输入框。传 `false` 可让标题在界面上只读，仍可用 `setAnnotationTitle` 程序设置。需 `enableTitle: true` |
| `enableTitleDragging` | `boolean` | `true` | 选中标注后是否允许拖拽标题框：拖右边缘改宽度并实时换行、拖框体移动位置。传 `false` 可关闭该交互。需 `enableTitle: true` |
| `clampToImageBounds` | `boolean` | `true` | 绘制时将坐标约束在图片边界内（矩形/多边形/文本），避免存储负值或超界坐标；图片未加载时自动跳过，传 `false` 可关闭 |

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
drawer.selectAnnotation(index, { lock: true });  // 锁定选中：显示高亮，但禁止鼠标拖动与缩放（程序化 API 不受影响）
drawer.deselectAnnotation();
drawer.deleteSelectedAnnotation();
drawer.moveSelectedAnnotation(dx, dy);

// 导入 / 回填矩形、多边形（深拷贝、补 id/样式、按边界 clamp、自动布局标题）
const saved = drawer.setAnnotations([
  { type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 100, height: 60 }], status: 'fullfilled', title: '人脸' }
]);
const added = drawer.addAnnotation({
  type: 'polygon',
  data: [{ point: { x: 10, y: 10 } }, { point: { x: 80, y: 10 } }, { point: { x: 40, y: 80 } }],
  status: 'fullfilled'
});

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

#### 标注标题

```typescript
// 设置 / 获取
drawer.setAnnotationTitle(0, '这是一个很长的中文标题，会自动换行');
drawer.getAnnotationTitle(0);

// 全局样式 / 位置
drawer.setTitleStyle({ font: 'bold 14px Arial', paddingX: 8, paddingY: 4 });
drawer.setTitlePosition({ vertical: 'top', align: 'center' });

// 单个标注：样式 / 位置 / 手动宽度（初始显示画布像素）
drawer.setAnnotationTitleStyle(0, { color: '#FFD700' });
drawer.setAnnotationTitlePosition(0, { vertical: 'bottom', width: 160 });

// 恢复自动布局（清掉手动宽度/位置）
drawer.resetAnnotationTitleLayout(0);

// 原地修改标注坐标 / 字体 / 标题文案后强制重排
drawer.refreshTitleLayouts();
```

标题布局规则：

- **自动换行**：外置标题（上方 / 下方）最多和图片同宽，内部标题最多和标注框同宽；超出按宽度折行，中文逐字断、英文优先在空格断。
- **垂直兜底**：先放上方，放不下放下方；上下都放不下（如和图片等高的标注）放到标注内部顶边（`vertical: 'inside-top'`）。
- **不截断**：所有文字都会绘制；内部标题文字过多时会向下生长，优先保证可见。
- **手动调整**：选中标注后，拖右边缘把手改宽度（实时换行），拖框体移动位置；手动调整过的标题不再参与自动兜底，用 `resetAnnotationTitleLayout()` 恢复。
- **导入即用**：`setAnnotations()` / `addAnnotation()` / 反序列化进来的标注，会在下一次渲染时自动补算标题布局；直接改 `recordList` 的数据同理。
- 单行标题的框高与旧版本一致，现有观感不变。

> `TitlePosition.offsetX / offsetY / width` 的单位都是「初始显示比例下的画布像素」，缩放与导出时按同一倍率换算。

#### 导出
```typescript
// 导出原始尺寸
drawer.exportAnnotationImage().then(base64 => { ... });

// 导出当前视图
drawer.exportCurrentViewImage().then(base64 => { ... });

// 可选配置（两个方法都支持）：
//   type    覆盖导出格式，默认跟随底图；'jpg' 等价于 'jpeg'
//   quality 有损格式（jpeg / webp）的编码质量 0–1，默认 0.92；png 无损、忽略该值
drawer.exportAnnotationImage({ quality: 0.8 }).then(base64 => { ... }); // 文件更小
drawer.exportAnnotationImage({ type: 'png' }).then(base64 => { ... });  // 强制无损，体积更大

// 能被 canvas 真正编码的只有 3 种（规范/实现所限，不是本库的选择）：
//   image/png   永远支持；请求其它类型不被支持时也会回落到它
//   image/jpeg  所有现代浏览器
//   image/webp  Chrome 17+ / Firefox 96+ / Edge 79+；Safari（含 iOS）至今不支持编码 → 回落 PNG
// 其余格式（gif / bmp / svg / avif / jxl / tiff / heic / 非标准 image/jpg …）浏览器没有
// 编码器，一律静默回落成 PNG。因此 type 只是「请求」，真实格式请以返回的 data URL 前缀为准。

// 转换为 File
// ⚠️ 后缀请按 data URL 的实际 MIME 推断，不要写死成 .jpg：
//    导出格式跟随底图（png 底图 → image/png、jpeg 底图 → image/jpeg），
//    canvas 编码不出的格式（gif / bmp / svg）会回落成 PNG，写死后缀会与内容脱节。
const mime = /^data:(image\/[a-z0-9.+-]+)/i.exec(base64)?.[1] ?? 'image/jpeg';
const ext = mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length);
const file = drawer.base64ToFile(base64, `annotation.${ext}`);
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

// 订阅标注变更事件
drawer.on('create', ({ id, type, index, data }) => { ... }); // 新增
drawer.on('update', ({ id, type, index, data }) => { ... }); // 移动/缩放/标题/样式变化
drawer.on('delete', ({ id, type, index, data }) => { ... }); // 删除
drawer.on('load', ({ annotations }) => { ... });              // setAnnotations 批量导入
drawer.on('clear', () => { ... });                            // 清空
drawer.on('undo', () => { ... });                             // 撤销
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
