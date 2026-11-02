# Build the deck into build/, a self-contained static site.
#   make        build once
#   make dev    rebuild on every change and serve build/ over the tailnet
#   make clean  delete build/

BUILD := build
HOST := $(shell tailscale ip -4 2>/dev/null || echo 127.0.0.1)
PORT := 8390

.PHONY: all assets watch serve dev clean

all: $(BUILD)/index.html assets

$(BUILD)/index.html: slides.md theme/template.html
	@mkdir -p $(BUILD)
	pandoc slides.md --from markdown --to revealjs --slide-level 2 \
		--katex --template theme/template.html --output $@

# Copy our own sources and the parts of each npm package the page loads.
assets:
	@mkdir -p $(BUILD)/vendor
	@rsync -a --delete --exclude template.html theme widgets $(BUILD)/
	@[ ! -d drawings ] || rsync -a --delete drawings $(BUILD)/
	@[ ! -d media ] || rsync -a --delete media $(BUILD)/
	@rsync -a --delete --relative \
		node_modules/reveal.js/dist/./reset.css \
		node_modules/reveal.js/dist/./reveal.css \
		node_modules/reveal.js/dist/./reveal.js \
		node_modules/reveal.js/./plugin/notes/notes.js \
		$(BUILD)/vendor/reveal.js/
	@rsync -a --delete node_modules/katex/dist/katex.min.js \
		node_modules/katex/dist/katex.min.css \
		node_modules/katex/dist/fonts \
		$(BUILD)/vendor/katex/
	@rsync -a --delete node_modules/@fortawesome/fontawesome-free/css \
		node_modules/@fortawesome/fontawesome-free/webfonts \
		$(BUILD)/vendor/fontawesome/
	@rsync -a --delete node_modules/reveal.js-plugins/chalkboard \
		node_modules/reveal.js-plugins/customcontrols \
		$(BUILD)/vendor/reveal.js-plugins/

# entr reruns make whenever a watched file changes; -d makes it exit when a
# file is added to a watched directory, so the loop restarts with a fresh list.
watch:
	while true; do \
		find slides.md theme widgets $$(ls -d drawings media 2>/dev/null) -type f \
			| entr -d $(MAKE) --no-print-directory; \
	done

serve: all
	python3 -m http.server --bind $(HOST) $(PORT) --directory $(BUILD)

dev:
	$(MAKE) -j2 watch serve

clean:
	rm -rf $(BUILD)
