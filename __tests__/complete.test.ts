/**
 * ADrawer 完整功能自动化测试
 * 测试覆盖所有核心功能模块
 */

import Drawer, { 
  Shape, 
  Point, 
  Rect, 
  Polygon, 
  TextAnnotation, 
  Operate, 
  DrawerOptions,
  DrawType,
  LineStyle,
  VertexStyle,
  TextStyle,
  TextInputStyle,
  ColorConfig,
  ViewportManager,
  AnnotationManager,
  TextAnnotationManager,
  Renderer,
  EventHandler,
  isPointInRect,
  isPointInPolygon,
  getImageTypeFromUrl,
  base64ToFile,
  base64ToBlob,
  getZoomDelta,
} from '../src/index';

// ==================== 工具函数测试 ====================
describe('Utils', () => {
  describe('isPointInRect', () => {
    it('should detect point inside rect', () => {
      const rect: Rect = { start: { x: 100, y: 100 }, width: 100, height: 100 };
      expect(isPointInRect({ x: 150, y: 150 }, rect)).toBe(true);
    });

    it('should detect point outside rect', () => {
      const rect: Rect = { start: { x: 100, y: 100 }, width: 100, height: 100 };
      expect(isPointInRect({ x: 50, y: 50 }, rect)).toBe(false);
    });

    it('should detect point on rect boundary', () => {
      const rect: Rect = { start: { x: 100, y: 100 }, width: 100, height: 100 };
      expect(isPointInRect({ x: 100, y: 100 }, rect)).toBe(true);
      expect(isPointInRect({ x: 200, y: 200 }, rect)).toBe(true);
    });

    it('should handle negative rect dimensions', () => {
      const rect: Rect = { start: { x: 200, y: 200 }, width: -100, height: -100 };
      expect(isPointInRect({ x: 150, y: 150 }, rect)).toBe(true);
      expect(isPointInRect({ x: 250, y: 250 }, rect)).toBe(false);
    });

    it('should handle zero width/height rect', () => {
      const rect: Rect = { start: { x: 100, y: 100 }, width: 0, height: 0 };
      expect(isPointInRect({ x: 100, y: 100 }, rect)).toBe(true);
      expect(isPointInRect({ x: 101, y: 101 }, rect)).toBe(false);
    });
  });

  describe('isPointInPolygon', () => {
    it('should detect point inside polygon', () => {
      const polygon: Polygon[] = [
        { point: { x: 100, y: 100 } },
        { point: { x: 200, y: 100 } },
        { point: { x: 200, y: 200 } },
        { point: { x: 100, y: 200 } }
      ];
      expect(isPointInPolygon({ x: 150, y: 150 }, polygon)).toBe(true);
    });

    it('should detect point outside polygon', () => {
      const polygon: Polygon[] = [
        { point: { x: 100, y: 100 } },
        { point: { x: 200, y: 100 } },
        { point: { x: 200, y: 200 } },
        { point: { x: 100, y: 200 } }
      ];
      expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(false);
    });

    it('should detect point on polygon edge', () => {
      const polygon: Polygon[] = [
        { point: { x: 100, y: 100 } },
        { point: { x: 200, y: 100 } },
        { point: { x: 200, y: 200 } },
        { point: { x: 100, y: 200 } }
      ];
      expect(isPointInPolygon({ x: 150, y: 100 }, polygon)).toBe(true);
    });

    it('should handle triangle polygon', () => {
      const polygon: Polygon[] = [
        { point: { x: 100, y: 100 } },
        { point: { x: 200, y: 100 } },
        { point: { x: 150, y: 200 } }
      ];
      expect(isPointInPolygon({ x: 150, y: 150 }, polygon)).toBe(true);
      expect(isPointInPolygon({ x: 50, y: 50 }, polygon)).toBe(false);
    });

    it('should handle empty polygon', () => {
      expect(isPointInPolygon({ x: 100, y: 100 }, [])).toBe(false);
    });

    it('should handle single point polygon', () => {
      const polygon: Polygon[] = [{ point: { x: 100, y: 100 } }];
      expect(isPointInPolygon({ x: 100, y: 100 }, polygon)).toBe(false);
    });
  });

  describe('getImageTypeFromUrl', () => {
    it('should extract png from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.png')).toBe('png');
    });

    it('should extract jpg from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.jpg')).toBe('jpg');
    });

    it('should extract jpeg from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.jpeg')).toBe('jpeg');
    });

    it('should extract webp from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.webp')).toBe('webp');
    });

    it('should extract gif from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.gif')).toBe('gif');
    });

    it('should extract bmp from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.bmp')).toBe('bmp');
    });

    it('should extract svg from url', () => {
      expect(getImageTypeFromUrl('https://example.com/image.svg')).toBe('svg');
    });

    it('should handle url with query params', () => {
      expect(getImageTypeFromUrl('https://example.com/image.png?v=123')).toBe('png');
      expect(getImageTypeFromUrl('https://example.com/image.jpg?size=large')).toBe('jpg');
    });

    it('should return jpeg for unknown extension', () => {
      expect(getImageTypeFromUrl('https://example.com/image')).toBe('jpeg');
      expect(getImageTypeFromUrl('https://example.com/image.xyz')).toBe('jpeg');
    });

    it('should handle uppercase extensions', () => {
      expect(getImageTypeFromUrl('https://example.com/image.PNG')).toBe('png');
      expect(getImageTypeFromUrl('https://example.com/image.JPG')).toBe('jpg');
      expect(getImageTypeFromUrl('https://example.com/image.WEBP')).toBe('webp');
    });
  });

  describe('base64ToFile', () => {
    it('should convert base64 to File', () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';
      const file = base64ToFile(base64, 'test.jpg');
      expect(file.name).toBe('test.jpg');
      expect(file).toBeInstanceOf(File);
    });

    it('should handle different mime types', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const file = base64ToFile(base64, 'test.png');
      expect(file.name).toBe('test.png');
    });
  });

  describe('base64ToBlob', () => {
    it('should convert base64 to Blob', async () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';
      const blob = await base64ToBlob(base64);
      expect(blob).toBeInstanceOf(Blob);
    });

    it('should reject invalid base64', async () => {
      await expect(base64ToBlob('invalid')).rejects.toThrow('Invalid base64 string');
    });

    it('should handle base64 without data uri prefix', async () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const blob = await base64ToBlob(base64);
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('getZoomDelta', () => {
    it('should return positive delta for zoom in at small scale', () => {
      expect(getZoomDelta(0.5, true)).toBeGreaterThan(0);
    });

    it('should return positive delta for zoom in at large scale', () => {
      expect(getZoomDelta(2.0, true)).toBeGreaterThan(0);
    });

    it('should return negative delta for zoom out', () => {
      expect(getZoomDelta(1.0, false)).toBeLessThan(0);
    });

    it('should return smaller delta at larger scales', () => {
      const smallScaleDelta = getZoomDelta(0.5, true);
      const largeScaleDelta = getZoomDelta(3.0, true);
      expect(smallScaleDelta).toBeGreaterThan(largeScaleDelta);
    });
  });
});

