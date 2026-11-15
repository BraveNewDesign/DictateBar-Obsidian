type LocationMarker =
  | { kind: 'start'; name: string }
  | { kind: 'end'; id?: string };

const COMMENT_NODE = 8;
const SHOW_COMMENT = 128;

export function decorateLocationMarkers(root: HTMLElement, previousOpenLocationName?: string): string | undefined {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_COMMENT);
  const comments: Comment[] = [];
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === COMMENT_NODE) comments.push(current as Comment);
    current = walker.nextNode();
  }

  let openLocationName = previousOpenLocationName;
  for (const comment of comments) {
    if (comment.parentElement?.closest('pre, code')) continue;
    const marker = parseLocationMarker(comment.data);
    if (!marker) continue;

    if (marker.kind === 'start') {
      openLocationName = marker.name;
      replaceComment(comment, createBoundary(root, 'start', marker.name));
      continue;
    }

    const name = marker.id ? displayNameFromID(marker.id) : openLocationName ?? 'DictateBar location';
    replaceComment(comment, createBoundary(root, 'end', name));
    openLocationName = undefined;
  }
  return openLocationName;
}

function parseLocationMarker(source: string): LocationMarker | null {
  if (!source.startsWith(' dictatebar:') || !source.endsWith(' ')) return null;
  const marker = source.slice(1, -1);
  if (marker === 'dictatebar:end') return { kind: 'end' };

  const legacyStart = /^dictatebar:start id="([A-Za-z0-9][A-Za-z0-9-]*)"$/.exec(marker);
  if (legacyStart) return { kind: 'start', name: displayNameFromID(legacyStart[1]) };

  const legacyEnd = /^dictatebar:end id="([A-Za-z0-9][A-Za-z0-9-]*)"$/.exec(marker);
  if (legacyEnd) return { kind: 'end', id: legacyEnd[1] };

  const manualStart = /^dictatebar:start (.+)$/.exec(marker);
  if (!manualStart) return null;
  const name = manualStart[1].normalize('NFC');
  if (
    !name ||
    name !== name.trim() ||
    name.startsWith('id=') ||
    name.includes('--') ||
    name.includes('-->') ||
    name.includes('\n') ||
    name.includes('\r')
  ) return null;
  return { kind: 'start', name };
}

function displayNameFromID(id: string): string {
  return id.split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function createBoundary(root: HTMLElement, kind: 'start' | 'end', name: string): HTMLElement {
  const document = root.ownerDocument;
  const boundary = document.createElement('div');
  const label = `${kind === 'start' ? 'Start' : 'End'} of ${name}`;
  boundary.className = `dictatebar-location-boundary dictatebar-location-boundary--${kind}`;
  boundary.setAttribute('role', 'separator');
  boundary.setAttribute('aria-label', label);

  const text = document.createElement('span');
  text.className = 'dictatebar-location-boundary-label';
  text.textContent = label;
  boundary.append(text);
  return boundary;
}

function replaceComment(comment: Comment, boundary: HTMLElement): void {
  const parent = comment.parentElement;
  if (!parent) return;
  const isOnlyParagraphContent = parent.tagName === 'P' && Array.from(parent.childNodes).every(node =>
    node === comment || (node.nodeType === 3 && !(node.textContent ?? '').trim())
  );
  if (isOnlyParagraphContent) parent.replaceWith(boundary);
  else comment.replaceWith(boundary);
}
