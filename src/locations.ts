type LocationMarker =
  | { kind: 'start'; name: string; key: string }
  | { kind: 'end'; key?: string };

type PendingBoundary = { comment: Comment; kind: 'start' | 'end'; name: string };

export type LocationRenderState = {
  insideLocation: boolean;
  openLocationName?: string;
  openLocationKey?: string;
  isCurrentLocationValid: boolean;
  pendingItems: HTMLElement[];
  pendingBoundaries: PendingBoundary[];
};

const COMMENT_NODE = 8;
const SHOW_ELEMENT_AND_COMMENT = 129;

export function decorateLocationMarkers(
  root: HTMLElement,
  initialState: LocationRenderState = {
    insideLocation: false,
    isCurrentLocationValid: false,
    pendingItems: [],
    pendingBoundaries: [],
  },
  onManagedItems: (items: HTMLElement[]) => void = () => {},
): LocationRenderState {
  const walker = root.ownerDocument.createTreeWalker(root, SHOW_ELEMENT_AND_COMMENT);
  const nodes: Node[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current);
    current = walker.nextNode();
  }

  let insideLocation = initialState.insideLocation;
  let openLocationName = initialState.openLocationName;
  let openLocationKey = initialState.openLocationKey;
  let isCurrentLocationValid = initialState.isCurrentLocationValid;
  let pendingItems = [...initialState.pendingItems];
  let pendingBoundaries = [...initialState.pendingBoundaries];
  for (const node of nodes) {
    if (!root.contains(node)) continue;
    if (node.nodeType === 1) {
      const element = node as HTMLElement;
      if (element.tagName === 'LI' && insideLocation) pendingItems.push(element);
      continue;
    }
    if (node.nodeType !== COMMENT_NODE) continue;
    const comment = node as Comment;
    if (root.closest('pre, code') || comment.parentElement?.closest('pre, code')) continue;
    const marker = parseLocationMarker(comment.data);
    if (!marker) continue;

    if (marker.kind === 'start') {
      const isNested = insideLocation;
      insideLocation = true;
      openLocationName = marker.name;
      openLocationKey = marker.key;
      isCurrentLocationValid = !isNested;
      pendingItems = [];
      pendingBoundaries = isNested ? [] : [{ comment, kind: 'start', name: marker.name }];
      continue;
    }

    const matchesOpenLocation = !marker.key || marker.key === openLocationKey;
    if (insideLocation && isCurrentLocationValid && matchesOpenLocation) {
      const name = openLocationName ?? 'Dictate Bar location';
      pendingBoundaries.push({ comment, kind: 'end', name });
      for (const boundary of pendingBoundaries) {
        replaceComment(boundary.comment, createBoundary(root, boundary.kind, boundary.name));
      }
      onManagedItems(pendingItems);
    }
    insideLocation = false;
    openLocationName = undefined;
    openLocationKey = undefined;
    isCurrentLocationValid = false;
    pendingItems = [];
    pendingBoundaries = [];
  }
  return insideLocation
    ? { insideLocation, openLocationName, openLocationKey, isCurrentLocationValid, pendingItems, pendingBoundaries }
    : { insideLocation: false, isCurrentLocationValid: false, pendingItems: [], pendingBoundaries: [] };
}

export function parseLocationMarker(source: string): LocationMarker | null {
  if (!source.startsWith(' dictatebar:') || !source.endsWith(' ')) return null;
  const marker = source.slice(1, -1);
  if (marker === 'dictatebar:end') return { kind: 'end' };

  const legacyStart = /^dictatebar:start id="([A-Za-z0-9][A-Za-z0-9-]*)"$/.exec(marker);
  if (legacyStart) return { kind: 'start', name: displayNameFromID(legacyStart[1]), key: `legacy:${legacyStart[1]}` };

  const legacyEnd = /^dictatebar:end id="([A-Za-z0-9][A-Za-z0-9-]*)"$/.exec(marker);
  if (legacyEnd) return { kind: 'end', key: `legacy:${legacyEnd[1]}` };

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
  return { kind: 'start', name, key: `manual:${name}` };
}

function displayNameFromID(id: string): string {
  return id.split('-').filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

export function createBoundary(root: HTMLElement, kind: 'start' | 'end', name: string): HTMLElement {
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
