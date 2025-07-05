import { ref, computed, onUnmounted, nextTick } from 'vue';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import { uid } from 'uid';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  CanvasItem,
  TransformQueue,
  BoundaryLimits,
  MobilePDFViewerConfig,
  MobilePDFViewerEmits,
  PDFSourceDataOption
} from './types';

import {
  getBoundaryLimits,
  constrainTranslate,
  updateProgress,
  createCanvas
} from './utils';

// 设置PDF.js worker
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 变换相关的组合式函数
 */
export const useTransform = (config: Required<MobilePDFViewerConfig>) => {
  const scale = ref(1);
  const translateX = ref(0);
  const translateY = ref(0);
  const isDragging = ref(false);
  const isPinching = ref(false);
  const isTransforming = ref(false);
  const animationFrame = ref<number | null>(null);
  const transformQueue = ref<TransformQueue | null>(null);

  // 边界限制缓存
  let cachedBoundaryLimits: BoundaryLimits | null = null;
  let lastBoundaryScale = 0;

  /**
   * 应用变换
   */
  const applyTransform = (newScale: number, newX: number, newY: number, immediate = false) => {
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value);
    }

    if (immediate) {
      scale.value = newScale;
      translateX.value = newX;
      translateY.value = newY;
      isTransforming.value = false;
      return;
    }

    transformQueue.value = { scale: newScale, x: newX, y: newY };

    if (!isTransforming.value) {
      isTransforming.value = true;
      animationFrame.value = requestAnimationFrame(() => {
        if (transformQueue.value) {
          scale.value = transformQueue.value.scale;
          translateX.value = transformQueue.value.x;
          translateY.value = transformQueue.value.y;
          transformQueue.value = null;
        }
        isTransforming.value = false;
      });
    }
  };

  /**
   * 获取边界限制
   */
  const getBoundaryLimitsForRefs = (
    wrapperRef: HTMLElement | null,
    innerRef: HTMLElement | null
  ): BoundaryLimits => {
    const limits = getBoundaryLimits(
      wrapperRef,
      innerRef,
      scale.value,
      config.boundaryPadding,
      cachedBoundaryLimits,
      lastBoundaryScale
    );

    cachedBoundaryLimits = limits;
    lastBoundaryScale = scale.value;

    return limits;
  };

  /**
   * 限制平移范围
   */
  const constrainTranslateForRefs = (
    x: number,
    y: number,
    wrapperRef: HTMLElement | null,
    innerRef: HTMLElement | null
  ) => {
    const boundaries = getBoundaryLimitsForRefs(wrapperRef, innerRef);
    return constrainTranslate(x, y, boundaries);
  };

  /**
   * 重置位置
   */
  const resetPosition = (emit: MobilePDFViewerEmits) => {
    applyTransform(1, 0, 0, true);
    isPinching.value = false;
    cachedBoundaryLimits = null;
    emit('scale-change', 1);
  };

  /**
   * 清理边界缓存
   */
  const clearBoundaryCache = () => {
    cachedBoundaryLimits = null;
  };

  /**
   * 计算变换样式
   */
  const transformStyle = computed(() => {
    const x = scale.value > 1 ? translateX.value : 0;
    const y = scale.value > 1 ? translateY.value : 0;
    const s = Math.max(scale.value, 1);

    return {
      transform: `translate3d(${x}px, ${y}px, 0) scale(${s})`,
      transformOrigin: '0 0',
      transition: (isDragging.value || isPinching.value) ? 'none' : 'transform 0.3s ease-out',
      touchAction: scale.value > 1 ? 'none' : 'auto',
      willChange: (isDragging.value || isPinching.value) ? 'transform' : 'auto'
    };
  });

  onUnmounted(() => {
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value);
    }
  });

  return {
    scale,
    translateX,
    translateY,
    isDragging,
    isPinching,
    isTransforming,
    transformStyle,
    applyTransform,
    constrainTranslateForRefs,
    resetPosition,
    clearBoundaryCache
  };
};

/**
 * PDF渲染相关的组合式函数
 */
