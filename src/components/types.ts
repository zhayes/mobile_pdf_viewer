import { getDocument } from 'pdfjs-dist';


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