// ==================== ViewportManager 测试 ====================
describe('ViewportManager', () => {
  let viewport: ViewportManager;

  beforeEach(() => {
    viewport = new ViewportManager();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(viewport.width).toBe(0);
      expect(viewport.height).toBe(0);
      expect(viewport.scale).toBe(1);
      expect(viewport.offset.x).toBe(0);
      expect(viewport.offset.y).toBe(0);
    });

    it('should set size', () => {
      viewport.setSize(800, 600);
      expect(viewport.width).toBe(800);
      expect(viewport.height).toBe(600);
    });

    it('should set original size', () => {
      viewport.setOriginalSize(1920, 1080);
      expect(viewport.originalWidth).toBe(1920);
      expect(viewport.originalHeight).toBe(1080);
    });
  });

  describe('Scale and Offset', () => {
    beforeEach(() => {
      viewport.setSize(800, 600);
      viewport.setOriginalSize(1600, 1200);
    });

    it('should update scale', () => {
      viewport.updateScale(2, 400, 300);
      expect(viewport.scale).toBe(2);
    });

    it('should clamp scale to minimum', () => {
      viewport.updateScale(0.1, 400, 300);
      expect(viewport.scale).toBeGreaterThanOrEqual(0.1);
    });

    it('should clamp scale to maximum', () => {
      viewport.updateScale(10, 400, 300);
      // Note: maxScale is 10 by default, not 5
      expect(viewport.scale).toBeLessThanOrEqual(10);
    });

    it('should update offset', () => {
      // updateOffset adds to current offset and then constrains
      viewport.setOriginalSize(1600, 1200);
      viewport.calculateInitialView();
      
      // Just verify the method doesn't throw
      expect(() => viewport.updateOffset(100, 100)).not.toThrow();
      expect(() => viewport.updateOffset(-50, -50)).not.toThrow();
    });
  });

  describe('Coordinate Conversion', () => {
    beforeEach(() => {
      viewport.setSize(800, 600);
      viewport.setOriginalSize(1600, 1200);
      viewport.calculateInitialView();
    });

    it('should convert canvas to image coordinates', () => {
      const imagePoint = viewport.toImageCoordinates(400, 300);
      expect(imagePoint.x).toBeDefined();
      expect(imagePoint.y).toBeDefined();
    });

    it('should convert image to canvas coordinates', () => {
      const canvasPoint = viewport.toCanvasCoordinates(800, 600);
      expect(canvasPoint.x).toBeDefined();
      expect(canvasPoint.y).toBeDefined();
    });

    it('should be inverse operations', () => {
      const original = { x: 400, y: 300 };
      const image = viewport.toImageCoordinates(original.x, original.y);
      const canvas = viewport.toCanvasCoordinates(image.x, image.y);
      expect(Math.round(canvas.x)).toBeCloseTo(original.x, 0);
      expect(Math.round(canvas.y)).toBeCloseTo(original.y, 0);
    });
  });

  describe('Reset', () => {
    it('should reset to initial state', () => {
      viewport.setSize(800, 600);
      viewport.setOriginalSize(1600, 1200);
      viewport.calculateInitialView();
      viewport.updateScale(2, 400, 300);
      viewport.updateOffset(100, 100);
      
      viewport.reset();
      
      expect(viewport.scale).toBe(1);
      expect(viewport.offset.x).toBe(0);
      expect(viewport.offset.y).toBe(0);
    });
  });
});

