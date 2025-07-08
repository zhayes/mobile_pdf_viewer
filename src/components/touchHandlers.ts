import { MobilePDFViewerConfig, MobilePDFViewerEmits } from './types';
import { getDistance, getTouchCenter } from './utils';
import { DOUBLE_CLICK_TIMEOUT, DOUBLE_CLICK_DISTANCE, SCALE_THRESHOLD, ZOOM_SCALE } from './constants';

/**
 * 触摸事件处理器
 */
export class TouchHandlers {
  private startX = 0;
  private startY = 0;
  private lastScale = 1;
  private lastDistance = 0;

  // 双击检测
  private lastTouchTime = 0;
  private touchCount = 0;
  private lastTouchX = 0;
  private lastTouchY = 0;

  constructor(
    private config: Required<MobilePDFViewerConfig>,
    private emit: MobilePDFViewerEmits,
    private getters: {
      wrapperRef: () => HTMLElement | null;
      innerRef: () => HTMLElement | null;
      scale: () => number;
      translateX: () => number;
      translateY: () => number;
      isDragging: () => boolean;
      isPinching: () => boolean;
    },
    private actions: {
      setDragging: (value: boolean) => void;
      setPinching: (value: boolean) => void;
      clearBoundaryCache: () => void;
      constrainTranslateForRefs: (x: number, y: number, wrapperRef: HTMLElement | null, innerRef: HTMLElement | null) => { x: number; y: number };
      applyTransform: (scale: number, x: number, y: number, immediate?: boolean) => void;
      resetPosition: (emit: MobilePDFViewerEmits) => void;
    }
  ) {
    console.log(this.actions)
  }

  /**
   * 处理触摸开始事件
   */
  handleTouchStart = (e: TouchEvent) => {
    this.actions.clearBoundaryCache();

    if (e.touches.length === 1) {
      this.actions.setDragging(true);
      this.actions.setPinching(false);
      this.startX = e.touches[0].clientX - this.getters.translateX();
      this.startY = e.touches[0].clientY - this.getters.translateY();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      this.actions.setDragging(false);
      this.actions.setPinching(true);
      this.lastDistance = getDistance(e.touches);
      this.lastScale = this.getters.scale();
    }
  };

  /**
   * 处理触摸移动事件
   */
  handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && this.getters.isDragging()) {
      const newX = e.touches[0].clientX - this.startX;
      const newY = e.touches[0].clientY - this.startY;

      if (this.getters.scale() > 1) {
        e.preventDefault();
        const constrained = this.actions.constrainTranslateForRefs(
          newX,
          newY,
          this.getters.wrapperRef(),
          this.getters.innerRef()
        );
        this.actions.applyTransform(this.getters.scale(), constrained.x, constrained.y, true);
      }
    } else if (e.touches.length === 2) {
      e.preventDefault();

      const distance = getDistance(e.touches);

      if (this.lastDistance === 0) {
        this.lastDistance = distance;
        return;
      }

      const scaleChange = distance / this.lastDistance;
      const dampedScaleChange = 1 + (scaleChange - 1) * this.config.pinchSensitivity;

      let newScale = this.getters.scale() * dampedScaleChange;
      newScale = Math.max(this.config.minScale, Math.min(this.config.maxScale, newScale));

      const center = getTouchCenter(e.touches);
      const rect = this.getters.wrapperRef()?.getBoundingClientRect();

      if (rect) {
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;

        const scaleRatio = newScale / this.getters.scale();
        const newX = centerX - (centerX - this.getters.translateX()) * scaleRatio;
        const newY = centerY - (centerY - this.getters.translateY()) * scaleRatio;

        const constrained = this.actions.constrainTranslateForRefs(
          newX,
          newY,
          this.getters.wrapperRef(),
          null
        );
        this.actions.applyTransform(newScale, constrained.x, constrained.y, true);
      }

      this.emit('scale-change', newScale);
      this.lastDistance = distance;
    }
  };

  /**
   * 处理触摸结束事件
   */
  handleTouchEnd = (e: TouchEvent) => {
    const wasDragging = this.getters.isDragging();
    const wasPinching = this.getters.isPinching();

    this.actions.setDragging(false);

    if (e.touches.length < 2) {
      this.actions.setPinching(false);
      this.lastDistance = 0;
      this.lastScale = this.getters.scale();
    }

    if (!wasDragging && !wasPinching && this.getters.scale() < this.config.minScale) {
      this.actions.resetPosition(this.emit);
    }

    // 双击检测
    this.handleDoubleClickDetection(e);
  };

  /**
   * 双击检测
   */
  private handleDoubleClickDetection = (e: TouchEvent) => {
    const now = Date.now();

    if (!this.getters.isDragging() && !this.getters.isPinching() &&
        e.touches.length === 0 && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const touchX = touch.clientX;
      const touchY = touch.clientY;

      const timeDiff = now - this.lastTouchTime;
      const distance = Math.sqrt(
        Math.pow(touchX - this.lastTouchX, 2) + Math.pow(touchY - this.lastTouchY, 2)
      );

      if (timeDiff < DOUBLE_CLICK_TIMEOUT && distance < DOUBLE_CLICK_DISTANCE) {
        this.touchCount++;
        if (this.touchCount === 2) {
          this.handleDoubleClick(e);
          this.touchCount = 0;
          return;
        }
      } else {
        this.touchCount = 1;
      }

      this.lastTouchTime = now;
      this.lastTouchX = touchX;
      this.lastTouchY = touchY;
    } else {
      this.touchCount = 0;
      this.lastTouchTime = 0;
    }
  };

  /**
   * 处理双击事件
   */
  private handleDoubleClick = (e: TouchEvent | MouseEvent) => {
    e.preventDefault();

    const isNormalScale = Math.abs(this.getters.scale() - 1) < SCALE_THRESHOLD;

    if (isNormalScale) {
      const rect = this.getters.wrapperRef()?.getBoundingClientRect();
      if (rect) {
        let centerX: number, centerY: number;

        if (e instanceof MouseEvent) {
          centerX = e.clientX - rect.left;
          centerY = e.clientY - rect.top;
        } else {
          const touch = e.changedTouches?.[0] || e.touches?.[0];
          centerX = touch?.clientX - rect.left || rect.width / 2;
          centerY = touch?.clientY - rect.top || rect.height / 2;
        }

        const newScale = ZOOM_SCALE;
        const newX = centerX - (centerX - this.getters.translateX()) * newScale;
        const newY = centerY - (centerY - this.getters.translateY()) * newScale;

        const constrained = this.actions.constrainTranslateForRefs(
          newX,
          newY,
          this.getters.wrapperRef(),
          null
        );
        this.actions.applyTransform(newScale, constrained.x, constrained.y);

        this.emit('scale-change', newScale);
      }
    } else {
      this.actions.resetPosition(this.emit);
    }
  };

  /**
   * 处理鼠标双击事件
   */
  handleDoubleClickMouse = (e: MouseEvent) => {
    this.handleDoubleClick(e);
  };
}
