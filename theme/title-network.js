// A fixed sparse feedforward network. Each input pulse is propagated through
// local weighted connections and a rectifier; light follows the resulting
// activations, including the travel time along each connection.
export default function createTitleNetwork(width, height) {
  let seed = 137;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const layers = 49;
  const rows = 53;
  const nodes = [];
  const edges = [];
  const pulseCount = 15;
  const pulseSpacing = 3.8 / 3;
  const cycle = pulseCount * pulseSpacing;
  const layerSpacing = (width - 20) / (layers - 1);
  const rowSpacing = (height - 18) / (rows - 1);

  for (let layer = 0; layer < layers; layer++) {
    for (let row = 0; row < rows; row++) {
      // Stagger adjacent rows and gently bend the layers, retaining the
      // spacing of a dot matrix without imposing straight vertical columns.
      const x = 10 + layerSpacing * (layer +
        0.3 * Math.sin(row * 0.18 + layer * 0.12) +
        (row % 2 ? 0.25 : -0.25) + 0.12 * (random() - 0.5));
      const y = 9 + rowSpacing * (row +
        (layer % 2 ? 0.2 : -0.2) + 0.2 * (random() - 0.5));
      const boundary = Math.min(x, width - x, y, height - y);
      const textX = (x - width / 2) / (width * 0.43);
      const textY = (y - height * 0.55) / (height * 0.24);
      const node = {
        x, y,
        fade: Math.max(0, Math.min(1, boundary / 80)) *
          (1 - 0.7 * Math.exp(-(textX ** 8 + textY ** 4))),
        incoming: [],
        signals: [],
        // A smooth field of faster and slower regions lets nearby paths
        // drift apart in time instead of resynchronising at every layer.
        delay: 0.11 + 0.13 * (1 + Math.sin(row * 0.16 + layer * 0.10)) / 2 +
          random() * 0.09,
      };
      if (layer > 0) {
        const sourceRows = new Set();
        const count = random() < 0.5 ? 2 : 3;
        while (sourceRows.size < count) {
          const sourceRow = row + Math.floor(random() * 7) - 3;
          if (sourceRow >= 0 && sourceRow < rows) sourceRows.add(sourceRow);
        }
        for (const sourceRow of sourceRows) {
          const source = nodes[(layer - 1) * rows + sourceRow];
          const edge = {
            source,
            target: node,
            weight: (0.65 + random() * 0.55) * (random() < 0.12 ? -1 : 1),
          };
          node.incoming.push(edge);
          edges.push(edge);
        }
      }

      for (let pulse = 0; pulse < pulseCount; pulse++) {
        let amplitude;
        let arrival = 0;
        if (layer === 0) {
          // Different input profiles seed distinct branching activation paths.
          const pattern = pulse % 5;
          const center = [0.22, 0.72, 0.42, 0.83, 0.35][pattern] * rows;
          amplitude = Math.exp(-0.5 * ((row - center) / 5) ** 2);
          amplitude += 0.7 * Math.exp(-0.5 * ((row - (rows - center)) / 3) ** 2);
          arrival = 0.6 * (1 + Math.sin(row * 0.13 + pattern));
        } else {
          let sum = 0;
          for (const edge of node.incoming) {
            const signal = edge.source.signals[pulse];
            sum += signal.amplitude * edge.weight;
            if (signal.amplitude > 0.04) arrival = Math.max(arrival, signal.arrival);
          }
          amplitude = Math.max(0, sum * 1.25 / Math.sqrt(node.incoming.length) - 0.08);
          arrival += node.delay;
        }
        node.signals.push({ amplitude: Math.min(1, amplitude), arrival });
      }
      nodes.push(node);
    }
  }

  // Show several stages of propagation even in the reduced-motion still.
  const pulseAge = (elapsed, pulse) =>
    ((elapsed + 10 - pulse * pulseSpacing) % cycle + cycle) % cycle;
  const envelope = (time) => {
    const spread = time < 0 ? 0.10 : 0.48;
    return Math.exp(-0.5 * (time / spread) ** 2);
  };

  return {
    draw(context, elapsed, color) {
      const edgePaths = Array.from({ length: 25 }, () => new Path2D());
      const dotPaths = Array.from({ length: 25 }, () => new Path2D());
      const travelers = Array.from({ length: 25 }, () => new Path2D());
      const ages = Array.from({ length: pulseCount }, (_, pulse) => pulseAge(elapsed, pulse));

      for (const edge of edges) {
        const { source, target } = edge;
        let light = 0;
        for (let pulse = 0; pulse < pulseCount; pulse++) {
          const signal = source.signals[pulse];
          if (signal.amplitude < 0.04) continue;
          const age = ages[pulse] - signal.arrival;
          const travel = Math.max(target.delay, target.signals[pulse].arrival - signal.arrival);
          light = Math.max(light, signal.amplitude * envelope(age - travel / 2));
          if (age < 0 || age > travel) continue;
          const fraction = age / travel;
          const x = source.x + fraction * (target.x - source.x);
          const y = source.y + fraction * (target.y - source.y);
          const fade = source.fade + fraction * (target.fade - source.fade);
          const path = travelers[Math.round(24 * 0.45 * signal.amplitude * fade)];
          path.moveTo(x + 0.9, y);
          path.arc(x, y, 0.9, 0, 2 * Math.PI);
        }
        const alpha = Math.sqrt(source.fade * target.fade) * (0.008 + 0.19 * light);
        const path = edgePaths[Math.round(24 * alpha)];
        path.moveTo(source.x, source.y);
        path.lineTo(target.x, target.y);
      }

      for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        let light = 0;
        for (let pulse = 0; pulse < pulseCount; pulse++) {
          const signal = node.signals[pulse];
          light = Math.max(light, signal.amplitude * envelope(ages[pulse] - signal.arrival));
        }
        const path = dotPaths[Math.round(24 * node.fade * (0.055 + 0.75 * light))];
        const radius = 1.4 + 0.55 * light;
        path.moveTo(node.x + radius, node.y);
        path.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      }

      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 0.65;
      for (let index = 1; index < 25; index++) {
        context.globalAlpha = index / 24;
        context.stroke(edgePaths[index]);
        context.fill(travelers[index]);
        context.fill(dotPaths[index]);
      }
      context.globalAlpha = 1;
    },
  };
}
