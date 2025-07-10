import { MobilePDFViewerConfig } from './types';

export const DEFAULT_CONFIG: Required<MobilePDFViewerConfig> = {
  resolutionMultiplier: 3,
  minScale: 1,
  maxScale: 4,
  dampingFactor: 0.95,
  boundaryPadding: 50,
  pinchSensitivity: 0.6
};

export const DOUBLE_CLICK_TIMEOUT = 300;
export const DOUBLE_CLICK_DISTANCE = 50;
export const SCALE_THRESHOLD = 0.2;
export const BOUNDARY_SCALE_THRESHOLD = 0.001;
export const ZOOM_SCALE = 2;
export const OBSERVER_ROOT_MARGIN = '100% 0px';
export const OBSERVER_THRESHOLD = 0.1;
