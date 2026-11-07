// <slt-regular-model width="300"></slt-regular-model>
// Fixed-camera Gaussian regression illustration: two weights, population-loss
// contours and a posterior with covariance (n I)^-1 under a flat prior.
// I = [[1.8, 0.65], [0.65, 1]], corresponding to a full-rank input design
// and unit observation-noise variance. The estimate's path is illustrative.
// Plays once on slide entry; reduced motion, overview and print show the end.

import {setupWidgetKeys} from "./widget-controls.js";

const FISHER = [1.8, 0.65, 1];
const FINAL_N = 64;
const DURATION = 12;
const GRID = 52;

// The camera, grid and painter order are fixed. Only the posterior heights
// change between frames; keep one mesh and four scratch heights per widget.
export function createPosteriorSurface(grid) {
  const range = 1.1, step = 2 * range / grid;
  const tiles = [];
  for (let row = 0; row < grid; row++) {
    for (let column = 0; column < grid; column++) {
      const u = -range + column * step, v = -range + row * step;
      tiles.push({
        depth: u + v,
        corners: [[u, v], [u + step, v], [u + step, v + step], [u, v + step]].map(
          ([u, v]) => ({ u, v, x: 155 + 62 * (u - v), y: 243 + 25 * (u + v) }),
        ),
      });
    }
  }
  tiles.sort((left, right) => left.depth - right.depth);
  const heights = new Float64Array(4);
  return {
    draw(context, height) {
      context.fillStyle = "rgba(255,153,51,0.26)";
      for (const tile of tiles) {
        let maximum = 0;
        for (let index = 0; index < 4; index++) {
          const corner = tile.corners[index];
          heights[index] = height(corner.u, corner.v);
          maximum = Math.max(maximum, heights[index]);
        }
        if (maximum < 0.25) continue;
        context.beginPath();
        for (let index = 0; index < 4; index++) {
          const corner = tile.corners[index];
          const y = corner.y - heights[index];
          if (index === 0) context.moveTo(corner.x, y);
          else context.lineTo(corner.x, y);
        }
        context.closePath();
        context.fill();
      }
    },
  };
}

export class SltRegularModel extends HTMLElement {
  constructor() {
    super();
    this.sync = this.sync.bind(this);
    this.tick = this.tick.bind(this);
  }

