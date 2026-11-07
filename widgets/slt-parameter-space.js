// <slt-parameter-space></slt-parameter-space>
// Drag w in a schematic two-dimensional view of R^d.
// view="map" adds the computed function in a wide horizontal layout.
// Add layout="sidebar" to stack the map vertically in a slide sidebar.
// The wrapped vector contains 24 connection weights followed by 9 biases;
// the miniature 1–4–4–1 network displays only the connection weights.
import {setupWidgetKeys} from "./widget-controls.js";
import katex from "../vendor/katex/katex.mjs";
import {
  LAYER_SIZES, WEIGHT_COUNT, PARAMETER_COUNT,
  parametersAt, evaluateNetwork, weightColor,
} from "./network-model.js";
const SVG_NS = "http://www.w3.org/2000/svg";
const BOX = {left: 18, top: 32, width: 264, height: 148};

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

function mathLabel(tex, x, y, width = 50) {
  const element = svgElement("foreignObject", {x, y, width, height: 34});
  const label = document.createElement("div");
  katex.render(tex, label);
  element.append(label);
  return element;
}

export class SltParameterSpace extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.view = this.getAttribute("view") || this.defaultView || "parameters";
    const isMap = this.view === "map";
    const isFunction = this.view === "function";
    this.isSidebarMap = isMap && this.getAttribute("layout") === "sidebar";
    const isWideMap = isMap && !this.isSidebarMap;
    this.box = {...BOX, height:this.isSidebarMap ? 108 : BOX.height};
    const root = this.attachShadow({mode: "open"});
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("../vendor/katex/katex.min.css", import.meta.url)}">
      <style>
        .katex { font-size:1em; }
        :host { display:block; width:100%; max-width:${isWideMap ? 1200 : 300}px; margin:0 auto;
          color:var(--slt-foreground, #fff); font-family:var(--slt-body-font, serif); }
        svg { display:block; width:100%; height:auto; overflow:visible; user-select:none; }
        foreignObject { overflow:visible; pointer-events:none; font-size:22px; }
        .space { fill:var(--slt-background, #000); stroke:#888; stroke-width:1.4; }
        .point { cursor:grab; touch-action:none; outline:none; }
        .point.dragging { cursor:grabbing; }
        .point:focus-visible .dot { stroke:#ff4dff; stroke-width:3; }
        .dot { fill:var(--slt-foreground, #fff); stroke:#000; stroke-width:2; }
        .guide { fill:none; stroke:#777; stroke-width:1.2; }
        .node { fill:var(--slt-background, #000); stroke:#bbb; stroke-width:1.4; }
        .hint { fill:var(--slt-muted, #999); font-size:15px; text-anchor:middle; }
        .legend { fill:var(--slt-muted, #999); font-size:16px; text-anchor:middle; }
        .axis { stroke:#666; stroke-width:1; }
        .plot-label { fill:var(--slt-muted, #999); font-size:15px; }
        .curve { fill:none; stroke:var(--slt-foreground, #fff); stroke-width:2.3; }
        button { display:block; margin:8px auto 0; padding:7px 16px;
          border:1px solid #888; border-radius:4px; background:#111;
          color:inherit; font:18px var(--slt-body-font, serif); cursor:pointer; }
        button:hover, button:focus-visible { border-color:#ff4dff; }
      </style>
      <svg viewBox="0 0 ${isWideMap ? "1200 325" : this.isSidebarMap ? "300 550" : isFunction ? "300 450" : "300 500"}" role="group"
        aria-label="${isFunction ? "Weighted neural network and its computed function" : isMap ? "Parameter space, weighted network, and computed function" : "Parameter space, parameter vector, and weighted network"}"></svg>`;
    this.svg = root.querySelector("svg");
    if (!isFunction) this.buildParameterControl();
    this.buildNetwork(isWideMap ? {x:440, y:150, width:300} : {x:23, y:this.isSidebarMap ? 260 : isFunction ? 82 : 405, width:252});
    if (isFunction || isMap) this.buildPlot(this.isSidebarMap
      ? {x:32, y:370, width:240, height:170} : isWideMap
      ? {x:880, y:55, width:280, height:220}
      : {x:32, y:230, width:240, height:175});
    if (isFunction) {
      this.svg.append(mathLabel("f_w", 131, 170),
        svgElement("path", {d:"M150 147 V165 M145 160 L150 165 L155 160", class:"guide"}));
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Randomise weights";
      button.addEventListener("click", () => this.renderParameters(
        Array.from({length:PARAMETER_COUNT}, () => 2 * Math.random() - 1)));
      root.append(button);
    } else if (this.isSidebarMap) {
      this.svg.append(mathLabel("f_w", 173, 330),
        svgElement("path", {d:"M150 322 V346 M145 341 L150 346 L155 341", class:"guide"}));
    } else if (isWideMap) {
      this.svg.append(mathLabel("\\mathbb R^d", 22, 0, 90),
        mathLabel("w", 574, 23), mathLabel("f_w", 1000, 0),
        svgElement("path", {d:"M310 150 H410 M404 145 L410 150 L404 155 M760 150 H850 M844 145 L850 150 L844 155", class:"guide"}),
        svgElement("text", {x:590, y:238, class:"hint"}, "weighted network"));
    }
    if (!this.isSidebarMap) this.buildLegend(isMap ? 590 : 150, isFunction ? 431 : isMap ? 280 : 479);

    this.position = {x:0.43, y:0.54};
    this.point?.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.pointerId !== undefined) return;
      event.preventDefault();
      event.stopPropagation();
      this.point.focus({preventScroll:true});
      this.pointerId = event.pointerId;
      this.point.setPointerCapture(event.pointerId);
      this.point.classList.add("dragging");
      const position = this.pointerPosition(event);
      this.dragOffset = {x:position.x - this.position.x, y:position.y - this.position.y};
    });
    this.point?.addEventListener("pointermove", event => {
      if (event.pointerId !== this.pointerId) return;
      event.stopPropagation();
      const position = this.pointerPosition(event);
      this.move(position.x - this.dragOffset.x, position.y - this.dragOffset.y);
    });
    const endDrag = event => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = undefined;
      this.point.classList.remove("dragging");
      if (this.point.hasPointerCapture(event.pointerId)) this.point.releasePointerCapture(event.pointerId);
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.point?.addEventListener(type, endDrag);
    setupWidgetKeys(root);
    this.move(this.position.x, this.position.y);
  }

  buildParameterControl() {
    const box = this.box;
    this.svg.append(
      ...(this.view === "map" && !this.isSidebarMap ? [] : [mathLabel("\\mathbb R^d", 22, 0, 90)]),
      svgElement("rect", {x:box.left, y:box.top, width:box.width, height:box.height, rx:3, class:"space"}),
      svgElement("text", {x:150, y:box.top + box.height + 21, class:"hint"}, "Drag w"));
    this.point = svgElement("g", {class:"point", tabindex:0, role:"button",
      "aria-label":"Parameter w. Drag to change the network weights."});
    this.point.append(svgElement("circle", {r:19, fill:"transparent"}),
      svgElement("circle", {r:6, class:"dot"}), mathLabel("w", 10, -30));
    this.svg.append(this.point);
    if (this.view === "map") {
      if (this.isSidebarMap) this.svg.append(svgElement("path", {d:"M150 178 V196 M145 191 L150 196 L155 191", class:"guide"}));
      return;
    }
    const vectorTop = 230;
    this.svg.append(mathLabel("w=", 0, vectorTop + 14, 55),
      svgElement("path", {d:`M51 ${vectorTop - 4} H45 V${vectorTop + 53} H51 M284 ${vectorTop - 4} H290 V${vectorTop + 53} H284`, class:"guide"}));
    this.cells = Array.from({length:PARAMETER_COUNT}, (_, index) => {
      const cell = svgElement("rect", {x:53 + index % 12 * 19, y:vectorTop + Math.floor(index / 12) * 18,
        width:16, height:14, rx:1});
      cell.append(svgElement("title", {}));
      this.svg.append(cell);
      return cell;
    });
    this.svg.append(svgElement("path", {d:"M150 295 V334 M145 329 L150 334 L155 329", class:"guide"}));
  }

  buildNetwork({x, y, width}) {
    const layers = LAYER_SIZES.map((size, layer) => Array.from({length:size}, (_, index) => ({
      x:x + layer * width / 3, y:y + (index - (size - 1) / 2) * 31,
    })));
    this.edges = [];
    for (let layer = 1; layer < layers.length; layer++) {
      for (const target of layers[layer]) {
        for (const source of layers[layer - 1]) {
          const edge = svgElement("line", {x1:source.x, y1:source.y, x2:target.x, y2:target.y, "stroke-width":1.7});
          this.edges.push(edge);
          this.svg.append(edge);
        }
      }
    }
    for (const node of layers.flat()) this.svg.append(svgElement("circle", {cx:node.x, cy:node.y, r:5, class:"node"}));
  }

  buildPlot({x, y, width, height}) {
    this.plot = {x, y, width, height};
    this.svg.append(svgElement("rect", {x, y, width, height, fill:"none", stroke:"#333"}),
      svgElement("line", {x1:x, y1:y + height / 2, x2:x + width, y2:y + height / 2, class:"axis"}),
      svgElement("line", {x1:x + width / 2, y1:y, x2:x + width / 2, y2:y + height, class:"axis"}));
    for (const value of [-3, 0, 3]) {
      this.svg.append(svgElement("text", {x:x + (value + 3) * width / 6, y:y + height / 2 + 18,
        class:"plot-label", "text-anchor":"middle"}, String(value)));
    }
    for (const value of [-5, 5]) this.svg.append(svgElement("text", {
      x:x + width / 2 - 8, y:y + (5 - value) * height / 10 + (value > 0 ? 13 : -4),
      class:"plot-label", "text-anchor":"end"}, String(value)));
    this.svg.append(svgElement("text", {x:x + width + 8, y:y + height / 2 + 5, class:"plot-label"}, "x"));
    this.curve = svgElement("path", {class:"curve", "aria-label":"Computed network function"});
    this.svg.append(this.curve);
  }

  buildLegend(center, y) {
    for (const [offset, value, label] of [[-94, -1, "−"], [0, 0, "0"], [94, 1, "+"]]) {
      const x = center + offset;
      this.svg.append(svgElement("line", {x1:x - 17, y1:y, x2:x + 17, y2:y,
        stroke:weightColor(value), "stroke-width":4}), svgElement("text", {x, y:y + 20, class:"legend"}, label));
    }
  }

  pointerPosition(event) {
    // Transform screen coordinates back through reveal.js's slide scaling.
    const point = this.svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(this.svg.getScreenCTM().inverse());
    const box = this.box;
    return {x:(local.x - box.left - 12) / (box.width - 24), y:(local.y - box.top - 12) / (box.height - 24)};
  }

  move(x, y) {
    this.position = {x:Math.max(0, Math.min(1, x)), y:Math.max(0, Math.min(1, y))};
    const box = this.box;
    this.point?.setAttribute("transform", `translate(${box.left + 12 + this.position.x * (box.width - 24)} ${box.top + 12 + this.position.y * (box.height - 24)})`);
    this.renderParameters(parametersAt(this.position));
  }

  renderParameters(parameters) {
    this.parameters = parameters;
    this.cells?.forEach((cell, index) => {
      cell.setAttribute("fill", weightColor(this.parameters[index]));
      cell.querySelector("title").textContent = `${index < WEIGHT_COUNT ? `Connection weight ${index + 1}` : `Bias ${index - WEIGHT_COUNT + 1}`}: ${this.parameters[index].toFixed(2)}`;
    });
    this.edges.forEach((edge, index) => edge.setAttribute("stroke", weightColor(this.parameters[index])));
    if (this.plot) {
      const {x, y, width, height} = this.plot;
      // Fixed axes: x in [-3, 3], f_w(x) in [-5, 5]. With weights and
      // biases in [-1, 1] and four bounded hidden activations, |f_w| <= 5.
      const points = Array.from({length:241}, (_, index) => {
        const input = -3 + 6 * index / 240;
        return `${index ? "L" : "M"}${x + width * index / 240},${y + height * (5 - evaluateNetwork(this.parameters, input)) / 10}`;
      });
      this.curve.setAttribute("d", points.join(" "));
    }
  }
}

customElements.define("slt-parameter-space", SltParameterSpace);

// <slt-network-function></slt-network-function>
// Randomise a weighted network and plot its actual scalar-valued function.
class SltNetworkFunction extends SltParameterSpace {
  get defaultView() { return "function"; }
}
customElements.define("slt-network-function", SltNetworkFunction);
