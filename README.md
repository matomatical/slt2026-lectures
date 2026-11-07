# Singular Learning Theory slides

Slides for the Oxford
[Singular Learning Theory course](https://kaiogden.net/slt/), Michaelmas 2026.
The decks are written in Markdown, compiled by pandoc into
[reveal.js](https://revealjs.com) presentations, and published as a static
site. They share a theme, interactive widgets, and support for live drawing
with a pen tablet. The demo illustrates the available slide features;
Lecture 1A is for the first hour on motivation, and Lecture 1B for the second
hour on degeneracy.

## Building

Requirements: pandoc (3.x), Node/npm, Python 3, rsync, and entr (for `make dev`).

```sh
npm ci         # fetch the locked front-end packages into node_modules/
make           # build the static site into build/
make dev       # rebuild, serve over the tailnet, and refresh the browser
```

`build/` is self-contained: serve it with any static web server
(e.g. GitHub Pages). Its index links to `demo/`, `1A/`, and `1B/`.
`widgets/gallery.html` shows every widget outside the decks, for developing
widgets. Deploy the whole build directory so the shared assets are available.

For local use without Tailscale, run `make serve HOST=127.0.0.1` (or
`make dev HOST=127.0.0.1`) and open `http://127.0.0.1:8390/`.

During `make dev`, open pages refresh automatically after each successful
rebuild, staying on the current slide. Failed builds leave the page as it is.
The development server adds the refresh script as it serves HTML; built files
remain suitable for static hosting. `make serve` serves without live reload.

During `make dev`, drag images or videos from your computer onto a deck to
save them in `lectures/<name>/media/`. A panel shows a snippet to copy into the
slide source: `![](media/diagram.png)` for images, or
`<video controls src="media/clip.mp4"></video>` for videos. Existing files
are preserved: repeated names get a numeric suffix. You can drop multiple
files at once. Images (PNG, JPEG, GIF, WebP, SVG, AVIF, BMP and ICO) may be up
to 25 MiB each; videos (MP4, WebM, OGV, MOV and M4V) up to 250 MiB each.
Video playback depends on the browser's support for the file's codecs.
The panel survives automatic refreshes until you close it. Uploads are
available only on the development server.

## Publishing

The published lectures are at
[Lecture 1A](https://far.in.net/slt2026/lecture-1A/) and
[Lecture 1B](https://far.in.net/slt2026/lecture-1B/).

Run `make public` to create `public/`, ready to serve under `/slt2026/` or
another URL prefix. It contains `lecture-1A/`, `lecture-1B/`, an index, and
shared assets, including the vendored dependency licenses. The export omits
the demo, widget gallery, unused level-set widget, and unused ornaments.
The source and development build retain these for authoring.

Copy the contents of `public/` into a static host's destination directory.
For the personal website, that directory is `assets/slt2026/`; its asset-copy
target populates `ghp/slt2026/`. Replace the previous export when updating so
removed files do not linger. Speaker notes are included in the HTML, and
drawings stored only in a presenter's browser are not part of the export.

## Checking changes

Run `make test` for the Python tests of the Markdown filters and development
uploads, plus the Node.js checks of posterior calculations, widget lifecycle,
and loss geometry. These use the build dependencies and standard libraries.

`make test-browser` additionally checks live drawing and speaker previews in
Chromium. It requires Playwright and its Chromium browser. If Playwright is
installed elsewhere, set `NODE_PATH` to the containing `node_modules/` directory.

## Layout

- `lectures/<name>/slides.md`: each deck's content. Pandoc Markdown; each level-2
  heading is a slide and each level-1 heading a section-title slide.
- `lectures/<name>/drawings/`, `lectures/<name>/media/` (optional): saved drawings,
  and images or videos referenced from that deck. Copied beside its built
  `index.html`; removed assets are also removed from the build.
- `index.html`: links to the decks and widget gallery.
- `theme/`: shared presentation of the decks.
  - `template.html`: the pandoc template, page structure only.
  - `deck.js`: start-up script: typesets maths with KaTeX (shared LaTeX macros
    are defined here) and configures reveal.js and its plugins.
  - `slt.css`, `fonts/`: the visual style (black background, white text,
    EB Garamond with TeX Gyre Chorus for titles).
  - `ink.js`, `ink.css`: the ink layer, a reveal.js plugin for drawing on
    slides (see Drawing below).
- `filters/`: pandoc Lua filters run by the build; `check-slide-ids.lua`
  warns about untitled slides (see Drawing below), and `comments-to-notes.lua`
  turns HTML comments into speaker notes; `slide-columns.lua` expands the
  column shorthand below.
- `widgets/`: interactive visualisations, one custom HTML element per file,
  registered by `index.js`.
- `package.json`: pinned versions of reveal.js and KaTeX.
- `makefile`: the build; copies only the needed files from `node_modules/`
  into `build/vendor/`.
- `tools/devserver.py`: the development server with live reload; uses Python's
  standard library.

## Writing slides

Edit `lectures/demo/slides.md`, `lectures/1A/slides.md`, or
`lectures/1B/slides.md`. To add another deck, create
`lectures/<name>/slides.md` and add a link to it in `index.html`; `make` discovers
the deck automatically and builds it into `build/<name>/index.html`.

The progress bar has a segment for each level-1 section, with widths
proportional to slide counts. Completed sections are grey, the current
section uses the deck's highlight colour, and future sections are dimmed.
The bright portion tracks the current slide. Hover over a segment to see
its section name, or click to jump to its first slide. Set
`progress-color: orange` or `progress-color: magenta` in the deck's YAML
metadata; the default is the theme's gold accent. Orange matches the orange
drawing pen.

Section titles can have a grey, hand-drawn mathematical ornament above them:

```markdown
# A section title {data-ornament="cusp"}
```

Available stages are `cusp`, `parabola`, `triple-crossing`, and
`normal-crossings`. Prepend `cusp-5` for a five-section sequence starting
from the sharper cusp `x² = y⁵`.
The parabola includes its tangent exceptional divisor;
the later stages retain their exceptional divisors too. `punctured-axes`
provides coordinate axes with an open origin, used for the break slide.
Omit the attribute for an undecorated title. The four stages from `cusp`
through `normal-crossings` redraw the sequence in Franklin Vera Pacheco's
[Functorial Resolution of Singularities](https://commons.wikimedia.org/wiki/File:Functorial_Resolution_of_Singularities.svg),
with labels and arrows removed. The ornaments are licensed under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

`network-5` through `network-0` show successive reductions of a single
constant-function network, removing one hidden unit per stage. Shared
incoming stems denote identical incoming weights and biases. First, the
input-only unit at the top is removed because its outgoing weight is zero.
The output-only constant unit at the bottom is then absorbed into the output
bias and removed. The three central units have outgoing weights `1, 1, -2`;
successive merges give `2, -2`, then `0`. Removing the final zero-outgoing
unit leaves isolated input and output nodes. One parameter realisation is
`f(x) = 0 tanh(2x) + tanh(x) + tanh(x) - 2 tanh(x) + tanh(1)`;
the ornaments omit weights and biases. These ornaments also use CC BY-SA 3.0.


`network-short-3` through `network-short-0` give a four-stage reduction sequence.
The starting network has a pair of duplicate hidden units with opposite outgoing
weights, plus one constant hidden unit: `f(x) = tanh(x) - tanh(x) + tanh(1)`.
First the duplicate pair merges into a zero-outgoing unit. Next that unit is
removed. Finally the constant unit is absorbed into the output bias, leaving
isolated input and output nodes. Shared incoming stems mark the duplicate pair;
weights and biases are omitted. These ornaments also use CC BY-SA 3.0.

Add `title-landscape: cusp` to a deck's YAML metadata to give its title slide
a breathing dot-matrix background. The fixed landscape is
`K(x, y) = (x² - y³)²`, viewed from above with the cusp opening to the right.
Use `cusp-5` or `cusp-7` for the sharper cusps with powers five and seven,
respectively, at the start of longer resolution sequences.
Three illuminated height bands sweep up and down on a 16-second cycle, so
the cusp appears near the bottom of each sweep. The animation runs only on
the visible title slide; reduced-motion preferences, speaker previews and
print view use a still frame. Adjust its colour with `--slt-landscape-color`
in `theme/slt.css`.

Use `title-landscape: network` for a dot matrix of neural-network layers.
Each neuron receives two or three weighted connections from nearby neurons
in the preceding layer. Different input pulses propagate from left to right
through rectified activations, lighting the neurons and their connections.
Staggered dots and spatially varying propagation times give the wavefronts
a gently irregular shape.
It shares the landscape's colour, title shading, and animation controls.

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

::: centered                   <!-- horizontally centred content -->
...
:::

<slt-level-set k="w1^2 * w2^2" size="440"></slt-level-set>   <!-- a widget -->

![](media/animation.gif)       <!-- image; <video> tags also work -->

## {#board-volume .chalk}      <!-- blank slide for drawing -->
```

For a two-column slide, add `.sidebar` (75% left, 24% right) or `.split`
(49.5% each) to its heading, and separate the columns with a standalone `---`:

```markdown
## A slide with an image {.sidebar}

Text and bullet points on the left.

---

![](media/diagram.png)
```

Both layouts have a 1% gap and a full-width heading. Either column can
contain arbitrary Markdown, including multiple images, lists or widgets.
Use exactly one top-level divider per column slide; ordinary slides keep
Pandoc's usual `---` slide breaks. Speaker notes stay outside the columns.
Explicit `columns`/`column` divs remain available for custom layouts.

HTML source comments also become speaker notes, including comments inside
bullet points:

```markdown
* A point for the audience.
  <!-- Explain this with the earlier example. -->

<!--
Notes can contain **Markdown**.

- Ask for questions before moving on.
-->
```

Comments appear in speaker view (S), hidden from the audience. Existing
`::: notes` blocks work too; comments inside those blocks remain comments.
Comments in code examples remain literal code.

## Widgets

`<slt-regular-model width="300"></slt-regular-model>` illustrates a regular
two-weight linear regression model. Grey contours show population excess
loss; an orange Gaussian posterior concentrates as the sample size grows
from 4 to 64. The dot marks the true parameter and the small cross the
estimate. The camera and density-height scale are fixed. The animation
plays once on slide entry, with a Replay button; overview, print and
reduced-motion views show the final frame. The Gaussian posterior is exact
for full-rank Gaussian regression under a flat prior, and the estimate's
path is illustrative.

`<slt-singular-model width="300"></slt-singular-model>` shows a two-layer
scalar linear network with loss `K(w) = (w₁w₂)²/2`, crossing lines of minima
and hyperbolic contours. Its posterior is proportional to `exp(-n K(w))`
times a proper `N(0, 0.25 I)` prior; the illustration omits empirical
fluctuations. The posterior plays from `n = 4` to `4096`. To first show only
the geometry, mark a slide fragment with `data-slt-posterior=""`; revealing
that fragment starts the posterior animation. Overview and print show the
final posterior; reduced motion respects the fragment but skips animation.

A widget is a [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements):
a class extending `HTMLElement`, registered under a tag name, configured by
the tag's attributes. To add one:

1. Write `widgets/slt-<name>.js`, ending in
   `customElements.define("slt-<name>", ...)`. Document its attributes in a
   comment at the top of the file.
2. Import it in `widgets/index.js`.
3. Add an example to `widgets/gallery.html`.
4. Use the tag in a deck's Markdown.

Conventions, following `slt-level-set.js`:

- Render into a shadow root, so slide styles and widget styles cannot
  interfere with each other.
- Size the widget in slide pixels (the slide is 1280×720; reveal.js scales it
  to the screen), and draw canvases at a higher resolution so they stay sharp
  when scaled up.
- Read colours from the theme's CSS variables (`--slt-foreground`,
  `--slt-accent`, ...).
- Keep arrow keys available for slide navigation. Use `setupWidgetKeys` from
  `widgets/widget-controls.js` to keep native button activation local and
  prevent range inputs from changing values when navigating with arrow keys.

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
| Ctrl+Z           | undo                                                  |
| Ctrl+Shift+Z     | redo                                                  |
| Delete           | clear the slide; undoable                             |
| Shift+Delete     | forget all drawings stored in this browser (asks first) |
| D                | download all drawings as `drawings.json`              |
| Esc              | stop drawing                                         |

Colours, pen width, eraser size and laser settings are in `theme/deck.js`.

Drawings are stored in the browser (localStorage), so they survive reloading
and closing the tab. Each deck has separate storage. The speaker view's
previews show ink. For a board, add a blank slide with an explicit id
(`## {#board-volume .chalk}`). B is unassigned. Each slide's
drawings are keyed by its id, which pandoc derives from the heading: renaming
a heading detaches its drawings (the browser console lists drawings whose
slide is missing). Untitled slides get ids from their position among untitled
slides, so give them explicit ids (`## {#board-volume .chalk}`); the build
warns about untitled slides without one.

To publish drawings with the deck: download them (D), save the file as
`lectures/<name>/drawings/lecture.json`, and add `ink-src: drawings/lecture.json`
to the metadata block at the top of that deck's `slides.md`. Viewers then see
the saved drawings, except on slides where they have drawn their own. The
ink layer is not shown in reveal.js's PDF print view.
