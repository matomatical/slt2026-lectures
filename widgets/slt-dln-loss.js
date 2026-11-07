// <slt-dln-loss></slt-dln-loss>: crossing and hyperbolic valleys of minima.
// <slt-linear-loss></slt-linear-loss>: a two-weight linear neuron's quadratic bowl.
// <slt-loss-examples></slt-loss-examples>: a rotating 2×2 grid of degenerate losses.
// True-height surfaces on [-1.8,1.8]^2; heights above 3 are omitted, not compressed.
// Drag to rotate (both deep-network plots share a camera). A fixed coarse mesh
// keeps interaction light. Only the four-example grid auto-rotates, and only
// while visible, respecting reduced-motion preferences.
import katex from "../vendor/katex/katex.mjs";

const WIDTH = 560;
const HEIGHT = 350;
const RANGE = 1.8;
const MAX_LOSS = 3;
const GRID = 26;

export function linearNetworkLoss(a, b, target) {
  return (a * b - target) ** 2;
}

export function shallowLinearLoss(w1, w2) {
  return w1 * w1 + w2 * w2;
}

const DEEP_EXAMPLES = [0, 1].map(target => ({
  formula:target === 0 ? "L(a,b)=(ab)^2" : "L(a,b)=(ab-1)^2",
  description:target === 0 ? "Loss (ab) squared: crossing lines of minima with a marked origin. Drag to rotate."
    : "Loss (ab minus one) squared: hyperbolic valleys with a marked nonzero minimum. Drag to rotate.",
  loss:(a,b) => linearNetworkLoss(a,b,target),
  gradient:(a,b) => [2*b*(a*b-target), 2*a*(a*b-target)],
  axes:["a", "b"], minimum:{a:target,b:target},
  minimumLabel:target === 0 ? "(0, 0)" : "w*",
  tangent:target === 1 ? {a:1,b:-1} : null,
  caption:target === 1 ? "Along the valley: a flat direction tangent to the minima." : "",
  curves:target === 0
    ? [false, true].map(swap => Array.from({length:161}, (_,index) => {
      const t = -RANGE + 2 * RANGE * index / 160;
      return {a:swap ? 0:t, b:swap ? t:0, z:0.015};
    }))
    : [-1, 1].map(sign => Array.from({length:161}, (_,index) => {
      const a = sign * (1/RANGE + (RANGE - 1/RANGE) * index / 160);
      return {a, b:1/a, z:0.015};
    })),
}));

const SHALLOW_EXAMPLE = {
  formula:"L(w)=w_1^2+w_2^2",
  description:"A two-weight linear neuron's loss: an isolated quadratic bowl with a marked minimum. Drag to rotate.",
  loss:shallowLinearLoss, gradient:(a,b) => [2*a,2*b], axes:["w₁","w₂"],
  minimum:{a:0,b:0}, minimumLabel:"w*", tangent:null, caption:"", curves:[],
};

const EXTRA_EXAMPLES = [
  {title:"Quadratic valley", formula:"L(a,b)=a^2", powerA:2, powerB:0},
  {title:"Quartic–quadratic", formula:"L(a,b)=a^4+b^2", powerA:4, powerB:2},
  {title:"Quartic valley", formula:"L(a,b)=a^4", powerA:4, powerB:0},
  {title:"Quartic bowl", formula:"L(a,b)=a^4+b^4", powerA:4, powerB:4},
].map(({title,formula,powerA,powerB}) => ({
  title, formula, description:`${title}: ${formula}. Drag to rotate.`,
  loss:(a,b) => a**powerA + (powerB ? b**powerB : 0),
  gradient:(a,b) => [powerA*a**(powerA-1), powerB ? powerB*b**(powerB-1) : 0],
  axes:["a","b"], minimum:{a:0,b:0}, minimumLabel:"", tangent:null, caption:"",
  curves:powerB ? [] : [Array.from({length:161},(_,index) =>
    ({a:0,b:-RANGE+2*RANGE*index/160,z:0.015}))],
}));

// Intersect a mesh cell with the top of the displayed loss range.
function clipHeight(vertices) {
  const result = [];
  for (let index = 0; index < vertices.length; index++) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    if (start.z <= MAX_LOSS) result.push(start);
    if ((start.z <= MAX_LOSS) !== (end.z <= MAX_LOSS)) {
      const fraction = (MAX_LOSS - start.z) / (end.z - start.z);
      result.push({a:start.a + fraction * (end.a - start.a),
        b:start.b + fraction * (end.b - start.b), z:MAX_LOSS});
    }
  }
  return result;
}

export class SltDlnLoss extends HTMLElement {
  get examples() {
    return DEEP_EXAMPLES;
  }

  get autoRotate() {
    return false;
  }

