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
          source="path/to/your/pdf/file.pdf"
          @load-complete="onLoadComplete"
          @scale-change="onScaleChange"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import MobilePDFViewer from 'vue3-mobile-pdf-viewer'; // 假设这是包名

const pdfViewerRef = ref();

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF 加载完成，共 ${pageCount} 页`);
};

const onScaleChange = (scale: number) => {
  console.log(`当前缩放比例: ${scale}`);
};

// 也可以通过暴露的方法加载PDF
// onMounted(()=>{
//   pdfViewerRef.value?.loadPDF('path/to/your/pdf/file.pdf');
// })
</script>
```

### Props

| Prop             | Type                  | Description                                                                                                                            | Default |
| ---------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `source`         | `PDFSourceDataOption` | PDF 文件来源。可以是 URL、TypedArray (Uint8Array)、或 `pdfjs-dist` 的 `getDocument` 支持的任何其他格式。 | `undefined` |
| `containerClass` | `string`              | 应用于容器元素的自定义 CSS 类。                                                                                                        | `''`    |
| `canvasClass`    | `string`              | 应用于每个 PDF 页面 `<canvas>` 元素的自定义 CSS 类。                                                                                    | `''`    |
| `config`         | `MobilePDFViewerConfig` | 一个包含查看器行为配置选项的对象。                                                                                                       | `{}`    |

### `config` 对象

`config` prop 接受一个对象，用于详细配置查看器的行为：

```typescript
interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;    // 分辨率倍数，默认 3
  minScale?: number;                // 最小缩放比例，默认 1
  maxScale?: number;                // 最大缩放比例，默认 4
  dampingFactor?: number;           // 拖拽惯性滑动的阻尼系数，默认 0.95
  boundaryPadding?: number;         // 边界填充，用于限制拖拽范围，默认 50
  pinchSensitivity?: number;        // 双指缩放的敏感度，默认 0.6
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
// `source` 的类型为 `PDFSourceDataOption`
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
