<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, nextTick } from 'vue';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export interface PDFSourceDataOption {
  url?: string;
  data?: Uint8Array;
  httpHeaders?: Record<string, string>;
  withCredentials?: boolean;
}

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
}

export interface MobilePDFViewerEmits {
  (e: 'load-start'): void;
  (e: 'load-progress', progress: number): void;
  (e: 'load-complete', pageCount: number): void;
  (e: 'load-error', error: Error): void;
  (e: 'scale-change', scale: number): void;
}

// Props定义
const props = withDefaults(defineProps<{
  source?: PDFSourceDataOption;
  config?: MobilePDFViewerConfig;
  containerClass?: string;
  canvasClass?: string;
}>(), {
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
const canvasList = ref<{ el: HTMLCanvasElement | null }[]>([]);
const isLoading = ref(false);
const loadingProgress = ref(0);

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

// 合并配置
const mergedConfig = computed(() => ({
  resolutionMultiplier: 3,
  minScale: 0.5,
  maxScale: 4,
  scaleStep: 0.1,
  dampingFactor: 0.85,
  boundaryPadding: 50,
  pinchSensitivity: 0.4,
  maxScaleChange: 0.15,
  showProgress: true,
  progressColor: '#007bff',
  ...props.config
}));

// 简单的进度条组件
const progressStyle = computed(() => ({
  position: 'fixed' as const,
  top: '0',
  left: '0',
  width: `${loadingProgress.value}%`,
  height: '2px',
  backgroundColor: mergedConfig.value.progressColor,
  transition: 'width 0.3s ease',
  zIndex: 9999
}));

// 边界限制
const getBoundaryLimits = () => {
  if (!wrapperRef.value || !innerRef.value) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };

  const wrapperRect = wrapperRef.value.getBoundingClientRect();
  const innerRect = innerRef.value.getBoundingClientRect();

  const scaledWidth = innerRect.width * scale.value;
  const scaledHeight = innerRect.height * scale.value;

  const minX = Math.min(0, wrapperRect.width - scaledWidth - mergedConfig.value.boundaryPadding);
  const maxX = Math.max(0, mergedConfig.value.boundaryPadding);
  const minY = Math.min(0, wrapperRect.height - scaledHeight - mergedConfig.value.boundaryPadding);
  const maxY = Math.max(0, mergedConfig.value.boundaryPadding);

  return { minX, maxX, minY, maxY };
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
  const [touch1, touch2] = [touches[0], touches[1]];
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
};

// 获取触摸中心点
const getTouchCenter = (touches: TouchList) => {
  const [touch1, touch2] = [touches[0], touches[1]];
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
};

// 更新进度条
const updateProgress = (progress: number) => {
  loadingProgress.value = Math.min(Math.max(progress * 100, 0), 100);
  emit('load-progress', progress);
};

// 渲染PDF页面
const renderPage = async (source: PDFSourceDataOption) => {
  if (!source) return;

  try {
    isLoading.value = true;
    loadingProgress.value = 0;
    emit('load-start');

    const loadingTask = getDocument(source);
    const pdf = await loadingTask.promise;

    // 等待DOM更新
    await nextTick();

    // 获取容器宽度用于初始缩放
    const wrapperWidth = innerRef.value?.offsetWidth || 800;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    // 计算基础缩放比例，使PDF适应容器宽度
    baseScale.value = (wrapperWidth / viewport.width) * mergedConfig.value.resolutionMultiplier;

    // 初始化canvas列表
    canvasList.value = Array(pdf.numPages).fill(null).map(() => ({ el: null }));

    // 等待DOM更新
    await nextTick();

    // 渲染所有页面
    for (let i = 0; i < pdf.numPages; i++) {
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale: baseScale.value });
      const canvas = canvasList.value[i].el;

      if (!canvas) continue;

      const context = canvas.getContext('2d')!;

      // 设置canvas实际尺寸
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // 设置CSS显示尺寸
      canvas.style.width = `${wrapperWidth}px`;
      canvas.style.height = `${viewport.height / mergedConfig.value.resolutionMultiplier}px`;

      // 渲染页面
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      // 更新进度条
      updateProgress((i + 1) / pdf.numPages);
    }

    // 重置位置
    resetPosition();

    // 滚动到顶部
    if (wrapperRef.value) {
      wrapperRef.value.scrollTop = 0;
    }

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
      translateX.value = constrained.x;
      translateY.value = constrained.y;
    }
  } else if (e.touches.length === 2) {
    e.preventDefault();

    const distance = getDistance(e.touches);

    if (lastDistance.value === 0) {
      lastDistance.value = distance;
      return;
    }

    const rawScaleChange = distance / lastDistance.value;
    const logScaleChange = Math.log(rawScaleChange) * mergedConfig.value.pinchSensitivity + 1;

    const clampedScaleChange = Math.max(
      1 - mergedConfig.value.maxScaleChange,
      Math.min(1 + mergedConfig.value.maxScaleChange, logScaleChange)
    );

    let newScale = scale.value * clampedScaleChange;
    newScale = Math.min(Math.max(newScale, mergedConfig.value.minScale), mergedConfig.value.maxScale);

    const center = getTouchCenter(e.touches);
    const rect = wrapperRef.value?.getBoundingClientRect();

    if (rect) {
      const centerX = center.x - rect.left;
      const centerY = center.y - rect.top;

      const scaleRatio = newScale / scale.value;
      translateX.value = centerX - (centerX - translateX.value) * scaleRatio;
      translateY.value = centerY - (centerY - translateY.value) * scaleRatio;

      const constrained = constrainTranslate(translateX.value, translateY.value);
      translateX.value = constrained.x;
      translateY.value = constrained.y;
    }

    scale.value = newScale;
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
  scale.value = 1;
  translateX.value = 0;
  translateY.value = 0;
  lastScale.value = 1;
  lastDistance.value = 0;
  isPinching.value = false;
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
        centerX = e.touches[0]?.clientX - rect.left || rect.width / 2;
        centerY = e.touches[0]?.clientY - rect.top || rect.height / 2;
      }

      scale.value = 2;
      translateX.value = centerX - centerX * 2;
      translateY.value = centerY - centerY * 2;

      const constrained = constrainTranslate(translateX.value, translateY.value);
      translateX.value = constrained.x;
      translateY.value = constrained.y;

      emit('scale-change', 2);
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
    transform: `translate(${x}px, ${y}px) scale(${s})`,
    transformOrigin: 'top left',
    transition: isDragging.value ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    touchAction: scale.value > 1 ? 'none' : 'auto'
  };
});