  connectedCallback() {
    if (!this.shadowRoot) this.setup();
    this.elapsed = 0;
    this.lastTime = null;
    this.frame = null;
    this.active = false;
    this.motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.observer = new MutationObserver(this.sync);
    const reveal = this.closest(".reveal");
    if (reveal) {
      this.observer.observe(reveal, {
        attributes: true,
        attributeFilter: ["class"],
        subtree: true,
      });
    }
    document.addEventListener("visibilitychange", this.sync);
    this.motion.addEventListener("change", this.sync);
    this.sync();
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.sync);
    this.motion.removeEventListener("change", this.sync);
  }

  setup() {
    const width = Number(this.getAttribute("width") ?? 300);
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host { display:block; width:${width}px; max-width:100%; margin:0 auto;
          color:var(--slt-foreground, white); font-family:var(--slt-body-font, serif); }
        svg { display:block; width:100%; overflow:visible; }
        canvas { display:block; width:100%; aspect-ratio:310 / 340; }
        .caption { text-align:center; font-size:20px; line-height:1.3; }
        button { display:block; margin:8px auto 0; padding:2px 8px;
          font-family:inherit; font-size:16px; color:var(--slt-muted, #999);
          border:1px solid #555; border-radius:3px; background:transparent; cursor:pointer; }
        button:focus-visible { outline:2px solid #ff9933; outline-offset:3px; }
        button[hidden] { display:none; }
        @media print { button { display:none; } }
      </style>
      <svg viewBox="0 0 310 145" role="img"
        aria-label="Linear model: inputs x one and x two connect through weights w one and w two to output y.">
        <g fill="none" stroke="#999" stroke-width="1.6">
          <path d="M82 36 L226 70 M82 105 L226 70"/>
          <circle cx="63" cy="36" r="20"/>
          <circle cx="63" cy="105" r="20"/>
          <circle cx="247" cy="70" r="21"/>
        </g>
        <g fill="currentColor" font-size="25" text-anchor="middle" font-style="italic">
          <text x="63" y="44">x₁</text><text x="63" y="113">x₂</text>
          <text x="247" y="78">y</text>
          <text x="151" y="36">w₁</text><text x="151" y="110">w₂</text>
        </g>
        <text x="155" y="140" fill="#999" font-size="19" text-anchor="middle">
          y = w₁x₁ + w₂x₂ + ε
        </text>
      </svg>
      <canvas width="620" height="680" role="img"
        aria-label="Grey elliptical loss contours around the true parameter. An orange Gaussian posterior narrows as the sample size increases."></canvas>
      <div class="caption">Posterior width ∝ n<sup>−½</sup></div>
      <button type="button">Replay</button>`;
    setupWidgetKeys(root);
    root.querySelector("button").onclick = () => {
      this.elapsed = 0;
      this.lastTime = null;
      this.sync();
    };
    this.context = root.querySelector("canvas").getContext("2d");
    this.context.scale(2, 2);
  }

  sync() {
    const reveal = this.closest(".reveal");
    const slide = this.closest("section");
    const still = this.motion.matches || location.search.includes("print-pdf") ||
      document.body.classList.contains("print-pdf") ||
      reveal?.classList.contains("overview");
    const active = !still && !document.hidden &&
      !reveal?.classList.contains("paused") &&
      (!reveal || slide?.classList.contains("present")) && this.animationEnabled();
    if (active && !this.active) this.elapsed = 0;
    this.active = active;
    if (!active && this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
      this.lastTime = null;
    }
    this.draw(still ? 1 : this.elapsed / DURATION);
    if (active && this.elapsed < DURATION && this.frame === null) {
      this.frame = requestAnimationFrame(this.tick);
    }
  }

  animationEnabled() {
    return true;
  }

  tick(now) {
    this.frame = null;
    if (this.lastTime !== null && now - this.lastTime < 1000 / 24) {
      this.frame = requestAnimationFrame(this.tick);
      return;
    }
    if (this.lastTime !== null) this.elapsed += Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.draw(Math.min(1, this.elapsed / DURATION));
    if (this.elapsed < DURATION) this.frame = requestAnimationFrame(this.tick);
  }

  draw(progress) {
    const context = this.context;
    const project = (u, v, z = 0) => [155 + 62 * (u - v), 243 + 25 * (u + v) - z];
    const path = (points, close = false) => {
      context.beginPath();
      points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      if (close) context.closePath();
    };
    const label = (text, x, y, color = "#999", size = 19) => {
      context.fillStyle = color;
      context.font = `${size}px "EB Garamond", serif`;
      context.textAlign = "center";
      context.fillText(text, x, y);
    };
    context.clearRect(0, 0, 310, 340);
    const n = 4 * (FINAL_N / 4) ** Math.max(0, Math.min(1, progress));
    label(`n = ${Math.round(n)}`, 155, 28, "#ff9933", 23);
    label("Bayesian posterior", 155, 53, "#bbb", 20);

    context.strokeStyle = "#444";
    context.lineWidth = 1;
    path([project(-1.1, -1.1), project(1.1, -1.1), project(1.1, 1.1), project(-1.1, 1.1)], true);
    context.stroke();
    path([project(-1.1, 0), project(1.35, 0)]);
    context.stroke();
    path([project(0, -1.1), project(0, 1.35)]);
    context.stroke();
    label("w₁", ...project(1.52, 0));
    label("w₂", ...project(0, 1.52));

    // Cholesky coordinates for wᵀ I w = r², with I positive definite.
    const [a, b, c] = FISHER;
    const diagonal = Math.sqrt(c - b * b / a);
    const ellipse = (radius, angle) => {
      const v = radius * Math.sin(angle) / diagonal;
      const u = (radius * Math.cos(angle) - b * v / Math.sqrt(a)) / Math.sqrt(a);
      return [u, v];
    };
    context.strokeStyle = "#777";
    for (const radius of [0.22, 0.45, 0.7, 0.95]) {
      path(Array.from({ length: 97 }, (_, index) => project(...ellipse(radius, index * Math.PI / 48))), true);
      context.stroke();
    }

    // A full-rank Gaussian likelihood and flat prior give this exact normal
    // posterior. Keep a fixed density-height scale, so its peak rises with n.
    const mean = [0.5 / Math.sqrt(n), -0.35 / Math.sqrt(n)];
    const height = (u, v) => {
      const x = u - mean[0], y = v - mean[1];
      return 164 * n / FINAL_N * Math.exp(-n * (a * x * x + 2 * b * x * y + c * y * y) / 2);
    };
    this.posteriorSurface ??= createPosteriorSurface(GRID);
    this.posteriorSurface.draw(context, height);

    // Sparse meridians keep the surface legible at sidebar size.
    const range = 1.1;
    context.strokeStyle = "rgba(255,170,85,0.45)";
    context.lineWidth = 0.7;
    for (let index = -3; index <= 3; index++) {
      const v = mean[1] + index * 0.4 / Math.sqrt(n);
      if (Math.abs(v) > range) continue;
      const lower = Math.max(-range, mean[0] - 3 / Math.sqrt(n));
      const upper = Math.min(range, mean[0] + 3 / Math.sqrt(n));
      path(Array.from({ length: 81 }, (_, point) => {
        const u = lower + point / 80 * (upper - lower);
        return project(u, v, height(u, v));
      }));
      context.stroke();
    }

    const [x, y] = project(0, 0);
    context.fillStyle = "#ff9933";
    context.beginPath();
    context.arc(x, y, 4, 0, 2 * Math.PI);
    context.fill();
    label("w₀", x - 18, y + 20, "#ff9933");
    const [mx, my] = project(...mean);
    context.strokeStyle = "#ffc58a";
    context.lineWidth = 1.3;
    path([[mx - 3, my - 3], [mx + 3, my + 3]]);
    context.stroke();
    path([[mx - 3, my + 3], [mx + 3, my - 3]]);
    context.stroke();
    label("Grey contours: excess loss K(w)", 155, 330, "#999", 18);
  }
}

customElements.define("slt-regular-model", SltRegularModel);
