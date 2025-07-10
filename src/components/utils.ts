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

  // Get computed styles to account for padding set in CSS, which affects the coordinate system.
  const computedStyle = window.getComputedStyle(wrapperRef);
  const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
  const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
  const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;

  // Use layout dimensions which are unaffected by CSS transforms.
  // The actual content area width is the clientWidth minus horizontal paddings.
  const contentAreaWidth = wrapperRef.clientWidth - paddingLeft - paddingRight;
  const contentAreaHeight = wrapperRef.clientHeight - paddingTop - paddingBottom;

  // `innerRef` has `width: 100%` of its containing block, so its `clientWidth` is the content's base width at scale=1.
  const contentBaseWidth = innerRef.clientWidth;
  const contentBaseHeight = innerRef.scrollHeight;

  const scaledWidth = contentBaseWidth * scale;
  const scaledHeight = contentBaseHeight * scale;

  let minX: number, maxX: number;
  if (scaledWidth > contentAreaWidth) {
    // Content is wider than container's content area, allow panning.
    minX = contentAreaWidth - scaledWidth - boundaryPadding;
    maxX = boundaryPadding;
  } else {
    // Content is narrower, no horizontal panning needed/allowed.
    minX = 0;
    maxX = 0;
  }

  let minY: number, maxY: number;
  if (scaledHeight > contentAreaHeight) {
    // Content is taller, allow vertical panning.
    minY = contentAreaHeight - scaledHeight - boundaryPadding;
    maxY = boundaryPadding;
  } else {
    // Content is shorter, no vertical panning needed/allowed.
    minY = 0;
    maxY = 0;
  }

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