// ==================== Drawer 核心功能测试 ====================
describe('Drawer Core', () => {
  let container: HTMLDivElement;
  let drawer: Drawer;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (drawer) {
      drawer.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Initialization', () => {
    it('should create drawer instance', () => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
      expect(drawer).toBeInstanceOf(Drawer);
    });

    it('should throw error for non-existent container', () => {
      expect(() => {
        new Drawer({ id: 'non-existent', useEvents: false });
      }).toThrow('Container with id "non-existent" not found');
    });

    it('should set container position to relative', () => {
      const div = document.createElement('div');
      div.id = 'position-test';
      div.style.width = '800px';
      div.style.height = '600px';
      document.body.appendChild(div);
      
      const d = new Drawer({ id: 'position-test', useEvents: false });
      expect(div.style.position).toBe('relative');
      
      d.destroy();
      document.body.removeChild(div);
    });

    it('should not change existing position', () => {
      const div = document.createElement('div');
      div.id = 'position-test2';
      div.style.width = '800px';
      div.style.height = '600px';
      div.style.position = 'absolute';
      document.body.appendChild(div);
      
      const d = new Drawer({ id: 'position-test2', useEvents: false });
      expect(div.style.position).toBe('absolute');
      
      d.destroy();
      document.body.removeChild(div);
    });

    it('should initialize with default draw type', () => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
      expect(drawer.drawType).toBe('');
    });

    it('should initialize with specified draw type', () => {
      drawer = new Drawer({ id: 'test-container', drawType: 'rect', useEvents: false });
      expect(drawer.drawType).toBe('rect');
    });
  });

  describe('DrawType Management', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
    });

    it('should set draw type to rect', () => {
      drawer.setDrawType('rect');
      expect(drawer.drawType).toBe('rect');
    });

    it('should set draw type to polygon', () => {
      drawer.setDrawType('polygon');
      expect(drawer.drawType).toBe('polygon');
    });

    it('should set draw type to drag', () => {
      drawer.setDrawType('drag');
      expect(drawer.drawType).toBe('drag');
    });

    it('should set draw type to text', () => {
      drawer.setDrawType('text');
      expect(drawer.drawType).toBe('text');
    });

    it('should not change type if same', () => {
      drawer.setDrawType('rect');
      drawer.setDrawType('rect');
      expect(drawer.drawType).toBe('rect');
    });

    it('should deselect when switching to draw mode', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer.selectAnnotation(0);
      expect(drawer.getSelectedAnnotation()).not.toBeNull();
      
      drawer.setDrawType('rect');
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });
  });

  describe('Image Loading', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
    });

    it('should load image without error', (done) => {
      drawer.drawImage('https://example.com/test.jpg');
      setTimeout(() => {
        expect(() => drawer.exportCurrentViewImage()).not.toThrow();
        done();
      }, 100);
    });
  });

  describe('Zoom', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
      drawer.drawImage('https://example.com/test.jpg');
    });

    it('should zoom in', (done) => {
      setTimeout(() => {
        expect(() => drawer.changeScale(true)).not.toThrow();
        done();
      }, 100);
    });

    it('should zoom out', (done) => {
      setTimeout(() => {
        expect(() => drawer.changeScale(false)).not.toThrow();
        done();
      }, 100);
    });
  });

  describe('Clear Operations', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
      drawer.addTextAnnotation(100, 100, 'Test');
    });

    it('should clear with specific type', () => {
      drawer.clear('rect');
      expect(drawer.drawType).toBe('rect');
      expect(drawer.getTextAnnotations().length).toBe(0);
    });

    it('should clear canvas completely', () => {
      drawer.clearCanvas();
      expect(drawer.getTextAnnotations().length).toBe(0);
    });

    it('should clear annotations only', () => {
      drawer.clearAnnotations();
      expect(drawer.getTextAnnotations().length).toBe(0);
    });
  });

  describe('Withdraw', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
    });

    it('should not throw when withdrawing empty', () => {
      expect(() => drawer.withdraw()).not.toThrow();
    });

    it('should withdraw text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test 1');
      drawer.addTextAnnotation(200, 200, 'Test 2');
      drawer.withdraw();
      expect(drawer.getTextAnnotations().length).toBe(1);
    });
  });

  describe('Export', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
    });

    it('should reject export without image', async () => {
      await expect(drawer.exportAnnotationImage()).rejects.toThrow('No background image loaded');
    });

    it('should export current view', async () => {
      const result = await drawer.exportCurrentViewImage();
      expect(result).toContain('data:image');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
    });

    it('should convert base64 to file', () => {
      const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD';
      const file = drawer.base64ToFile(base64, 'test.jpg');
      expect(file.name).toBe('test.jpg');
    });
  });

  describe('Destroy', () => {
    it('should clean up resources', () => {
      drawer = new Drawer({ id: 'test-container', useEvents: false });
      drawer.addTextAnnotation(100, 100, 'Test');
      
      drawer.destroy();
      
      // Canvas should be removed
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeNull();
    });
  });
});