// 监听source变化
const loadPDF = async (source?: PDFSourceDataOption) => {
  if (source) {
    await renderPage(source);
  }
};

// 组件挂载
onMounted(() => {
  const inner = innerRef.value;
  if (inner) {
    inner.addEventListener('touchstart', handleTouchStart, { passive: false });
    inner.addEventListener('touchmove', handleTouchMove, { passive: false });
    inner.addEventListener('touchend', handleTouchEnd, { passive: true });
    inner.addEventListener('dblclick', handleDoubleClick);

    // 触摸双击支持
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

  // 如果有初始source，加载PDF
  if (props.source) {
    loadPDF(props.source);
  }
});

// 组件卸载
onUnmounted(() => {
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
    <!-- 进度条 -->
    <div
      v-if="isLoading && mergedConfig.showProgress"
      :style="progressStyle"
      class="pdf-progress-bar"
    />

    <!-- PDF容器 -->
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
        <canvas
          v-for="(_, index) in canvasList"
          :key="index"
          :ref="(el:any) => canvasList[index] ? canvasList[index].el = el as HTMLCanvasElement : null"
          :class="['pdf-canvas', canvasClass]"
          class="mobile-pdf-canvas"
        />
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
}

.mobile-pdf-canvas {
  margin: 10px auto;
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
  image-rendering: pixelated;
}

.pdf-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  background-color: #007bff;
  transition: width 0.3s ease;
  z-index: 9999;
}
</style>
