// Run with Node.js. Check posterior normalization and slide-fragment lifecycle
// independently of the browser's rendering, with a minimal DOM substitute.
import assert from "node:assert/strict";

globalThis.HTMLElement = class {};
globalThis.customElements = { define() {} };
const { SltSingularModel, singularNormalizer } = await import(
  "../widgets/slt-singular-model.js"
);

// Compare the partially analytic normalizer with independent 2D quadrature.
for (const n of [0, 4, 64, 4096]) {
  const count = 1000;
  const step = 8 / count;
  let integral = 0;
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      const u = -4 + (row + 0.5) * step;
      const v = -4 + (column + 0.5) * step;
      integral += Math.exp(-2 * (u * u + v * v) - n * u * u * v * v / 2) /
        (Math.PI / 2) * step * step;
    }
  }
  assert.ok(Math.abs(integral - singularNormalizer(n)) < 1e-5);
}

let shown = false;
let callback;
const revealClasses = new Set();
const fragment = { classList: { contains: () => shown } };
const reveal = { classList: { contains: (name) => revealClasses.has(name) } };
const slide = {
  classList: { contains: (name) => name === "present" },
  querySelector: () => fragment,
};
globalThis.location = { search: "" };
globalThis.document = {
  hidden: false,
  body: { classList: { contains: () => false } },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.matchMedia = () => ({
  matches: false, addEventListener() {}, removeEventListener() {},
});
globalThis.requestAnimationFrame = (next) => { callback = next; return 1; };
globalThis.cancelAnimationFrame = () => {};

const widget = new SltSingularModel();
widget.shadowRoot = {};
widget.closest = (selector) => selector === ".reveal" ? reveal : slide;
widget.draw = (progress) => { widget.progress = progress; };
widget.connectedCallback();
assert.equal(widget.active, false);
assert.equal(widget.frame, null);

shown = true;
widget.sync();
assert.equal(widget.active, true);
for (let now = 0; now <= 13000; now += 50) callback(now);
assert.equal(widget.progress, 1);
assert.equal(widget.frame, null);

shown = false;
widget.sync();
assert.equal(widget.active, false);
shown = true;
widget.sync();
assert.equal(widget.elapsed, 0);

widget.motion.matches = true;
widget.sync();
assert.equal(widget.progress, 1);
assert.equal(widget.active, false);
shown = false;
widget.sync();
assert.equal(widget.posteriorVisible(), false);

revealClasses.add("overview");
widget.sync();
assert.equal(widget.posteriorVisible(), true);
assert.equal(widget.progress, 1);
widget.disconnectedCallback();

console.log("Posterior normalization and fragment lifecycle checks passed.");