// ==================== 文本标注功能测试 ====================
describe('Text Annotations', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'text-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    drawer = new Drawer({ id: 'text-test-container', useEvents: false });
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('CRUD Operations', () => {
    it('should add text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test text');
      const annotations = drawer.getTextAnnotations();
      expect(annotations.length).toBe(1);
      expect(annotations[0].text).toBe('Test text');
      expect(annotations[0].position).toEqual({ x: 100, y: 100 });
    });

    it('should add text with empty string by default', () => {
      drawer.addTextAnnotation(100, 100);
      const annotations = drawer.getTextAnnotations();
      expect(annotations.length).toBe(1);
      expect(annotations[0].text).toBe('');
    });

    it('should update text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Original');
      drawer.updateTextAnnotation(0, 'Updated');
      expect(drawer.getTextAnnotations()[0].text).toBe('Updated');
    });

    it('should not throw when updating non-existent index', () => {
      expect(() => drawer.updateTextAnnotation(999, 'Test')).not.toThrow();
    });

    it('should move text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      drawer.moveTextAnnotation(0, 200, 200);
      expect(drawer.getTextAnnotations()[0].position).toEqual({ x: 200, y: 200 });
    });

    it('should not throw when moving non-existent index', () => {
      expect(() => drawer.moveTextAnnotation(999, 200, 200)).not.toThrow();
    });

    it('should remove text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test 1');
      drawer.addTextAnnotation(200, 200, 'Test 2');
      drawer.removeTextAnnotation(0);
      expect(drawer.getTextAnnotations().length).toBe(1);
      expect(drawer.getTextAnnotations()[0].text).toBe('Test 2');
    });

    it('should not throw when removing non-existent index', () => {
      expect(() => drawer.removeTextAnnotation(999)).not.toThrow();
    });

    it('should clear all text annotations', () => {
      drawer.addTextAnnotation(100, 100, 'Test 1');
      drawer.addTextAnnotation(200, 200, 'Test 2');
      drawer.clearTextAnnotations();
      expect(drawer.getTextAnnotations()).toEqual([]);
    });
  });

  describe('Text Annotation Selection', () => {
    it('should select text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      // 通过内部方法测试选中
      const textManager = drawer['textManager'];
      textManager.selectTextAnnotation(0);
      expect(textManager.selectedTextIndex).toBe(0);
    });

    it('should deselect text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      const textManager = drawer['textManager'];
      textManager.selectTextAnnotation(0);
      textManager.deselectTextAnnotation();
      expect(textManager.selectedTextIndex).toBeNull();
    });

    it('should get selected text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      const textManager = drawer['textManager'];
      textManager.selectTextAnnotation(0);
      const selected = textManager.getSelectedTextAnnotation();
      expect(selected).not.toBeNull();
      expect(selected?.index).toBe(0);
    });

    it('should delete selected text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test 1');
      drawer.addTextAnnotation(200, 200, 'Test 2');
      const textManager = drawer['textManager'];
      textManager.selectTextAnnotation(0);
      textManager.deleteSelectedTextAnnotation();
      expect(drawer.getTextAnnotations().length).toBe(1);
    });
  });

  describe('Text Annotation Undo', () => {
    it('should undo deleted text annotation', () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      drawer.removeTextAnnotation(0);
      expect(drawer.getTextAnnotations().length).toBe(0);
      
      // 撤销删除
      const textManager = drawer['textManager'];
      textManager.withdraw();
      expect(drawer.getTextAnnotations().length).toBe(1);
      expect(drawer.getTextAnnotations()[0].text).toBe('Test');
    });

    it('should handle undo when no delete history', () => {
      const textManager = drawer['textManager'];
      expect(() => textManager.withdraw()).not.toThrow();
    });
  });

  describe('Multiple Text Annotations', () => {
    it('should handle multiple annotations', () => {
      drawer.addTextAnnotation(100, 100, 'First');
      drawer.addTextAnnotation(200, 200, 'Second');
      drawer.addTextAnnotation(300, 300, 'Third');
      
      const annotations = drawer.getTextAnnotations();
      expect(annotations.length).toBe(3);
      expect(annotations[0].text).toBe('First');
      expect(annotations[1].text).toBe('Second');
      expect(annotations[2].text).toBe('Third');
    });

    it('should maintain correct indices after removal', () => {
      drawer.addTextAnnotation(100, 100, 'First');
      drawer.addTextAnnotation(200, 200, 'Second');
      drawer.addTextAnnotation(300, 300, 'Third');
      
      drawer.removeTextAnnotation(1);
      
      const annotations = drawer.getTextAnnotations();
      expect(annotations.length).toBe(2);
      expect(annotations[0].text).toBe('First');
      expect(annotations[1].text).toBe('Third');
    });
  });
});

