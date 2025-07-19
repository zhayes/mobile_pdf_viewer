import { getDocument, type RenderTask } from 'pdfjs-dist';

export type PDFSourceDataOption = Parameters<typeof getDocument>[0];

export interface MobilePDFViewerConfig {
  resolutionMultiplier?: number;
  minScale?: number;
  maxScale?: number;
  dampingFactor?: number;
  boundaryPadding?: number;
  pinchSensitivity?: number;
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

export interface CanvasItem {
  canvas: HTMLCanvasElement | null;
  divEl: HTMLDivElement | null;
  renderStatus: 'pending' | 'loading' | 'complete';
  key?: string;
  rendering_task?: RenderTask | null;
}

export interface BoundaryLimits {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TouchCenter {
  x: number;
  y: number;
}
