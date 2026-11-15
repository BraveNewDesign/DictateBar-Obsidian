import { DEFAULT_SETTINGS, type DictateBarSettings } from './preferences.ts';
import { createBoundary, parseLocationMarker } from './locations.ts';
import { decorateTimestamp } from './render.ts';

type Region = { start: number; end: number; name: string };

/** Validate marker pairs against source, including markers that Obsidian removes from HTML. */
export function locationsInSource(source: string): Region[] {
  const regions: Region[] = [];
  const seen = new Set<string>();
  let open: { start: number; name: string; key: string } | undefined;
  let fence: { char: string; length: number } | undefined;
  const lines = source.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fenceMatch) {
      const run = fenceMatch[1];
      if (!fence) fence = { char: run[0], length: run.length };
      else if (run[0] === fence.char && run.length >= fence.length && !fenceMatch[2].trim()) fence = undefined;
      continue;
    }
    if (fence) continue;
    const match = /^\s*<!--( dictatebar:.* )-->\s*$/.exec(line);
    if (!match) continue;
    const marker = parseLocationMarker(match[1]);
    if (!marker) continue;
    if (marker.kind === 'start') {
      if (open || seen.has(marker.key)) return [];
      seen.add(marker.key);
      open = { start: index, name: marker.name, key: marker.key };
    } else {
      if (!open || (marker.key && marker.key !== open.key)) return [];
      regions.push({ start: open.start, end: index, name: open.name });
      open = undefined;
    }
  }
  return open ? [] : regions;
}

export function decorateSourceSection(element: HTMLElement, source: string, lineStart: number, lineEnd: number, settings: DictateBarSettings = DEFAULT_SETTINGS): void {
  const regions = locationsInSource(source);
  for (const region of regions) {
    if (lineStart === lineEnd && (lineStart === region.start || lineStart === region.end)) {
      const kind = lineStart === region.start ? 'start' : 'end';
      if ((kind === 'start' ? settings.showStartSeparator : settings.showEndSeparator) && !element.querySelector('.dictatebar-location-boundary')) element.append(createBoundary(element, kind, region.name));
    }
  }
  element.querySelectorAll<HTMLElement>('li[data-line]').forEach(item => {
    const offset = Number(item.getAttribute('data-line'));
    if (!Number.isInteger(offset) || offset < 0) return;
    const line = lineStart + offset;
    if (line <= lineEnd && regions.some(region => line > region.start && line < region.end)) decorateTimestamp(item, settings);
  });
}
