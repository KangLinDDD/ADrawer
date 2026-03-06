# Image Annotation Drawer

一个轻量级的图片标注库，基于 HTML5 Canvas，支持矩形、多边形、文本标注，以及缩放、拖拽等操作。

[A lightweight image annotation library based on HTML5 Canvas, supporting rectangles, polygons, text annotations, zoom and drag operations.]

## 功能特性

- ✅ **多种标注类型**：矩形、多边形、文本标注
- ✅ **视图操作**：鼠标滚轮缩放、拖拽平移
- ✅ **撤销功能**：支持撤销上一步操作 (Ctrl+Z)
- ✅ **快捷键**：空格键重置视图，ESC 取消当前绘制
- ✅ **图片导出**：支持导出标注后的图片（原始尺寸或当前视图）
- ✅ **TypeScript 支持**：完整的类型定义

## 安装

```bash
npm install image-annotation-drawer
```

## 快速开始

### HTML

```html
<div id="annotation-container" style="width: 800px; height: 600px;"></div>
```

### JavaScript / TypeScript

```typescript
import Drawer from 'image-annotation-drawer';

// 初始化
const drawer = new Drawer({
  id: 'annotation-container',  // 容器 ID
  drawType: 'rect',            // 默认绘制类型: 'rect' | 'polygon' | 'drag' | 'text' | ''
  useEvents: true              // 是否自动绑定事件
});

// 加载图片
drawer.drawImage('https://example.com/image.jpg');

// 切换绘制模式
drawer.setDrawType('polygon');  // 多边形模式
drawer.setDrawType('text');     // 文本标注模式
drawer.setDrawType('drag');     // 拖拽模式
```

## API 文档

### 构造函数选项

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 容器元素 ID |
| drawType | string | ❌ | 默认绘制类型 |
| useEvents | boolean | ❌ | 是否自动绑定事件，默认为 true |

### 方法

#### 绘制控制

- `setDrawType(type)` - 设置绘制模式
  - `'rect'` - 矩形标注
  - `'polygon'` - 多边形标注
  - `'text'` - 文本标注
  - `'drag'` - 拖拽模式
  - `''` - 无操作模式

#### 图片操作

- `drawImage(src: string)` - 加载背景图片
- `changeScale(zoomIn: boolean)` - 放大/缩小视图
- `clearCanvas()` - 清除画布（包括背景图片和标注）

#### 标注操作

- `clear(type?)` - 清除所有标注
- `withdraw()` - 撤销上一步操作 (Ctrl+Z)
- `getAnnotations()` - 获取所有标注数据
- `getTextAnnotations()` - 获取所有文本标注

#### 标注选中与移动（NEW ✨）

- `selectAnnotation(index)` - 选中指定索引的标注
- `deselectAnnotation()` - 取消选中
- `getSelectedAnnotation()` - 获取当前选中的标注信息
- `deleteSelectedAnnotation()` - 删除选中的标注
- `moveSelectedAnnotation(dx, dy)` - 移动选中的标注

详细交互说明见下方「标注选中与移动」章节。

#### 文本标注（已优化）

- `addTextAnnotation(x, y, text?)` - 添加文本标注（默认空文本，自动进入编辑模式）
- `updateTextAnnotation(index, text)` - 更新文本内容
- `moveTextAnnotation(index, x, y)` - 移动文本位置
- `removeTextAnnotation(index)` - 删除文本标注
- `clearTextAnnotations()` - 清除所有文本标注

#### 标注选中与移动（NEW ✨）

在无绘制模式下（`drawType: ''`），可以选中和移动已绘制的标注：

| 操作 | 说明 |
|------|------|
| 点击标注 | 选中并高亮显示（青色虚线边框 + 控制点）|
| 拖拽选中标注 | 移动标注位置 |
| 点击空白处 | 取消选中 |
| ESC | 取消选中 |
| Delete / Backspace | 删除选中的标注 |

```typescript
// 切换到选择模式
drawer.setDrawType('');

// 程序化选中标注
drawer.selectAnnotation(0); // 选中第一个标注

// 获取当前选中的标注
const selected = drawer.getSelectedAnnotation();
console.log(selected);
// { index: 0, type: 'rect', data: {...} }

// 移动选中的标注
drawer.moveSelectedAnnotation(10, 20); // 向右移动10px，向下移动20px

// 删除选中的标注
drawer.deleteSelectedAnnotation();

// 取消选中
drawer.deselectAnnotation();
```

#### 文本标注交互优化

| 操作 | 说明 |
|------|------|
| 点击空白处 | 添加新文本标注（自动进入编辑模式）|
| 点击已有文本 | 进入编辑模式（文本自动选中，方便替换）|
| Enter | 完成编辑 |
| ESC | 取消编辑，恢复原状 |
| Delete（文本为空时）| 删除该标注 |
| 清空文本后确认 | 自动删除标注（无需手动删除）|
| 输入时 | 输入框自动调整宽度适应内容 |

#### 视觉优化

- ✨ 圆角背景 + 阴影效果
- ✨ 编辑状态青色发光边框
- ✨ 选中时半透明背景高亮
- ✨ 输入框美观样式（圆角、阴影）

#### 导出功能

- `exportAnnotationImage()` - 导出原始尺寸标注图片
- `exportCurrentViewImage()` - 导出当前视图
- `base64ToFile(base64, filename)` - 将 base64 转换为 File 对象
- `static base64ToBlob(base64)` - 将 base64 转换为 Blob 对象

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+Z / Cmd+Z | 撤销 |
| Space | 重置视图 |
| ESC | 取消当前绘制 / 取消选中 / 取消文本编辑 |
| Enter | 完成文本编辑 |
| Delete / Backspace | 删除选中的标注 |

### 事件

| 事件 | 说明 |
|------|------|
| 双击 | 完成多边形绘制 / 编辑文本 |
| 滚轮 | 缩放视图 |
| 拖拽 | 平移视图（拖拽模式下）|

## 示例

### 基本使用

```typescript
import Drawer from 'image-annotation-drawer';

const drawer = new Drawer({
  id: 'container',
  drawType: 'rect'
});

drawer.drawImage('image.jpg');

// 导出标注结果
drawer.exportAnnotationImage().then(base64 => {
  console.log('标注完成:', base64);
});
```

### 文本标注

```typescript
// 添加文本标注
drawer.addTextAnnotation(100, 100, '这是一个标注');

// 获取所有文本标注
const texts = drawer.getTextAnnotations();
console.log(texts);
// [{ position: {x: 100, y: 100}, text: '这是一个标注', width: 120, height: 19 }]
```

### 导出并上传

```typescript
// 导出为 base64
const base64 = await drawer.exportAnnotationImage();

// 转换为 File 对象
const file = drawer.base64ToFile(base64, 'annotated-image.jpg');

// 或者转换为 Blob
const blob = await Drawer.base64ToBlob(base64);

// 上传到服务器
const formData = new FormData();
formData.append('file', file);
fetch('/api/upload', { method: 'POST', body: formData });
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 代码检查
npm run lint
npm run lint:fix
```

## 浏览器兼容性

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 许可证

[MIT](LICENSE)

## 贡献

欢迎提交 Issue 和 Pull Request！
