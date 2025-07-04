# Vue Mobile PDF Viewer

一个专为移动端优化的 Vue 3 PDF 查看器组件，支持触摸手势缩放、拖拽和双击操作。

## 特性

- 📱 **移动端优化**: 专为移动设备设计，支持触摸手势
- 🔍 **手势支持**: 支持双指缩放、拖拽移动、双击缩放
- ⚡ **高性能**: 使用 Canvas 渲染，支持高分辨率显示
- 🎨 **可定制**: 提供丰富的配置选项
- 📦 **轻量级**: 移除了非必要的依赖
- 🔧 **TypeScript**: 完整的 TypeScript 支持

## 安装

```bash
npm install vue-mobile-pdf-viewer
```

## 使用方法

### 全局注册

```typescript
import { createApp } from 'vue'
import VueMobilePDFViewer from 'vue-mobile-pdf-viewer'
import App from './App.vue'

const app = createApp(App)
app.use(VueMobilePDFViewer)
app.mount('#app')
```

### 局部导入

```vue
<template>
  <div style="height: 100vh;">
    <MobilePDFViewer
      :source="pdfSource"
      :config="config"
      @load-complete="onLoadComplete"
      @load-error="onLoadError"
      @scale-change="onScaleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MobilePDFViewer, type PDFSourceDataOption, type MobilePDFViewerConfig } from 'vue-mobile-pdf-viewer'

const pdfSource = ref<PDFSourceDataOption>({
  url: 'path/to/your/file.pdf'
})

const config = ref<MobilePDFViewerConfig>({
  resolutionMultiplier: 3,
  minScale: 0.5,
  maxScale: 4,
  showProgress: true,
  progressColor: '#007bff'
})

const onLoadComplete = (pageCount: number) => {
  console.log(`PDF loaded with ${pageCount} pages`)
}

const onLoadError = (error: Error) => {
  console.error('PDF load error:', error)
}

const onScaleChange = (scale: number) => {
  console.log('Scale changed to:', scale)
}
</script>
```

## API 文档

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `source` | `PDFSourceDataOption` | - | PDF 数据源 |
| `config` | `MobilePDFViewerConfig` | `{}` | 配置选项 |
| `containerClass` | `string` | `''` | 容器自定
