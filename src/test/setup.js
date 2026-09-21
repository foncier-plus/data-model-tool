if (typeof window !== 'undefined') {
  const rect = {
    width: 1200,
    height: 800,
    top: 0,
    left: 0,
    bottom: 800,
    right: 1200,
    x: 0,
    y: 0,
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      constructor(callback) {
        this.callback = callback
      }
      observe(target) {
        this.callback(
          [{ target, contentRect: rect, borderBoxSize: [], contentBoxSize: [] }],
          this,
        )
      }
      unobserve() {}
      disconnect() {}
    }
  }

  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false
      },
    })
  }

  if (!window.DOMMatrixReadOnly) {
    window.DOMMatrixReadOnly = class {
      constructor() {
        this.m22 = 1
      }
    }
  }

  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { ...rect }
  }

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return rect.width
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return rect.height
    },
  })

  if (typeof SVGElement !== 'undefined') {
    SVGElement.prototype.getBBox = function getBBox() {
      return { x: 0, y: 0, width: 10, height: 10 }
    }
    SVGElement.prototype.getComputedTextLength = function getComputedTextLength() {
      return 10
    }
  }
}
