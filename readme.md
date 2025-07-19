### Recommend [mobile-pdf](https://www.npmjs.com/package/mobile-pdf), which does not rely on any framework

---

[![License](https://img.shields.io/npm/l/vue3-mobile-pdf-viewer.svg)](https://github.com/zhayes/vue3-mobile-pdf-viewer/blob/main/LICENSE)
[![NPM Downloads](https://img.shields.io/npm/dm/vue3-mobile-pdf-viewer.svg)](https://www.npmjs.com/package/vue3-mobile-pdf-viewer)

---

[English](#english) | [中文](#中文)

---

<a id="english"></a>
# Mobile PDF Viewer (English)

A mobile-friendly PDF viewer component for Vue 3, with support for touch gestures, zooming, and panning.

## Features

- ✅ Touch gesture support (one-finger drag, two-finger pinch-to-zoom)
- ✅ Double-tap to zoom
- ✅ Optimized with virtual scrolling for on-demand page rendering
- ✅ Progress bar for loading status
- ✅ Boundary detection to prevent over-scrolling
- ✅ High-performance rendering using `IntersectionObserver`
- ✅ TypeScript support
- ✅ Modular design for easy maintenance

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `source` | `PDFSourceDataOption` | `undefined` | The source of the PDF file. This can be a URL to a PDF file, a `Uint8Array`, or any other parameter supported by [pdf.js's getDocument](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js#L237). This prop is optional, and you can also load a PDF using the `loadPDF` method after the component is mounted. |
| `config` | `MobilePDFViewerConfig` | `{}` | Configuration options for the viewer. See the **Configuration Options** section below for more details. |
| `containerClass` | `string` | `''` | Custom CSS class to apply to the root container element of the component. |
| `canvasClass` | `string` | `''` | Custom CSS class to apply to each canvas element that renders a PDF page. |

## Usage

### Basic Usage

```vue
<template>
    <!-- Note: A parent container with a defined height is required, as MobilePDFViewer defaults to full height, which is necessary for on-demand rendering. -->
    <div style="height: 100vh">
        <MobilePDFViewer
          ref="pdfViewerRef"
          source="/path/to/your/pdf/file.pdf"
          @load-complete="onLoadComplete"
          @scale-change="onScaleChange"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MobilePDFViewer from 'vue3-mobile-pdf-viewer';

const pdfViewerRef = ref();

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF loaded successfully, total pages: ${pageCount}`);
};

const onScaleChange = (scale: number) => {
  console.log(`Current scale: ${scale}`);
};
</script>
```

> **Tip:** If you do not provide the `source` in the `props`, you can also manually load a PDF file using the `loadPDF` method after the component is mounted:
> ```javascript
> onMounted(() => {
>   pdfViewerRef.value?.loadPDF('/path/to/your/pdf/file.pdf');
> })
> ```

### Configuration Options

```typescript
interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;    // Resolution multiplier, default: 3
  minScale?: number;                // Minimum scale, default: 1
  maxScale?: number;                // Maximum scale, default: 4
  dampingFactor?: number;           // Damping factor for inertial scrolling, default: 0.95
  boundaryPadding?: number;         // Boundary padding to constrain dragging, default: 50
  pinchSensitivity?: number;        // Sensitivity for pinch-to-zoom, default: 0.6
}
```

### Events

- `load-start`: PDF loading has started.
- `load-progress`: PDF loading is in progress `(progress: number)`.
- `load-complete`: PDF has finished loading `(pageCount: number)`.
- `load-error`: An error occurred while loading the PDF `(error: Error)`.
- `scale-change`: The scale has changed `(scale: number)`.

### Exposed Methods

```typescript
import { ref } from 'vue';

const pdfViewerRef = ref();

// Load a PDF
pdfViewerRef.value?.loadPDF(source);

// Reset the position
pdfViewerRef.value?.resetPosition();

// Get the current scale
const scale = pdfViewerRef.value?.getScale();

// Check if it is currently loading
const loading = pdfViewerRef.value?.isLoading();

// Get the number of pages
const pageCount = pdfViewerRef.value?.getPageCount();
```

---

<a id="中文"></a>
# Mobile PDF Viewer (中文)

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

## Props

| Prop | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `source` | `PDFSourceDataOption` | `undefined` | PDF 文件来源。可以是 PDF 文件的 URL、`Uint8Array`，或 [pdf.js's getDocument](https://github.com/mozilla/pdf.js/blob/master/src/display/api.js#L237) 支持的参数对象。此属性为可选，你也可以在组件挂载后通过 `loadPDF` 方法加载 PDF。 |
| `config` | `MobilePDFViewerConfig` | `{}` | 查看器的配置选项。详细信息请参阅下方的 **配置选项** 部分。 |
| `containerClass` | `string` | `''` | 应用于组件根容器元素的自定义 CSS 类。 |
| `canvasClass` | `string` | `''` | 应用于渲染 PDF 页面的每个 canvas 元素的自定义 CSS 类。 |


## 使用方法

### 基本使用

```vue
<template>
    <!-- 注意这里应该需要个父容器高度，MobilePDFViewer默认铺满，否则不能按需渲染。 -->
    <div style="height: 100vh">
        <MobilePDFViewer
          ref="pdfViewerRef"
          source="/path/to/your/pdf/file.pdf"
          @load-complete="onLoadComplete"
          @scale-change="onScaleChange"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import MobilePDFViewer from 'vue3-mobile-pdf-viewer';

const pdfViewerRef = ref();

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF 加载完成，共 ${pageCount} 页`);
};

const onScaleChange = (scale: number) => {
  console.log(`当前缩放比例: ${scale}`);
};
</script>
```

> **提示:** 如果你没有在 `props` 中提供 `source`，你也可以在组件挂载后通过 `loadPDF` 方法手动加载 PDF 文件：
> ```javascript
> onMounted(() => {
>   pdfViewerRef.value?.loadPDF('/path/to/your/pdf/file.pdf');
> })
> ```

### 配置选项

```typescript
interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;    // 分辨率倍数，默认 3
  minScale?: number;                // 最小缩放比例，默认 1
  maxScale?: number;                // 最大缩放比例，默认 4
  dampingFactor?: number;           // 阻尼系数，默认 0.95
  boundaryPadding?: number;         // 边界填充，默认 50
  pinchSensitivity?: number;        // 捏合敏感度，默认 0.6
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
import { ref } from 'vue';

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
