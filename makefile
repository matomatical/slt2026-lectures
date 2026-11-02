# Build all decks into build/, a self-contained static site.
#   make        build once
#   make dev    rebuild, serve over the tailnet, and refresh browsers on changes
#   make clean  delete build/

BUILD := build
HOST := $(shell tailscale ip -4 2>/dev/null || echo 127.0.0.1)
PORT := 8390
DECKS := $(patsubst decks/%/slides.md,%,$(wildcard decks/*/slides.md))
DECK_PAGES := $(addsuffix /index.html,$(addprefix $(BUILD)/,$(DECKS)))

.PHONY: all assets reload watch serve serve-dev dev clean

all: $(BUILD)/index.html $(DECK_PAGES) assets

$(BUILD)/index.html: index.html
	@mkdir -p $(BUILD)
	cp $< $@

$(BUILD)/%/index.html: decks/%/slides.md theme/template.html filters/check-slide-ids.lua filters/comments-to-notes.lua
	@mkdir -p $(@D)
	pandoc $< --from markdown --to revealjs --slide-level 2 \
		--lua-filter filters/check-slide-ids.lua \
		--lua-filter filters/comments-to-notes.lua \
		--variable asset-prefix=../ \
		--katex --template theme/template.html --output $@

# Copy our own sources and the parts of each npm package the page loads.
assets:
	@mkdir -p $(BUILD)/vendor
	@rsync -a --delete --exclude template.html theme widgets $(BUILD)/
	@for deck in $(DECKS); do \
		mkdir -p "$(BUILD)/$$deck" || exit; \
		for directory in drawings media; do \
			if [ -d "decks/$$deck/$$directory" ]; then \
				rsync -a --delete "decks/$$deck/$$directory" "$(BUILD)/$$deck/" || exit; \
			else \
				rm -rf "$(BUILD)/$$deck/$$directory"; \
			fi; \
		done; \
	done
	@rsync -a --delete --relative \
		node_modules/reveal.js/dist/./reset.css \
		node_modules/reveal.js/dist/./reveal.css \
		node_modules/reveal.js/dist/./reveal.mjs \
		node_modules/reveal.js/dist/./plugin/notes.mjs \
		$(BUILD)/vendor/reveal.js/
	@rsync -a --delete node_modules/katex/dist/katex.mjs \
		node_modules/katex/dist/katex.min.css \
		node_modules/katex/dist/fonts \
		$(BUILD)/vendor/katex/

# Notify browsers only after every build step succeeds.
reload: all
	@date +%s%N > $(BUILD)/.revision.tmp
	@mv $(BUILD)/.revision.tmp $(BUILD)/.revision

# entr exits with status 2 when directories change; refresh its file list then.
# -n lets the watcher run without a terminal, including under a process manager.
watch:
	while true; do \
		find makefile index.html package.json package-lock.json decks theme widgets filters tools \
			| entr -dn $(MAKE) --no-print-directory reload; \
		status=$$?; \
		[ "$$status" -eq 2 ] || exit "$$status"; \
	done

serve: all
	python3 -m http.server --bind $(HOST) $(PORT) --directory $(BUILD)

serve-dev:
	python3 tools/devserver.py --bind $(HOST) --port $(PORT) --directory $(BUILD)

dev: reload
	$(MAKE) -j2 watch serve-dev

clean:
	rm -rf $(BUILD)
