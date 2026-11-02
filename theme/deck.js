// Deck start-up: typeset maths with KaTeX, then start reveal.js and its plugins.

// LaTeX macros available in every formula on every slide.
const MACROS = {
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\E": "\\mathbb{E}",
};

// Pandoc emits each formula as <span class="math inline|display">TeX</span>.
for (const element of document.querySelectorAll("span.math")) {
  katex.render(element.textContent, element, {
    displayMode: element.classList.contains("display"),
    throwOnError: false,
    macros: MACROS,
  });
}

const CHALKBOARD_IMAGES = "vendor/reveal.js-plugins/chalkboard/img/";

// Opaque, smooth ink rather than the plugin's default translucent chalk.
// The same palette serves slide annotation and the full-screen board.
const INK_COLORS = [
  ["white", "rgba(255, 255, 255, 1)"],
  ["yellow", "rgba(255, 220, 0, 1)"],
  ["blue", "rgba(96, 154, 244, 1)"],
  ["red", "rgba(237, 60, 60, 1)"],
  ["green", "rgba(60, 220, 90, 1)"],
  ["orange", "rgba(240, 150, 50, 1)"],
  ["purple", "rgba(220, 90, 220, 1)"],
];
const INKS = INK_COLORS.map(([name, color]) => ({
  color: color,
  cursor: `url(${CHALKBOARD_IMAGES}chalk-${name}.png), auto`,
}));

Reveal.initialize({
  width: 1280,
  height: 720,
  margin: 0.04,
  center: false,
  hash: true,
  navigationMode: "linear",
  transition: "none",
  backgroundTransition: "none",
  controls: false,
  progress: true,
  slideNumber: "c/t",

  chalkboard: {
    theme: "chalkboard",
    chalkEffect: 0,
    chalkWidth: 4,
    boardmarkerWidth: 4,
    chalks: INKS,
    boardmarkers: INKS,
    // [slide-annotation tint, board background]; the eraser repaints with the
    // board background, so that one has to be an image.
    background: ["rgba(255, 255, 255, 0.03)", "theme/black.png"],
    grid: false,
    transition: 0,
    // Drawings persist in sessionStorage under this key (survives reloads,
    // not closing the tab); press 'd' to download them as JSON.
    storage: "slt-chalkboard",
    // Previously saved drawings to replay, set via `chalkboard-src` metadata.
    src: document.body.dataset.chalkboardSrc || null,
  },

  customcontrols: {
    controls: [
      {
        icon: '<i class="fa fa-pen-square"></i>',
        title: "Toggle chalkboard (B)",
        action: "RevealChalkboard.toggleChalkboard();",
      },
      {
        icon: '<i class="fa fa-pen"></i>',
        title: "Toggle slide annotation (C)",
        action: "RevealChalkboard.toggleNotesCanvas();",
      },
    ],
  },

  plugins: [RevealNotes, RevealChalkboard, RevealCustomControls],
});