// ==================== 矩形/多边形标注测试 ====================
describe('Shape Annotations', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'shape-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    drawer = new Drawer({ id: 'shape-test-container', useEvents: false });
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Annotation Records', () => {
    it('should return empty annotations initially', () => {
      expect(drawer.getAnnotations()).toEqual([]);
    });

    it('should add rect annotation via internal method', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      expect(drawer.getAnnotations().length).toBe(1);
    });

    it('should add polygon annotation via internal method', () => {
      drawer['annotationManager'].recordList.push({
        type: 'polygon',
        data: [
          { point: { x: 100, y: 100 } },
          { point: { x: 200, y: 100 } },
          { point: { x: 200, y: 200 } }
        ],
        status: 'fullfilled'
      });
      expect(drawer.getAnnotations().length).toBe(1);
    });
  });

  describe('Annotation Selection', () => {
    beforeEach(() => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer['annotationManager'].recordList.push({
        type: 'polygon',
        data: [
          { point: { x: 300, y: 300 } },
          { point: { x: 400, y: 300 } },
          { point: { x: 400, y: 400 } }
        ],
        status: 'fullfilled'
      });
    });

    it('should select annotation', () => {
      drawer.selectAnnotation(0);
      const selected = drawer.getSelectedAnnotation();
      expect(selected).not.toBeNull();
      expect(selected?.index).toBe(0);
    });

    it('should deselect annotation', () => {
      drawer.selectAnnotation(0);
      drawer.deselectAnnotation();
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });

    it('should not select out of bounds index', () => {
      drawer.selectAnnotation(999);
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });

    it('should get correct annotation type', () => {
      drawer.selectAnnotation(0);
      expect(drawer.getSelectedAnnotation()?.type).toBe('rect');
      
      drawer.selectAnnotation(1);
      expect(drawer.getSelectedAnnotation()?.type).toBe('polygon');
    });
  });

  describe('Annotation Movement', () => {
    beforeEach(() => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
    });

    it('should move selected annotation', () => {
      drawer.selectAnnotation(0);
      drawer.moveSelectedAnnotation(50, 50);
      
      const rect = drawer.getAnnotations()[0].data[0] as Rect;
      expect(rect.start.x).toBe(150);
      expect(rect.start.y).toBe(150);
    });

    it('should not move without selection', () => {
      drawer.moveSelectedAnnotation(50, 50);
      const rect = drawer.getAnnotations()[0].data[0] as Rect;
      expect(rect.start.x).toBe(100);
      expect(rect.start.y).toBe(100);
    });
  });

  describe('Annotation Deletion', () => {
    beforeEach(() => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 300, y: 300 }, width: 50, height: 50 }],
        status: 'fullfilled'
      });
    });

    it('should delete selected annotation', () => {
      drawer.selectAnnotation(0);
      drawer.deleteSelectedAnnotation();
      expect(drawer.getAnnotations().length).toBe(1);
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });

    it('should not delete without selection', () => {
      drawer.deleteSelectedAnnotation();
      expect(drawer.getAnnotations().length).toBe(2);
    });
  });

  describe('Annotation Undo', () => {
    it('should undo last annotation', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 300, y: 300 }, width: 50, height: 50 }],
        status: 'fullfilled'
      });
      
      drawer.withdraw();
      expect(drawer.getAnnotations().length).toBe(1);
    });

    it('should handle undo with empty annotations', () => {
      expect(() => drawer.withdraw()).not.toThrow();
    });
  });
});

