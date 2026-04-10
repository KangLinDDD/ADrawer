/**
 * 视图管理模块
 * 负责视口尺寸、缩放、偏移、边界约束等视图相关功能
 */

import type { ViewportSize, ViewportOffset } from './types'

export class ViewportManager {
  // 视口尺寸
  public width = 0
  public height = 0

  // 原始图片尺寸
  public originalWidth = 0
  public originalHeight = 0

  // 视图变换属性
  public scale = 1
  public minScale = 1
  public maxScale = 10
  public offset: ViewportOffset = { x: 0, y: 0 }

  // 初始视图状态
  public initialScale = 1
  public initialOffset: ViewportOffset = { x: 0, y: 0 }
  public isInitialScale = true

  // 边界约束
  public minOffsetX = 0
  public minOffsetY = 0
  public maxOffsetX = 0
  public maxOffsetY = 0

  /**
   * 设置视口尺寸
   */
  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  /**
   * 设置原始图片尺寸
   */
  setOriginalSize(width: number, height: number): void {
    this.originalWidth = width
    this.originalHeight = height
  }

  /**
   * 计算初始视图参数
   */
  calculateInitialView(): void {
    if (this.originalWidth === 0 || this.originalHeight === 0) return

    // 计算缩放比例以适应容器
    const scaleX = this.width / this.originalWidth
    const scaleY = this.height / this.originalHeight
    this.scale = Math.min(scaleX, scaleY)
    this.initialScale = this.scale

    // 设置最小缩放为初始缩放比例
    this.minScale = this.initialScale

    // 计算居中位置
    this.offset = {
      x: (this.width - this.originalWidth * this.scale) / 2,
      y: (this.height - this.originalHeight * this.scale) / 2,
    }
    this.initialOffset = { ...this.offset }

    // 计算边界约束
    this.calculateBoundaries()

    // 标记为初始状态
    this.isInitialScale = true
  }

  /**
   * 计算边界约束
   */
  calculateBoundaries(): void {
    const imgScaledWidth = this.originalWidth * this.scale
    const imgScaledHeight = this.originalHeight * this.scale

    // 最大偏移量（图像完全在视口内）
    this.maxOffsetX = 0
    this.maxOffsetY = 0

    // 最小偏移量（图像完全覆盖视口）
    this.minOffsetX = this.width - imgScaledWidth
    this.minOffsetY = this.height - imgScaledHeight

    // 确保最小值不大于最大值
    if (this.minOffsetX > this.maxOffsetX) {
      ;[this.minOffsetX, this.maxOffsetX] = [this.maxOffsetX, this.minOffsetX]
    }
    if (this.minOffsetY > this.maxOffsetY) {
      ;[this.minOffsetY, this.maxOffsetY] = [this.maxOffsetY, this.minOffsetY]
    }
  }

  /**
   * 确保视图在合理范围内
   */
  constrainViewport(): void {
    // 约束X轴
    if (this.offset.x > this.maxOffsetX) {
      this.offset.x = this.maxOffsetX
    } else if (this.offset.x < this.minOffsetX) {
      this.offset.x = this.minOffsetX
    }

    // 约束Y轴
    if (this.offset.y > this.maxOffsetY) {
      this.offset.y = this.maxOffsetY
    } else if (this.offset.y < this.minOffsetY) {
      this.offset.y = this.minOffsetY
    }
  }

  /**
   * 将画布坐标转换为图像坐标
   */
  toImageCoordinates(canvasX: number, canvasY: number): { x: number; y: number } {
    return {
      x: (canvasX - this.offset.x) / this.scale,
      y: (canvasY - this.offset.y) / this.scale,
    }
  }

  /**
   * 将图像坐标转换为画布坐标
   */
  toCanvasCoordinates(imgX: number, imgY: number): { x: number; y: number } {
    return {
      x: this.offset.x + imgX * this.scale,
      y: this.offset.y + imgY * this.scale,
    }
  }

  /**
   * 更新缩放比例
   */
  updateScale(newScale: number, centerX: number, centerY: number): void {
    const oldScale = this.scale

    // 计算缩放前中心点在图像中的位置
    const centerImgX = (centerX - this.offset.x) / oldScale
    const centerImgY = (centerY - this.offset.y) / oldScale

    // 更新缩放比例
    this.scale = Math.max(this.minScale, Math.min(newScale, this.maxScale))

    // 计算缩放后中心点应该的位置
    const newCenterX = centerImgX * this.scale + this.offset.x
    const newCenterY = centerImgY * this.scale + this.offset.y

    // 调整偏移量以保持中心点不变
    this.offset.x += centerX - newCenterX
    this.offset.y += centerY - newCenterY

    // 更新边界约束
    this.calculateBoundaries()
    this.constrainViewport()

    // 更新初始状态标志
    this.isInitialScale = this.scale === this.initialScale
  }

  /**
   * 重置视图到初始状态
   */
  resetToInitial(): void {
    this.scale = this.initialScale
    this.offset = { ...this.initialOffset }
    this.calculateBoundaries()
    this.isInitialScale = true
  }

  /**
   * 更新偏移量（用于拖拽）
   */
  updateOffset(dx: number, dy: number): void {
    this.offset.x += dx
    this.offset.y += dy
    this.constrainViewport()
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.scale = 1
    this.minScale = 1
    this.offset = { x: 0, y: 0 }
    this.initialScale = 1
    this.initialOffset = { x: 0, y: 0 }
    this.isInitialScale = true
    this.minOffsetX = 0
    this.minOffsetY = 0
    this.maxOffsetX = 0
    this.maxOffsetY = 0
  }
}
