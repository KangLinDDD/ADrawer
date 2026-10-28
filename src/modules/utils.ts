/**
 * 工具函数模块
 * 包含几何计算、坐标转换等通用工具函数
 */

import type { Point, Rect, Polygon } from './types'

/**
 * 检测点是否在矩形内
 * 支持负宽高的情况（从右下往左上画）
 */
export function isPointInRect(point: Point, rect: Rect): boolean {
  // 处理负宽高的情况
  const x = rect.width >= 0 ? rect.start.x : rect.start.x + rect.width
  const y = rect.height >= 0 ? rect.start.y : rect.start.y + rect.height
  const w = Math.abs(rect.width)
  const h = Math.abs(rect.height)

  return point.x >= x && point.x <= x + w && point.y >= y && point.y <= y + h
}

/**
 * 检测点是否在多边形内（射线法）
 */
export function isPointInPolygon(point: Point, polygon: Polygon[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].point.x
    const yi = polygon[i].point.y
    const xj = polygon[j].point.x
    const yj = polygon[j].point.y

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}

/**
 * 从 URL 解析图片类型
 * 支持 png, jpg, jpeg, webp, gif, bmp, svg 等常见格式
 */
export function getImageTypeFromUrl(urlString: string): string {
  try {
    const url = new URL(urlString)
    const pathname = url.pathname.toLowerCase()
    
    // 支持的图片格式
    if (pathname.endsWith(".png")) return "png"
    if (pathname.endsWith(".jpg")) return "jpg"
    if (pathname.endsWith(".jpeg")) return "jpeg"
    if (pathname.endsWith(".webp")) return "webp"
    if (pathname.endsWith(".gif")) return "gif"
    if (pathname.endsWith(".bmp")) return "bmp"
    if (pathname.endsWith(".svg")) return "svg"
    
    // 默认返回 jpeg
    return "jpeg"
  } catch {
    return "jpeg"
  }
}

/**
 * canvas 真正支持的编码类型。
 */
export type CanvasImageType = "png" | "jpeg" | "webp"

/**
 * 把「URL 后缀」归一化成 `canvas.toDataURL()` 能**真正编码**的类型。
 *
 * `toDataURL(type)` 只认 `png` / `jpeg` / `webp`：其余（`image/jpg`、`image/gif`、
 * `image/bmp`、`image/svg` …）都不是合法的 canvas 编码类型，浏览器会**静默回落成 PNG**。
 * 于是 `data:image/png` 配上 `.jpg` 的文件名 —— 内容与后缀脱节，上传/回填按后缀或
 * Content-Type 校验时就会出问题。这里统一收敛：
 *
 * - `jpg` / `jpeg` → `jpeg`（`image/jpg` 不被支持，必须映射成 `image/jpeg`）
 * - `png` / `webp` → 原样
 * - `gif` / `bmp` / `svg` / 未知 → `png`（无损，也是浏览器的回落格式）
 */
export function toCanvasImageType(extension: string): CanvasImageType {
  const ext = String(extension ?? "").toLowerCase()

  if (ext === "jpg" || ext === "jpeg") return "jpeg"
  if (ext === "webp") return "webp"
  if (ext === "png") return "png"

  return "png"
}

/**
 * 导出 JPEG / WebP 的默认编码质量（`png` 无损，忽略该值）。
 *
 * 标注本身多是细线、小字，压缩过狠会在重新放大查看时糊掉，所以默认取 0.92
 * （也是多数浏览器 `toDataURL()` 不传质量时的默认档位）。
 */
export const DEFAULT_EXPORT_QUALITY = 0.92

/**
 * 归一化编码质量：非数字 / NaN 用默认值，越界按 0–1 裁剪。
 */
export function normalizeExportQuality(quality?: number): number {
  if (typeof quality !== "number" || Number.isNaN(quality)) {
    return DEFAULT_EXPORT_QUALITY
  }

  return Math.min(1, Math.max(0, quality))
}

/**
 * 将 base64 字符串转换为 File 对象
 */
export function base64ToFile(base64Data: string, filename: string): File {
  const parts = base64Data.split(";base64,")
  const contentType = parts[0].split(":")[1]
  const raw = window.atob(parts[1])
  const rawLength = raw.length
  const uInt8Array = new Uint8Array(rawLength)
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i)
  }

  const blob = new Blob([uInt8Array], { type: contentType })
  return new File([blob], filename, { type: contentType })
}

/**
 * 将 base64 字符串转换为 Blob 对象（用于上传）
 */
export function base64ToBlob(base64: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const parts = base64.split(";base64,")
    if (parts.length < 2) {
      reject(new Error("Invalid base64 string"))
      return
    }

    const mime = parts[0].split(":")[1]
    const byteString = atob(parts[1])
    const arrayBuffer = new ArrayBuffer(byteString.length)
    const uint8Array = new Uint8Array(arrayBuffer)

    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i)
    }

    resolve(new Blob([arrayBuffer], { type: mime }))
  })
}

/**
 * 计算缩放增量
 */
export function getZoomDelta(currentScale: number, zoomIn: boolean): number {
  // 使用动态缩放增量
  if (currentScale < 2) {
    return zoomIn ? 0.1 : -0.1
  } else if (currentScale < 5) {
    return zoomIn ? 0.05 : -0.05
  } else {
    return zoomIn ? 0.02 : -0.02
  }
}

/**
 * 深拷贝（优先 structuredClone，回退 JSON 序列化）
 * 仅用于纯 JSON 安全数据（标注数据均为数字/字符串/普通对象）
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * 生成标注唯一 ID（优先 crypto.randomUUID，旧环境回退随机串）
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
