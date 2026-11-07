// <slt-dln-degeneracy></slt-dln-degeneracy>
// Compare scaling, an axis translation, and a first-order-only direction for
// f_(a,b)(x) = bax. Drag the point along the selected path; arrow keys navigate
// the presentation. Switching cases resets the path parameter t to zero.
import katex from "../vendor/katex/katex.mjs";
import {setupWidgetKeys} from "./widget-controls.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const RANGE = 2.3;
const PLOT = {left:35, top:24, size:380};
const CASES = {
  global: {label:"Global", limit:0.75, color:"#ff9933",
    point:t => ({a:Math.exp(t), b:Math.exp(-t)}),
    formula:"\\begin{gathered}w(t)=(e^t,e^{-t})\\\\f_{w(t)}(x)=x\\end{gathered}"},
  local: {label:"Localised", limit:1.8, color:"#ff9933",
    point:t => ({a:t, b:0}),
    formula:"\\begin{gathered}w(t)=(t,0)\\\\f_{w(t)}(x)=0\\end{gathered}"},
  infinitesimal: {label:"Infinitesimal", limit:1.8, color:"#ff4dff",
    point:t => ({a:t, b:t}),
    formula:"\\begin{gathered}w(t)=(t,t)\\\\f_{w(t)}(x)=t^2x\\end{gathered}"},
};

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function screenPoint({a, b}) {
  return {x:PLOT.left + (a + RANGE) * PLOT.size / (2 * RANGE),
    y:PLOT.top + (RANGE - b) * PLOT.size / (2 * RANGE)};
}

function pathData(points) {
  return points.map((point, index) => {
    const {x, y} = screenPoint(point);
    return `${index ? "L" : "M"}${x},${y}`;
  }).join(" ");
}

