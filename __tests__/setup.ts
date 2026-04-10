// Jest setup file
// Add any global test setup here

// Mock measureText with actualBoundingBox support
const mockMeasureText = jest.fn((text: string) => ({
  width: text.length * 8,
  actualBoundingBoxAscent: 12,
  actualBoundingBoxDescent: 4,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: text.length * 8,
}));

// Mock canvas for jsdom
HTMLCanvasElement.prototype.toDataURL = jest.fn((type) => `data:${type || 'image/png'};base64,mocked-data`);

HTMLCanvasElement.prototype.getContext = jest.fn((contextId: string) => {
  if (contextId === '2d') {
    return {
      // Canvas state
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineDashOffset: 0,
      font: '10px sans-serif',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'low',
      
      // Rect methods
      fillRect: jest.fn(),
      clearRect: jest.fn(),
      strokeRect: jest.fn(),
      
      // Path methods
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      bezierCurveTo: jest.fn(),
      quadraticCurveTo: jest.fn(),
      arc: jest.fn(),
      arcTo: jest.fn(),
      rect: jest.fn(),
      roundRect: jest.fn(),
      
      // Drawing methods
      fill: jest.fn(),
      stroke: jest.fn(),
      clip: jest.fn(),
      drawImage: jest.fn(),
      
      // Text methods
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: mockMeasureText,
      
      // Image data
      getImageData: jest.fn(() => ({ 
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1
      })),
      putImageData: jest.fn(),
      createImageData: jest.fn(() => ({ 
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1
      })),
      
      // Transformation
      setTransform: jest.fn(),
      resetTransform: jest.fn(),
      transform: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      
      // State
      save: jest.fn(),
      restore: jest.fn(),
      
      // Line styles
      setLineDash: jest.fn(),
      getLineDash: jest.fn(() => []),
      
      // Gradients and patterns (simplified)
      createLinearGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      createRadialGradient: jest.fn(() => ({
        addColorStop: jest.fn()
      })),
      createPattern: jest.fn(() => null),
      
      // Shadows
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      
      // Text alignment
      textAlign: 'start',
      textBaseline: 'alphabetic',
      direction: 'inherit',
      
      // Canvas reference
      canvas: document.createElement('canvas'),
    };
  }
  return null;
}) as any;

// Mock Image
class MockImage {
  src = '';
  width = 800;
  height = 600;
  naturalWidth = 800;
  naturalHeight = 600;
  complete = false;
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor() {
    // Auto trigger onload after setting src
    setTimeout(() => {
      this.complete = true;
      if (this.onload) this.onload();
    }, 0);
  }
}

global.Image = MockImage as any;

// Mock URL
global.URL = class URL {
  static createObjectURL = jest.fn(() => 'blob:mock-url');
  static revokeObjectURL = jest.fn();
  
  private _url: string;
  private _pathname: string;
  private _search: string;
  private _hash: string;
  
  constructor(url: string) {
    this._url = url;
    // Parse pathname (remove protocol, host, query string and hash)
    const withoutProtocol = url.replace(/^[^:]+:\/\/[^/]+/, '');
    const withoutQuery = withoutProtocol.replace(/\?.*$/, '');
    const withoutHash = withoutQuery.replace(/#.*$/, '');
    this._pathname = withoutHash;
    
    // Parse search/query string
    const queryMatch = url.match(/\?([^#]*)/);
    this._search = queryMatch ? '?' + queryMatch[1] : '';
    
    // Parse hash
    const hashMatch = url.match(/#.*/);
    this._hash = hashMatch ? hashMatch[0] : '';
  }
  
  get pathname() {
    return this._pathname;
  }
  
  get search() {
    return this._search;
  }
  
  get hash() {
    return this._hash;
  }
  
  get hostname() {
    const match = this._url.match(/^[^:]+:\/\/([^/]+)/);
    return match ? match[1] : '';
  }
  
  get href() {
    return this._url;
  }
} as any;

// Mock File
global.File = class MockFile {
  readonly lastModified: number = Date.now();
  readonly webkitRelativePath: string = '';
  
  constructor(
    public bits: BlobPart[],
    public name: string,
    public options?: FilePropertyBag
  ) {}
  
  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob(this.bits.slice(start, end), { type: contentType });
  }
  
  text(): Promise<string> {
    return Promise.resolve('');
  }
  
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0));
  }
  
  stream(): ReadableStream {
    return new ReadableStream();
  }
} as any;

// Mock Blob
global.Blob = class MockBlob {
  readonly size: number;
  readonly type: string;
  
  constructor(public parts: any[], public options?: BlobPropertyBag) {
    this.size = parts.reduce((acc, part) => acc + (part?.length || 0), 0);
    this.type = options?.type || '';
  }
  
  slice(start?: number, end?: number, contentType?: string): Blob {
    return new Blob(this.parts.slice(start, end), { type: contentType });
  }
  
  text(): Promise<string> {
    return Promise.resolve('');
  }
  
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(0));
  }
  
  stream(): ReadableStream {
    return new ReadableStream();
  }
} as any;

// Mock atob/btoa
global.atob = jest.fn((str: string) => {
  try {
    return Buffer.from(str, 'base64').toString('binary');
  } catch {
    throw new Error('Invalid base64 string');
  }
});

global.btoa = jest.fn((str: string) => {
  try {
    return Buffer.from(str, 'binary').toString('base64');
  } catch {
    throw new Error('Invalid string');
  }
});

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
  return setTimeout(callback, 0) as unknown as number;
});

global.cancelAnimationFrame = jest.fn((id: number) => {
  clearTimeout(id);
});

// Mock window methods
global.window.scrollTo = jest.fn();
global.window.alert = jest.fn();
global.window.confirm = jest.fn(() => true);
global.window.prompt = jest.fn(() => null);

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Add custom matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
