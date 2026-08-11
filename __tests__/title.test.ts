/**
 * 标注标题功能全量自动化测试
 * 覆盖 enableTitle、标题数据 CRUD、样式/位置配置、样式快照隔离
 */
import Drawer from '../src/index';
import type { AnnotationManager } from '../src/index';

// 工具函数：通过 bracket 访问 private annotationManager
const am = (d: Drawer): AnnotationManager => d['annotationManager'];

describe('Title Feature: Enable/Disable', () => {
  it('should default to enableTitle=false', () => {
    const c = document.createElement('div');
    c.id = 'tt1'; document.body.appendChild(c);
    const d = new Drawer({ id: 'tt1' });
    expect(am(d).enableTitle).toBe(false);
    d.destroy(); document.body.removeChild(c);
  });

  it('should set enableTitle=true when specified', () => {
    const c = document.createElement('div');
    c.id = 'tt2'; document.body.appendChild(c);
    const d = new Drawer({ id: 'tt2', enableTitle: true });
    expect(am(d).enableTitle).toBe(true);
    d.destroy(); document.body.removeChild(c);
  });
});

describe('Title Data API: setAnnotationTitle / getAnnotationTitle', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-data'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-data' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('set and get title on annotation', () => {
    expect(d.setAnnotationTitle(0, '人脸检测')).toBe(true);
    expect(d.getAnnotationTitle(0)).toBe('人脸检测');
  });

  it('returns undefined for annotation without title', () => {
    expect(d.getAnnotationTitle(0)).toBeUndefined();
  });

  it('returns undefined for out-of-range index', () => {
    expect(d.getAnnotationTitle(999)).toBeUndefined();
    expect(d.getAnnotationTitle(-1)).toBeUndefined();
  });

  it('returns false on out-of-range set', () => {
    expect(d.setAnnotationTitle(999, 'test')).toBe(false);
  });

  it('overwrites existing title', () => {
    d.setAnnotationTitle(0, 'old');
    d.setAnnotationTitle(0, 'new');
    expect(d.getAnnotationTitle(0)).toBe('new');
  });

  it('clears title on empty string', () => {
    d.setAnnotationTitle(0, '标题');
    d.setAnnotationTitle(0, '');
    expect(d.getAnnotationTitle(0)).toBeUndefined();
  });

  it('handles Chinese characters', () => {
    d.setAnnotationTitle(0, '这是一个中文标题');
    expect(d.getAnnotationTitle(0)).toBe('这是一个中文标题');
  });

  it('handles special characters', () => {
    const s = '<div>&emoji "quotes" \'single\'';
    d.setAnnotationTitle(0, s);
    expect(d.getAnnotationTitle(0)).toBe(s);
  });

  it('works on polygon annotation', () => {
    am(d).recordList.push({
      type: 'polygon',
      data: [
        { point: { x: 200, y: 200 } },
        { point: { x: 300, y: 200 } },
        { point: { x: 300, y: 300 } },
      ],
      status: 'fullfilled',
    });
    d.setAnnotationTitle(1, '多边形区域');
    expect(d.getAnnotationTitle(1)).toBe('多边形区域');
  });

  it('stores title in annotation data', () => {
    d.setAnnotationTitle(0, '测试');
    expect(d.getAnnotations()[0].title).toBe('测试');
  });
});

describe('Title Style API: Global Configuration', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-style'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-style' });
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('getTitleStyle returns defaults', () => {
    const s = d.getTitleStyle();
    expect(s.font).toBe('12px Arial');
    expect(s.color).toBe('#FFFFFF');
    expect(s.backgroundColor).toBe('rgba(0, 0, 0, 0.7)');
    expect(s.paddingX).toBe(6);
    expect(s.paddingY).toBe(3);
    expect(s.borderRadius).toBe(4);
  });

  it('setTitleStyle updates globals, preserves rest', () => {
    d.setTitleStyle({ font: 'bold 14px Arial', color: '#FFD700' });
    const s = d.getTitleStyle();
    expect(s.font).toBe('bold 14px Arial');
    expect(s.color).toBe('#FFD700');
    expect(s.backgroundColor).toBe('rgba(0, 0, 0, 0.7)');
  });

  it('setTitleStyle partial update', () => {
    d.setTitleStyle({ borderRadius: 8 });
    expect(d.getTitleStyle().borderRadius).toBe(8);
    expect(d.getTitleStyle().font).toBe('12px Arial');
  });

  it('getTitlePosition returns defaults', () => {
    const p = d.getTitlePosition();
    expect(p.vertical).toBe('top');
    expect(p.align).toBe('center');
    expect(p.offsetX).toBe(0);
    expect(p.offsetY).toBe(0);
  });

  it('setTitlePosition updates, preserves rest', () => {
    d.setTitlePosition({ vertical: 'bottom', align: 'left' });
    const p = d.getTitlePosition();
    expect(p.vertical).toBe('bottom');
    expect(p.align).toBe('left');
    expect(p.offsetX).toBe(0);
  });

  it('setTitlePosition partial update', () => {
    d.setTitlePosition({ offsetX: -5 });
    expect(d.getTitlePosition().offsetX).toBe(-5);
    expect(d.getTitlePosition().vertical).toBe('top');
  });
});

