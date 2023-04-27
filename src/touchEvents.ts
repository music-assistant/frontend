import { App } from 'vue';

interface CustomTouchEventsOptions {
  holdDuration?: number;
  holdThreshold?: number;
  swipeThreshold?: number;
  doubleTapThreshold?: number;
}

const CustomTouchEvents = {
  install: (app: App, options?: CustomTouchEventsOptions) => {
    const holdDuration = options?.holdDuration || 500;
    const swipeThreshold = options?.swipeThreshold || 50;
    const doubleTapThreshold = options?.doubleTapThreshold || 300;
    const holdThreshold = options?.holdThreshold || 10;

    const touchStartEvent = 'touchstart';
    const touchEndEvent = 'touchend';
    const touchMoveEvent = 'touchmove';

    // Hold Directive
    app.directive('hold', {
      mounted(el, binding) {
        const touchStartEvent = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
        const touchEndEvent = 'ontouchstart' in window ? 'touchend' : 'mouseup';
        const touchMoveEvent = 'ontouchstart' in window ? 'touchmove' : 'mousemove';
        let holdTimeout: number | null = null;
        let startX: number | null = null;
        let startY: number | null = null;

        const handleTouchStart = (event: TouchEvent) => {
          startX = event.touches[0].clientX;
          startY = event.touches[0].clientY;

          holdTimeout = window.setTimeout(() => {
            binding.value(event);
            holdTimeout = null;
          }, holdDuration);
        };

        const handleTouchMove = (event: TouchEvent) => {
          if (!startX || !startY || !holdTimeout) {
            return;
          }

          const x = event.touches[0].clientX;
          const y = event.touches[0].clientY;

          if (Math.abs(x - startX) > holdThreshold || Math.abs(y - startY) > holdThreshold) {
            window.clearTimeout(holdTimeout);
            holdTimeout = null;
          }
        };

        const handleTouchEnd = () => {
          if (holdTimeout) {
            window.clearTimeout(holdTimeout);
            holdTimeout = null;
          }
        };

        el.addEventListener(touchStartEvent, handleTouchStart);
        el.addEventListener(touchEndEvent, handleTouchEnd);
        el.addEventListener(touchMoveEvent, handleTouchMove);

        el._hold = {
          handleTouchStart,
          handleTouchEnd,
          handleTouchMove,
        };
      },
      unmounted(el) {
        if (el._hold) {
          el.removeEventListener(touchStartEvent, el._hold.handleTouchStart);
          el.removeEventListener(touchEndEvent, el._hold.handleTouchEnd);
          el.removeEventListener(touchMoveEvent, el._hold.handleTouchMove);
        }
      },
    });

    // Tap Directive
    app.directive('tap', {
      mounted(el, binding) {
        let touchStartTime: number | null = null;

        const handleTouchStart = () => {
          touchStartTime = Date.now();
        };

        const handleTouchEnd = () => {
          if (touchStartTime && Date.now() - touchStartTime < holdDuration) {
            binding.value();
          }
        };

        el.addEventListener(touchStartEvent, handleTouchStart);
        el.addEventListener(touchEndEvent, handleTouchEnd);

        el._tap = {
          handleTouchStart,
          handleTouchEnd,
        };
      },
      unmounted(el) {
        if (el._tap) {
          el.removeEventListener(touchStartEvent, el._tap.handleTouchStart);
          el.removeEventListener(touchEndEvent, el._tap.handleTouchEnd);
        }
      },
    });

    // Swipe Directive
    app.directive('swipe', {
      mounted(el, binding) {
        const touchStartEvent = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
        const touchEndEvent = 'ontouchstart' in window ? 'touchend' : 'mouseup';
        let startX: number | null = null;
        let startY: number | null = null;

        const handleTouchStart = (event: TouchEvent) => {
          startX = event.touches[0].clientX;
          startY = event.touches[0].clientY;
        };

        const handleTouchEnd = (event: TouchEvent) => {
          const endX = event.changedTouches[0].clientX;
          const endY = event.changedTouches[0].clientY;
          const distanceX = endX - (startX || 0);
          const distanceY = endY - (startY || 0);

          const absDistanceX = Math.abs(distanceX);
          const absDistanceY = Math.abs(distanceY);

          let direction: 'right' | 'left' | 'up' | 'down' | null = null;

          if (absDistanceX > swipeThreshold || absDistanceY > swipeThreshold) {
            if (absDistanceX >= absDistanceY) {
              direction = distanceX > 0 ? 'right' : 'left';
            } else {
              direction = distanceY > 0 ? 'down' : 'up';
            }
          }

          if (direction) {
            if (binding.modifiers.right && direction === 'right') {
              binding.value(direction);
            } else if (binding.modifiers.left && direction === 'left') {
              binding.value(direction);
            } else if (binding.modifiers.up && direction === 'up') {
              binding.value(direction);
            } else if (binding.modifiers.down && direction === 'down') {
              binding.value(direction);
            } else if (
              !binding.modifiers.right &&
              !binding.modifiers.left &&
              !binding.modifiers.up &&
              !binding.modifiers.down
            ) {
              binding.value(direction);
            }
          }
        };

        el.addEventListener(touchStartEvent, handleTouchStart);
        el.addEventListener(touchEndEvent, handleTouchEnd);

        el._swipe = {
          handleTouchStart,
          handleTouchEnd,
        };
      },
      unmounted(el) {
        if (el._swipe) {
          el.removeEventListener(touchStartEvent, el._swipe.handleTouchStart);
          el.removeEventListener(touchEndEvent, el._swipe.handleTouchEnd);
        }
      },
    });

    // Drag Directive
    app.directive('drag', {
      mounted(el, binding) {
        let startX: number | null = null;
        let startY: number | null = null;
        let initialOffsetX = 0;
        let initialOffsetY = 0;
        let dragging = false;

        const handleTouchStart = (event: TouchEvent) => {
          event.preventDefault();
          startX = event.touches[0].clientX;
          startY = event.touches[0].clientY;
          initialOffsetX = el.offsetLeft;
          initialOffsetY = el.offsetTop;
          dragging = true;
        };

        const handleTouchMove = (event: TouchEvent) => {
          if (!dragging) return;

          const moveX = event.touches[0].clientX;
          const moveY = event.touches[0].clientY;
          const deltaX = moveX - (startX || 0);
          const deltaY = moveY - (startY || 0);

          binding.value({
            offsetX: initialOffsetX + deltaX,
            offsetY: initialOffsetY + deltaY,
          });
        };

        const handleTouchEnd = () => {
          dragging = false;
        };

        el.addEventListener(touchStartEvent, handleTouchStart);
        el.addEventListener(touchMoveEvent, handleTouchMove);
        el.addEventListener(touchEndEvent, handleTouchEnd);

        el._drag = {
          handleTouchStart,
          handleTouchMove,
          handleTouchEnd,
        };
      },
      unmounted(el) {
        if (el._drag) {
          el.removeEventListener(touchStartEvent, el._drag.handleTouchStart);
          el.removeEventListener(touchMoveEvent, el._drag.handleTouchMove);
          el.removeEventListener(touchEndEvent, el._drag.handleTouchEnd);
        }
      },
    });

    // Press Directive
    app.directive('press', {
      mounted(el, binding) {
        const touchStartEvent = 'ontouchstart' in window ? 'touchstart' : 'mousedown';

        const handleTouchStart = (event: TouchEvent) => {
          binding.value(event);
        };

        el.addEventListener(touchStartEvent, handleTouchStart);

        el._press = {
          handleTouchStart,
        };
      },
      unmounted(el) {
        if (el._press) {
          el.removeEventListener(touchStartEvent, el._press.handleTouchStart);
        }
      },
    });

    // Release Directive
    app.directive('release', {
      mounted(el, binding) {
        const touchEndEvent = 'ontouchstart' in window ? 'touchend' : 'mouseup';

        const handleTouchEnd = (event: TouchEvent) => {
          binding.value(event);
        };

        el.addEventListener(touchEndEvent, handleTouchEnd);

        el._release = {
          handleTouchEnd,
        };
      },
      unmounted(el) {
        if (el._release) {
          el.removeEventListener(touchEndEvent, el._release.handleTouchEnd);
        }
      },
    });

    // DoubleTap Directive
    app.directive('doubletap', {
      mounted(el, binding) {
        const touchStartEvent = 'ontouchstart' in window ? 'touchstart' : 'mousedown';
        let lastTapTime = 0;

        const handleTouchEnd = (event: TouchEvent) => {
          const currentTime = new Date().getTime();
          const tapInterval = currentTime - lastTapTime;

          if (tapInterval > 0 && tapInterval < doubleTapThreshold) {
            binding.value(event);
          }
          lastTapTime = currentTime;
        };

        el.addEventListener(touchStartEvent, handleTouchEnd);

        el._doubletap = {
          handleTouchEnd,
        };
      },
      unmounted(el) {
        if (el._doubletap) {
          el.removeEventListener(touchStartEvent, el._doubletap.handleTouchEnd);
        }
      },
    });
  },
};

export default CustomTouchEvents;
