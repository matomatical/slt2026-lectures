// <slt-level-set k="w1^2 * w2^2" range="1" size="480"></slt-level-set>
//
// Heatmap of a function K(w1, w2) on the square [-range, range]^2, with
// isolines at every half-decade of K and the sublevel set {K < ε} filled in
// the accent colour. A slider sets ε on a log scale; the readout shows ε and
// the fraction of the square's area inside the sublevel set.
//
// Attributes:
//   k        JavaScript expression in w1 and w2; `^` means power.
//   range    half-width of the square (default 1).
//   size     side length in slide pixels (default 480).

import {setupWidgetKeys} from "./widget-controls.js";

const RESOLUTION_MULTIPLIER = 2; // canvas pixels per slide pixel
const EPSILON_DECADES = 5; // slider spans [max K · 10^-5, max K]

class SltLevelSet extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const size = Number(this.getAttribute("size") ?? 480);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display: block; width: ${size}px; margin: 0 auto; }
        canvas { width: ${size}px; height: ${size}px; display: block; }
        .controls { display: flex; align-items: center; gap: 0.5em;
                    font-size: 0.75em; margin-top: 0.3em; }
        input { flex: 1; accent-color: var(--slt-accent); }
        .readout { font-variant-numeric: tabular-nums; min-width: 11em; }
      </style>
      <canvas></canvas>
      <div class="controls">
        <i>ε</i><input type="range" min="0" max="1000" value="500">
        <span class="readout"></span>
      </div>`;
    setupWidgetKeys(root);

    this.canvas = root.querySelector("canvas");
    this.slider = root.querySelector("input");
    this.readout = root.querySelector(".readout");
    this.pixels = size * RESOLUTION_MULTIPLIER;
    this.canvas.width = this.canvas.height = this.pixels;

    this.evaluateGrid();
    this.slider.addEventListener("input", () => this.draw());
    this.draw();
  }

  evaluateGrid() {
    const expression = (this.getAttribute("k") ?? "w1^2 * w2^2").replaceAll("^", "**");
    const lossFunction = new Function("w1", "w2", `return (${expression});`);
    const range = Number(this.getAttribute("range") ?? 1);
    const n = this.pixels;
    this.values = new Float64Array(n * n);
    this.maxValue = 0;
    for (let row = 0; row < n; row++) {
      const w2 = range * (1 - (2 * (row + 0.5)) / n);
      for (let column = 0; column < n; column++) {
        const w1 = range * ((2 * (column + 0.5)) / n - 1);
        const value = lossFunction(w1, w2);
        this.values[row * n + column] = value;
        if (value > this.maxValue) this.maxValue = value;
      }
    }
    // Isoline band of each pixel: which half-decade of K it lies in.
    this.bands = new Int32Array(n * n);
    for (let i = 0; i < n * n; i++) {
      this.bands[i] = Math.floor(2 * Math.log10(this.values[i] + 1e-300));
    }
  }

  epsilon() {
    const fraction = Number(this.slider.value) / Number(this.slider.max);
    return this.maxValue * 10 ** (-EPSILON_DECADES * (1 - fraction));
  }

  draw() {
    const n = this.pixels;
    const epsilon = this.epsilon();
    const style = getComputedStyle(this);
    const accent = parseColor(style.getPropertyValue("--slt-accent") || "#ffdc00");
    const context = this.canvas.getContext("2d");
    const image = context.createImageData(n, n);
    let inside = 0;
    for (let row = 0; row < n; row++) {
      for (let column = 0; column < n; column++) {
        const i = row * n + column;
        const band = this.bands[i];
        const onIsoline =
          (column + 1 < n && this.bands[i + 1] !== band) ||
          (row + 1 < n && this.bands[i + n] !== band);
        let rgb = onIsoline ? [90, 90, 90] : [0, 0, 0];
        if (this.values[i] < epsilon) {
          inside++;
          rgb = onIsoline ? accent.map((c) => c * 0.6) : accent;
        }
        image.data.set([...rgb, 255], 4 * i);
      }
    }
    context.putImageData(image, 0, 0);
    this.readout.textContent =
      `= ${epsilon.toExponential(1)},  area = ${(inside / (n * n)).toFixed(4)}`;
  }
}

function parseColor(cssColor) {
  const probe = document.createElement("canvas").getContext("2d");
  probe.fillStyle = cssColor.trim();
  const hex = probe.fillStyle; // normalised to #rrggbb
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}

customElements.define("slt-level-set", SltLevelSet);
