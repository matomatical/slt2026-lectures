// Section navigation and progress, grouped by level-1 slide headings.
export default function RevealSectionProgress() {
  let bar;
  let sections = [];

  return {
    id: "section-progress",
    init(deck) {
      if (deck.isPrintView() || deck.isSpeakerNotes()) return;

      const update = () => {
        if (!bar) return;
        const current = deck.getSlides().indexOf(deck.getCurrentSlide());
        for (const section of sections) {
          const visited = Math.max(0, Math.min(section.count, current - section.start + 1));
          section.button.style.setProperty("--section-progress", visited / section.count);
          if (current >= section.start && current < section.start + section.count) {
            section.button.setAttribute("aria-current", "step");
          } else {
            section.button.removeAttribute("aria-current");
          }
        }
      };

      const render = () => {
        bar?.remove();
        bar = document.createElement("nav");
        bar.className = "section-progress";
        bar.setAttribute("aria-label", "Slide sections");
        sections = [];
        deck.getSlides().forEach((slide, index) => {
          if (sections.length === 0 || slide.classList.contains("level1")) {
            const label = slide.querySelector("h1, h2")?.textContent.trim() || "Slides";
            const button = document.createElement("button");
            button.type = "button";
            button.title = label;
            button.setAttribute("aria-label", `Go to section: ${label}`);
            const fill = document.createElement("span");
            button.append(fill);
            button.addEventListener("click", () => {
              const { h, v } = deck.getIndices(slide);
              deck.slide(h, v);
              button.blur();
            });
            bar.append(button);
            sections.push({ start: index, count: 0, button });
          }
          sections.at(-1).count++;
        });
        for (const section of sections) {
          section.button.style.flexGrow = section.count;
        }
        deck.getRevealElement().append(bar);
        update();
      };

      deck.on("ready", render);
      deck.on("slidechanged", update);
      this.destroy = () => {
        deck.off("ready", render);
        deck.off("slidechanged", update);
        bar?.remove();
      };
    },
  };
}
