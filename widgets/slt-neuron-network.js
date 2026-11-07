// <slt-neuron-network></slt-neuron-network>
// A fully connected 1–4–4–1 network. Hover or focus a connection to inspect
// its weight; hover or focus a neuron to inspect its incoming weights, bias,
// and activation equation. Clicking pins the selection for touch/presentation
// use; click again or click the background to clear it. Values are illustrative.
import katex from "../vendor/katex/katex.mjs";

import {LAYER_SIZES} from "./network-model.js";
const LAYER_X = [130, 440, 750, 1060];
const LAYER_NAMES = ["Input", "Hidden layer 1", "Hidden layer 2", "Output"];
const WEIGHTS = [
  [[0.8], [-0.6], [0.5], [0.4]],
  [[-0.7, 1.3, 0.4, 0.2], [1.1, 0.6, -0.8, -0.4],
   [0.2, -0.5, 0.9, 0.7], [-0.3, 0.8, -0.6, 1.0]],
  [[0.6, -0.9, 1.1, 0.4]],
];
const BIASES = [[0.2, -0.3, 0.1, -0.2], [-0.1, 0.4, -0.2, 0.3], [0.3]];
const SVG_NS = "http://www.w3.org/2000/svg";
let instanceCount = 0;

function activationLabel(layer, index) {
  return layer === 0 ? "x"
    : layer === 3 ? "y" : `h${index + 1} (layer ${layer})`;
}

function activationTex(layer, index) {
  return layer === 0 ? "x"
    : layer === 3 ? "y" : `h_{${index + 1}}^{(${layer})}`;
}

function svgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

// KaTeX uses HTML inside SVG foreignObject so diagram and equation labels
// share the same TeX layout, including the placement of scripts on h.
function mathLabel(tex, x, y, className, width = 180) {
  const element = svgElement("foreignObject", {
    x: x - width / 2, y: y - 22, width, height: 44,
    class: `math-label ${className}`,
  });
  const container = document.createElement("div");
  container.className = "label-content";
  const formula = document.createElement("span");
  katex.render(tex, formula);
  container.append(formula);
  element.append(container);
  return element;
}