class SltDlnDegeneracy extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:"open"});
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("../vendor/katex/katex.min.css", import.meta.url)}">
      <style>
        :host { display:block; width:100%; max-width:520px; margin:auto;
          color:var(--slt-foreground, #fff); font-family:var(--slt-body-font, serif); }
        .cases { display:flex; gap:8px; justify-content:center; }
        button { background:#111; color:inherit; border:1px solid #666; border-radius:4px;
          padding:5px 12px; font:19px var(--slt-body-font, serif); cursor:pointer; }
        button[aria-pressed="true"], button:focus-visible { border-color:var(--active, #ff9933); }
        svg { display:block; width:100%; max-width:380px; height:auto; margin:2px auto;
          overflow:visible; user-select:none; }
        .fibre { fill:none; stroke:#444; stroke-width:1; }
        .axis { stroke:#888; stroke-width:1.2; }
        .tick { fill:#999; font-size:16px; text-anchor:middle; }
        .axis-label { fill:var(--slt-foreground, #fff); font-size:24px; font-style:italic; }
        .trace { fill:none; stroke:var(--active); stroke-width:3; }
        .start { fill:#000; stroke:#bbb; stroke-width:1.5; }
        .point { cursor:grab; touch-action:none; outline:none; }
        .point.dragging { cursor:grabbing; }
        .point:focus-visible .dot { stroke:var(--active); stroke-width:3; }
        .dot { fill:var(--slt-foreground, #fff); stroke:#000; stroke-width:2; }
        .point-label { fill:var(--slt-foreground, #fff); font-size:24px; font-style:italic; pointer-events:none; }
        .formula { min-height:64px; text-align:center; font-size:21px; }
        .hint { text-align:center; color:var(--slt-muted, #999); font-size:16px; margin:3px 0 8px; }
      </style>
      <div class="formula"></div>
      <svg viewBox="0 0 440 430" role="group" aria-label="Parameters a and b. Grey curves show equal products ba. Drag w along the selected path."></svg>
      <div class="hint">Drag w along the highlighted path</div>
      <div class="cases" role="group" aria-label="Type of degeneracy"></div>`;
    this.svg = root.querySelector("svg");
    this.formula = root.querySelector(".formula");
    this.buttons = [];
    for (const [name, example] of Object.entries(CASES)) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = example.label;
      button.addEventListener("click", () => this.selectCase(name));
      root.querySelector(".cases").append(button);
      this.buttons.push({name, button});
    }
    this.buildPlane();
    this.trace = svgElement("path", {class:"trace"});
    this.start = svgElement("circle", {class:"start", r:4});
    this.point = svgElement("g", {class:"point", tabindex:0, role:"group", "aria-label":"Drag parameter w along the highlighted path"});
    this.point.append(svgElement("circle", {r:21, fill:"transparent"}),
      svgElement("circle", {r:7, class:"dot"}), svgElement("text", {x:12, y:-12, class:"point-label"}, "w"));
    this.svg.append(this.trace, this.start, this.point);
    this.selectCase("global");
    setupWidgetKeys(root);
    this.point.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.pointerId !== undefined) return;
      event.preventDefault();
      event.stopPropagation();
      this.pointerId = event.pointerId;
      this.point.focus({preventScroll:true});
      this.point.setPointerCapture(event.pointerId);
      this.point.classList.add("dragging");
      const pointer = this.pointerPosition(event);
      const point = CASES[this.caseName].point(this.t);
      this.dragOffset = {a:pointer.a - point.a, b:pointer.b - point.b};
    });
    this.point.addEventListener("pointermove", event => {
      if (event.pointerId !== this.pointerId) return;
      event.stopPropagation();
      const position = this.pointerPosition(event);
      this.setTime(this.projectTime({a:position.a - this.dragOffset.a, b:position.b - this.dragOffset.b}));
    });
    const finish = event => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = undefined;
      this.point.classList.remove("dragging");
      if (this.point.hasPointerCapture(event.pointerId)) this.point.releasePointerCapture(event.pointerId);
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.point.addEventListener(type, finish);
  }

  buildPlane() {
    for (const product of [-4, -2, -1, -0.5, 0.5, 1, 2, 4]) {
      for (const sign of [-1, 1]) {
        const points = Array.from({length:161}, (_, index) => {
          const a = sign * (Math.abs(product) / RANGE + (RANGE - Math.abs(product) / RANGE) * index / 160);
          return {a, b:product / a};
        });
        this.svg.append(svgElement("path", {d:pathData(points), class:"fibre"}));
      }
    }
    this.svg.append(svgElement("path", {d:pathData([{a:-RANGE, b:0}, {a:RANGE, b:0}]), class:"axis"}),
      svgElement("path", {d:pathData([{a:0, b:-RANGE}, {a:0, b:RANGE}]), class:"axis"}));
    for (const value of [-2, -1, 1, 2]) {
      const horizontal = screenPoint({a:value, b:0});
      const vertical = screenPoint({a:0, b:value});
      this.svg.append(svgElement("text", {x:horizontal.x, y:horizontal.y + 20, class:"tick"}, String(value)),
        svgElement("text", {x:vertical.x - 15, y:vertical.y + 5, class:"tick"}, String(value)));
    }
    const zero = screenPoint({a:0, b:0});
    this.svg.append(svgElement("text", {x:zero.x - 14, y:zero.y + 20, class:"tick"}, "0"),
      svgElement("text", {x:423, y:zero.y + 7, class:"axis-label"}, "a"),
      svgElement("text", {x:zero.x - 6, y:17, class:"axis-label"}, "b"));
  }

  selectCase(name) {
    this.caseName = name;
    const example = CASES[name];
    this.style.setProperty("--active", example.color);
    for (const {name:buttonName, button} of this.buttons) button.setAttribute("aria-pressed", String(buttonName === name));
    katex.render(example.formula, this.formula);
    this.trace.setAttribute("d", pathData(Array.from({length:201}, (_, index) => example.point(-example.limit + 2 * example.limit * index / 200))));
    const start = screenPoint(example.point(0));
    this.start.setAttribute("cx", start.x);
    this.start.setAttribute("cy", start.y);
    this.setTime(0);
  }

  setTime(t) {
    const example = CASES[this.caseName];
    this.t = Math.max(-example.limit, Math.min(example.limit, t));
    this.position = example.point(this.t);
    this.product = this.position.b * this.position.a;
    const point = screenPoint(this.position);
    this.point.setAttribute("transform", `translate(${point.x} ${point.y})`);
  }

  pointerPosition(event) {
    const pointer = this.svg.createSVGPoint();
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    const local = pointer.matrixTransform(this.svg.getScreenCTM().inverse());
    return {a:2 * RANGE * (local.x - PLOT.left) / PLOT.size - RANGE,
      b:RANGE - 2 * RANGE * (local.y - PLOT.top) / PLOT.size};
  }

  projectTime(position) {
    if (this.caseName === "local") return position.a;
    if (this.caseName === "infinitesimal") return (position.a + position.b) / 2;
    // Find the nearest point on the visible scaling orbit, first sampling it
    // and then refining around the best sample. This also handles pointers
    // dragged outside the plot without taking logs of negative coordinates.
    const {limit, point} = CASES.global;
    const distance = t => {
      const candidate = point(t);
      return (candidate.a - position.a) ** 2 + (candidate.b - position.b) ** 2;
    };
    let best = 0;
    for (let index = 0; index <= 80; index++) {
      const t = -limit + 2 * limit * index / 80;
      if (distance(t) < distance(best)) best = t;
    }
    let left = Math.max(-limit, best - 2 * limit / 80);
    let right = Math.min(limit, best + 2 * limit / 80);
    for (let iteration = 0; iteration < 30; iteration++) {
      const a = left + (right - left) / 3, b = right - (right - left) / 3;
      if (distance(a) < distance(b)) right = b;
      else left = a;
    }
    return (left + right) / 2;
  }
}

customElements.define("slt-dln-degeneracy", SltDlnDegeneracy);
