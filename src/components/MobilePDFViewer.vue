<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { MobilePDFViewerProps, MobilePDFViewerEmits } from './types';
import { DEFAULT_CONFIG } from './constants';
import { useTransform, usePDFRenderer, useProgress } from './composables';
import { TouchHandlers } from './touchHandlers';

// Props和Emits定义
const props = withDefaults(defineProps<MobilePDFViewerProps>(), {
  containerClass: '',
  canvasClass: '',
  config: () => ({})
});

const emit = defineEmits<MobilePDFViewerEmits>();

// 模板引用
const wrapperRef = ref<HTMLElement | null>(null);
const innerRef = ref<HTMLElement | null>(null);

// 合并配置
const mergedConfig = computed(() => ({
  ...DEFAULT_CONFIG,
  ...props.config
}));

// 使用组合式函数
const {
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
} = useTransform(mergedConfig.value);

const {
  canvasList,
  isLoading,
  loadingProgress,
  loadPDF,
  cleanupObserver
} = usePDFRenderer(mergedConfig.value);

const { progressStyle } = useProgress(mergedConfig.value);

// 触摸事件处理器
let touchHandlers: TouchHandlers | null = null;

// 初始化触摸事件处理器
const initializeTouchHandlers = () => {
  if (isPCByTouch()) return;
  touchHandlers = new TouchHandlers(
    mergedConfig.value,
    emit,
    {
      wrapperRef: () => wrapperRef.value!,
      innerRef: ()=>innerRef.value!,
      scale: () => scale.value,
      translateX: () => translateX.value,
      translateY: () => translateY.value,
      isDragging: () => isDragging.value,
      isPinching: () => isPinching.value,
    },
    {
      setDragging: (value: boolean) => { isDragging.value = value; },
      setPinching: (value: boolean) => { isPinching.value = value; },
      clearBoundaryCache,
      constrainTranslateForRefs,
      applyTransform,
      resetPosition,
      startInertialScroll,
      stopInertialScroll
    }
  );
};

// 加载PDF方法
const loadPDFDocument = async (source?: typeof props.source) => {
  if (!source) return;

  await loadPDF(
    source,
    wrapperRef.value,
    innerRef.value,
    props.canvasClass,
    emit
  );
};

// 重置位置方法
const resetPositionMethod = () => {
  resetPosition(emit);
};

// 进度条样式（带动态宽度）
const dynamicProgressStyle = computed(() => ({
  ...progressStyle.value,
  width: `${loadingProgress.value}%`
}));

// 组件挂载
onMounted(() => {
  initializeTouchHandlers();

  const inner = innerRef.value;
  if (inner && touchHandlers) {
    inner.addEventListener('touchstart', touchHandlers.handleTouchStart, { passive: false });
    inner.addEventListener('touchmove', touchHandlers.handleTouchMove, { passive: false });
    inner.addEventListener('touchend', touchHandlers.handleTouchEnd, { passive: true });
    inner.addEventListener('dblclick', touchHandlers.handleDoubleClickMouse);
  }
});

// 组件卸载
onUnmounted(() => {
  cleanupObserver();

  const inner = innerRef.value;
  if (inner && touchHandlers) {
    inner.removeEventListener('touchstart', touchHandlers.handleTouchStart);
    inner.removeEventListener('touchmove', touchHandlers.handleTouchMove);
    inner.removeEventListener('touchend', touchHandlers.handleTouchEnd);
    inner.removeEventListener('dblclick', touchHandlers.handleDoubleClickMouse);
  }
});

watch(() => props.source, (source) => {
  if (source) {
    loadPDFDocument(props.source);
  }

},{
  immediate: true
})

// 暴露方法
defineExpose({
  loadPDF: loadPDFDocument,
  resetPosition: resetPositionMethod,
  getScale: () => scale.value,
  isLoading: () => isLoading.value,
  getPageCount: () => canvasList.value.length
});

const isPCByTouch = ()=>{
  // PC通常不支持触摸
  return !('ontouchstart' in window) && !navigator.maxTouchPoints;
}
</script>

<template>
  <div class="mobile-pdf-viewer">
    <div
      v-if="isLoading && mergedConfig.showProgress"
      :style="dynamicProgressStyle"
      class="pdf-progress-bar"
    />
    <div
      ref="wrapperRef"
      :class="['mobile-pdf-container', 'pdf-container' ,containerClass]"
      :style="{overflow: isPCByTouch() ? 'auto' : 'hidden'}"
    >
      <div
        ref="innerRef"
        style="transformStyle"
        class="pdf-inner"
      >
        <div
            v-for="(item, index) in canvasList" :key="item.key"
            :ref="(el: any) => canvasList[index] ? canvasList[index].divEl = el as HTMLDivElement : null"
            class="canvas_wrap_div"
            :style="{height: '100vh'}"
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
  min-height: 50px;
}

.mobile-pdf-container {
  padding: 0 10px;
  height: 100%;
  overflow-x: hidden;
  overflow-y: hidden;
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

.canvas_wrap_div {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin: 10px auto;
}

:deep(.mobile-pdf-canvas) {
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