  connectedCallback() {
    if (this.shadowRoot) {
      if (this.autoRotate) this.startRotation();
      this.requestDraw();
      return;
    }
    this.plotExamples = this.examples;
    const single = this.plotExamples.length === 1;
    const grid = this.plotExamples.length > 2;
    const root = this.attachShadow({mode:"open"});
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("../vendor/katex/katex.min.css", import.meta.url)}">
      <style>
        :host { display:block; width:100%; max-width:${single ? 560 : 1160}px; margin:auto;
          color:var(--slt-foreground, #fff); font-family:var(--slt-body-font, serif); }
        .katex { font-size:1em; }
        .plots { display:grid; grid-template-columns:repeat(${Math.min(2,this.plotExamples.length)}, minmax(0,1fr)); gap:${grid ? "10px 20px" : "20px"}; }
        .formula { text-align:center; font-size:${grid ? 24 : 26}px; height:${grid ? 30 : 36}px; }
        .plot-title { text-align:center; font-size:20px; color:var(--slt-muted, #999); height:25px; }
        .plot { position:relative; width:${grid ? "360px" : "100%"}; max-width:100%; margin:auto; aspect-ratio:560 / 350; }
        canvas { position:absolute; inset:0; display:block; width:100%; height:100%;
          cursor:grab; touch-action:none; }
        .surface { pointer-events:none; }
        canvas.dragging { cursor:grabbing; }
        canvas:focus-visible { outline:1px solid #ff4dff; }
        .caption { text-align:center; color:var(--slt-muted, #999); font-size:19px; line-height:1.25; }
        .controls { display:flex; align-items:center; justify-content:center;
          gap:14px; margin-top:4px; color:var(--slt-muted, #999); font-size:18px; }
      </style>
      <div class="plots">
        ${this.plotExamples.map(example => `
          <div>
            ${example.title ? `<div class="plot-title">${example.title}</div>` : ""}
            <div class="formula"></div>
            <div class="plot"><canvas class="surface" aria-hidden="true"></canvas>
              <canvas class="interaction" tabindex="0" role="img" aria-label="${example.description}"></canvas>
            </div>
            ${example.caption ? `<div class="caption">${example.caption}</div>` : ""}
          </div>`).join("")}
      </div>
      <div class="controls">${this.autoRotate ? "Hover to pause · drag to rotate" : "Drag to rotate"}</div>`;
    root.querySelectorAll(".formula").forEach((element,index) => {
      katex.render(this.plotExamples[index].formula,element);
    });
    this.canvases = [...root.querySelectorAll("canvas.interaction")];
    this.yaw = Math.PI / 4;
    this.pitch = 0.6;
    this.meshes = this.plotExamples.map(example => this.buildMesh(example));
    this.backgrounds = [...root.querySelectorAll("canvas.surface")];
    for (const canvas of this.backgrounds) {
      canvas.width = WIDTH * 2;
      canvas.height = HEIGHT * 2;
    }
    for (const canvas of this.canvases) {
      canvas.width = WIDTH * 2;
      canvas.height = HEIGHT * 2;
      canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0 || this.drag) return;
        event.preventDefault();
        event.stopPropagation();
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("dragging");
        this.drag = {id:event.pointerId, x:event.clientX, y:event.clientY,
          yaw:this.yaw, pitch:this.pitch, scale:WIDTH / canvas.getBoundingClientRect().width};
      });
      canvas.addEventListener("pointermove", event => {
        if (event.pointerId !== this.drag?.id) return;
        const {scale} = this.drag;
        this.yaw = this.drag.yaw - (event.clientX - this.drag.x) * scale * 0.009;
        this.pitch = Math.max(0.25, Math.min(1.15,
          this.drag.pitch + (event.clientY - this.drag.y) * scale * 0.006));
        this.requestDraw();
      });
      const finish = event => {
        if (event.pointerId !== this.drag?.id) return;
        this.drag = null;
        this.syncSpin?.();
        this.requestDraw();
        canvas.classList.remove("dragging");
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      };
      for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, finish);
      for (const type of ["touchstart", "touchmove", "touchend"]) {
        canvas.addEventListener(type, event => event.stopPropagation());
      }
    }
    this.draw();
    if (this.autoRotate) this.startRotation();
    // Canvas text uses the theme font, which may still be loading on entry.
    document.fonts.ready.then(() => {
      this.backgroundKey = null;
      this.requestDraw();
    });
  }

  buildMesh(example) {
    const grid = GRID;
    const tiles = [];
    const step = 2 * RANGE / grid;
    for (let row = 0; row < grid; row++) {
      for (let column = 0; column < grid; column++) {
        const a = -RANGE + column * step;
        const b = -RANGE + row * step;
        const vertices = [[a,b], [a+step,b], [a+step,b+step], [a,b+step]].map(
          ([a,b]) => ({a,b,z:example.loss(a,b)}));
        const clipped = clipHeight(vertices);
        if (clipped.length < 3) continue;
        const centerA = a + step/2;
        const centerB = b + step/2;
        const [slopeA, slopeB] = example.gradient(centerA,centerB);
        const illumination = Math.max(0, (1 - 0.4*slopeA - 0.3*slopeB) / Math.hypot(slopeA,slopeB,1));
        const grey = Math.round(32 + 65 * illumination);
        tiles.push({vertices:clipped, a:centerA, b:centerB,
          z:vertices.reduce((sum, vertex) => sum + Math.min(vertex.z, MAX_LOSS), 0) / 4,
          fill:`rgb(${grey},${grey},${grey})`, depth:0});
      }
    }
    return tiles;
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.drawFrame);
    this.drawFrame = null;
    cancelAnimationFrame(this.spinFrame);
    this.spinFrame = null;
    this.spinVisibility?.disconnect();
    this.spinSlideObserver?.disconnect();
    this.spinMotion?.removeEventListener("change",this.syncSpin);
    if (this.syncSpin) document.removeEventListener("visibilitychange",this.syncSpin);
  }

  startRotation() {
    if (!this.syncSpin) {
      this.syncSpin = () => {
        const slide = this.closest("section");
        const reveal = this.closest(".reveal");
        const enabled = this.isConnected && this.inViewport && !document.hidden &&
          !this.spinMotion.matches && !this.hovered && !this.focused && !this.drag &&
          (!slide || slide.classList.contains("present")) &&
          !reveal?.classList.contains("overview") &&
          !/receiver|print-pdf/.test(location.search);
        if (enabled && this.spinFrame == null) {
          this.spinLastPaint = null;
          this.spinFrame = requestAnimationFrame(this.tickSpin);
        } else if (!enabled) {
          cancelAnimationFrame(this.spinFrame);
          this.spinFrame = null;
        }
      };
      this.tickSpin = now => {
        if (this.spinLastPaint === null) this.spinLastPaint = now;
        const elapsed = now - this.spinLastPaint;
        if (elapsed >= 1000/24) {
          this.yaw -= Math.min(elapsed,100) * 0.00015;
          this.spinLastPaint = now;
          this.draw();
        }
        this.spinFrame = requestAnimationFrame(this.tickSpin);
      };
      for (const [type,property,value] of [
        ["pointerenter","hovered",true], ["pointerleave","hovered",false],
        ["focusin","focused",true], ["focusout","focused",false],
      ]) {
        this.addEventListener(type,() => {this[property] = value;this.syncSpin();});
      }
    }
    this.spinMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.spinMotion.addEventListener("change",this.syncSpin);
    document.addEventListener("visibilitychange",this.syncSpin);
    this.spinVisibility = new IntersectionObserver(entries => {
      this.inViewport = entries[0].isIntersecting;
      this.syncSpin();
    });
    this.spinVisibility.observe(this);
    this.spinSlideObserver = new MutationObserver(this.syncSpin);
    for (const element of [this.closest("section"),this.closest(".reveal")]) {
      if (element) this.spinSlideObserver.observe(element,{attributes:true,attributeFilter:["class"]});
    }
    this.syncSpin();
  }

  requestDraw() {
    if (this.drawFrame != null || !this.isConnected) return;
    this.drawFrame = requestAnimationFrame(() => {
      this.drawFrame = null;
      this.draw();
    });
  }

  // Build the camera transform once per view, rather than per mesh vertex.
  updateProjection() {
    const sinYaw = Math.sin(this.yaw), cosYaw = Math.cos(this.yaw);
    const sinPitch = Math.sin(this.pitch), cosPitch = Math.cos(this.pitch);
    const bound = RANGE * (Math.abs(sinYaw) + Math.abs(cosYaw));
    const height = 38 * cosPitch * MAX_LOSS;
    const scale = Math.min(82, (WIDTH-70)/(2*bound),
      (HEIGHT-40-height)/(2*sinPitch*bound));
    this.projection = {
      xa:scale*cosYaw, xb:-scale*sinYaw,
      ya:scale*sinPitch*sinYaw, yb:scale*sinPitch*cosYaw, yz:-38*cosPitch,
      da:scale*cosPitch*sinYaw, db:scale*cosPitch*cosYaw, dz:38*sinPitch,
      yOrigin:(HEIGHT+height)/2,
    };
  }

  project(a, b, z = 0) {
    const p = this.projection;
    return {x:WIDTH/2 + p.xa*a + p.xb*b,
      y:p.yOrigin + p.ya*a + p.yb*b + p.yz*z,
      depth:p.da*a + p.db*b + p.dz*z};
  }

  path(context, points) {
    const p = this.projection;
    context.beginPath();
    for (let index = 0; index < points.length; index++) {
      const {a, b, z=0} = points[index];
      const x = WIDTH/2 + p.xa*a + p.xb*b;
      const y = p.yOrigin + p.ya*a + p.yb*b + p.yz*z;
      if (index === 0) context.moveTo(x,y);
      else context.lineTo(x,y);
    }
  }

  label(context, text, a, b, z=0, offsetX=0, offsetY=0) {
    const point = this.project(a,b,z);
    context.fillStyle = this.foreground;
    context.font = '20px "EB Garamond", serif';
    context.textAlign = "center";
    context.fillText(text,point.x+offsetX,point.y+offsetY);
  }

  // Surface and annotation canvases share a camera and draw without pixel copies.
  drawSurface(context, target, tiles) {
    context.setTransform(2,0,0,2,0,0);
    context.clearRect(0,0,WIDTH,HEIGHT);
    context.strokeStyle = "#555";
    context.lineWidth = 1;
    this.path(context, [{a:-RANGE,b:-RANGE},{a:RANGE,b:-RANGE},
      {a:RANGE,b:RANGE},{a:-RANGE,b:RANGE},{a:-RANGE,b:-RANGE}]);
    context.stroke();
    const p = this.projection;
    for (const tile of tiles) tile.depth = p.da*tile.a + p.db*tile.b + p.dz*tile.z;
    tiles.sort((left,right) => left.depth-right.depth);
    context.lineWidth = 0.5;
    context.strokeStyle = "rgba(170,170,170,0.3)";
    for (const tile of tiles) {
      this.path(context,tile.vertices);
      context.closePath();
      context.fillStyle = tile.fill;
      context.fill();
      context.stroke();
    }
    // The lift is only a drawing offset to keep mesh seams off the minima.
    context.strokeStyle = "#ff4dff";
    context.lineWidth = 3;
    for (const curve of this.plotExamples[target].curves) {
      this.path(context,curve);
      context.stroke();
    }
    this.label(context,this.plotExamples[target].axes[0],RANGE,0,0,18,12);
    this.label(context,this.plotExamples[target].axes[1],0,RANGE,0,-16,12);
    context.strokeStyle = "#999";
    context.lineWidth = 1;
    this.path(context,[{a:-RANGE,b:-RANGE},{a:-RANGE,b:-RANGE,z:MAX_LOSS}]);
    context.stroke();
    this.label(context,"L",-RANGE,-RANGE,MAX_LOSS,-14,0);
  }

  draw() {
    const key = `${this.yaw}:${this.pitch}`;
    if (key !== this.backgroundKey) {
      this.updateProjection();
      this.foreground = getComputedStyle(this).getPropertyValue("--slt-foreground").trim() || "#fff";
      for (let target = 0; target < this.plotExamples.length; target++) {
        this.drawSurface(this.backgrounds[target].getContext("2d"),target,this.meshes[target]);
      }
      this.backgroundKey = key;
    }
    this.canvases.forEach((canvas,target) => {
      const context = canvas.getContext("2d");
      context.setTransform(2,0,0,2,0,0);
      context.clearRect(0,0,WIDTH,HEIGHT);
      const example = this.plotExamples[target];
      const {a,b} = example.minimum;
      this.markedMinimum = {a,b};
      if (example.tangent) {
        // This is the tangent in the parameter plane, not a line of minima.
        context.strokeStyle = "#fff";
        context.lineWidth = 1.6;
        context.setLineDash([5,4]);
        this.path(context,[{a:a-0.22*example.tangent.a,b:b-0.22*example.tangent.b,z:0.025},
          {a:a+0.22*example.tangent.a,b:b+0.22*example.tangent.b,z:0.025}]);
        context.stroke();
        context.setLineDash([]);
      }
      const point = this.project(a,b,0.04);
      context.beginPath();
      context.arc(point.x,point.y,5.5,0,2*Math.PI);
      context.fillStyle = "white";
      context.fill();
      context.strokeStyle = "#ff4dff";
      context.lineWidth = 2;
      context.stroke();
      if (example.minimumLabel) this.label(context,example.minimumLabel,a,b,0,18,-14);
    });
  }
}

customElements.define("slt-dln-loss", SltDlnLoss);

export class SltLinearLoss extends SltDlnLoss {
  get examples() {
    return [SHALLOW_EXAMPLE];
  }
}

customElements.define("slt-linear-loss", SltLinearLoss);

export class SltLossExamples extends SltDlnLoss {
  get examples() {
    return EXTRA_EXAMPLES;
  }

  get autoRotate() {
    return true;
  }
}

customElements.define("slt-loss-examples", SltLossExamples);
