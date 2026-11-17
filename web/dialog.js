// Shared dialog wiring for both pages.
//
// `closedby="any"` gives native light dismiss in Chrome/Edge/Firefox. Safari
// and other Baseline-2024 browsers still get Esc/back dismissal from
// showModal(); this small fallback restores click-outside for them.

function outsideDialog(event, dialog) {
  const r = dialog.getBoundingClientRect();
  return (
    event.clientX < r.left ||
    event.clientX > r.right ||
    event.clientY < r.top ||
    event.clientY > r.bottom
  );
}

function wireLightDismiss(dialog) {
  if ("closedBy" in HTMLDialogElement.prototype) return;

  // Test pointer position, not event.target: dialog padding and gaps between
  // children also target the dialog element.
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = outsideDialog(event, dialog);
  });
  dialog.addEventListener("pointerup", (event) => {
    // Require press and release outside so a selection drag that ends on the
    // backdrop does not dismiss the dialog.
    if (pressedOutside && outsideDialog(event, dialog)) dialog.close();
    pressedOutside = false;
  });
}

export function wireDialogs() {
  for (const dialog of document.querySelectorAll("dialog[closedby='any']")) {
    wireLightDismiss(dialog);
  }

  for (const trigger of document.querySelectorAll("[data-open-dialog]")) {
    trigger.addEventListener("click", () => {
      const dialog = document.getElementById(trigger.dataset.openDialog);
      if (dialog && !dialog.open) dialog.showModal();
    });
  }
}
