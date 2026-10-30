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
  enableTitleEditing?: boolean;        // Allow double-click to edit the title text (default: true)
  enableTitleDragging?: boolean;       // Allow dragging the title box to resize/move (default: true)
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
| `enableTitleEditing` | `boolean` | `true` | Whether double-clicking a selected annotation opens the title input. Set `false` to make titles read-only in the UI; they can still be set programmatically via `setAnnotationTitle`. Requires `enableTitle: true` |
| `enableTitleDragging` | `boolean` | `true` | Whether the title box can be dragged after selecting an annotation: drag the right-edge handle to resize (re-wrap live) or drag the box body to move it. Set `false` to disable. Requires `enableTitle: true` |
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
drawer.selectAnnotation(index, { lock: true });  // Locked selection: highlighted but not draggable/resizable via mouse (programmatic APIs still work)
drawer.deselectAnnotation();
drawer.deleteSelectedAnnotation();
drawer.moveSelectedAnnotation(dx, dy);

// Import / restore rectangles and polygons (deep-cloned, ids/styles filled, clamped, titles laid out)
const saved = drawer.setAnnotations([
  { type: 'rect', data: [{ start: { x: 10, y: 10 }, width: 100, height: 60 }], status: 'fullfilled', title: 'Person' }
]);
const added = drawer.addAnnotation({
  type: 'polygon',
  data: [{ point: { x: 10, y: 10 } }, { point: { x: 80, y: 10 } }, { point: { x: 40, y: 80 } }],
  status: 'fullfilled'
});

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

#### Annotation Titles

```typescript
// Set / get
drawer.setAnnotationTitle(0, 'A long title that wraps automatically');
drawer.getAnnotationTitle(0);

// Global style / position
drawer.setTitleStyle({ font: 'bold 14px Arial', paddingX: 8, paddingY: 4 });
drawer.setTitlePosition({ vertical: 'top', align: 'center' });

// Per annotation: style / position / manual width (initial-view canvas px)
drawer.setAnnotationTitleStyle(0, { color: '#FFD700' });
drawer.setAnnotationTitlePosition(0, { vertical: 'bottom', width: 160 });

// Restore automatic layout (clears manual width / offsets)
drawer.resetAnnotationTitleLayout(0);

// Force a re-layout after mutating annotation coordinates / font / title text in place
drawer.refreshTitleLayouts();
```

Layout rules:

- **Wrap**: outside titles (above/below) are capped at the image width; inside titles are capped at the annotation width. Text wraps by width: CJK per character, Latin preferably at spaces.
- **Vertical fallback**: try above, then below; when neither fits (e.g. an annotation as tall as the image), the title goes inside the annotation's top edge (`vertical: 'inside-top'`).
- **No truncation**: all text is drawn. Inside titles grow downward when there is too much text, so nothing is lost.
- **Manual control**: after selecting an annotation, drag the right-edge handle to change width (live re-wrap) or drag the box body to move it. Manually adjusted titles stop participating in the automatic fallback; call `resetAnnotationTitleLayout()` to restore.
- **Imported annotations**: `setAnnotations()` / `addAnnotation()` / deserialized records get their title layout computed on the next render; the same applies to records pushed directly into `recordList`.
- Single-line title box height is unchanged from previous versions.

> `TitlePosition.offsetX / offsetY / width` are in initial-view canvas pixels and are scaled consistently on export.

#### Export
```typescript
// Export original size
drawer.exportAnnotationImage().then(base64 => { ... });

// Export current view
drawer.exportCurrentViewImage().then(base64 => { ... });

// Optional config (both methods):
//   type    overrides the export format (default: follow the background image); 'jpg' === 'jpeg'
//   quality encoding quality 0–1 for lossy formats (jpeg / webp), default 0.92; png ignores it
drawer.exportAnnotationImage({ quality: 0.8 }).then(base64 => { ... }); // smaller file
drawer.exportAnnotationImage({ type: 'png' }).then(base64 => { ... });  // force lossless, bigger

// Only 3 formats can actually be encoded by canvas (spec / implementation, not our choice):
//   image/png   always supported; also the fallback when the requested type is unsupported
//   image/jpeg  every modern browser
//   image/webp  Chrome 17+ / Firefox 96+ / Edge 79+; Safari (incl. iOS) still cannot encode → PNG
// Everything else (gif / bmp / svg / avif / jxl / tiff / heic / non-standard image/jpg …) has no
// encoder in the browser and silently falls back to PNG. So `type` is only a *request* — trust the
// data URL prefix for the real format.

// Convert to File
// ⚠️ Derive the extension from the data URL's actual MIME; don't hard-code `.jpg`:
//    the export format follows the background image (png → image/png, jpeg → image/jpeg),
//    while formats canvas cannot encode (gif / bmp / svg) fall back to PNG.
const mime = /^data:(image\/[a-z0-9.+-]+)/i.exec(base64)?.[1] ?? 'image/jpeg';
const ext = mime === 'image/jpeg' ? 'jpg' : mime.slice('image/'.length);
const file = drawer.base64ToFile(base64, `annotation.${ext}`);
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

// Subscribe to annotation changes
drawer.on('create', ({ id, type, index, data }) => { ... }); // created
drawer.on('update', ({ id, type, index, data }) => { ... }); // moved / resized / title / style changed
drawer.on('delete', ({ id, type, index, data }) => { ... }); // deleted
drawer.on('load', ({ annotations }) => { ... });              // setAnnotations bulk import
drawer.on('clear', () => { ... });                            // cleared
drawer.on('undo', () => { ... });                             // undone
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
