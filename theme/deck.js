// Deck start-up: typeset maths with KaTeX, then start reveal.js and its plugins.

import Reveal from "../vendor/reveal.js/reveal.mjs";
import RevealNotes from "../vendor/reveal.js/plugin/notes.mjs";
import RevealSpeakerNotes from "./speaker-notes.js";
import katex from "../vendor/katex/katex.mjs";
import RevealInk from "./ink.js";
import RevealSectionProgress from "./section-progress.js";
import RevealTitleLandscape from "./title-landscape.js";

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
  // Leave B unassigned so an accidental press cannot blank the screen.
  keyboard: { 66: null },
  progress: false,
  slideNumber: "c/t",
  // Always show slides (never reveal.js's narrow-screen scrolling layout),
  // so that ink stays on its slide.
  scrollActivationWidth: 0,

  ink: {
    colors: ["#ffffff", "#ff9933", "#999999", "#ff4dff"],
    penWidth: 4,
    eraserSize: 40,
    laserColor: "#ff2a2a",
    // Saved drawings to show, set via the deck's `ink-src` metadata.
    src: document.body.dataset.inkSrc || null,
  },

  plugins: [RevealNotes, RevealSpeakerNotes, RevealInk, RevealSectionProgress, RevealTitleLandscape],
});