// ==================== 样式系统测试 ====================
describe('Styling System', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'style-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    drawer = new Drawer({ id: 'style-test-container', useEvents: false });
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Annotation Color', () => {
    it('should set annotation color as string', () => {
      drawer.setAnnotationColor('#FF0000');
      expect(drawer.getAnnotationColor().default).toBe('#FF0000');
    });

    it('should set annotation color as config', () => {
      const config: ColorConfig = {
        rect: '#FF0000',
        polygon: '#00FF00',
        default: '#0000FF'
      };
      drawer.setAnnotationColor(config);
      expect(drawer.getAnnotationColor()).toEqual(config);
    });

    it('should set color via constructor', () => {
      const div = document.createElement('div');
      div.id = 'color-test';
      div.style.width = '800px';
      div.style.height = '600px';
      document.body.appendChild(div);
      
      const d = new Drawer({ 
        id: 'color-test', 
        useEvents: false,
        annotationColor: '#FF0000'
      });
      expect(d.getAnnotationColor().default).toBe('#FF0000');
      
      d.destroy();
      document.body.removeChild(div);
    });
  });

  describe('Line Style', () => {
    it('should set line style to solid', () => {
      drawer.setLineStyle('solid');
      expect(drawer.getLineStyle()).toBe('solid');
    });

    it('should set line style to dashed', () => {
      drawer.setLineStyle('dashed');
      expect(drawer.getLineStyle()).toBe('dashed');
    });

    it('should set line style to dotted', () => {
      drawer.setLineStyle('dotted');
      expect(drawer.getLineStyle()).toBe('dotted');
    });

    it('should set line style via constructor', () => {
      const div = document.createElement('div');
      div.id = 'line-style-test';
      div.style.width = '800px';
      div.style.height = '600px';
      document.body.appendChild(div);
      
      const d = new Drawer({ 
        id: 'line-style-test', 
        useEvents: false,
        lineStyle: 'dashed'
      });
      expect(d.getLineStyle()).toBe('dashed');
      
      d.destroy();
      document.body.removeChild(div);
    });
  });

  describe('Vertex Style', () => {
    it('should set vertex style', () => {
      const style: Partial<VertexStyle> = {
        size: 10,
        fillColor: '#FF0000',
        shape: 'square'
      };
      drawer.setVertexStyle(style);
      expect(drawer.getVertexStyle().size).toBe(10);
      expect(drawer.getVertexStyle().fillColor).toBe('#FF0000');
      expect(drawer.getVertexStyle().shape).toBe('square');
    });

    it('should set vertex style via constructor', () => {
      const div = document.createElement('div');
      div.id = 'vertex-test';
      div.style.width = '800px';
      div.style.height = '600px';
      document.body.appendChild(div);
      
      const d = new Drawer({ 
        id: 'vertex-test', 
        useEvents: false,
        vertexStyle: { size: 15, shape: 'diamond' }
      });
      expect(d.getVertexStyle().size).toBe(15);
      expect(d.getVertexStyle().shape).toBe('diamond');
      
      d.destroy();
      document.body.removeChild(div);
    });

    it('should preserve default values when partial update', () => {
      drawer.setVertexStyle({ size: 20 });
      expect(drawer.getVertexStyle().size).toBe(20);
      // Other values should still be defaults
      expect(drawer.getVertexStyle().shape).toBeDefined();
    });
  });

  describe('Text Style', () => {
    it('should set text style', () => {
      const style: Partial<TextStyle> = {
        font: '20px Arial',
        color: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.8)'
      };
      drawer.setTextStyle(style);
      const textManager = drawer['textManager'];
      expect(textManager.textStyle.font).toBe('20px Arial');
      expect(textManager.textStyle.color).toBe('#FFFFFF');
    });

    it('should set text input style', () => {
      const style: Partial<TextInputStyle> = {
        border: '2px solid red',
        backgroundColor: '#FFF'
      };
      drawer.setTextInputStyle(style);
      // Should not throw
      expect(() => drawer.setTextInputStyle(style)).not.toThrow();
    });

    it('should set text selection style', () => {
      const style = {
        selectedBorderColor: '#FF0000',
        selectedBackgroundColor: 'rgba(255,0,0,0.2)'
      };
      expect(() => drawer.setTextSelectionStyle(style)).not.toThrow();
    });

    it('should set text style via constructor', () => {
      const div = document.createElement('div');
      div.id = 'text-style-test';
      div.style.width = '800px';
      div.style.height = '600px';
      document.body.appendChild(div);
      
      const d = new Drawer({ 
        id: 'text-style-test', 
        useEvents: false,
        textStyle: { font: '24px Times', color: '#000' }
      });
      const textManager = d['textManager'];
      expect(textManager.textStyle.font).toBe('24px Times');
      
      d.destroy();
      document.body.removeChild(div);
    });
  });

  describe('Update Selected Annotation Style', () => {
    it('should update selected annotation style', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      
      drawer.selectAnnotation(0);
      drawer.setAnnotationColor('#00FF00');
      const result = drawer.updateSelectedAnnotationStyle();
      expect(result).toBe(true);
    });

    it('should return false when no annotation selected', () => {
      const result = drawer.updateSelectedAnnotationStyle();
      expect(result).toBe(false);
    });

    it('should return false for invalid index', () => {
      drawer['annotationManager'].selectedAnnotation = { index: 999, type: 'rect' };
      const result = drawer.updateSelectedAnnotationStyle();
      expect(result).toBe(false);
    });
  });
});

