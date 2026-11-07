// Ink layer for reveal.js: draw on slides with a pen, mouse or touch screen.
//
// Every slide has a layer of ink over its content. A layer is a list of
// operations (strokes, erasures and clears) in slide coordinates, replayed
// onto a canvas inside the deck's slide container, so ink scales with the
// slide and stays attached to its content. Undo and redo move operations
// between the list and a redo stack.
//
// Layers persist in localStorage, can be downloaded as JSON, and can be
// loaded from a JSON file (the `src` option) to publish drawings with a deck.
// Layers are keyed by slide id, so a slide keeps its drawings when other
// slides are added or removed, as long as its own id stays the same.
//
// Tools: pens in several colours, a square eraser, and a laser pointer whose
// trace stays while drawn, fades after release, and is never recorded.
//
// Configured by the `ink` key of the reveal.js config (see DEFAULTS); the
// deck's width and height must be numbers of pixels.

const DEFAULTS = {
  colors: ["#ffffff"], // pen colours, selected with keys 1, 2, ...
  penWidth: 4, // slide pixels
  eraserSize: 40, // side of the square eraser, slide pixels
  laserColor: "#ff2a2a",
  laserWidth: 5, // slide pixels
  laserFadeMs: 800, // time for a released laser trace to fade away
  src: null, // URL of a JSON file of saved drawings
};

const SHORTCUTS = [
  ["C", "Ink: toggle drawing"],
  ["1, 2, ...", "Ink: pen colour"],
  ["E", "Ink: eraser (toggle); or drag with the right button"],
  ["L", "Ink: laser pointer (toggle)"],
  ["CTRL + Z", "Ink: undo"],
  ["CTRL + SHIFT + Z", "Ink: redo"],
  ["DEL", "Ink: clear slide (undoable)"],
  ["SHIFT + DEL", "Ink: forget all drawings stored in this browser"],
  ["D", "Ink: download drawings"],
];

// 24×24 line icons, stroked in the button's text colour.
const ICONS = {
  pen: '<path d="M4 20l1.5-5.5L15.5 4.5l4 4-10 10z"/><path d="M13.5 6.5l4 4"/>',
  eraser: '<rect x="5" y="5" width="14" height="14"/>',
  laser: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
  undo: '<path d="M9 13L4 8l5-5"/><path d="M4 8h10a6 6 0 0 1 0 12h-4"/>',
  redo: '<path d="M15 13l5-5-5-5"/><path d="M20 8H10a6 6 0 0 0 0 12h4"/>',
  clear: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
};

export default function RevealInk() {
  return {
    id: "ink",
    init(deck) {
      // Print layout lays slides out as pages, which this layer does not
      // support; skip it rather than draw ink in the wrong place.
      if (deck.isPrintView()) return;
      new Ink(deck);
    },
  };
}

class Ink {
  constructor(deck) {
    this.deck = deck;
    this.options = { ...DEFAULTS, ...deck.getConfig().ink };
    this.width = deck.getConfig().width;
    this.height = deck.getConfig().height;
    // The previews in the speaker view show ink but do not take input.
    this.interactive = !deck.isSpeakerNotes();

    this.layers = new Map(); // layer key -> { ops, redo }
    this.savedLayers = new Map(); // layer key -> ops loaded from options.src
    this.storagePrefix = `ink:${location.pathname}:`;
    this.liveState = null;

    this.active = false; // whether pointer input goes to the ink layer
    this.tool = "pen"; // "pen", "eraser" or "laser"
    this.colorIndex = 0;
    this.gesture = null; // the stroke, erasure or laser trace being drawn
    this.cursor = null; // pointer position in slide coordinates, if over the slide
    this.laserTraces = []; // { points, releasedAt }
    this.overlayFrame = null;
    this.scaleX = this.scaleY = 1; // canvas pixels per slide pixel

    this.buildLayer();
    if (this.interactive) {
      this.buildToolbar();
      this.bindInput();
      for (const [key, description] of SHORTCUTS) {
        deck.registerKeyboardShortcut(key, description);
      }
    }
    this.loadFromStorage();
    this.connectLivePreview();
    window.addEventListener("pagehide", () => {
      this.liveChannel?.close();
      this.liveChannel = null;
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) this.connectLivePreview();
    });