describe('Title Style Snapshot Isolation', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-snap'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-snap' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('style snapshot frozen on set: global changes do not affect', () => {
    d.setTitleStyle({ color: '#00FF00', font: 'bold 16px Arial' });
    d.setAnnotationTitle(0, '绿色标题');

    d.setTitleStyle({ color: '#FF0000', font: '12px Arial' });

    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.color).toBe('#00FF00');
    expect(s.font).toBe('bold 16px Arial');
  });

  it('position snapshot frozen on set', () => {
    d.setTitlePosition({ vertical: 'bottom' });
    d.setAnnotationTitle(0, '底部标题');

    d.setTitlePosition({ vertical: 'top' });

    const p = am(d).getEffectiveTitlePosition(am(d).recordList[0]);
    expect(p.vertical).toBe('bottom');
  });

  it('new titles use current global, old keep their snapshots', () => {
    d.setTitleStyle({ color: '#00FF00' });
    d.setAnnotationTitle(0, 'first');

    d.setTitleStyle({ color: '#FF0000' });

    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 200, y: 200 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
    d.setAnnotationTitle(1, 'second');

    const s0 = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    const s1 = am(d).getEffectiveTitleStyle(am(d).recordList[1]);
    expect(s0.color).toBe('#00FF00');
    expect(s1.color).toBe('#FF0000');
  });

  it('re-captures style after clearing and re-setting', () => {
    d.setTitleStyle({ color: '#00FF00' });
    d.setAnnotationTitle(0, 'first');
    d.setAnnotationTitle(0, '');

    d.setTitleStyle({ color: '#FF0000' });
    d.setAnnotationTitle(0, 'second');

    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.color).toBe('#FF0000');
  });
});

describe('Per-Annotation Title Style', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-per'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-per' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('setAnnotationTitleStyle updates single annotation', () => {
    d.setAnnotationTitle(0, 'test');
    d.setAnnotationTitleStyle(0, { color: '#FFD700', font: 'italic 14px serif' });
    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.color).toBe('#FFD700');
    expect(s.font).toBe('italic 14px serif');
  });

  it('setAnnotationTitleStyle returns false for out-of-range', () => {
    expect(d.setAnnotationTitleStyle(999, { color: '#FF0000' })).toBe(false);
  });

  it('setAnnotationTitlePosition updates single annotation', () => {
    d.setAnnotationTitle(0, 'test');
    d.setAnnotationTitlePosition(0, { vertical: 'inside-top', align: 'right' });
    const p = am(d).getEffectiveTitlePosition(am(d).recordList[0]);
    expect(p.vertical).toBe('inside-top');
    expect(p.align).toBe('right');
  });

  it('setAnnotationTitlePosition returns false for out-of-range', () => {
    expect(d.setAnnotationTitlePosition(999, { vertical: 'bottom' })).toBe(false);
  });

  it('per-annotation style does not affect others', () => {
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 200, y: 200 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });

    d.setAnnotationTitle(0, 'first');
    d.setAnnotationTitle(1, 'second');
    d.setAnnotationTitleStyle(0, { color: '#FF0000' });

    const s0 = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    const s1 = am(d).getEffectiveTitleStyle(am(d).recordList[1]);
    expect(s0.color).toBe('#FF0000');
    expect(s1.color).toBe('#FFFFFF');
  });
});

