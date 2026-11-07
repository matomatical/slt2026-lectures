// Reserve arrow keys for presentation navigation, including when a control
// inside a shadow root has focus. Native button activation stays local.
export function setupWidgetKeys(root) {
  root.addEventListener("keydown", event => {
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("button")) {
      event.stopPropagation();
    }
    if (event.key.startsWith("Arrow") && event.target.matches('input[type="range"]')) {
      event.preventDefault();
    }
  });
}
