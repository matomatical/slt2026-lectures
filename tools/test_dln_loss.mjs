// Run with Node.js after `make`. Check the geometry used by both landscapes.
import assert from "node:assert/strict";

globalThis.HTMLElement = class {};
globalThis.customElements = { define() {} };
const { linearNetworkLoss, shallowLinearLoss, SltDlnLoss, SltLossExamples } = await import("../build/widgets/slt-dln-loss.js");

// The zero-target model has crossing axes of minima, and grows quartically
// along every straight line through the origin with both components nonzero.
for (const value of [-1.5, -0.5, 0, 0.5, 1.5]) {
  assert.equal(linearNetworkLoss(value, 0, 0), 0);
  assert.equal(linearNetworkLoss(0, value, 0), 0);
}
for (const [a, b] of [[1, 1], [2, -1], [-0.5, 1.5]]) {
  const full = linearNetworkLoss(0.2 * a, 0.2 * b, 0);
  const half = linearNetworkLoss(0.1 * a, 0.1 * b, 0);
  assert.ok(full > 0);
  assert.ok(Math.abs(full / half - 16) < 1e-10);
}

// Both branches ab=1 are minima. Scaling follows them exactly, whereas the
// straight tangent has quartic growth and a transverse direction is quadratic.
for (const sign of [-1, 1]) {
  for (const time of [-0.5, 0, 0.5]) {
    const a = sign * Math.exp(time);
    const b = sign * Math.exp(-time);
    assert.ok(linearNetworkLoss(a, b, 1) < 1e-25);
    for (const step of [0.1, 0.2]) {
      const tangentLoss = linearNetworkLoss(a * (1 + step), b * (1 - step), 1);
      assert.ok(Math.abs(tangentLoss - step ** 4) < 1e-12);
      const transverseLoss = linearNetworkLoss(a * (1 + step), b, 1);
      assert.ok(Math.abs(transverseLoss - step ** 2) < 1e-12);
    }
  }
}
assert.ok(linearNetworkLoss(0.1, 0.1, 1) < linearNetworkLoss(0, 0, 1));
assert.ok(linearNetworkLoss(0.1, -0.1, 1) > linearNetworkLoss(0, 0, 1));
// The two-input shallow neuron has strictly positive quadratic growth in
// every nonzero weight direction, in contrast to the quartic checks above.
for (const [w1, w2] of [[1, 0], [0, 1], [1, -1], [2, 3]]) {
  const loss = shallowLinearLoss(w1, w2);
  assert.ok(loss > 0);
  assert.ok(Math.abs(shallowLinearLoss(0.5*w1, 0.5*w2) / loss - 0.25) < 1e-12);
}
const step = 0.001;
assert.ok(Math.abs((shallowLinearLoss(step, 0) + shallowLinearLoss(-step, 0)) / step**2 - 2) < 1e-10);
assert.ok(Math.abs((shallowLinearLoss(0, step) + shallowLinearLoss(0, -step)) / step**2 - 2) < 1e-10);

// The four extra examples distinguish lines of minima from isolated minima,
// and quadratic curvature from quartic growth at the origin.
const extras = new SltLossExamples().examples;
for (const [index, expected] of [[0,[2,0]], [1,[0,2]], [2,[0,0]], [3,[0,0]]]) {
  const {loss,gradient} = extras[index];
  assert.equal(loss(0,0),0);
  assert.deepEqual(gradient(0,0),[0,0]);
  const h = 0.0001;
  const diagonal = [(loss(h,0)+loss(-h,0))/h**2, (loss(0,h)+loss(0,-h))/h**2];
  for (let axis=0;axis<2;axis++) assert.ok(Math.abs(diagonal[axis]-expected[axis])<1e-7);
  assert.equal(loss(0,1)===0,index===0||index===2);
}

// Turning the near side right follows a rightward drag (decreasing yaw).
// The fitted camera must also keep both the ground and height cutoff in view.
const widget = new SltDlnLoss();
for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
  widget.yaw = yaw;
  widget.pitch = 0.6;
  widget.updateProjection();
  const frontA = Math.sin(yaw), frontB = Math.cos(yaw);
  const before = widget.project(frontA, frontB).x;
  widget.yaw -= 0.1;
  widget.updateProjection();
  assert.ok(widget.project(frontA, frontB).x > before);
  for (const pitch of [0.25, 0.6, 1.15]) {
    widget.pitch = pitch;
    widget.updateProjection();
    for (const a of [-1.8, 1.8]) {
      for (const b of [-1.8, 1.8]) {
        for (const height of [0, 3]) {
          const point = widget.project(a, b, height);
          assert.ok(point.x >= 34.9 && point.x <= 525.1);
          assert.ok(point.y >= 19.9 && point.y <= 330.1);
        }
      }
    }
  }
}
console.log("Camera direction and bounds passed.");
console.log("Crossing minima, quartic flatness, hyperbolic valleys, tangent curvature, and saddle checks passed.");
