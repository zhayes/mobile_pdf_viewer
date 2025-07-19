import { ref, computed, onUnmounted, nextTick, shallowRef } from 'vue';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from 'pdfjs-dist';
import { uid } from 'uid';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  CanvasItem,
  BoundaryLimits,
  MobilePDFViewerConfig,
  MobilePDFViewerEmits,
  PDFSourceDataOption,
} from './types';

import {
  getBoundaryLimits,
  constrainTranslate,
  updateProgress,
  createCanvas
} from './utils';

// 设置 PDF.js 的 worker 地址
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * 处理变换（平移、缩放）的组合式函数。
 */
export const useTransform = (config: Required<MobilePDFViewerConfig>) => {
  const scale = ref(1);
  const translateX = ref(0);
  const translateY = ref(0);
  const isDragging = ref(false);
  const isPinching = ref(false);

  // 用于惯性滚动
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
    velocityX.value = vx * 25; // 速度乘数，用于改善手感
    velocityY.value = vy * 25;
    if (Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1) {
      animationFrame.value = requestAnimationFrame(animationLoop);
    }
  };

  const applyTransform = (newScale: number, newX: number, newY: number) => {
    stopInertialScroll();
    scale.value = newScale;
    translateX.value = newX;
    translateY.value = newY;
  };

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

  const constrainTranslateForRefs = (
    x: number,
    y: number,
    wrapperRef: HTMLElement | null,
    innerRef: HTMLElement | null
  ) => {
    // 为动画循环缓存引用
    _wrapperRef = wrapperRef;
    _innerRef = innerRef;

    const boundaries = getBoundaryLimitsForRefs(wrapperRef, innerRef);
    return constrainTranslate(x, y, boundaries);
  };

  const resetPosition = (emit: MobilePDFViewerEmits) => {
    stopInertialScroll();
    applyTransform(1, 0, 0);
    isPinching.value = false;
    cachedBoundaryLimits = null;
    emit('scale-change', 1);
  };

  const clearBoundaryCache = () => {
    cachedBoundaryLimits = null;
  };

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
    stopInertialScroll();
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
 * 处理 PDF 渲染逻辑的组合式函数。
 */
export const usePDFRenderer = (config: Required<MobilePDFViewerConfig>) => {
  const canvasList = ref<CanvasItem[]>([]);
  const isLoading = ref(false);
  const loadingProgress = ref(0);
  const baseScale = ref(1);
  const observer = ref<IntersectionObserver | null>(null);
  const pdfDoc = shallowRef<PDFDocumentProxy | null>(null);

  /**
   * 将单个页面渲染到 canvas 上。
   */
  const renderPage = async (pdf: PDFDocumentProxy, pageNum: number, canvas: HTMLCanvasElement) => {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: baseScale.value });
      const item = canvasList.value[pageNum - 1];

      if (!canvas) {
        page.cleanup();
        item.renderStatus = 'pending';
        return;
      }

      const context = canvas.getContext('2d')!;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `100%`;


      item.renderStatus = 'loading';

      const task = page.render({ canvasContext: context, viewport });
      item.rendering_task = task;

      await task.promise;

      // 关键：清理页面资源，防止内存泄漏。
      page.cleanup();
      item.rendering_task = null;

      item.renderStatus = 'complete';
      if (item.divEl) {
        item.divEl.style.height = (viewport.height / config.resolutionMultiplier) + 'px';
      }
    } catch (err) {
      console.log(err);
    }
  };

  /**
   * 初始化并加载新的 PDF 文档。
   */

  type TransformAction = ReturnType<typeof useTransform>;

  type PickFunctionKeys<T> = {
    [K in keyof T as T[K] extends Function ? K : never]: T[K]
  };

  const loadPDF = async (
    source: PDFSourceDataOption,
    wrapperRef: HTMLElement | null,
    innerRef: HTMLElement | null,
    canvasClass: string,
    emit: MobilePDFViewerEmits,
    transformAction: PickFunctionKeys<TransformAction>
  ) => {
    try {
      isLoading.value = true;
      loadingProgress.value = 0;
      emit('load-start');

      if (wrapperRef) {
        wrapperRef.scrollTop = 0;
      }

      const loadingTask = getDocument(source);
      const newPdfDoc = await loadingTask.promise;

      // 只有在新 PDF 成功加载后，才清理旧的资源。
      cleanupPDF();

      pdfDoc.value = newPdfDoc;
      const pdf = pdfDoc.value;

      await nextTick();

      const wrapperWidth = innerRef?.offsetWidth || 800;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      page.cleanup(); // 清理用于获取尺寸的页面

      baseScale.value = (wrapperWidth / viewport.width) * config.resolutionMultiplier;

      canvasList.value = Array(pdf.numPages).fill(null).map(() => ({
        renderStatus: 'pending' as const,
        key:  uid(),
        canvas: null,
        divEl: null,
        rendering_task: null
      }));

      await nextTick();

      transformAction.resetPosition(emit);

      // 设置 IntersectionObserver 用于虚拟滚动。
      observer.value = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
          const index = canvasList.value.findIndex(c => c.divEl === entry.target);
          if (index === -1) return;

          const item = canvasList.value[index];

          if (entry.isIntersecting) {
            // 目标进入视口，进行渲染。
            const canvas = item.canvas || createCanvas(canvasClass);
            item.canvas = canvas;

            if (entry.target instanceof HTMLDivElement && !entry.target.contains(canvas)) {
              entry.target.appendChild(canvas);
            }

            if (item.renderStatus === 'pending') {
              await renderPage(pdf, index + 1, canvas);
              updateProgress((index + 1) / pdf.numPages, loadingProgress, emit);
            }
          } else {
            // 目标离开视口，无论渲染状态如何都执行清理。
            const canvas = item.canvas;
            if (canvas && canvasList.value.length>1 && entry.target instanceof HTMLDivElement && entry.target.contains(canvas)) {
              item.rendering_task?.cancel();
              item.rendering_task = null;
              entry.target.removeChild(canvas);
              item.canvas = null;
              item.renderStatus = 'pending';
            }
          }
        });
      }, {
        root: wrapperRef,
        rootMargin: '100% 0px', // 预加载距离视口高度 100% 的页面
        threshold: 0.1
      });

      canvasList.value.forEach((item) => {
        if (item.divEl) {
          observer.value!.observe(item.divEl);
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
   * 清理 IntersectionObserver。
   */
  const cleanupObserver = () => {
    if (observer.value) {
      // 在断开连接前取消观察所有目标，以防止内存泄漏。
      canvasList.value.forEach(item => {
        if (item.divEl) {
          observer.value!.unobserve(item.divEl);
        }
      });
      observer.value.disconnect();
      observer.value = null;
    }
  };

  /**
   * 清理所有 PDF 相关的资源。
   */
  const cleanupPDF = () => {
    cleanupObserver();
    if (pdfDoc.value) {
      pdfDoc.value.destroy();
      pdfDoc.value = null;
    }
    canvasList.value = [];
  };

  onUnmounted(() => {
    cleanupPDF();
  });

  return {
    canvasList,
    isLoading,
    loadingProgress,
    loadPDF,
    cleanupObserver
  };
};
