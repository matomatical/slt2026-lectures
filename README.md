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
- `widgets/`: interactive visualisations, one custom HTML element per file,
  registered by `index.js`.
- `drawings/`, `media/` (optional): saved chalkboard drawings, and images or
  videos referenced from the slides. Copied into `build/` if present.
- `package.json`: pinned versions of reveal.js, KaTeX, the reveal.js
  chalkboard plugin, and Font Awesome (which the plugin's buttons use).
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

## {.chalk}                    <!-- blank slide for drawing -->
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

The [chalkboard plugin](https://github.com/rajgoel/reveal.js-plugins/tree/master/chalkboard)
provides two drawing modes, toggled by keyboard or by the buttons at the
bottom left:

| Key         | Action                                         |
| ----------- | ---------------------------------------------- |
| C           | toggle drawing on the current slide            |
| B           | toggle the full-screen board                   |
| X / Y       | next / previous ink colour                     |
| right-drag  | erase                                          |
| DEL         | clear the current drawing                      |
| D           | download all drawings as JSON                  |

Drawings are kept in the browser's session storage, so they survive
reloading the page but not closing the tab. To publish drawings with the
deck, download them (D), save the file as `drawings/lecture.json`, and add
`chalkboard-src: drawings/lecture.json` to the metadata block at the top of
`slides.md`. Saved drawings replay on their slides, and are included in PDF
export (board drawings only).
