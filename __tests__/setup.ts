// Jest setup file
// Add any global test setup here

// Mock canvas for jsdom
HTMLCanvasElement.prototype.toDataURL = jest.fn((type) => `data:${type || 'image/png'};base64,mocked-data`);

HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  strokeRect: jest.fn(),
  setLineDash: jest.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  font: '',
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 100 })),
  roundRect: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arcTo: jest.fn(),
  quadraticCurveTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
})) as any;

// Mock Image
class MockImage {
  src = '';
  width = 800;
  height = 600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';

  constructor() {
    // Auto trigger onload after setting src
    setTimeout(() => {
      if (this.onload) this.onload();
    }, 0);
  }
}

global.Image = MockImage as any;

// Mock URL
global.URL = class URL {
  static createObjectURL = jest.fn(() => 'blob:mock-url');
  static revokeObjectURL = jest.fn();
  
  constructor(public url: string) {}
  
  get pathname() {
    return this.url.replace(/^[^:]+:\/\/[^/]+/, '');
  }
} as any;

// Mock File
global.File = class MockFile {
  constructor(
    public bits: BlobPart[],
    public name: string,
    public options?: FilePropertyBag
  ) {}
} as any;

// Mock Blob
global.Blob = class MockBlob {
  constructor(public parts: any[], public options?: BlobPropertyBag) {}
} as any;

// Mock atob/btoa
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));
