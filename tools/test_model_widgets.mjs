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
let nextFrame = 0;
const frames = new Map();
const visibilityListeners = new Set();
const motionListeners = new Set();
let slidePresent = true;
const revealClasses = new Set();
const fragment = { classList: { contains: () => shown } };
const reveal = { classList: { contains: (name) => revealClasses.has(name) } };
const slide = {
  classList: { contains: (name) => name === "present" && slidePresent },
  querySelector: () => fragment,
};
globalThis.location = { search: "" };
globalThis.document = {
  hidden: false,
  body: { classList: { contains: () => false } },
  addEventListener(name, callback) { visibilityListeners.add(callback); },
  removeEventListener(name, callback) { visibilityListeners.delete(callback); },
};
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.matchMedia = () => ({
  matches: false,
  addEventListener(name, callback) { motionListeners.add(callback); },
  removeEventListener(name, callback) { motionListeners.delete(callback); },
});
globalThis.requestAnimationFrame = (callback) => {
  frames.set(++nextFrame, callback);
  return nextFrame;
};
globalThis.cancelAnimationFrame = (frame) => { frames.delete(frame); };

function advance(now) {
  const callbacks = [...frames.values()];
  frames.clear();
  for (const callback of callbacks) callback(now);
}

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
for (let now = 0; now <= 13000; now += 50) advance(now);
assert.equal(widget.progress, 1);
assert.equal(widget.frame, null);
assert.equal(frames.size, 0);

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
assert.equal(visibilityListeners.size, 0);
assert.equal(motionListeners.size, 0);

// Reattaching the same element must reuse its handlers, retain only one loop,
// and release external subscriptions on every disconnection.
revealClasses.clear();
shown = true;
const sync = widget.sync, tick = widget.tick;
for (let connection = 0; connection < 3; connection++) {
  widget.connectedCallback();
  assert.equal(widget.sync, sync);
  assert.equal(widget.tick, tick);
  assert.equal(visibilityListeners.size, 1);
  assert.equal(motionListeners.size, 1);
  assert.equal(frames.size, 1);
  widget.sync();
  widget.sync();
  assert.equal(frames.size, 1);
  slidePresent = false;
  widget.sync();
  assert.equal(frames.size, 0);
  slidePresent = true;
  widget.sync();
  assert.equal(widget.elapsed, 0);
  assert.equal(frames.size, 1);
  widget.disconnectedCallback();
  assert.equal(frames.size, 0);
  assert.equal(visibilityListeners.size, 0);
  assert.equal(motionListeners.size, 0);
}

console.log("Posterior normalization and fragment lifecycle checks passed.");