    deck.on("ready", () => {
      this.resize();
      this.renderInk();
      this.updateToolbar();
      this.loadFromSource();
    });
    deck.on("resize", () => this.resize());
    window.addEventListener("resize", () => requestAnimationFrame(() => this.resize()));
    deck.on("slidechanged", () => this.onSlideChanged());
    deck.on("overviewshown", () => this.setActive(false));
    window.addEventListener("storage", (event) => this.onStorage(event));
  }

  // Storage keeps finished drawings durable; the channel carries transient
  // input without writing cursor movements or unfinished strokes to storage.
  connectLivePreview() {
    if (!("BroadcastChannel" in window)) return;
    this.liveChannel = new BroadcastChannel(`${this.storagePrefix}live`);
    this.liveChannel.onmessage = ({ data }) => {
      if (this.interactive) {
        if (data.request) this.publishLive(this.slideKey());
        return;
      }
      if (!data.state) return;
      const hadOperation = this.liveState?.gesture?.operation;
      this.liveState = data.state;
      // Each window has its own performance clock. Translate release times
      // so fading laser traces retain their age in the preview.
      for (const trace of this.liveState.laserTraces) {
        if (trace.releasedAt !== null) trace.releasedAt -= performance.timeOrigin;
      }
      if (data.layer) {
        this.layer(data.layer.key).ops = data.layer.ops;
        this.layer(data.layer.key).redo = [];
      }
      if (data.layer || hadOperation || this.liveState.gesture?.operation) this.renderInk();
      this.requestOverlay();
    };
    if (!this.interactive) this.liveChannel.postMessage({ request: true });
  }

  publishLive(layerKey) {
    if (!this.interactive || !this.liveChannel) return;
    const state = {
      key: this.slideKey(), active: this.active, cursor: this.cursor,
      tool: this.tool, colorIndex: this.colorIndex, gesture: this.gesture,
      laserTraces: this.laserTraces.map((trace) => ({
        points: trace.points,
        releasedAt: trace.releasedAt === null ? null : trace.releasedAt + performance.timeOrigin,
      })),
    };
    const layer = layerKey === undefined ? undefined
      : { key: layerKey, ops: this.layer(layerKey).ops };
    this.liveChannel.postMessage({ state, layer });
  }

  // --- DOM ---------------------------------------------------------------

  buildLayer() {
    this.layerElement = element("div", "ink-layer");
    // Stop reveal.js treating touch drawing as swipes between slides.
    this.layerElement.setAttribute("data-prevent-swipe", "");
    this.layerElement.style.width = `${this.width}px`;
    this.layerElement.style.height = `${this.height}px`;
    this.inkCanvas = element("canvas", "ink-canvas");
    this.overlayCanvas = element("canvas", "ink-overlay");
    this.layerElement.append(this.inkCanvas, this.overlayCanvas);
    this.deck.getSlidesElement().append(this.layerElement);
  }

  buildToolbar() {
    const button = (name, title, icon, action) => {
      const result = element("button", `ink-button ink-${name}`);
      result.type = "button";
      result.title = title;
      result.tabIndex = -1;
      result.innerHTML = icon.startsWith("<span") ? icon : `<svg viewBox="0 0 24 24">${icon}</svg>`;
      // Keep keyboard focus off the button, so Space still changes slides.
      result.addEventListener("mousedown", (event) => event.preventDefault());
      result.addEventListener("click", action);
      return result;
    };
    this.buttons = {
      toggle: button("toggle", "Draw (C)", ICONS.pen, () => this.setActive(!this.active)),
      colors: this.options.colors.map((color, index) => {
        const swatch = button(
          "color",
          `Pen colour ${index + 1} (${index + 1})`,
          '<span class="ink-swatch"></span>',
          () => this.selectColor(index),
        );
        swatch.style.setProperty("--ink-color", color);
        return swatch;
      }),
      eraser: button("eraser", "Eraser (E)", ICONS.eraser, () => this.selectTool("eraser")),
      laser: button("laser", "Laser pointer (L)", ICONS.laser, () => this.selectTool("laser")),
      undo: button("undo", "Undo (Ctrl+Z)", ICONS.undo, () => this.undo()),
      redo: button("redo", "Redo (Ctrl+Shift+Z)", ICONS.redo, () => this.redo()),
      clear: button("clear", "Clear slide (Delete)", ICONS.clear, () => this.clear()),
    };
    this.buttons.laser.style.color = this.options.laserColor;

    const tools = element("div", "ink-tools");
    tools.append(
      ...this.buttons.colors,
      this.buttons.eraser,
      this.buttons.laser,
      element("span", "ink-separator"),
      this.buttons.undo,
      this.buttons.redo,
      this.buttons.clear,
    );
    this.toolbar = element("div", "ink-toolbar");
    this.toolbar.append(this.buttons.toggle, tools);
    this.deck.getRevealElement().append(this.toolbar);
  }

  updateToolbar() {
    if (!this.toolbar || !this.deck.isReady()) return;
    const { buttons, tool, active } = this;
    this.toolbar.classList.toggle("open", active);
    buttons.toggle.classList.toggle("selected", active);
    buttons.toggle.style.color = active ? this.options.colors[this.colorIndex] : "";
    buttons.colors.forEach((swatch, index) => {
      swatch.classList.toggle("selected", tool === "pen" && index === this.colorIndex);
    });
    buttons.eraser.classList.toggle("selected", tool === "eraser");
    buttons.laser.classList.toggle("selected", tool === "laser");
    const layer = this.layer();
    buttons.undo.disabled = layer.ops.length === 0;
    buttons.redo.disabled = layer.redo.length === 0;
    buttons.clear.disabled = visibleOperations(layer.ops).length === 0;
  }

  // Size the canvases to the slide's size on screen, in device pixels.
  resize() {
    const pixelsPerUnit = this.deck.getScale() * (window.devicePixelRatio || 1);
    const width = Math.round(this.width * pixelsPerUnit);
    const height = Math.round(this.height * pixelsPerUnit);
    if (width === this.inkCanvas.width && height === this.inkCanvas.height) return;
    for (const canvas of [this.inkCanvas, this.overlayCanvas]) {
      canvas.width = width;
      canvas.height = height;
    }
    this.scaleX = width / this.width;
    this.scaleY = height / this.height;
    this.renderInk();
    this.requestOverlay();
  }

  // --- Layers --------------------------------------------------------------

  slideKey() {
    const slide = this.deck.getCurrentSlide();
    if (slide?.id) return slide.id;
    const { h, v } = this.deck.getIndices();
    return `slide-${h}-${v ?? 0}`;
  }

  layer(key = this.slideKey()) {
    if (!this.layers.has(key)) this.layers.set(key, { ops: [], redo: [] });
    return this.layers.get(key);
  }

  // Record a change to a layer: save it, and redraw it if it is showing.
  layerChanged(key) {
    this.save(key);
    if (key === this.slideKey()) this.renderInk();
    this.updateToolbar();
  }

  undo() {
    if (this.gesture) return;
    const key = this.slideKey();
    const layer = this.layer(key);
    if (layer.ops.length === 0) return;
    layer.redo.push(layer.ops.pop());
    this.layerChanged(key);
  }

  redo() {
    if (this.gesture) return;
    const key = this.slideKey();
    const layer = this.layer(key);
    if (layer.redo.length === 0) return;
    layer.ops.push(layer.redo.pop());
    this.layerChanged(key);
  }

  clear() {
    if (this.gesture) return;
    const key = this.slideKey();
    const layer = this.layer(key);
    if (visibleOperations(layer.ops).length === 0) return;
    layer.ops.push({ kind: "clear" });
    layer.redo = [];
    this.layerChanged(key);
  }

  // --- Modes ---------------------------------------------------------------

  setActive(active) {
    if (this.gesture) this.finishGesture();
    this.active = active;
    this.layerElement.classList.toggle("active", active);
    if (!active) this.cursor = null;
    this.updateToolbar();
    this.requestOverlay();
  }

  // Choosing the selected eraser or laser again goes back to the pen.
  selectTool(tool) {
    this.tool = this.active && this.tool === tool ? "pen" : tool;
    this.setActive(true);
  }

  selectColor(index) {
    this.colorIndex = index;
    this.tool = "pen";
    this.setActive(true);
  }

  onSlideChanged() {
    if (this.interactive && this.gesture) this.finishGesture();
    this.cursor = null;
    this.laserTraces = [];
    this.renderInk();
    this.updateToolbar();
    this.requestOverlay();
  }

  // --- Pointer input -------------------------------------------------------

  bindInput() {
    const overlay = this.overlayCanvas;
    overlay.addEventListener("pointerdown", (event) => this.onPointerDown(event));
    overlay.addEventListener("pointermove", (event) => this.onPointerMove(event));
    overlay.addEventListener("pointerup", (event) => this.onPointerUp(event));
    overlay.addEventListener("pointercancel", (event) => this.onPointerUp(event));
    overlay.addEventListener("lostpointercapture", (event) => this.onPointerUp(event));
    overlay.addEventListener("pointerleave", () => {
      if (this.gesture) return;
      this.cursor = null;
      this.requestOverlay();
    });
    overlay.addEventListener("contextmenu", (event) => event.preventDefault());
    for (const type of ["touchstart", "touchmove", "touchend"]) {
      overlay.addEventListener(type, (event) => event.stopPropagation());
    }
    // Capture phase on window: runs before reveal.js's own key handling.
    window.addEventListener("keydown", (event) => this.onKeyDown(event), true);
  }

  // Slide coordinates of a pointer event, given the overlay's screen rectangle.
  slidePoint(event, rectangle) {
    const x = ((event.clientX - rectangle.left) / rectangle.width) * this.width;
    const y = ((event.clientY - rectangle.top) / rectangle.height) * this.height;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  }

  onPointerDown(event) {
    if (this.gesture) return;
    event.preventDefault();
    event.stopPropagation();
    // Right button (or a pen's side button, if it acts as one) or a pen's
    // eraser end: erase, whatever the selected tool.
    const tool = event.button === 2 || event.button === 5 ? "eraser" : this.tool;
    try {
      this.overlayCanvas.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone; draw what we have anyway.
    }
    const point = this.slidePoint(event, this.overlayCanvas.getBoundingClientRect());
    this.cursor = point;
    const gesture = { pointerId: event.pointerId, tool, layerKey: this.slideKey() };
    if (tool === "laser") {
      gesture.trace = { points: [...point], releasedAt: null };
      this.laserTraces.push(gesture.trace);
    } else if (tool === "pen") {
      const color = this.options.colors[this.colorIndex];
      gesture.operation = { kind: "stroke", color, width: this.options.penWidth, points: [...point] };
      drawStroke(this.inkContext(), gesture.operation, 1, 1);
    } else {
      gesture.operation = { kind: "erase", size: this.options.eraserSize, points: [...point] };
      erase(this.inkContext(), gesture.operation, 0);
    }
    this.gesture = gesture;
    this.requestOverlay();
  }

  onPointerMove(event) {
    const rectangle = this.overlayCanvas.getBoundingClientRect();
    this.cursor = this.slidePoint(event, rectangle);
    if (this.gesture?.pointerId === event.pointerId) {
      // Browsers deliver at most one move event per frame; the coalesced
      // events are the pointer samples in between, for smoother strokes.
      const samples = event.getCoalescedEvents?.() ?? [];
      const points = (samples.length > 0 ? samples : [event]).map((sample) =>
        this.slidePoint(sample, rectangle),
      );
      this.extendGesture(points);
    }
    this.requestOverlay();
  }

  onPointerUp(event) {
    if (this.gesture?.pointerId === event.pointerId) this.finishGesture();
  }

  extendGesture(newPoints) {
    const { tool } = this.gesture;
    const path = tool === "laser" ? this.gesture.trace : this.gesture.operation;
    const countBefore = path.points.length / 2;
    for (const [x, y] of newPoints) {
      const length = path.points.length;
      if (path.points[length - 2] === x && path.points[length - 1] === y) continue;
      path.points.push(x, y);
    }
    const countAfter = path.points.length / 2;
    if (countAfter === countBefore || tool === "laser") return;
    if (tool === "pen") drawStroke(this.inkContext(), path, countBefore, countAfter - 1);
    else erase(this.inkContext(), path, countBefore);
  }

  finishGesture() {
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture.tool === "laser") {
      gesture.trace.releasedAt = performance.now();
      this.requestOverlay();
      return;
    }
    const operation = gesture.operation;
    const pointCount = operation.points.length / 2;
    if (gesture.tool === "pen" && pointCount > 1 && gesture.layerKey === this.slideKey()) {
      drawStroke(this.inkContext(), operation, pointCount, pointCount);
    }
    const layer = this.layer(gesture.layerKey);
    layer.ops.push(operation);
    layer.redo = [];
    this.save(gesture.layerKey);
    this.updateToolbar();
  }

  // --- Keyboard ------------------------------------------------------------

  onKeyDown(event) {
    // Leave keys to reveal.js while one of its overlays (e.g. help) is open.
    if (this.deck.isOverlayOpen()) return;
    const origin = event.composedPath()[0];
    const typing =
      origin instanceof HTMLElement &&
      (origin.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(origin.tagName));
    if (typing) return;
    const command = this.commandFor(event);
    if (!command) return;
    event.preventDefault();
    event.stopPropagation();
    command();
  }

  commandFor(event) {
    const key = (event.key ?? "").toLowerCase();
    const control = event.ctrlKey || event.metaKey;
    if (event.altKey) return null;
    if (control) {
      if (key === "z") return event.shiftKey ? () => this.redo() : () => this.undo();
      if (key === "y") return () => this.redo();
      return null;
    }
    const colorNumber = Number(key);
    if (Number.isInteger(colorNumber) && colorNumber >= 1 && colorNumber <= this.options.colors.length) {
      return () => this.selectColor(colorNumber - 1);
    }
    switch (key) {
      case "c":
        return () => this.setActive(!this.active);
      case "e":
        return () => this.selectTool("eraser");
      case "l":
        return () => this.selectTool("laser");
      case "delete":
      case "backspace":
        return event.shiftKey ? () => this.forgetAll() : () => this.clear();
      case "d":
        return () => this.download();
      case "escape":
        if (this.active) return () => this.setActive(false);
        return null;
      default:
        return null;
    }
  }

  // --- Rendering -----------------------------------------------------------

  // A 2D context for a canvas, drawing in slide coordinates.
  context(canvas) {
    const context = canvas.getContext("2d");
    context.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    return context;
  }

  inkContext() {
    return this.context(this.inkCanvas);
  }

  renderInk() {
    const context = this.inkCanvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
    if (!this.deck.isReady()) return;
    context.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
    for (const operation of visibleOperations(this.layer().ops)) {
      applyOperation(context, operation);
    }
    const gesture = this.interactive ? this.gesture : this.liveState?.gesture;
    if (gesture?.operation && gesture.layerKey === this.slideKey()) {
      const operation = gesture.operation;
      if (operation.kind === "stroke") {
        // The final segment is added on release; while drawing, the curve
        // ends at the midpoint before the last sample.
        drawStroke(context, operation, 1, Math.max(1, operation.points.length / 2 - 1));
      } else {
        applyOperation(context, operation);
      }
    }
  }

  requestOverlay() {
    if (this.overlayFrame !== null) return;
    this.overlayFrame = requestAnimationFrame((now) => {
      this.overlayFrame = null;
      this.renderOverlay(now);
      this.publishLive();
    });
  }

  // The overlay shows the cursor and laser traces, and is redrawn every frame
  // while a released laser trace is fading.
  renderOverlay(now) {
    const canvas = this.overlayCanvas;
    const context = canvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);

    const { laserColor, laserWidth, laserFadeMs } = this.options;
    const live = this.interactive ? this
      : this.liveState?.key === this.slideKey() ? this.liveState : null;
    const age = (trace) => (trace.releasedAt === null ? 0 : now - trace.releasedAt);
    const traces = (live?.laserTraces ?? []).filter((trace) => age(trace) < laserFadeMs);
    if (live) live.laserTraces = traces;
    for (const trace of traces) {
      context.globalAlpha = Math.max(0, 1 - age(trace) / laserFadeMs);
      this.drawLaser(context, trace.points, laserColor, laserWidth);
    }
    context.globalAlpha = 1;

    if (live?.active && live.cursor) {
      const [x, y] = live.cursor;
      const tool = live.gesture?.tool ?? live.tool;
      if (tool === "pen") {
        const color = this.options.colors[live.colorIndex];
        drawStroke(context, { color, width: Math.max(this.options.penWidth, 5), points: [x, y] }, 1, 1);
      } else if (tool === "eraser") {
        const size = this.options.eraserSize;
        context.fillStyle = "rgba(255, 255, 255, 0.08)";
        context.fillRect(x - size / 2, y - size / 2, size, size);
        context.strokeStyle = "rgba(255, 255, 255, 0.8)";
        context.lineWidth = 1.5 / this.scaleX;
        context.strokeRect(x - size / 2, y - size / 2, size, size);
      } else {
        this.drawLaser(context, [x, y], laserColor, laserWidth * 2);
      }
    }

    if (traces.some((trace) => trace.releasedAt !== null)) this.requestOverlay();
  }

  // A glowing line with a pale core.
  drawLaser(context, points, color, width) {
    context.save();
    context.shadowColor = color;
    context.shadowBlur = 3 * width * this.scaleX; // shadows ignore the transform
    drawStroke(context, { color, width, points }, 1, points.length / 2);
    context.restore();
    drawStroke(context, { color: "rgba(255, 235, 235, 0.9)", width: width * 0.35, points }, 1, points.length / 2);
  }

  // --- Storage, loading and saving -----------------------------------------

  save(key) {
    try {
      localStorage.setItem(this.storagePrefix + key, JSON.stringify(this.layer(key).ops));
    } catch (error) {
      console.warn("ink: could not store drawings:", error);
    }
    this.publishLive(key);
  }

  storedKeys() {
    try {
      return Object.keys(localStorage)
        .filter((storageKey) => storageKey.startsWith(this.storagePrefix))
        .map((storageKey) => storageKey.slice(this.storagePrefix.length));
    } catch {
      return [];
    }
  }

  loadFromStorage() {
    for (const key of this.storedKeys()) {
      try {
        this.layer(key).ops = JSON.parse(localStorage.getItem(this.storagePrefix + key));
      } catch (error) {
        console.warn(`ink: could not read stored drawings for ${key}:`, error);
      }
    }
  }

  // Saved drawings fill in layers with nothing stored in this browser.
  async loadFromSource() {
    if (this.options.src) {
      try {
        const response = await fetch(this.options.src);
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const drawings = await response.json();
        if (drawings.width !== this.width || drawings.height !== this.height) {
          console.warn(
            `ink: ${this.options.src} was drawn on ${drawings.width}×${drawings.height} slides,`,
            `but this deck's slides are ${this.width}×${this.height}`,
          );
        }
        const stored = new Set(this.storedKeys());
        for (const [key, ops] of Object.entries(drawings.layers)) {
          this.savedLayers.set(key, ops);
          if (!stored.has(key)) this.layer(key).ops = structuredClone(ops);
        }
        this.renderInk();
        this.updateToolbar();
      } catch (error) {
        console.warn(`ink: could not load drawings from ${this.options.src}:`, error);
      }
    }
    this.warnAboutMissingSlides();
  }

  warnAboutMissingSlides() {
    const missing = [...this.layers]
      .filter(([key, layer]) => layer.ops.length > 0 && !key.startsWith("slide-"))
      .map(([key]) => key)
      .filter((id) => !document.getElementById(id));
    if (missing.length > 0) {
      console.warn("ink: drawings for slides not in this deck:", [...new Set(missing)]);
    }
  }

  // Another tab or window (e.g. the speaker view) changed stored drawings.
  onStorage(event) {
    if (!event.key?.startsWith(this.storagePrefix)) return;
    const key = event.key.slice(this.storagePrefix.length);
    const layer = this.layer(key);
    layer.ops = event.newValue
      ? JSON.parse(event.newValue)
      : structuredClone(this.savedLayers.get(key) ?? []);
    layer.redo = [];
    if (key === this.slideKey()) this.renderInk();
    this.updateToolbar();
  }

  forgetAll() {
    if (!confirm("Forget all drawings stored in this browser for this deck?")) return;
    for (const key of this.storedKeys()) localStorage.removeItem(this.storagePrefix + key);
    this.layers = new Map();
    for (const [key, ops] of this.savedLayers) this.layer(key).ops = structuredClone(ops);
    this.renderInk();
    this.updateToolbar();
  }

  download() {
    const layers = {};
    for (const [key, layer] of this.layers) {
      if (layer.ops.length > 0) layers[key] = layer.ops;
    }
    const json = JSON.stringify({ width: this.width, height: this.height, layers });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: "drawings.json" });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

