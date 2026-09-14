/** Keyboard containment and focus restoration for planner dialogs. */
export function dialogFocus(node: HTMLElement, close: () => void) {
  const previous = document.activeElement as HTMLElement | null;
  const oldOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const focusable = () => Array.from(node.querySelectorAll<HTMLElement>(
    'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex="0"]'
  )).filter((el) => el.getClientRects().length > 0);
  const frame = requestAnimationFrame(() => (focusable()[0] ?? node).focus());
  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const elements = focusable();
    const first = elements[0];
    const last = elements.at(-1);
    if (!first) { event.preventDefault(); node.focus(); return; }
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  node.addEventListener('keydown', onKey);
  return { destroy() {
    cancelAnimationFrame(frame);
    node.removeEventListener('keydown', onKey);
    document.body.style.overflow = oldOverflow;
    previous?.focus();
  } };
}