export class SltNeuronNetwork extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("../vendor/katex/katex.min.css", import.meta.url)}">
      <style>
        .katex { font-size:1em; }
        :host { display:block; width:100%; max-width:1200px; margin:auto;
          font-family:var(--slt-body-font, serif); color:var(--slt-foreground, #fff);
          --highlight:var(--slt-progress-accent, #ff4dff); }
        svg { display:block; width:100%; height:auto; overflow:visible; }
        .heading { fill:var(--slt-muted, #999); font-size:24px; text-anchor:middle; }
        .edge-line { stroke:#555; stroke-width:1.6; }
        .edge-hit { stroke:transparent; stroke-width:14; cursor:pointer; }
        .edge.active .edge-line { stroke:var(--highlight); stroke-width:3; }
        .edge:focus, .neuron:focus { outline:none; }
        .edge:focus-visible .edge-line { stroke:var(--highlight); stroke-width:4; }
        .node { fill:var(--slt-background, #000); stroke:#aaa; stroke-width:2; }
        .neuron { cursor:pointer; }
        .neuron.active .node, .neuron.source .node,
        .neuron:focus-visible .node { stroke:var(--highlight); stroke-width:3; }
        .math-label { pointer-events:none; overflow:visible; }
        .label-content { display:flex; align-items:center; justify-content:center;
          height:44px; font-size:21px; }
        .parameter .label-content { color:var(--highlight); font-size:19px; }
        .parameter .label-content > span { background:var(--slt-background, #000);
          padding:0 3px; }
        .bias-label .label-content { justify-content:flex-start; }
        .bias-link { stroke:#555; stroke-width:1.6; }
        .neuron.active .bias-link { stroke:var(--highlight); stroke-width:2.5; }
        .parameter[hidden] { display:none; }
        .detail { border-top:1px solid #333; padding-top:15px; min-height:48px;
          font-size:27px; line-height:1.3; text-align:center; }
        .detail.idle { color:var(--slt-muted, #999); font-size:20px; }
      </style>
      <svg viewBox="0 0 1200 500" role="group" aria-label="Interactive neural network with two hidden layers of four neurons. Focus or hover over neurons and connections to inspect parameters."></svg>
      <div class="detail idle" aria-live="polite" aria-atomic="true"></div>`;
    this.svg = root.querySelector("svg");
    this.detail = root.querySelector(".detail");
    const markerPrefix = `neuron-network-${++instanceCount}`;
    this.arrow = `url(#${markerPrefix}-arrow)`;
    this.activeArrow = `url(#${markerPrefix}-active-arrow)`;
    const definitions = svgElement("defs", {});
    for (const [name, fill] of [["arrow", "#555"], ["active-arrow", "var(--highlight)"]]) {
      const marker = svgElement("marker", {
        id: `${markerPrefix}-${name}`, viewBox: "0 0 8 8", refX: 8, refY: 4,
        markerWidth: 9, markerHeight: 9, orient: "auto", markerUnits: "userSpaceOnUse",
      });
      marker.append(svgElement("path", {d: "M0 0 L8 4 L0 8 Z", fill}));
      definitions.append(marker);
    }
    this.svg.append(definitions);
    this.nodes = [];
    this.edges = [];
    this.pinned = null;
    this.buildNetwork();
    this.svg.addEventListener("click", (event) => {
      if (event.target === this.svg) {
        this.pinned = null;
        this.render(null);
      }
    });
    this.render(null);
  }

  buildNetwork() {
    LAYER_SIZES.forEach((size, layer) => {
      this.svg.append(svgElement("text", {x:LAYER_X[layer], y:27, class:"heading"}, LAYER_NAMES[layer]));
      for (let index = 0; index < size; index++) {
        this.nodes.push({layer, index, x:LAYER_X[layer], y:282.5 + (index - (size - 1) / 2) * 115});
      }
    });
    const edgeGroup = svgElement("g", {});
    this.svg.append(edgeGroup);
    for (const target of this.nodes.filter(node => node.layer > 0)) {
      for (const source of this.nodes.filter(node => node.layer === target.layer - 1)) {
        const value = WEIGHTS[target.layer - 1][target.index][source.index];
        const label = `w_{${target.index + 1},${source.index + 1}}^{(${target.layer})}`;
        const group = svgElement("g", {class:"edge", tabindex:0, role:"button",
          "aria-label":`${label} = ${value}, from ${activationLabel(source.layer, source.index)} to ${activationLabel(target.layer, target.index)}`});
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.hypot(dx, dy);
        const coordinates = {
          x1: source.x + 32 * dx / length, y1: source.y + 32 * dy / length,
          x2: target.x - 32 * dx / length, y2: target.y - 32 * dy / length,
        };
        const line = svgElement("line", {...coordinates, class:"edge-line", "marker-end":this.arrow});
        group.append(line, svgElement("line", {...coordinates, class:"edge-hit"}));
        const annotation = mathLabel(`${label}=${value.toFixed(1)}`,
          source.x + 0.67 * dx, source.y + 0.67 * dy - 16, "parameter");
        annotation.toggleAttribute("hidden", true);
        const edge = {source, target, value, label, group, line, annotation};
        this.edges.push(edge);
        edgeGroup.append(group);
        this.bindInteraction(group, {kind:"edge", edge});
      }
    }
    // Put labels above all edges so crossing connections cannot obscure them.
    for (const edge of this.edges) this.svg.append(edge.annotation);
    for (const node of this.nodes) {
      const group = svgElement("g", {class:"neuron", tabindex:0, role:"button",
        "aria-label":node.layer === 0 ? `Input ${activationLabel(node.layer, node.index)}`
          : `Neuron ${activationLabel(node.layer, node.index)}, inspect incoming weights and bias`});
      if (node.layer > 0) {
        node.biasLine = svgElement("line", {
          x1:node.x, y1:node.y-64, x2:node.x, y2:node.y-32,
          class:"bias-link", "marker-end":this.arrow,
        });
        group.append(node.biasLine);
        node.biasLabel = mathLabel(
          `b_{${node.index + 1}}^{(${node.layer})}=${BIASES[node.layer-1][node.index].toFixed(1)}`,
          node.x + 93, node.y - 57, "parameter bias-label", 160);
        node.biasLabel.toggleAttribute("hidden", true);
        group.append(node.biasLabel);
      }
      group.append(svgElement("circle", {cx:node.x, cy:node.y, r:30, class:"node"}),
        mathLabel(activationTex(node.layer, node.index), node.x, node.y, "node-label", 90));
      node.group = group;
      this.svg.append(group);
      this.bindInteraction(group, {kind:"node", node});
    }
  }

  bindInteraction(element, selection) {
    element.addEventListener("pointerenter", () => this.render(selection));
    element.addEventListener("pointerleave", () => this.render(this.pinned));
    element.addEventListener("focus", () => this.render(selection));
    element.addEventListener("blur", () => this.render(this.pinned));
    const pin = () => {
      this.pinned = this.pinned === selection ? null : selection;
      this.render(this.pinned);
    };
    element.addEventListener("click", pin);
    element.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        pin();
      }
    });
  }

  render(selection) {
    const neuron = selection?.kind === "node" ? selection.node : null;
    const selectedEdge = selection?.kind === "edge" ? selection.edge : null;
    for (const edge of this.edges) {
      const active = edge === selectedEdge || edge.target === neuron;
      edge.group.classList.toggle("active", active);
      edge.line.setAttribute("marker-end", active ? this.activeArrow : this.arrow);
      edge.annotation.toggleAttribute("hidden", !active);
      edge.group.setAttribute("aria-pressed", String(this.pinned?.edge === edge));
    }
    for (const node of this.nodes) {
      node.group.classList.toggle("active", node === neuron || node === selectedEdge?.target);
      node.group.classList.toggle("source", node === selectedEdge?.source ||
        (neuron?.layer > 0 && node.layer === neuron.layer - 1));
      node.biasLabel?.toggleAttribute("hidden", node !== neuron);
      node.biasLine?.setAttribute("marker-end", node === neuron ? this.activeArrow : this.arrow);
      node.group.setAttribute("aria-pressed", String(this.pinned?.node === node));
    }
    this.detail.classList.toggle("idle", !selection || neuron?.layer === 0);
    if (neuron?.layer > 0) {
      const {layer, index} = neuron;
      const terms = WEIGHTS[layer-1][index].map((value, source) =>
        `${source > 0 && value >= 0 ? "+" : ""}${value.toFixed(1)}\\,${activationTex(layer-1, source)}`).join(" ");
      const bias = BIASES[layer-1][index];
      const sum = `${terms}${bias >= 0 ? "+" : ""}${bias.toFixed(1)}`;
      const expression = layer === 3 ? sum : `\\tanh\\!\\left(${sum}\\right)`;
      katex.render(`${activationTex(layer,index)}=${expression}`, this.detail);
    } else if (selectedEdge) {
      katex.render(`w_{${selectedEdge.target.index+1},${selectedEdge.source.index+1}}^{(${selectedEdge.target.layer})}=${selectedEdge.value.toFixed(1)}`, this.detail);
    } else {
      this.detail.textContent = "Hover to explore · click to pin";
    }
  }
}

customElements.define("slt-neuron-network", SltNeuronNetwork);
