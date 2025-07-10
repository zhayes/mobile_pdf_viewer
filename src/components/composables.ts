import { ref, computed, onUnmounted, nextTick, ShallowRef, shallowRef } from 'vue';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy, type PDFDocumentLoadingTask } from 'pdfjs-dist';
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

  // For inertial scrolling
  const velocityX = ref(0);
  const velocityY = ref(0);
  const animationFrame = ref<number | null>(null);
  let _wrapperRef: HTMLElement | null = null;
  let _innerRef: HTMLElement | null = null;

  // 边界限制缓存
  let cachedBoundaryLimits: BoundaryLimits | null = null;
  let lastBoundaryScale = 0;

  const stopInertialScroll = () => {
    if (animationFrame.value) {
      cancelAnimationFrame(animationFrame.value);
      animationFrame.value = null;
    }
    velocityX.value = 0;
    velocityY.value = 0;
  };

  const animationLoop = () => {
    if (!_wrapperRef || !_innerRef) {
      stopInertialScroll();
      return;
    }

    const newX = translateX.value + velocityX.value;
    const newY = translateY.value + velocityY.value;

    const constrained = constrainTranslateForRefs(newX, newY, _wrapperRef, _innerRef);
    translateX.value = constrained.x;
    translateY.value = constrained.y;

    if (constrained.x !== newX) velocityX.value = 0;
    if (constrained.y !== newY) velocityY.value = 0;

    velocityX.value *= config.dampingFactor;
    velocityY.value *= config.dampingFactor;

    if (Math.abs(velocityX.value) < 0.1 && Math.abs(velocityY.value) < 0.1) {
      stopInertialScroll();
      return;
    }
    animationFrame.value = requestAnimationFrame(animationLoop);
  };

  const startInertialScroll = (vx: number, vy: number) => {
    stopInertialScroll();
    velocityX.value = vx * 25; // Velocity multiplier for a better feel
    velocityY.value = vy * 25;
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      animationFrame.value = requestAnimationFrame(animationLoop);
    }
  };

  /**
   * 应用变换
   */
  const applyTransform = (newScale: number, newX: number, newY: number) => {
    stopInertialScroll();
    scale.value = newScale;
    translateX.value = newX;
    translateY.value = newY;
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
    // Cache refs for the animation loop
    _wrapperRef = wrapperRef;
    _innerRef = innerRef;

    const boundaries = getBoundaryLimitsForRefs(wrapperRef, innerRef);
    return constrainTranslate(x, y, boundaries);
  };

  /**
   * 重置位置
   */
  const resetPosition = (emit: MobilePDFViewerEmits) => {
    stopInertialScroll();
    applyTransform(1, 0, 0);
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
    return {
      transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
      transformOrigin: '0 0',
      transition: (isDragging.value || animationFrame.value !== null) ? 'none' : 'transform 0.3s ease-out',
      touchAction: 'none',
      willChange: (isDragging.value || isPinching.value || animationFrame.value !== null) ? 'transform' : 'auto'
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
    transformStyle,
    applyTransform,
    constrainTranslateForRefs,
    resetPosition,
    clearBoundaryCache,
    startInertialScroll,
    stopInertialScroll
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
  const observer = ref<IntersectionObserver | null>(null);
  const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);

  /**
   * 渲染单页
   */
  const renderPage = async (pdf: PDFDocumentProxy, pageNum: number, canvas: HTMLCanvasElement) => {
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

    page.cleanup();

    canvasList.value[pageNum - 1].renderStatus = 'complete';
    canvasList.value[pageNum - 1].divEl!.style.height = (viewport.height / config.resolutionMultiplier) + 'px';
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

      cleanupPDF();

      const loadingTask = getDocument(source);
      pdfDoc.value = await loadingTask.promise;
      const pdf = pdfDoc.value;

      await nextTick();

      const wrapperWidth = innerRef?.offsetWidth || 800;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });

      baseScale.value = (wrapperWidth / viewport.width) * config.resolutionMultiplier;

      canvasList.value = Array(pdf.numPages).fill(null).map(() => ({
        renderStatus: 'pending' as const,
        key:  uid(),
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
    try {
      if (observer.value) {
        observer.value.disconnect();
        observer.value = null;
      }
    } catch (err) { }
  };

  /**
   * 清理PDF相关资源
   */
  const cleanupPDF = () => {
    if (pdfDoc.value) {
      pdfDoc.value.destroy();
      pdfDoc.value = null;
    }
    cleanupObserver();
  };

  onUnmounted(() => {
    cleanupPDF();
  });

  return {
    canvasList,
    isLoading,
    loadingProgress,
    baseScale,
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
