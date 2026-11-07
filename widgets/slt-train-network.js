// <slt-train-network></slt-train-network>
// Drag w to explore empirical squared-error loss on a fixed
// affine plane through the 33-parameter 1–4–4–1 tanh network. Re-initialise
// changes the starting point and clears history; the plane and data stay fixed.
import {setupWidgetKeys} from "./widget-controls.js";
import {LAYER_SIZES, PARAMETER_COUNT, parametersAt, evaluateNetwork, weightColor} from "./network-model.js";

const WIDTH = 1200;
const HEIGHT = 490;
const MAP = {x:18, y:32, width:820, height:400};
const HISTORY = {x:907, y:36, width:263, height:100};
const FUNCTION = {x:907, y:327, width:263, height:140};
const GRID_WIDTH = 205;
const GRID_HEIGHT = 100;
const PALETTE = [[12, 12, 12], [55, 55, 55], [124, 87, 50], [255, 153, 51]];

function heatColor(fraction) {
  const scaled = Math.max(0, Math.min(1, fraction)) * (PALETTE.length - 1);
  const index = Math.min(PALETTE.length - 2, Math.floor(scaled));
  return PALETTE[index].map((value, channel) => Math.round(value +
    (scaled - index) * (PALETTE[index + 1][channel] - value)));
}

