<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick, shallowRef } from 'vue';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { uid } from 'uid';

export type PDFSourceDataOption = Parameters<typeof getDocument>[0];

export interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;
  minScale?: number;
  maxScale?: number;
  scaleStep?: number;
  dampingFactor?: number;
  boundaryPadding?: number;
  pinchSensitivity?: number;
  maxScaleChange?: number;
  showProgress?: boolean;
  progressColor?: string;
  viewportBufferPages?: number; // 新增：可视区域外缓冲页数
}

export interface MobilePDFViewerEmits {
  (e: 'load-start'): void;
  (e: 'load-progress', progress: number): void;
  (e: 'load-complete', pageCount: number): void;
  (e: 'load-error', error: Error): void;
  (e: 'scale-change', scale: number): void;
}

export interface MobilePDFViewerProps {
  source?: PDFSourceDataOption;
  config?: MobilePDFViewerConfig;
  containerClass?: string;
  canvasClass?: string;
}

// Props定义
const props = withDefaults(defineProps<MobilePDFViewerProps>(), {
  containerClass: '',
  canvasClass: '',
  config: () => ({})
});

// Emits定义
const emit = defineEmits<MobilePDFViewerEmits>();

// 设置PDF.js worker
GlobalWorkerOptions.workerSrc = workerUrl;

// 内部状态
const wrapperRef = ref<HTMLElement | null>(null);
const innerRef = ref<HTMLElement | null>(null);
const canvasList = ref<{ canvas: HTMLCanvasElement|null, divEl: HTMLDivElement|null, renderStatus: 'pending'|'loading'|'complete' }[]>([]);
const isLoading = ref(false);
const loadingProgress = ref(0);
const observer = shallowRef<IntersectionObserver | null>(null);

// 缩放和平移状态
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const lastScale = ref(1);
const lastDistance = ref(0);
const baseScale = ref(1);
const isPinching = ref(false);

// 性能优化相关
const animationFrame = ref<number | null>(null);
const isTransforming = ref(false);
const transformQueue = ref<{ scale: number; x: number; y: number } | null>(null);

// 合并配置
const mergedConfig = computed(() => ({
  resolutionMultiplier: 3,
  minScale: 0.5,
  maxScale: 4,
  scaleStep: 0.1,
  dampingFactor: 0.85,
  boundaryPadding: 50,
  pinchSensitivity: 0.6,
  maxScaleChange: 0.25,
  showProgress: true,
  progressColor: '#007bff',
  viewportBufferPages: 2, // 默认缓冲2页
  ...props.config
}));

// 进度条样式
const progressStyle = computed(() => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  width: `${loadingProgress.value}%`,
  height: '2px',
  backgroundColor: mergedConfig.value.progressColor,
  transition: 'width 0.3s ease',
  zIndex: 9999
}));

// 边界限制
let cachedBoundaryLimits: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
let lastBoundaryScale = 0;

const getBoundaryLimits = () => {
  if (!wrapperRef.value || !innerRef.value) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  if (cachedBoundaryLimits && Math.abs(lastBoundaryScale - scale.value) < 0.001) {
    return cachedBoundaryLimits;
  }

  const wrapperRect = wrapperRef.value.getBoundingClientRect();
  const innerRect = innerRef.value.getBoundingClientRect();

  const scaledWidth = innerRect.width * scale.value;
  const scaledHeight = innerRect.height * scale.value;

  const minX = Math.min(0, wrapperRect.width - scaledWidth - mergedConfig.value.boundaryPadding);
  const maxX = Math.max(0, mergedConfig.value.boundaryPadding);
  const minY = Math.min(0, wrapperRect.height - scaledHeight - mergedConfig.value.boundaryPadding);
  const maxY = Math.max(0, mergedConfig.value.boundaryPadding);

  cachedBoundaryLimits = { minX, maxX, minY, maxY };
  lastBoundaryScale = scale.value;

  return cachedBoundaryLimits;
};

// 限制平移范围
const constrainTranslate = (x: number, y: number) => {
  const { minX, maxX, minY, maxY } = getBoundaryLimits();
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  };
};

// 计算两点间距离
const getDistance = (touches: TouchList) => {
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.sqrt(dx * dx + dy * dy);
};

// 获取触摸中心点
const getTouchCenter = (touches: TouchList) => {
  return {
    x: (touches[0].clientX + touches[1].clientX) * 0.5,
    y: (touches[0].clientY + touches[1].clientY) * 0.5
  };
};

// 应用变换
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

// 更新进度条
const updateProgress = (progress: number) => {
  loadingProgress.value = Math.min(Math.max(progress * 100, 0), 100);
  emit('load-progress', progress);
};

const div_el_height = ref();

