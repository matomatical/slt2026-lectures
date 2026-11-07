// <slt-singular-model width="300"></slt-singular-model>
// Two-layer scalar linear network with K(w) = (w1 w2)^2 / 2.
// The density is proportional to exp(-n K(w)) times a N(0, 0.25 I) prior.
// This is an idealised zero-target likelihood, without empirical fluctuations.
// A fragment marked data-slt-posterior reveals the posterior on its slide.
// Without that fragment (e.g. in the gallery), the posterior plays immediately.

import { SltRegularModel, createPosteriorSurface } from "./slt-regular-model.js";

const PRIOR_VARIANCE = 0.25;
const FINAL_N = 4096;
const GRID = 64;

// Integrate out w2 analytically, then use Simpson quadrature over w1.
// The integration bounds are eight prior standard deviations from zero.
export function singularNormalizer(n) {
  const count = 2048;
  const step = 8 / count;
  let total = 0;
  for (let index = 0; index <= count; index++) {
    const u = -4 + index * step;
    const value = Math.exp(-u * u / (2 * PRIOR_VARIANCE)) /
      Math.sqrt(2 * Math.PI * PRIOR_VARIANCE * (1 + n * PRIOR_VARIANCE * u * u));
    total += value * (index === 0 || index === count ? 1 : index % 2 === 0 ? 2 : 4);
  }
  return total * step / 3;
}

const FINAL_NORMALIZER = singularNormalizer(FINAL_N);

export class SltSingularModel extends SltRegularModel {
  setup() {
    super.setup();
    const root = this.shadowRoot;
    const network = root.querySelector("svg");
    network.setAttribute("aria-label", "Two-layer linear network: input x, weight w one, hidden unit h, weight w two, output y.");
    network.innerHTML = `
      <g fill="none" stroke="#999" stroke-width="1.6">
        <path d="M65 62 L135 62 M175 62 L245 62"/>
        <circle cx="45" cy="62" r="20"/>
        <circle cx="155" cy="62" r="20"/>
        <circle cx="265" cy="62" r="20"/>
      </g>
      <g fill="currentColor" font-size="25" text-anchor="middle" font-style="italic">
        <text x="45" y="70">x</text><text x="155" y="70">h</text>
        <text x="265" y="70">y</text>
        <text x="100" y="42">w₁</text><text x="210" y="42">w₂</text>
      </g>
      <text x="155" y="110" fill="#999" font-size="19" text-anchor="middle">y = w₂w₁x + ε</text>
      <text x="155" y="140" fill="#ff9933" font-size="19" text-anchor="middle">w₁ = 0 or w₂ = 0 ⇒ zero predictor</text>`;
    root.querySelector("canvas").setAttribute("aria-label",
      "Hyperbolic loss contours around crossing lines of minima. After the reveal, a non-Gaussian orange posterior concentrates near the crossing.");
    root.querySelector(".caption").textContent = "Crossing lines of minima";
  }

  posteriorVisible() {
    const reveal = this.closest(".reveal");
    const fragment = this.closest("section")?.querySelector("[data-slt-posterior]");
    return !fragment || fragment.classList.contains("visible") ||
      reveal?.classList.contains("overview") || location.search.includes("print-pdf") ||
      document.body.classList.contains("print-pdf");
  }

  animationEnabled() {
    return this.posteriorVisible();
  }

  draw(progress) {
    const context = this.context;
    const posterior = this.posteriorVisible();
    const n = 4 * (FINAL_N / 4) ** Math.max(0, Math.min(1, progress));
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
    label(posterior ? `n = ${Math.round(n)}` : "Zero-target loss", 155, 28, "#ff9933", 23);
    label(posterior ? "Bayesian posterior" : "K(w) = ½(w₁w₂)²", 155, 53, "#bbb", 20);

    const range = 1.1;
    context.lineWidth = 1;
    context.strokeStyle = "#444";
    path([project(-range, -range), project(range, -range), project(range, range), project(-range, range)], true);
    context.stroke();
    label("w₁", ...project(1.52, 0));
    label("w₂", ...project(0, 1.52));

    context.strokeStyle = "#777";
    for (const product of [0.05, 0.15, 0.35, 0.65]) {
      for (const uSign of [-1, 1]) {
        for (const vSign of [-1, 1]) {
          path(Array.from({ length: 81 }, (_, index) => {
            const u = product / range + index / 80 * (range - product / range);
            return project(uSign * u, vSign * product / u);
          }));
          context.stroke();
        }
      }
    }

    context.strokeStyle = "#ff9933";
    context.lineWidth = 2;
    path([project(-range, 0), project(range, 0)]);
    context.stroke();
    path([project(0, -range), project(0, range)]);
    context.stroke();

    if (posterior) {
      const peak = 164 * FINAL_NORMALIZER / singularNormalizer(n);
      const height = (u, v) => peak * Math.exp(
        -(u * u + v * v) / (2 * PRIOR_VARIANCE) - n * (u * v) ** 2 / 2,
      );
      this.posteriorSurface ??= createPosteriorSurface(GRID);
      this.posteriorSurface.draw(context, height);
      context.strokeStyle = "rgba(255,170,85,0.45)";
      context.lineWidth = 0.7;
      // Draw both families of meridians to show the two posterior ridges.
      for (const fixed of [-0.6, -0.3, 0, 0.3, 0.6]) {
        for (const swap of [false, true]) {
          path(Array.from({ length: 97 }, (_, index) => {
            const variable = -range + index / 96 * 2 * range;
            const [u, v] = swap ? [fixed, variable] : [variable, fixed];
            return project(u, v, height(u, v));
          }));
          context.stroke();
        }
      }
    }

    const [x, y] = project(0, 0);
    context.fillStyle = "#ff9933";
    context.beginPath();
    context.arc(x, y, 4, 0, 2 * Math.PI);
    context.fill();
    label("singular point", x, 308, "#ff9933", 18);
    label("Grey contours: excess loss K(w)", 155, 333, "#999", 18);
    const button = this.shadowRoot?.querySelector("button");
    if (button) button.hidden = !posterior;
  }
}

customElements.define("slt-singular-model", SltSingularModel);