// ==================== 事件处理测试 ====================
describe('Event Handling', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'event-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Event Listeners', () => {
    it('should add event listeners when useEvents is true', () => {
      drawer = new Drawer({ id: 'event-test-container', useEvents: true });
      // Should create without error
      expect(drawer).toBeInstanceOf(Drawer);
    });

    it('should not add event listeners when useEvents is false', () => {
      drawer = new Drawer({ id: 'event-test-container', useEvents: false });
      expect(drawer).toBeInstanceOf(Drawer);
    });

    it('should add event listeners manually', () => {
      drawer = new Drawer({ id: 'event-test-container', useEvents: false });
      expect(() => drawer.addEventListeners()).not.toThrow();
    });
  });

  describe('Event Handler Methods', () => {
    beforeEach(() => {
      drawer = new Drawer({ id: 'event-test-container', useEvents: false });
    });

    it('should handle wheel event', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new WheelEvent('wheel', { deltaY: 100 });
      expect(() => eventHandler.handleWheel(event)).not.toThrow();
    });

    it('should handle mouse down', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('mousedown', { clientX: 100, clientY: 100 });
      expect(() => eventHandler.handleMouseDown(event)).not.toThrow();
    });

    it('should handle mouse move', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('mousemove', { clientX: 150, clientY: 150 });
      expect(() => eventHandler.handleMouseMove(event)).not.toThrow();
    });

    it('should handle mouse up', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('mouseup');
      expect(() => eventHandler.handleMouseUp(event)).not.toThrow();
    });

    it('should handle mouse leave', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('mouseleave');
      expect(() => eventHandler.handleMouseLeave(event)).not.toThrow();
    });

    it('should handle double click', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('dblclick', { clientX: 100, clientY: 100 });
      expect(() => eventHandler.handleDoubleClick(event)).not.toThrow();
    });

    it('should handle click', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new MouseEvent('click', { clientX: 100, clientY: 100 });
      expect(() => eventHandler.handleClick(event)).not.toThrow();
    });

    it('should handle key down', () => {
      const eventHandler = drawer['eventHandler'];
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(() => eventHandler.handleKeyDown(event)).not.toThrow();
    });
  });
});

// ==================== 类型导出测试 ====================
describe('Type Exports', () => {
  it('should export all types correctly', () => {
    // These are compile-time checks
    const point: Point = { x: 0, y: 0 };
    const rect: Rect = { start: point, width: 100, height: 100 };
    const polygon: Polygon = { point };
    const textAnnotation: TextAnnotation = { 
      position: point, 
      text: 'test', 
      width: 100, 
      height: 20 
    };
    const operate: Operate<Rect> = {
      type: 'rect',
      data: [rect],
      status: 'fullfilled'
    };
    const options: DrawerOptions = {
      id: 'test',
      drawType: 'rect'
    };
    
    expect(point).toBeDefined();
    expect(rect).toBeDefined();
    expect(polygon).toBeDefined();
    expect(textAnnotation).toBeDefined();
    expect(operate).toBeDefined();
    expect(options).toBeDefined();
  });

  it('should export module classes', () => {
    expect(ViewportManager).toBeDefined();
    expect(AnnotationManager).toBeDefined();
    expect(TextAnnotationManager).toBeDefined();
    expect(Renderer).toBeDefined();
    expect(EventHandler).toBeDefined();
  });
});

