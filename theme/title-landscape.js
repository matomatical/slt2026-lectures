// Animated title backgrounds: height bands on a fixed cusp landscape,
// or activations propagating through a sparse network.
import createTitleNetwork from "./title-network.js";

export default function RevealTitleLandscape() {
  return {
    id: "title-landscape",
    init(deck) {
      const slide = deck.getRevealElement().querySelector("#title-slide[data-landscape]");
      const power = { cusp: 3, "cusp-5": 5, "cusp-7": 7 }[slide?.dataset.landscape];
      const isNetwork = slide?.dataset.landscape === "network";
      if (!power && !isNetwork) return;

      const width = deck.getConfig().width;
      const height = deck.getConfig().height;
      const network = isNetwork ? createTitleNetwork(width, height) : null;
      const motion = matchMedia("(prefers-reduced-motion: reduce)");
      let canvas;
      let context;
      let frame = null;
      let lastFrame = null;
      let elapsed = 0;
      let dots = [];

      const draw = () => {
        if (!context) return;
        context.clearRect(0, 0, width, height);
        const color = getComputedStyle(slide).getPropertyValue("--slt-landscape-color").trim();
        if (network) {
          network.draw(context, elapsed, color);
          return;
        }
        const breath = (1 - Math.cos((2 * Math.PI * elapsed) / 16)) / 2;
        const band = 3.9 * breath;
        const paths = Array.from({ length: 25 }, () => new Path2D());
        const gaussian = (distance) => Math.exp(-0.5 * (distance / 0.28) ** 2);
        for (const dot of dots) {
          const distance = dot.level - band;
          const light = Math.max(
            gaussian(distance),
            0.55 * gaussian(distance - 0.85),
            0.3 * gaussian(distance + 0.85),
          );
          const alpha = dot.fade * (0.035 + 0.75 * light);
          const path = paths[Math.round(24 * alpha)];
          const radius = 1.4 + 0.55 * light;
          path.moveTo(dot.x + radius, dot.y);
          path.arc(dot.x, dot.y, radius, 0, 2 * Math.PI);
        }
        context.fillStyle = color;
        for (let index = 1; index < paths.length; index++) {
          context.globalAlpha = index / 24;
          context.fill(paths[index]);
        }
        context.globalAlpha = 1;
      };

      const resize = () => {
        if (!canvas) return;
        const scale = Math.min(2, deck.getScale() * (devicePixelRatio || 1));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        draw();
      };

      const tick = (now) => {
        frame = requestAnimationFrame(tick);
        if (lastFrame !== null && now - lastFrame < 1000 / 24) return;
        if (lastFrame !== null) elapsed += Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;
        draw();
      };

      const sync = () => {
        const animate = canvas && deck.getCurrentSlide() === slide && !document.hidden &&
          !motion.matches && !deck.isOverview() && !deck.isPaused() &&
          !deck.isPrintView() && !deck.isSpeakerNotes();
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        lastFrame = null;
        if (animate) frame = requestAnimationFrame(tick);
        else draw();
      };

      const setup = () => {
        canvas = document.createElement("canvas");
        canvas.className = "title-landscape";
        canvas.setAttribute("aria-hidden", "true");
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        slide.prepend(canvas);
        context = canvas.getContext("2d");

        const unit = height / 2.8;
        for (let row = 6; !network && row < height; row += 10) {
          for (let column = 6; column < width; column += 10) {
            // Swap the plotting axes to match the right-opening cusp ornament.
            const x = (height / 2 - row) / unit;
            const y = (column - width * 0.36) / unit;
            const loss = (x * x - y ** power) ** 2;
            const edge = Math.min(column, width - column, row, height - row);
            const edgeFade = Math.min(1, edge / 80);
            // A soft dark area behind the title block keeps the lettering clear.
            const textHorizontal = (column - width / 2) / (width * 0.43);
            const textVertical = (row - height * 0.55) / (height * 0.24);
            const textFade = 1 - 0.7 * Math.exp(-(textHorizontal ** 8 + textVertical ** 4));
            dots.push({
              x: column,
              y: row,
              // Compress large heights, retaining a finite band around zero
              // so the cusp remains visible on the discrete dot grid.
              level: Math.log10(1 + loss / 0.02),
              fade: edgeFade * textFade,
            });
          }
        }
        resize();
        sync();
      };

      const events = ["slidechanged", "overviewshown", "overviewhidden", "paused", "resumed"];
      deck.on("ready", setup);
      deck.on("resize", resize);
      for (const event of events) deck.on(event, sync);
      document.addEventListener("visibilitychange", sync);
      motion.addEventListener("change", sync);
      this.destroy = () => {
        if (frame !== null) cancelAnimationFrame(frame);
        deck.off("ready", setup);
        deck.off("resize", resize);
        for (const event of events) deck.off(event, sync);
        document.removeEventListener("visibilitychange", sync);
        motion.removeEventListener("change", sync);
        canvas?.remove();
        dots = [];
      };
    },
  };
}
