# Image Annotation Drawer

> A lightweight, dependency-free image annotation library for the web

[English](./README.md) | [中文](./README.zh-CN.md)

[![npm version](https://badge.fury.io/js/image-annotation-drawer.svg)](https://www.npmjs.com/package/image-annotation-drawer)
[![Build Status](https://github.com/KangLinDDD/ADrawer/workflows/Test/badge.svg)](https://github.com/KangLinDDD/ADrawer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🎨 **Multiple Annotation Types**: Rectangle, Polygon, Text annotations
- 🔍 **Viewport Operations**: Mouse wheel zoom, drag to pan
- 🎯 **Selection & Editing**: Select, move, resize, delete annotations
- 🎨 **Independent Styling**: Each annotation can have its own style
- ↩️ **Undo/Redo**: Support for withdrawing operations
- 💾 **Export**: Export annotated images in original or current view
- ⌨️ **Keyboard Shortcuts**: Space to reset view, ESC to cancel, Delete to remove
- 📱 **TypeScript**: Full type support
- 🪶 **Zero Dependencies**: Lightweight, no external dependencies

## Installation

```bash
npm install image-annotation-drawer
```

```bash
yarn add image-annotation-drawer
```

```bash
pnpm add image-annotation-drawer
```

## Quick Start

### Basic Usage

```typescript
import Drawer from 'image-annotation-drawer';

// Initialize
const drawer = new Drawer({
  id: 'container',        // Container element ID
  drawType: 'rect',       // Default draw type: 'rect' | 'polygon' | 'drag' | 'text' | ''
  useEvents: true,        // Enable mouse/keyboard events
});

// Load image
drawer.drawImage('https://example.com/image.jpg');

// Add text annotation programmatically
drawer.addTextAnnotation(100, 100, 'Hello World');

// Get all annotations
const annotations = drawer.getAnnotations();
const textAnnotations = drawer.getTextAnnotations();

// Export
drawer.exportAnnotationImage().then(base64 => {
  console.log(base64); // data:image/jpeg;base64,...
});
```

### HTML Setup

```html
<div id="container" style="width: 800px; height: 600px;"></div>
```

## API Reference

### Constructor Options

```typescript
interface DrawerOptions {
  id: string;                          // Container element ID (required)
  drawType?: DrawType;                 // Default draw type (default: '')
  useEvents?: boolean;                 // Enable events (default: true)
  annotationColor?: string | ColorConfig;  // Annotation colors (default: 'red')
  lineStyle?: LineStyle;               // Line style: 'solid' | 'dashed' | 'dotted'
  vertexStyle?: Partial<VertexStyle>;  // Vertex style
  textStyle?: Partial<TextStyle>;      // Text style
  enableTitle?: boolean;               // Enable annotation titles (default: false)
  clampToImageBounds?: boolean;        // Clamp drawing coords to image bounds (default: true)
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | — (required) | Container element ID |
| `drawType` | `DrawType` | `''` | Default draw type: `'rect'` / `'polygon'` / `'drag'` / `'text'` / `''` |
| `useEvents` | `boolean` | `true` | Enable mouse/keyboard event bindings |
| `annotationColor` | `string \| ColorConfig` | `'red'` | Annotation colors; rect/polygon can be configured separately |
| `lineStyle` | `LineStyle` | `'solid'` | Line style: `'solid'` / `'dashed'` / `'dotted'` |
| `vertexStyle` | `Partial<VertexStyle>` | See `VertexStyle` | Polygon vertex style (size, colors, shape, etc.) |
| `textStyle` | `Partial<TextStyle>` | See `TextStyle` | Text annotation style (font, color, background, etc.) |
| `enableTitle` | `boolean` | `false` | Enable annotation title feature (must be explicitly enabled) |
| `clampToImageBounds` | `boolean` | `true` | Clamp drawing coordinates (rect/polygon/text) to the image bounds, preventing negative or out-of-range stored coordinates; automatically skipped before the image is loaded. Set `false` to disable |

### Draw Types

| Type | Description |
|------|-------------|
| `'rect'` | Draw rectangles |
| `'polygon'` | Draw polygons (click to add points, double-click to finish) |
| `'drag'` | Drag to pan the image |
| `'text'` | Click to add text annotations |
| `''` | Default mode (selection) |

### Methods

#### Draw Type
```typescript
drawer.setDrawType('rect');           // Switch draw type
```

#### Image
```typescript
drawer.drawImage('image.jpg');        // Load image
drawer.changeScale(true);             // Zoom in
drawer.changeScale(false);            // Zoom out
```

#### Annotations
```typescript
// Text annotations
drawer.addTextAnnotation(x, y, text);
drawer.updateTextAnnotation(index, text);
drawer.moveTextAnnotation(index, x, y);
drawer.removeTextAnnotation(index);
drawer.clearTextAnnotations();

// Selection
drawer.selectAnnotation(index);
drawer.deselectAnnotation();
drawer.deleteSelectedAnnotation();
drawer.moveSelectedAnnotation(dx, dy);

// Get data
const annotations = drawer.getAnnotations();
const textAnnotations = drawer.getTextAnnotations();
const selected = drawer.getSelectedAnnotation();
```

#### Styling
```typescript
// Annotation colors
drawer.setAnnotationColor('#FF0000');
drawer.setAnnotationColor({
  rect: '#FF0000',
  polygon: '#00FF00',
  default: '#0000FF'
});

// Line style
drawer.setLineStyle('dashed');  // 'solid' | 'dashed' | 'dotted'

// Vertex style
drawer.setVertexStyle({
  size: 8,
  fillColor: '#FF0000',
  strokeColor: '#FFFFFF',
  strokeWidth: 2,
  shape: 'circle'  // 'circle' | 'square' | 'diamond'
});

// Text style
drawer.setTextStyle({
  font: '16px Arial',
  color: '#FFD700',
  backgroundColor: 'rgba(0,0,0,0.6)',
  padding: 6
});

// Update selected annotation's style
drawer.updateSelectedAnnotationStyle();
```

#### Export
```typescript
// Export original size
drawer.exportAnnotationImage().then(base64 => { ... });

// Export current view
drawer.exportCurrentViewImage().then(base64 => { ... });

// Convert to File
const file = drawer.base64ToFile(base64, 'annotation.jpg');
```

#### Clear & Undo
```typescript
drawer.clear();                    // Clear all, set draw type to ''
drawer.clear('rect');             // Clear all, set draw type to 'rect'
drawer.clearCanvas();             // Clear everything including image
drawer.clearAnnotations();        // Clear annotations only, keep image
drawer.withdraw();                // Undo last operation
```

#### Destroy
```typescript
drawer.destroy();                  // Clean up resources
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Reset view to initial state |
| `ESC` | Cancel current drawing / deselect |
| `Delete` / `Backspace` | Delete selected annotation |
| `Ctrl+Z` | Undo delete (for text annotations) |

## Advanced Usage

### Custom Styles Per Annotation

```typescript
// Set global style for new annotations
drawer.setAnnotationColor('#00FF00');
drawer.setLineStyle('dashed');

// Add annotation - it will use current global style
drawer.setDrawType('rect');
// ... draw rectangle ...

// Change style - only affects future annotations
drawer.setAnnotationColor('#FF0000');
drawer.setLineStyle('solid');

// To update existing annotation's style:
drawer.selectAnnotation(0);
drawer.setAnnotationColor('#0000FF');
drawer.updateSelectedAnnotationStyle();  // Save style to selected annotation
```

### Event Handling

```typescript
// Disable default events and handle manually
const drawer = new Drawer({
  id: 'container',
  useEvents: false  // Disable default event binding
});

// Add events manually when needed
drawer.addEventListeners();
```

### TypeScript Support

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

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Examples

- **Live Demo (English)**: https://kanglinddd.github.io/ADrawer/
- **在线演示 (中文)**: https://kanglinddd.github.io/ADrawer/zh.html
- **Source**: See the `examples/` directory for complete working examples.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository (https://github.com/KangLinDDD/ADrawer/fork)
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request (https://github.com/KangLinDDD/ADrawer/pulls)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
