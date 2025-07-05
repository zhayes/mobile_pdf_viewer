import { TouchCenter, BoundaryLimits } from './types';
import { BOUNDARY_SCALE_THRESHOLD } from './constants';

/**
 * 计算两点间距离
 */
export const getDistance = (touches: TouchList): number => {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * 获取触摸中心点
 */
export const getTouchCenter = (touches: TouchList): TouchCenter => {
  return {
    x: (touches[0].clientX + touches[1].clientX) * 0.5,
    y: (touches[0].clientY + touches[1].clientY) * 0.5
  };
};

/**
 * 创建Canvas元素
 */
export const createCanvas = (canvasClass: string): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.className = ['mobile-pdf-canvas', canvasClass].join(' ');
  return canvas;
};

/**
 * 获取边界限制
 */
export const getBoundaryLimits = (
  wrapperRef: HTMLElement | null,
  innerRef: HTMLElement | null,
  scale: number,
  boundaryPadding: number,
  cachedLimits: BoundaryLimits | null,
  lastScale: number
): BoundaryLimits => {
  if (!wrapperRef || !innerRef) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  }

  if (cachedLimits && Math.abs(lastScale - scale) < BOUNDARY_SCALE_THRESHOLD) {
    return cachedLimits;
  }

  const wrapperRect = wrapperRef.getBoundingClientRect();
  const innerRect = innerRef.getBoundingClientRect();

  const scaledWidth = innerRect.width * scale;
  const scaledHeight = innerRect.height * scale;

  const minX = Math.min(0, wrapperRect.width - scaledWidth - boundaryPadding);
  const maxX = Math.max(0, boundaryPadding);
  const minY = Math.min(0, wrapperRect.height - scaledHeight - boundaryPadding);
  const maxY = Math.max(0, boundaryPadding);

  return { minX, maxX, minY, maxY };
};

/**
 * 限制平移范围
 */
export const constrainTranslate = (
  x: number,
  y: number,
  boundaries: BoundaryLimits
): { x: number; y: number } => {
  return {
    x: Math.max(boundaries.minX, Math.min(boundaries.maxX, x)),
    y: Math.max(boundaries.minY, Math.min(boundaries.maxY, y))
  };
};

/**
 * 更新进度条
 */
export const updateProgress = (
  progress: number,
  progressRef: { value: number },
  emit: (event: 'load-progress', progress: number) => void
): void => {
  progressRef.value = Math.min(Math.max(progress * 100, 0), 100);
  emit('load-progress', progress);
};