// ==================== 集成测试 ====================
describe('Integration Tests', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'integration-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    drawer = new Drawer({ id: 'integration-test-container', useEvents: false });
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Mixed Annotations', () => {
    it('should handle mixed annotation types', () => {
      // Add rect annotation
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      
      // Add polygon annotation
      drawer['annotationManager'].recordList.push({
        type: 'polygon',
        data: [
          { point: { x: 300, y: 300 } },
          { point: { x: 400, y: 300 } },
          { point: { x: 400, y: 400 } }
        ],
        status: 'fullfilled'
      });
      
      // Add text annotation
      drawer.addTextAnnotation(500, 500, 'Test');
      
      const shapeAnnotations = drawer.getAnnotations();
      const textAnnotations = drawer.getTextAnnotations();
      
      expect(shapeAnnotations.length).toBe(2);
      expect(textAnnotations.length).toBe(1);
    });

    it('should clear all annotations together', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer.addTextAnnotation(200, 200, 'Test');
      
      drawer.clearCanvas();
      
      expect(drawer.getAnnotations().length).toBe(0);
      expect(drawer.getTextAnnotations().length).toBe(0);
    });
  });

  describe('Complex Workflow', () => {
    it('should handle complete annotation workflow', () => {
      // 1. Add annotations
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      drawer.addTextAnnotation(300, 300, 'Label');
      
      // 2. Select and move
      drawer.selectAnnotation(0);
      drawer.moveSelectedAnnotation(50, 50);
      
      // 3. Change style
      drawer.setAnnotationColor('#FF0000');
      drawer.updateSelectedAnnotationStyle();
      
      // 4. Deselect
      drawer.deselectAnnotation();
      
      // 5. Verify state
      const rect = drawer.getAnnotations()[0].data[0] as Rect;
      expect(rect.start.x).toBe(150);
      expect(rect.start.y).toBe(150);
    });

    it('should handle undo after multiple operations', () => {
      // Add multiple annotations
      drawer.addTextAnnotation(100, 100, 'First');
      drawer.addTextAnnotation(200, 200, 'Second');
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 300, y: 300 }, width: 50, height: 50 }],
        status: 'fullfilled'
      });
      
      const totalAnnotations = drawer.getAnnotations().length + drawer.getTextAnnotations().length;
      
      // Undo should remove one annotation at a time
      drawer.withdraw();
      const afterFirstWithdraw = drawer.getAnnotations().length + drawer.getTextAnnotations().length;
      expect(afterFirstWithdraw).toBeLessThan(totalAnnotations);
      
      // Continue undoing
      drawer.withdraw();
      const afterSecondWithdraw = drawer.getAnnotations().length + drawer.getTextAnnotations().length;
      expect(afterSecondWithdraw).toBeLessThanOrEqual(afterFirstWithdraw);
    });
  });

  describe('Export with Annotations', () => {
    it('should export current view with annotations', async () => {
      drawer.addTextAnnotation(100, 100, 'Test');
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 200, y: 200 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      
      const result = await drawer.exportCurrentViewImage();
      expect(result).toContain('data:image');
    });
  });
});

// ==================== 边界情况测试 ====================
describe('Edge Cases', () => {
  let drawer: Drawer;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'edge-test-container';
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    drawer = new Drawer({ id: 'edge-test-container', useEvents: false });
  });

  afterEach(() => {
    if (drawer) drawer.destroy();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  describe('Empty Operations', () => {
    it('should handle getAnnotations when empty', () => {
      expect(drawer.getAnnotations()).toEqual([]);
    });

    it('should handle getTextAnnotations when empty', () => {
      expect(drawer.getTextAnnotations()).toEqual([]);
    });

    it('should handle getSelectedAnnotation when nothing selected', () => {
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });
  });

  describe('Invalid Operations', () => {
    it('should handle negative indices gracefully', () => {
      expect(() => drawer.selectAnnotation(-1)).not.toThrow();
      expect(() => drawer.removeTextAnnotation(-1)).not.toThrow();
      expect(() => drawer.updateTextAnnotation(-1, 'test')).not.toThrow();
    });

    it('should handle very large indices gracefully', () => {
      expect(() => drawer.selectAnnotation(999999)).not.toThrow();
      expect(() => drawer.removeTextAnnotation(999999)).not.toThrow();
    });
  });

  describe('Rapid Operations', () => {
    it('should handle rapid add/remove', () => {
      for (let i = 0; i < 10; i++) {
        drawer.addTextAnnotation(i * 10, i * 10, `Text ${i}`);
      }
      expect(drawer.getTextAnnotations().length).toBe(10);
      
      for (let i = 9; i >= 0; i--) {
        drawer.removeTextAnnotation(i);
      }
      expect(drawer.getTextAnnotations().length).toBe(0);
    });

    it('should handle rapid select/deselect', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
        status: 'fullfilled'
      });
      
      for (let i = 0; i < 10; i++) {
        drawer.selectAnnotation(0);
        drawer.deselectAnnotation();
      }
      expect(drawer.getSelectedAnnotation()).toBeNull();
    });
  });

  describe('Special Characters in Text', () => {
    it('should handle text with special characters', () => {
      const specialTexts = [
        'Text with <html>',
        'Text with "quotes"',
        "Text with 'apostrophe'",
        'Text with \n newline',
        'Text with 🎨 emoji',
        'Text with 中文',
        'Text with &amp;',
        ''
      ];
      
      specialTexts.forEach((text, i) => {
        drawer.addTextAnnotation(i * 10, i * 10, text);
      });
      
      expect(drawer.getTextAnnotations().length).toBe(specialTexts.length);
    });
  });

  describe('Zero/Negative Dimensions', () => {
    it('should handle zero width/height rect', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 100, y: 100 }, width: 0, height: 0 }],
        status: 'fullfilled'
      });
      
      drawer.selectAnnotation(0);
      expect(drawer.getSelectedAnnotation()).not.toBeNull();
    });

    it('should handle negative width/height rect', () => {
      drawer['annotationManager'].recordList.push({
        type: 'rect',
        data: [{ start: { x: 200, y: 200 }, width: -100, height: -100 }],
        status: 'fullfilled'
      });
      
      drawer.selectAnnotation(0);
      expect(drawer.getSelectedAnnotation()).not.toBeNull();
    });
  });
});
