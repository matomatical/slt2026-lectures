// The notes plugin copies rendered slide notes into a separate document.
// Load its maths styles on connection and mark the slide bounds in previews.
export default function RevealSpeakerNotes() {
  let onMessage;
  let boundary;
  let updateBoundary;
  let deck;
  return {
    id: "speaker-notes-styles",
    init(presentation) {
      deck = presentation;
      if (deck.isSpeakerNotes() && !deck.isPrintView()) {
        boundary = document.createElement("div");
        boundary.className = "presenter-slide-boundary";
        boundary.setAttribute("aria-hidden", "true");
        deck.getSlidesElement().append(boundary);
        // Keep the outline legible even in the smaller upcoming-slide view.
        updateBoundary = () => {
          boundary.style.borderWidth = `${2 / deck.getScale()}px`;
        };
        deck.on("ready", updateBoundary);
        deck.on("resize", updateBoundary);
        updateBoundary();
      }
      const stylesheet = new URL("./speaker-notes.css", import.meta.url).href;
      onMessage = (event) => {
        if (event.origin !== window.location.origin ||
            event.source?.opener !== window || typeof event.data !== "string") return;

        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        if (message?.namespace !== "reveal-notes" ||
            !["connected", "heartbeat"].includes(message.type)) return;

        const document = event.source.document;
        if (!document.head || document.getElementById("slt-speaker-notes-styles")) return;
        const link = document.createElement("link");
        link.id = "slt-speaker-notes-styles";
        link.rel = "stylesheet";
        link.href = stylesheet;
        document.head.append(link);
      };
      window.addEventListener("message", onMessage);
    },
    destroy() {
      window.removeEventListener("message", onMessage);
      if (updateBoundary) {
        deck.off("ready", updateBoundary);
        deck.off("resize", updateBoundary);
      }
      boundary?.remove();
    },
  };
}
