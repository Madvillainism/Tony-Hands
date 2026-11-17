// Shared trick-sheet wiring for both pages.
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

export function wireTrickSheet() {
  const dialog = document.getElementById("tricks");
  if (!dialog) return;

  for (const trigger of document.querySelectorAll("[data-open-dialog]")) {
    trigger.addEventListener("click", () => {
      if (dialog.id === trigger.dataset.openDialog && !dialog.open) {
        dialog.showModal();
      }
    });
  }

  if ("closedBy" in HTMLDialogElement.prototype) return;

  // Test pointer position, not event.target: dialog padding and gaps between
  // children also target the dialog element.
  let pressedOutside = false;
  dialog.addEventListener("pointerdown", (event) => {
    pressedOutside = outsideDialog(event, dialog);
  });
  dialog.addEventListener("pointerup", (event) => {
    // Require press and release outside so a selection drag that ends on the
    // backdrop does not dismiss the sheet.
    if (pressedOutside && outsideDialog(event, dialog)) dialog.close();
    pressedOutside = false;
  });
}
