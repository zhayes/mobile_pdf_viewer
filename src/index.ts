import { App } from 'vue';
import MobilePDFViewer from './components/MobilePDFViewer.vue';

export type {
  PDFSourceDataOption,
  MobilePDFViewerConfig,
  MobilePDFViewerEmits
} from './components/MobilePDFViewer.vue';

export { MobilePDFViewer };

export default {
  install(app: App) {
    app.component('MobilePDFViewer', MobilePDFViewer);
  }
};

// 支持单独导入
export const install = (app: App) => {
  app.component('MobilePDFViewer', MobilePDFViewer);
};
