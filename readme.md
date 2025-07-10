# Mobile PDF Viewer

一个基于 Vue 3 的移动端 PDF 查看器组件，支持触摸手势、缩放、平移等功能。

## 功能特性

- ✅ 支持触摸手势（单指拖拽、双指缩放）
- ✅ 支持双击缩放
- ✅ 虚拟滚动优化，按需渲染页面
- ✅ 进度条显示加载状态
- ✅ 边界限制，防止过度拖拽
- ✅ 高性能渲染，使用 IntersectionObserver
- ✅ TypeScript 支持
- ✅ 模块化设计，易于维护

## 使用方法

### 基本使用

```vue
<template>
    <!-- 注意这里应该需要个父容器高度，MobilePDFViewer默认铺满，否则不能按需渲染。 -->
    <div style="height: 100vh">
        <MobilePDFViewer
          ref="pdfViewerRef"
          @load-complete="onLoadComplete"
          @scale-change="onScaleChange"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MobilePDFViewer, { type PDFSourceDataOption } from 'vue3-mobile-pdf-viewer';
const pdfViewerRef = ref();

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF 加载完成，共 ${pageCount} 页`);
};

const onScaleChange = (scale: number) => {
  console.log(`当前缩放比例: ${scale}`);
};


onMounted(()=>{
  const pdfSource = ref<PDFSourceDataOption>('path/to/your/pdf/file.pdf');

  pdfViewerRef.value?.loadPDF(source);
})
</script>
```

### 配置选项

```typescript
interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;    // 分辨率倍数，默认 3
  minScale?: number;                // 最小缩放比例，默认 1
  maxScale?: number;                // 最大缩放比例，默认 4
  scaleStep?: number;               // 缩放步长，默认 0.1
  dampingFactor?: number;           // 阻尼系数，默认 0.95
  boundaryPadding?: number;         // 边界填充，默认 50
  pinchSensitivity?: number;        // 捏合敏感度，默认 0.6
  maxScaleChange?: number;          // 最大缩放变化，默认 0.25
  showProgress?: boolean;           // 是否显示进度条，默认 true
  progressColor?: string;           // 进度条颜色，默认 '#007bff'
}
```

### 事件

- `load-start`: 开始加载 PDF
- `load-progress`: 加载进度更新 `(progress: number)`
- `load-complete`: 加载完成 `(pageCount: number)`
- `load-error`: 加载错误 `(error: Error)`
- `scale-change`: 缩放变化 `(scale: number)`

### 暴露的方法

```typescript
const pdfViewerRef = ref();

// 加载 PDF
pdfViewerRef.value?.loadPDF(source);

// 重置位置
pdfViewerRef.value?.resetPosition();

// 获取当前缩放比例
const scale = pdfViewerRef.value?.getScale();

// 获取是否正在加载
const loading = pdfViewerRef.value?.isLoading();

// 获取页面数量
const pageCount = pdfViewerRef.value?.getPageCount();
```
