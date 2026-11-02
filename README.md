# SLT Lecture 1: Introduction and Degeneracies

Slides for the first lecture of the Oxford
[Singular Learning Theory course](https://kaiogden.net/slt/), Michaelmas 2026.
The deck is written in Markdown, compiled by pandoc into a
[reveal.js](https://revealjs.com) presentation, and published as a static
site. Slides can embed interactive visualisations and support live drawing
with a pen tablet.

## Building

Requirements: pandoc (3.x), Node/npm, rsync, and entr (for `make dev`).

```sh
npm install    # fetch the pinned front-end packages into node_modules/
make           # build the static site into build/
make dev       # rebuild on every change and serve build/ over the tailnet
```

`build/` is self-contained: open `build/index.html` via any static web server
(e.g. GitHub Pages). `build/widgets/gallery.html` shows every widget outside
the deck, for developing widgets.

## Layout

- `slides.md`: the lecture content. Pandoc Markdown; each level-2 heading is
  a slide and each level-1 heading a section-title slide.
- `theme/`: presentation of the deck.
  - `template.html`: the pandoc template, page structure only.
  - `deck.js`: start-up script: typesets maths with KaTeX (shared LaTeX macros
    are defined here) and configures reveal.js and its plugins.
  - `slt.css`, `fonts/`: the visual style (black background, white text,
    EB Garamond with TeX Gyre Chorus for titles).
  - `ink.js`, `ink.css`: the ink layer, a reveal.js plugin for drawing on
    slides (see Drawing below).
- `filters/`: pandoc Lua filters run by the build; `check-slide-ids.lua`
  warns about untitled slides (see Drawing below).
- `widgets/`: interactive visualisations, one custom HTML element per file,
  registered by `index.js`.
- `drawings/`, `media/` (optional): saved drawings, and images or videos
  referenced from the slides. Copied into `build/` if present.
- `package.json`: pinned versions of reveal.js and KaTeX.
- `makefile`: the build; copies only the needed files from `node_modules/`
  into `build/vendor/`.

## Writing slides

Beyond ordinary Markdown and `$...$`/`$$...$$` maths:

```markdown
. . .                          <!-- pause: what follows appears on click -->

::: incremental                <!-- list revealed one item at a time -->
* ...
:::

:::: columns                   <!-- side-by-side columns -->
::: column
...
:::
::::

::: notes                      <!-- speaker notes (press S) -->
...
:::

<slt-level-set k="w1^2 * w2^2" size="440"></slt-level-set>   <!-- a widget -->

![](media/animation.gif)       <!-- image; <video> tags also work -->

## {#board-volume .chalk}      <!-- blank slide for drawing -->
```

## Widgets

A widget is a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements):
a class extending `HTMLElement`, registered under a tag name, configured by
the tag's attributes. To add one:

1. Write `widgets/slt-<name>.js`, ending in
   `customElements.define("slt-<name>", ...)`. Document its attributes in a
   comment at the top of the file.
2. Import it in `widgets/index.js`.
3. Add an example to `widgets/gallery.html`.
4. Use the tag in `slides.md`.

Conventions, following `slt-level-set.js`:

- Render into a shadow root, so slide styles and widget styles cannot
  interfere with each other.
- Size the widget in slide pixels (the slide is 1280×720; reveal.js scales it
  to the screen), and draw canvases at a higher resolution so they stay sharp
  when scaled up.
- Read colours from the theme's CSS variables (`--slt-foreground`,
  `--slt-accent`, ...).
- Stop `keydown` events from leaving the shadow root, so keys used by
  controls inside the widget do not also change slides.

## Drawing

The ink layer (`theme/ink.js`) draws on the current slide with a pen tablet,
mouse or touch screen. Ink is recorded in slide coordinates and drawn inside
the slide, so it stays attached to the slide's content when the window is
resized or zoomed. A toolbar at the bottom left mirrors the keys:

| Key              | Action                                                |
| ---------------- | ----------------------------------------------------- |
| C                | toggle drawing (pointer input draws instead of clicking) |
| 1, 2, 3, 4       | pen colour: white, orange, grey, magenta              |
| E                | eraser (a square); press again for the pen            |
| right-drag       | erase, whatever the tool                              |
| L                | laser pointer: its trace fades on release, unrecorded |
| B                | board: a blank page over the slide, with its own ink  |
| Ctrl+Z           | undo                                                  |
| Ctrl+Shift+Z     | redo                                                  |
| Delete           | clear the slide (or board); undoable                  |
| Shift+Delete     | forget all drawings stored in this browser (asks first) |
| D                | download all drawings as `drawings.json`              |
| Esc              | close the board, then stop drawing                    |

Colours, pen width, eraser size and laser settings are in `theme/deck.js`.

Drawings are stored in the browser (localStorage), so they survive reloading
and closing the tab, and the speaker view's previews show them. Each slide's
drawings are keyed by its id, which pandoc derives from the heading: renaming
a heading detaches its drawings (the browser console lists drawings whose
slide is missing). Untitled slides get ids from their position among untitled
slides, so give them explicit ids (`## {#board-volume .chalk}`); the build
warns about untitled slides without one.

To publish drawings with the deck: download them (D), save the file as
`drawings/lecture.json`, and add `ink-src: drawings/lecture.json` to the
metadata block at the top of `slides.md`. Viewers then see the saved
drawings, except on slides where they have drawn their own. The ink layer
is not shown in reveal.js's PDF print view.