// --- Drawing operations (all in slide coordinates) ---------------------------

function element(tag, className) {
  const result = document.createElement(tag);
  result.className = className;
  return result;
}

// The operations a layer shows: everything after its last clear.
function visibleOperations(ops) {
  return ops.slice(ops.findLastIndex((operation) => operation.kind === "clear") + 1);
}

function applyOperation(context, operation) {
  const pointCount = operation.points?.length / 2;
  if (operation.kind === "stroke") drawStroke(context, operation, 1, pointCount);
  else if (operation.kind === "erase") erase(context, operation, 0);
}

// A stroke is drawn as a smooth curve through the midpoints of consecutive
// points, with the points themselves as quadratic control points. With n
// points, piece k (1 ≤ k < n) ends at the midpoint of points k-1 and k, and
// piece n is a straight line from there to the last point; drawing pieces as
// points arrive gives the same result as drawing the whole stroke at once. A
// stroke of one point is a dot.
function drawStroke(context, stroke, firstPiece, lastPiece) {
  const { points, color, width } = stroke;
  const n = points.length / 2;
  if (n === 1) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(points[0], points[1], width / 2, 0, 2 * Math.PI);
    context.fill();
    return;
  }
  const x = (i) => points[2 * i];
  const y = (i) => points[2 * i + 1];
  const midX = (i) => (x(i - 1) + x(i)) / 2;
  const midY = (i) => (y(i - 1) + y(i)) / 2;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  for (let k = firstPiece; k <= lastPiece; k++) {
    if (k === 1) context.moveTo(x(0), y(0));
    else context.moveTo(midX(k - 1), midY(k - 1));
    if (k === n) context.lineTo(x(n - 1), y(n - 1));
    else if (k === 1) context.lineTo(midX(1), midY(1));
    else context.quadraticCurveTo(x(k - 1), y(k - 1), midX(k), midY(k));
  }
  context.stroke();
}

// Erase along the eraser's path from the given point on, clearing squares
// spaced closely enough to sweep a continuous band.
function erase(context, erasure, fromPoint) {
  const { points, size } = erasure;
  const clearSquare = (x, y) => context.clearRect(x - size / 2, y - size / 2, size, size);
  if (fromPoint === 0) clearSquare(points[0], points[1]);
  for (let i = Math.max(fromPoint, 1); i < points.length / 2; i++) {
    const [x0, y0, x1, y1] = points.slice(2 * i - 2, 2 * i + 2);
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (size / 4));
    for (let step = 1; step <= steps; step++) {
      clearSquare(x0 + ((x1 - x0) * step) / steps, y0 + ((y1 - y0) * step) / steps);
    }
  }
}
