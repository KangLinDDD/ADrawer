/**
 * 导出缩放换算
 *
 * 导出图按「原始图像分辨率」绘制，而交互画布只有「容器分辨率」，
 * 二者相差 1 / viewport.scale 倍。交互画布上按像素给定的量
 * （字号、内边距、圆角、线宽、顶点半径、标题间距与偏移）必须同倍放大，
 * 否则导出图里的文字相对整张图会缩小同样的倍数 —— 页面再把导出图缩进小面板显示时，
 * 文字会被重采样成几像素高的糊点（看起来像没画出来）。
 */

/** 画布像素量 → 导出图像素量（四舍五入，让绘制边界落在整像素上） */
export function scalePx(value: number, ratio: number): number {
  return Math.round(value * ratio)
}

/** 线宽 / 顶点半径等不允许变成 0 的量 */
export function scaleStrokePx(value: number, ratio: number): number {
  return Math.max(1, scalePx(value, ratio))
}

/** 解析字体字符串中的 px 字号，兼容 `bold 14px Arial` / `13.5px Arial` */
export function parseFontSize(font: string, fallback = 12): number {
  const match = font.match(/(\d+(?:\.\d+)?)px/)
  return match ? parseFloat(match[1]) : fallback
}

/** 按倍率缩放字体字符串中的字号，保留 bold/italic 前缀与字体族 */
export function scaleFont(font: string, ratio: number): string {
  return font.replace(
    /(\d+(?:\.\d+)?)px/,
    (_match, size: string) => `${scaleStrokePx(parseFloat(size), ratio)}px`
  )
}