describe('enableTitle Behavior', () => {
  it('titleInput created only when enableTitle=true', () => {
    const c = document.createElement('div');
    c.id = 'tt-on'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    const d = new Drawer({ id: 'tt-on', enableTitle: true });
    expect(am(d).titleInput).toBeDefined();
    d.destroy(); document.body.removeChild(c);
  });

  it('titleInput not created when enableTitle=false', () => {
    const c = document.createElement('div');
    c.id = 'tt-off'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    const d = new Drawer({ id: 'tt-off' });
    expect(am(d).titleInput).toBeNull();
    d.destroy(); document.body.removeChild(c);
  });

  it('startTitleEditing returns false when enableTitle=false', () => {
    const c = document.createElement('div');
    c.id = 'tt-noedit'; document.body.appendChild(c);
    const d = new Drawer({ id: 'tt-noedit' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
    expect(am(d).startTitleEditing(0)).toBe(false);
    d.destroy(); document.body.removeChild(c);
  });

  it('API methods work regardless of enableTitle flag', () => {
    const c = document.createElement('div');
    c.id = 'tt-api'; document.body.appendChild(c);
    const d = new Drawer({ id: 'tt-api' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });

    d.setAnnotationTitle(0, '测试');
    expect(d.getAnnotationTitle(0)).toBe('测试');

    d.setTitleStyle({ color: '#FF0000' });
    expect(d.getTitleStyle().color).toBe('#FF0000');

    d.destroy(); document.body.removeChild(c);
  });

  it('destroy cleans up titleInput', () => {
    const c = document.createElement('div');
    c.id = 'tt-destroy'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    const d = new Drawer({ id: 'tt-destroy', enableTitle: true });
    expect(am(d).titleInput).toBeDefined();
    d.destroy();
    expect(am(d).titleInput).toBeNull();
    document.body.removeChild(c);
  });
});

describe('Title Placeholder', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  const pushRect = (x = 100) => {
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
  };

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-ph'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-ph', enableTitle: true });
    pushRect();
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('getTitleStyle returns default placeholder', () => {
    expect(d.getTitleStyle().placeholder).toBe('输入标题...');
  });

  it('setTitleStyle updates global placeholder', () => {
    d.setTitleStyle({ placeholder: '请输入名称' });
    expect(d.getTitleStyle().placeholder).toBe('请输入名称');
  });

  it('startTitleEditing applies global placeholder to input', () => {
    d.setTitleStyle({ placeholder: '全局占位' });
    expect(am(d).startTitleEditing(0)).toBe(true);
    expect(am(d).titleInput!.placeholder).toBe('全局占位');
  });

  it('snapshot isolation: global change only affects later annotations', () => {
    d.setTitleStyle({ placeholder: '旧占位' });
    d.setAnnotationTitle(0, 'first');

    d.setTitleStyle({ placeholder: '新占位' });

    pushRect(200);
    d.setAnnotationTitle(1, 'second');

    const s0 = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    const s1 = am(d).getEffectiveTitleStyle(am(d).recordList[1]);
    expect(s0.placeholder).toBe('旧占位');
    expect(s1.placeholder).toBe('新占位');
  });

  it('startTitleEditing uses snapshotted placeholder for old annotation', () => {
    d.setTitleStyle({ placeholder: '旧占位' });
    d.setAnnotationTitle(0, 'first');

    d.setTitleStyle({ placeholder: '新占位' });

    am(d).startTitleEditing(0);
    expect(am(d).titleInput!.placeholder).toBe('旧占位');
  });

  it('per-annotation placeholder via setAnnotationTitleStyle', () => {
    d.setAnnotationTitle(0, 'test');
    d.setAnnotationTitleStyle(0, { placeholder: '专属占位' });
    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.placeholder).toBe('专属占位');

    am(d).startTitleEditing(0);
    expect(am(d).titleInput!.placeholder).toBe('专属占位');
  });

  it('per-annotation placeholder does not affect others', () => {
    pushRect(200);
    d.setAnnotationTitle(0, 'first');
    d.setAnnotationTitle(1, 'second');
    d.setAnnotationTitleStyle(0, { placeholder: '仅第一个' });

    const s1 = am(d).getEffectiveTitleStyle(am(d).recordList[1]);
    expect(s1.placeholder).toBe('输入标题...');
  });
});

describe('Title: getEffectiveTitleStyle / getEffectiveTitlePosition', () => {
  let c: HTMLDivElement;
  let d: Drawer;

  beforeEach(() => {
    c = document.createElement('div');
    c.id = 'tt-eff'; c.style.width = '800px'; c.style.height = '600px';
    document.body.appendChild(c);
    d = new Drawer({ id: 'tt-eff' });
    am(d).recordList.push({
      type: 'rect',
      data: [{ start: { x: 100, y: 100 }, width: 100, height: 100 }],
      status: 'fullfilled',
    });
  });

  afterEach(() => {
    d.destroy(); document.body.removeChild(c);
  });

  it('returns global defaults when annotation has no title set', () => {
    d.setTitleStyle({ color: '#ABC123' });
    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.color).toBe('#ABC123');
  });

  it('returns per-annotation style over global', () => {
    d.setAnnotationTitle(0, 'test');
    d.setAnnotationTitleStyle(0, { color: '#XYZ789' });
    d.setTitleStyle({ color: '#DEF456' });
    const s = am(d).getEffectiveTitleStyle(am(d).recordList[0]);
    expect(s.color).toBe('#XYZ789');
  });

  it('returns global position defaults when annotation has none', () => {
    d.setTitlePosition({ align: 'left' });
    const p = am(d).getEffectiveTitlePosition(am(d).recordList[0]);
    expect(p.align).toBe('left');
  });
});