// 渲染单页
const renderPage = async (pdf: any, pageNum: number, canvas: HTMLCanvasElement) => {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: baseScale.value });

  const context = canvas.getContext('2d')!;
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `100%`;
  //canvas.style.height = `${viewport.height / mergedConfig.value.resolutionMultiplier}px`;

  canvasList.value[pageNum - 1].renderStatus = 'loading'

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  canvasList.value[pageNum - 1].renderStatus = 'complete';

  if (!div_el_height.value) {
    div_el_height.value = (viewport.height / mergedConfig.value.resolutionMultiplier) + 'px';
  }
};

const create_canvas = () => {
  const can = document.createElement('canvas');
  can.className = ['mobile-pdf-canvas', props.canvasClass].join(' ');
  return can;
}

// 初始化PDF加载
const loadPDF = async (source?: PDFSourceDataOption) => {
  if (!source) return;

  try {
    isLoading.value = true;
    loadingProgress.value = 0;
    emit('load-start');

    resetPosition();

    if (wrapperRef.value) {
      wrapperRef.value.scrollTop = 0;
    }

    const loadingTask = getDocument(source);
    const pdf = await loadingTask.promise;

    const file_key:string = uid();

    await nextTick();

    const wrapperWidth = innerRef.value?.offsetWidth || 800;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    baseScale.value = (wrapperWidth / viewport.width) * mergedConfig.value.resolutionMultiplier;
    canvasList.value = Array(pdf.numPages).fill(null).map(() => {
      return {
        renderStatus: 'pending',
        key: file_key,
        canvas: null,
        divEl: null
      }
    });



    await nextTick();
    // 初始化IntersectionObserver
    observer.value = new IntersectionObserver((entries) => {
      entries.forEach(async (entry) => {
        const index = canvasList.value.findIndex(c => c.divEl === entry.target);
        if (index === -1) return;

        const canvas = canvasList.value[index].canvas || create_canvas();

        if (entry.isIntersecting && entry.target instanceof HTMLDivElement) {
          if (!entry.target?.contains(canvas)) {
            entry.target?.appendChild(canvas);
          }

          if (index >= 0 && canvasList.value[index].renderStatus === 'pending') {
            await renderPage(pdf, index + 1, canvas);
            updateProgress((index + 1) / pdf.numPages);
          }
        } else {
          if (canvasList.value[index].renderStatus === 'complete' && entry.target?.contains(canvas)) {
            entry.target?.removeChild(canvas);
            canvasList.value[index].canvas = null;
            canvasList.value[index].renderStatus = 'pending';
          }
        }
      });
    }, {
      root: wrapperRef.value,
      rootMargin: `100% 0px`,
      threshold: 0.1
    });

    canvasList.value.forEach((canvas, _index) => {
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

// 触摸事件处理
const handleTouchStart = (e: TouchEvent) => {
  cachedBoundaryLimits = null;

  if (e.touches.length === 1) {
    isDragging.value = true;
    isPinching.value = false;
    startX.value = e.touches[0].clientX - translateX.value;
    startY.value = e.touches[0].clientY - translateY.value;
  } else if (e.touches.length === 2) {
    e.preventDefault();
    isDragging.value = false;
    isPinching.value = true;
    lastDistance.value = getDistance(e.touches);
    lastScale.value = scale.value;
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (e.touches.length === 1 && isDragging.value) {
    const newX = e.touches[0].clientX - startX.value;
    const newY = e.touches[0].clientY - startY.value;

    if (scale.value > 1) {
      e.preventDefault();
      const constrained = constrainTranslate(newX, newY);
      applyTransform(scale.value, constrained.x, constrained.y, true);
    }
  } else if (e.touches.length === 2) {
    e.preventDefault();

    const distance = getDistance(e.touches);

    if (lastDistance.value === 0) {
      lastDistance.value = distance;
      return;
    }

    const scaleChange = distance / lastDistance.value;
    const dampedScaleChange = 1 + (scaleChange - 1) * mergedConfig.value.pinchSensitivity;

    let newScale = scale.value * dampedScaleChange;
    newScale = Math.max(mergedConfig.value.minScale, Math.min(mergedConfig.value.maxScale, newScale));

    const center = getTouchCenter(e.touches);
    const rect = wrapperRef.value?.getBoundingClientRect();

    if (rect) {
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;

      const scaleRatio = newScale / scale.value;
      const newX = centerX - (centerX - translateX.value) * scaleRatio;
      const newY = centerY - (centerY - translateY.value) * scaleRatio;

      const constrained = constrainTranslate(newX, newY);
      applyTransform(newScale, constrained.x, constrained.y, true);
    }

    emit('scale-change', newScale);
    lastDistance.value = distance;
  }
};

const handleTouchEnd = (e: TouchEvent) => {
  const wasDragging = isDragging.value;
  const wasPinching = isPinching.value;

  isDragging.value = false;

  if (e.touches.length < 2) {
    isPinching.value = false;
    lastDistance.value = 0;
    lastScale.value = scale.value;
  }

  if (!wasDragging && !wasPinching && scale.value < mergedConfig.value.minScale) {
    resetPosition();
  }
};

// 重置位置
const resetPosition = () => {
  applyTransform(1, 0, 0, true);
  lastScale.value = 1;
  lastDistance.value = 0;
  isPinching.value = false;
  cachedBoundaryLimits = null;
  emit('scale-change', 1);
};

// 双击缩放
const handleDoubleClick = (e: MouseEvent | TouchEvent) => {
  e.preventDefault();

  const isNormalScale = Math.abs(scale.value - 1) < 0.2;

  if (isNormalScale) {
    const rect = wrapperRef.value?.getBoundingClientRect();
    if (rect) {
      let centerX, centerY;

      if (e instanceof MouseEvent) {
        centerX = e.clientX - rect.left;
        centerY = e.clientY - rect.top;
      } else {
        const touch = e.changedTouches?.[0] || e.touches?.[0];
        centerX = touch?.clientX - rect.left || rect.width / 2;
        centerY = touch?.clientY - rect.top || rect.height / 2;
      }

      const newScale = 2;
      const newX = centerX - (centerX - translateX.value) * newScale;
      const newY = centerY - (centerY - translateY.value) * newScale;

      const constrained = constrainTranslate(newX, newY);
      applyTransform(newScale, constrained.x, constrained.y);

      emit('scale-change', newScale);
    }
  } else {
    resetPosition();
  }
};

// 计算变换样式
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

// 组件挂载
onMounted(() => {
  const inner = innerRef.value;
  if (inner) {
    inner.addEventListener('touchstart', handleTouchStart, { passive: false });
    inner.addEventListener('touchmove', handleTouchMove, { passive: false });
    inner.addEventListener('touchend', handleTouchEnd, { passive: true });
    inner.addEventListener('dblclick', handleDoubleClick);

    let lastTouchTime = 0;
    let touchCount = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    const handleTouchEndForDoubleClick = (e: TouchEvent) => {
      const now = Date.now();

      if (!isDragging.value && !isPinching.value && e.touches.length === 0 && e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const touchX = touch.clientX;
        const touchY = touch.clientY;

        const timeDiff = now - lastTouchTime;
        const distance = Math.sqrt(
          Math.pow(touchX - lastTouchX, 2) + Math.pow(touchY - lastTouchY, 2)
        );

        if (timeDiff < 300 && distance < 50) {
          touchCount++;
          if (touchCount === 2) {
            handleDoubleClick(e);
            touchCount = 0;
            return;
          }
        } else {
          touchCount = 1;
        }

        lastTouchTime = now;
        lastTouchX = touchX;
        lastTouchY = touchY;
      } else {
        touchCount = 0;
        lastTouchTime = 0;
      }
    };

    inner.addEventListener('touchend', handleTouchEndForDoubleClick);
  }

  if (props.source) {
    loadPDF(props.source);
  }
});

// 组件卸载
onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
  }

  if (observer.value) {
    observer.value.disconnect();
    observer.value = null;
  }

  const inner = innerRef.value;
  if (inner) {
    inner.removeEventListener('touchstart', handleTouchStart);
    inner.removeEventListener('touchmove', handleTouchMove);
    inner.removeEventListener('touchend', handleTouchEnd);
    inner.removeEventListener('dblclick', handleDoubleClick);
  }
});

// 暴露方法
defineExpose({
  loadPDF,
  resetPosition,
  getScale: () => scale.value,
  isLoading: () => isLoading.value,
  getPageCount: () => canvasList.value.length
});
</script>

<template>
  <div class="mobile-pdf-viewer">
    <div
      v-if="isLoading && mergedConfig.showProgress"
      :style="progressStyle"
      class="pdf-progress-bar"
    />
    <div
      ref="wrapperRef"
      :class="['pdf-container', containerClass]"
      class="mobile-pdf-container"
    >
      <div
        ref="innerRef"
        :style="transformStyle"
        class="pdf-inner"
      >
        <template v-for="(_, index) in canvasList" :key="_.key">
          <div
            :ref="(el:any) => canvasList[index] ? canvasList[index].divEl = el as HTMLDivElement : null"
            class="canvas_wrap_div"
            :style="{height: div_el_height, minHeight: '200px'}"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-pdf-viewer {
  position: relative;
  width: 100%;
  height: 100%;
}

.mobile-pdf-container {
  padding: 0 10px;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  user-select: none;
  -webkit-overflow-scrolling: touch;
}

.pdf-inner {
  width: 100%;
  will-change: transform;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  transform-style: preserve-3d;
}

.canvas_wrap_div{
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    margin: 10px auto;
}

.mobile-pdf-canvas {

  display: block;

  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
  transform: translateZ(0);
}

.pdf-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 2px;
  background-color: #007bff;
  transition: width 0.3s ease;
  z-index: 9999;
}
</style>
