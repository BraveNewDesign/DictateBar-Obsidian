import { leadingTimestamp, prettyTimestamp } from './timestamps.ts';
import { decorateLocationMarkers, type LocationRenderState } from './locations.ts';

export function decorateTimestamps(
  root: HTMLElement,
  locationState: LocationRenderState = {
    insideLocation: false,
    isCurrentLocationValid: false,
    pendingItems: [],
    pendingBoundaries: [],
  },
  formatWholeBlock = false,
): LocationRenderState {
  if (formatWholeBlock) {
    root.querySelectorAll<HTMLElement>('li').forEach(decorateTimestamp);
    return locationState;
  }
  return decorateLocationMarkers(root, locationState, items => items.forEach(decorateTimestamp));
}

function decorateTimestamp(item: HTMLElement): void {
  // Only leading timestamps on Markdown list items qualify; ordinary prose,
  // examples, inline code, and unknown bracketed text remain untouched.
  if (item.closest('pre, code') || item.querySelector(':scope > .dictatebar-timestamp')) return;
  const container = item.querySelector<HTMLElement>(':scope > p') ?? item;
  if (container.querySelector(':scope > .dictatebar-timestamp')) return;
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.matches('input[type="checkbox"]')) continue;
      return;
    }
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.textContent ?? '';
    if (!text.trim()) continue;
    const whitespace = text.match(/^\s*/)?.[0].length ?? 0;
    const timestamp = leadingTimestamp(text.slice(whitespace));
    if (!timestamp) return;
    const time = container.ownerDocument.createElement('time');
    time.className = 'dictatebar-timestamp';
    time.dateTime = timestamp.date.toISOString();
    time.textContent = prettyTimestamp(timestamp.date);
    time.title = timestamp.raw;
    time.setAttribute('aria-label', `Dictated ${time.textContent}`);
    const tail = container.ownerDocument.createTextNode(text.slice(whitespace + timestamp.length));
    node.replaceWith(time, tail);
    item.classList.add('dictatebar-entry');
    return;
  }
}