export const usePDFRenderer = (config: Required<MobilePDFViewerConfig>) => {
  const canvasList = ref<CanvasItem[]>([]);
  const isLoading = ref(false);
  const loadingProgress = ref(0);
  const baseScale = ref(1);
  const divElHeight = ref<string>();
  const observer = ref<IntersectionObserver | null>(null);

  /**
   * 渲染单页
   */
  const renderPage = async (pdf: any, pageNum: number, canvas: HTMLCanvasElement) => {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: baseScale.value });

    const context = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `100%`;

    canvasList.value[pageNum - 1].renderStatus = 'loading';

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    canvasList.value[pageNum - 1].renderStatus = 'complete';

    if (!divElHeight.value) {
      divElHeight.value = (viewport.height / config.resolutionMultiplier) + 'px';
    }
  };

  /**
   * 初始化PDF加载
   */
  const loadPDF = async (
    source: PDFSourceDataOption,
    wrapperRef: HTMLElement | null,
    innerRef: HTMLElement | null,
    canvasClass: string,
    emit: MobilePDFViewerEmits
  ) => {
    try {
      isLoading.value = true;
      loadingProgress.value = 0;
      emit('load-start');

      if (wrapperRef) {
        wrapperRef.scrollTop = 0;
      }

      const loadingTask = getDocument(source);
      const pdf = await loadingTask.promise;

      const fileKey = uid();
      await nextTick();

      const wrapperWidth = innerRef?.offsetWidth || 800;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });

      baseScale.value = (wrapperWidth / viewport.width) * config.resolutionMultiplier;
      canvasList.value = Array(pdf.numPages).fill(null).map(() => ({
        renderStatus: 'pending' as const,
        key: fileKey,
        canvas: null,
        divEl: null
      }));

      await nextTick();

      // 初始化IntersectionObserver
      observer.value = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
          const index = canvasList.value.findIndex(c => c.divEl === entry.target);
          if (index === -1) return;

          const canvas = canvasList.value[index].canvas || createCanvas(canvasClass);
          canvasList.value[index].canvas = canvas;

          if (entry.isIntersecting && entry.target instanceof HTMLDivElement) {
            if (!entry.target.contains(canvas)) {
              entry.target.appendChild(canvas);
            }

            if (canvasList.value[index].renderStatus === 'pending') {
              await renderPage(pdf, index + 1, canvas);
              updateProgress((index + 1) / pdf.numPages, loadingProgress, emit);
            }
          } else {
            if (canvasList.value[index].renderStatus === 'complete' && entry.target.contains(canvas)) {
              entry.target.removeChild(canvas);
              canvasList.value[index].canvas = null;
              canvasList.value[index].renderStatus = 'pending';
            }
          }
        });
      }, {
        root: wrapperRef,
        rootMargin: '100% 0px',
        threshold: 0.1
      });

      canvasList.value.forEach((canvas) => {
        if (canvas.divEl) {
          observer.value!.observe(canvas.divEl);
        }
      });

      emit('load-complete', pdf.numPages);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      emit('load-error', error);
      throw error;
    } finally {
      isLoading.value = false;
      loadingProgress.value = 0;
    }
  };

  /**
   * 清理Observer
   */
  const cleanupObserver = () => {
    if (observer.value) {
      observer.value.disconnect();
      observer.value = null;
    }
  };

  onUnmounted(() => {
    cleanupObserver();
  });

  return {
    canvasList,
    isLoading,
    loadingProgress,
    baseScale,
    divElHeight,
    loadPDF,
    cleanupObserver
  };
};

/**
 * 进度条相关的组合式函数
 */
export const useProgress = (config: Required<MobilePDFViewerConfig>) => {
  const progressStyle = computed(() => ({
    position: 'absolute' as const,
    top: '0',
    left: '0',
    width: `${0}%`,
    height: '2px',
    backgroundColor: config.progressColor,
    transition: 'width 0.3s ease',
    zIndex: 9999
  }));

  return {
    progressStyle
  };
};