export class SltTrainNetwork extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    const root = this.attachShadow({mode:"open"});
    root.innerHTML = `
      <style>
        :host { display:block; width:100%; max-width:1200px; margin:auto;
          color:var(--slt-foreground, #fff); font-family:var(--slt-body-font, serif); }
        canvas { display:block; width:100%; height:auto; touch-action:none; }
        canvas:focus-visible { outline:1px solid #ff4dff; outline-offset:3px; }
        .controls { display:flex; align-items:center; justify-content:space-between;
          gap:20px; margin-top:6px; font-size:18px; color:var(--slt-muted, #999); }
        button { padding:5px 16px; border:1px solid #888; border-radius:4px;
          background:#111; color:var(--slt-foreground, #fff); font:inherit; cursor:pointer; }
        button:hover, button:focus-visible { border-color:#ff4dff; }
        output { min-width:100px; font-variant-numeric:tabular-nums; }
      </style>
      <canvas width="2400" height="980" tabindex="0" role="group"
        aria-label="Interactive neural network training. Drag the point w on the loss heatmap. The right panels show loss history, network weights, and the fitted function with training data."></canvas>
      <div class="controls">
        <span>Drag <i>w</i> to fit the data</span>
        <output aria-live="polite"></output>
        <button type="button">Re-initialise</button>
      </div>`;
    this.canvas = root.querySelector("canvas");
    this.context = this.canvas.getContext("2d");
    this.context.scale(2, 2);
    this.output = root.querySelector("output");
    this.bodyFont = getComputedStyle(this).getPropertyValue("--slt-body-font") || "serif";
    this.foreground = getComputedStyle(this).getPropertyValue("--slt-foreground").trim() || "#fff";

    const teacher = parametersAt({x:0.7, y:0.2});
    this.direction1 = Array.from({length:PARAMETER_COUNT}, (_, index) => 0.65 * Math.sin((index + 1) * 1.73));
    this.direction2 = Array.from({length:PARAMETER_COUNT}, (_, index) => 0.65 * Math.cos((index + 1) * 2.41));
    this.origin = teacher.map((value, index) => value - 0.35 * this.direction1[index] + 0.3 * this.direction2[index]);
    this.data = Array.from({length:13}, (_, index) => {
      const x = -3 + index / 2;
      return {x, y:evaluateNetwork(teacher, x) + 0.06 * Math.sin(index * 2.7)};
    });
    this.evaluateGrid();
    this.reset({x:-0.72, y:0.7});
    document.fonts.ready.then(() => {
      if (this.isConnected) this.draw();
    });
    root.querySelector("button").addEventListener("click", () => this.reset());
    this.canvas.addEventListener("pointerdown", event => {
      if (event.button !== 0 || this.pointerId !== undefined) return;
      const point = this.localPoint(event);
      const dot = this.mapPoint(this.position);
      if (Math.hypot(point.x - dot.x, point.y - dot.y) > 24) return;
      event.preventDefault();
      event.stopPropagation();
      this.canvas.focus({preventScroll:true});
      this.pointerId = event.pointerId;
      this.dragOffset = {x:point.x - dot.x, y:point.y - dot.y};
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.style.cursor = "grabbing";
    });
    this.canvas.addEventListener("pointermove", event => {
      const point = this.localPoint(event);
      if (this.pointerId === undefined) {
        const dot = this.mapPoint(this.position);
        this.canvas.style.cursor = Math.hypot(point.x - dot.x, point.y - dot.y) < 24 ? "grab" : "default";
        return;
      }
      if (event.pointerId !== this.pointerId) return;
      event.stopPropagation();
      this.move({x:2 * (point.x - this.dragOffset.x - MAP.x) / MAP.width - 1,
        y:1 - 2 * (point.y - this.dragOffset.y - MAP.y) / MAP.height});
    });
    const finish = event => {
      if (event.pointerId !== this.pointerId) return;
      this.pointerId = undefined;
      this.canvas.style.cursor = "grab";
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      this.announce();
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) this.canvas.addEventListener(type, finish);
    setupWidgetKeys(root);
  }

  parametersAt(position) {
    return this.origin.map((value, index) => value +
      position.x * this.direction1[index] + position.y * this.direction2[index]);
  }

  lossAt(position) {
    const parameters = this.parametersAt(position);
    return this.data.reduce((sum, point) => sum + (evaluateNetwork(parameters, point.x) - point.y) ** 2, 0) / this.data.length;
  }

  evaluateGrid() {
    this.gridValues = new Float64Array(GRID_WIDTH * GRID_HEIGHT);
    this.maxLoss = 0;
    let maxPrediction = 0;
    for (let row = 0; row < GRID_HEIGHT; row++) {
      for (let column = 0; column < GRID_WIDTH; column++) {
        const position = {x:2 * column / (GRID_WIDTH - 1) - 1, y:1 - 2 * row / (GRID_HEIGHT - 1)};
        const parameters = this.parametersAt(position);
        let loss = 0;
        for (const point of this.data) {
          const prediction = evaluateNetwork(parameters, point.x);
          loss += (prediction - point.y) ** 2;
          maxPrediction = Math.max(maxPrediction, Math.abs(prediction));
        }
        loss /= this.data.length;
        this.gridValues[row * GRID_WIDTH + column] = loss;
        this.maxLoss = Math.max(this.maxLoss, loss);
      }
    }
    this.functionRange = Math.max(3, Math.ceil(maxPrediction * 1.2));
    const raster = document.createElement("canvas");
    raster.width = GRID_WIDTH;
    raster.height = GRID_HEIGHT;
    const context = raster.getContext("2d");
    const image = context.createImageData(GRID_WIDTH, GRID_HEIGHT);
    this.gridFractions = this.gridValues.map(value => this.lossFraction(value));
    for (let index = 0; index < this.gridValues.length; index++) {
      image.data.set([...heatColor(this.gridFractions[index]), 255], index * 4);
    }
    context.putImageData(image, 0, 0);
    this.heatmap = document.createElement("canvas");
    this.heatmap.width = MAP.width * 2;
    this.heatmap.height = MAP.height * 2;
    const heatContext = this.heatmap.getContext("2d");
    heatContext.scale(2, 2);
    heatContext.drawImage(raster, 0, 0, MAP.width, MAP.height);
    // Interpolate contour crossings between grid samples, keeping the contour
    // strokes sharp while the underlying heatmap is smoothly enlarged.
    heatContext.strokeStyle = "rgba(0,0,0,0.24)";
    heatContext.lineWidth = 0.9;
    for (let level = 1; level < 12; level++) {
      const threshold = level / 12;
      heatContext.beginPath();
      for (let row = 0; row < GRID_HEIGHT - 1; row++) {
        for (let column = 0; column < GRID_WIDTH - 1; column++) {
          const index = row * GRID_WIDTH + column;
          const corners = [
            {x:column, y:row, value:this.gridFractions[index]},
            {x:column + 1, y:row, value:this.gridFractions[index + 1]},
            {x:column + 1, y:row + 1, value:this.gridFractions[index + GRID_WIDTH + 1]},
            {x:column, y:row + 1, value:this.gridFractions[index + GRID_WIDTH]},
          ];
          const crossings = [];
          for (let edge = 0; edge < 4; edge++) {
            const a = corners[edge], b = corners[(edge + 1) % 4];
            if ((a.value < threshold) === (b.value < threshold)) continue;
            const fraction = (threshold - a.value) / (b.value - a.value);
            crossings.push({x:(a.x + fraction * (b.x - a.x)) * MAP.width / (GRID_WIDTH - 1),
              y:(a.y + fraction * (b.y - a.y)) * MAP.height / (GRID_HEIGHT - 1)});
          }
          for (let crossing = 0; crossing + 1 < crossings.length; crossing += 2) {
            heatContext.moveTo(crossings[crossing].x, crossings[crossing].y);
            heatContext.lineTo(crossings[crossing + 1].x, crossings[crossing + 1].y);
          }
        }
      }
      heatContext.stroke();
    }
  }

  lossFraction(loss) {
    return Math.log1p(loss / 0.025) / Math.log1p(this.maxLoss / 0.025);
  }

  reset(position) {
    if (!position) {
      for (let attempt = 0; attempt < 30; attempt++) {
        position = {x:2 * Math.random() - 1, y:2 * Math.random() - 1};
        const loss = this.lossAt(position);
        if (loss > this.maxLoss * 0.12 && loss < this.maxLoss * 0.8) break;
      }
    }
    this.history = [];
    this.steps = 0;
    this.move(position);
    this.announce();
  }

  move(position) {
    const next = {x:Math.max(-1, Math.min(1, position.x)), y:Math.max(-1, Math.min(1, position.y))};
    if (this.history.length && Math.hypot(next.x - this.position.x, next.y - this.position.y) < 1e-8) return;
    this.position = next;
    this.parameters = this.parametersAt(next);
    this.loss = this.lossAt(next);
    this.history.push({...next, loss:this.loss, step:this.steps++});
    // Keep the most recent movement visible during a long presentation.
    if (this.history.length > 600) this.history.shift();
    this.draw();
  }

  announce() {
    this.output.textContent = `MSE ${this.loss.toFixed(3)}`;
  }

  localPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {x:(event.clientX - rect.left) * WIDTH / rect.width,
      y:(event.clientY - rect.top) * HEIGHT / rect.height};
  }

  mapPoint(position) {
    return {x:MAP.x + (position.x + 1) * MAP.width / 2,
      y:MAP.y + (1 - position.y) * MAP.height / 2};
  }

  text(text, x, y, {size=18, color=this.foreground, align="left", italic=false} = {}) {
    const context = this.context;
    context.font = `${italic ? "italic " : ""}${size}px ${this.bodyFont}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(text, x, y);
  }

  line(points, {color="#666", width=1} = {}) {
    const context = this.context;
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  }

  dot(x, y, radius, fill, stroke="#000") {
    const context = this.context;
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 1.5;
    context.stroke();
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(this.heatmap, MAP.x, MAP.y, MAP.width, MAP.height);
    this.text("Parameter space · a 2D slice through 33 parameters", MAP.x, 18, {size:20});
    this.text(`Lₙ(w) = ${this.loss.toFixed(3)}`, MAP.x + MAP.width, 18, {align:"right", size:20});
    this.line(this.history.map(point => this.mapPoint(point)), {color:"rgba(255,255,255,0.65)", width:1.6});
    const start = this.mapPoint(this.history[0]);
    this.dot(start.x, start.y, 3, "#aaa");
    const point = this.mapPoint(this.position);
    this.dot(point.x, point.y, 7, this.foreground);
    this.text("w", Math.min(MAP.x + MAP.width - 17, point.x + 12), Math.max(MAP.y + 20, point.y - 12), {size:24, italic:true});
    const gradient = context.createLinearGradient(550, 0, 735, 0);
    PALETTE.forEach((color, index) => gradient.addColorStop(index / (PALETTE.length - 1), `rgb(${color.join(",")})`));
    context.fillStyle = gradient;
    context.fillRect(550, 450, 185, 10);
    this.text("0", 540, 460, {size:15, align:"right", color:"#aaa"});
    this.text(this.maxLoss.toFixed(1), 743, 460, {size:15, color:"#aaa"});
    this.text("MSE · log colour scale", 642, 480, {size:15, align:"center", color:"#aaa"});
    this.drawHistory();
    this.drawNetwork();
    this.drawFunction();
  }

  drawHistory() {
    const {x, y, width, height} = HISTORY;
    this.text("Loss along the path", x, 18, {size:20});
    this.line([{x, y}, {x, y:y + height}, {x:x + width, y:y + height}]);
    this.text("0", x - 7, y + height + 4, {size:14, align:"right", color:"#999"});
    this.text(this.maxLoss.toFixed(1), x - 7, y + 5, {size:14, align:"right", color:"#999"});
    const firstStep = this.history[0].step;
    const span = Math.max(30, this.history.at(-1).step - firstStep);
    this.line(this.history.map(point => ({x:x + width * (point.step - firstStep) / span,
      y:y + height * (1 - Math.min(1, point.loss / this.maxLoss))})), {color:"#ff4dff", width:2});
    const last = this.history.at(-1);
    this.dot(x + width * (last.step - firstStep) / span, y + height * (1 - Math.min(1, last.loss / this.maxLoss)), 3, "#ff4dff");
    this.text(String(firstStep), x, y + height + 17, {size:14, color:"#999"});
    this.text(String(firstStep + span), x + width, y + height + 17, {size:14, align:"right", color:"#999"});
    this.text("drag step", x + width / 2, y + height + 17, {size:14, align:"center", color:"#999"});
  }

  drawNetwork() {
    const layers = LAYER_SIZES.map((size, layer) => Array.from({length:size}, (_, index) => ({
      x:907 + layer * 87, y:232 + (index - (size - 1) / 2) * 28,
    })));
    this.text("Weighted network", 1038, 178, {size:20, align:"center"});
    let index = 0;
    for (let layer = 1; layer < layers.length; layer++) {
      for (const target of layers[layer]) {
        for (const source of layers[layer - 1]) this.line([source, target], {color:weightColor(this.parameters[index++]), width:1.7});
      }
    }
    for (const node of layers.flat()) this.dot(node.x, node.y, 4.5, "#000", "#bbb");
  }

  drawFunction() {
    const {x, y, width, height} = FUNCTION;
    const range = this.functionRange;
    const toPoint = (input, output) => ({x:x + (input + 3) * width / 6, y:y + (range - output) * height / (2 * range)});
    this.text("Function and training data", 1038, 310, {size:20, align:"center"});
    this.line([toPoint(-3, 0), toPoint(3, 0)]);
    this.line([toPoint(0, -range), toPoint(0, range)]);
    for (const input of [-3, 3]) this.text(String(input), toPoint(input, 0).x, toPoint(input, 0).y + 17, {size:14, color:"#999", align:"center"});
    for (const value of [-range, range]) this.text(String(value), toPoint(0, value).x - 7,
      toPoint(0, value).y + (value > 0 ? 11 : 0), {size:14, color:"#999", align:"right"});
    this.text("x", x + width + 9, y + height / 2 + 4, {size:16, color:"#999", italic:true});
    const curve = Array.from({length:161}, (_, index) => {
      const input = -3 + 6 * index / 160;
      return toPoint(input, evaluateNetwork(this.parameters, input));
    });
    this.line(curve, {color:this.foreground, width:2});
    for (const point of this.data) {
      const screen = toPoint(point.x, point.y);
      this.dot(screen.x, screen.y, 3.8, "#ff9933");
    }
  }
}

customElements.define("slt-train-network", SltTrainNetwork);
