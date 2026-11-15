import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadingTimestamp, parseTimestamp, prettyTimestamp } from '../src/timestamps.ts';
import { decorateTimestamps } from '../src/render.ts';
import { JSDOM } from 'jsdom';

function makeDOM(html: string): JSDOM {
  const dom = new JSDOM(html);
  const prototype = dom.window.HTMLElement.prototype as any;
  prototype.createEl = function(tag: string) { const element = this.ownerDocument.createElement(tag); this.append(element); return element; };
  prototype.detach = function() { this.remove(); };
  return dom;
}

import { DEFAULT_SETTINGS, normalizeSettings } from '../src/preferences.ts';
import { decorateSourceSection, locationsInSource } from '../src/sections.ts';

test('ISO timestamps preserve the recorded instant across offsets', () => {
  assert.equal(parseTimestamp('2026-09-13T19:30:00-04:00')?.toISOString(), '2026-09-13T23:30:00.000Z');
  assert.equal(parseTimestamp('2026-09-13T23:30:00Z')?.toISOString(), '2026-09-13T23:30:00.000Z');
});
test('legacy dates handle noon and midnight', () => {
  assert.equal(parseTimestamp('9/13/2026, 12:30 AM')?.getHours(), 0);
  assert.equal(parseTimestamp('9/13/2026, 12:30 PM')?.getHours(), 12);
});
test('invalid dates and ordinary bracketed text stay unchanged', () => {
  for (const raw of ['2026-02-30T12:00:00Z', '2026-09-13T25:00:00Z', '2/29/2025, 1:00 PM', 'meeting', '2026-09-13']) {
    assert.equal(parseTimestamp(raw), null, raw);
  }
  assert.equal(leadingTimestamp('[meeting] notes'), null);
  assert.equal(leadingTimestamp('Text [2026-09-13T12:00:00Z]'), null);
});
test('formatted dates are readable and leading matches leave the body intact', () => {
  assert.ok(prettyTimestamp(new Date('2026-09-13T12:00:00Z'), 'en-US').includes('9/13/2026'));
  const text = '[2026-09-13T12:00:00Z] **Hello**';
  assert.equal(text.slice(leadingTimestamp(text)!.length), ' **Hello**');
});
test('rendering preserves links, tasks, source order, and is idempotent', () => {
  const dom = makeDOM(`<ul><li>[2026-09-13T12:00:00Z] <strong>Hello</strong> <a href="note">note</a></li><li><p><input type="checkbox" checked> [9/13/2026, 1:00 PM] Done</p></li><li>Untimestamped</li><li><code>[2026-09-13T12:00:00Z]</code> example</li></ul>`);
  Object.assign(globalThis, { Node: dom.window.Node });
  const root = dom.window.document.body;
  root.insertBefore(dom.window.document.createComment(' dictatebar:start id="test" '), root.firstChild);
  root.append(dom.window.document.createComment(' dictatebar:end id="test" '));
  decorateTimestamps(root);
  const first = root.innerHTML;
  decorateTimestamps(root);
  assert.equal(root.innerHTML, first);
  assert.equal(root.querySelectorAll('time').length, 2);
  assert.equal(root.querySelector('strong')?.textContent, 'Hello');
  assert.equal(root.querySelector('a')?.getAttribute('href'), 'note');
  assert.equal(root.querySelector('input')?.checked, true);
  assert.equal(root.querySelectorAll('li')[2].textContent, 'Untimestamped');
  assert.equal(root.querySelector('code')?.textContent, '[2026-09-13T12:00:00Z]');
});

test('timestamps outside managed locations are left unchanged', () => {
  const dom = makeDOM('<div id="note"></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#note')!;
  const outsideBefore = dom.window.document.createElement('li');
  outsideBefore.textContent = '[2026-09-13T12:00:00Z] outside before';
  root.append(outsideBefore);
  root.append(dom.window.document.createComment(' dictatebar:start id="managed" '));
  const inside = dom.window.document.createElement('li');
  inside.textContent = '[2026-09-13T12:01:00Z] inside';
  root.append(inside);
  root.append(dom.window.document.createComment(' dictatebar:end id="managed" '));
  const outsideAfter = dom.window.document.createElement('li');
  outsideAfter.textContent = '[2026-09-13T12:02:00Z] outside after';
  root.append(outsideAfter);

  decorateTimestamps(root);

  assert.equal(root.querySelectorAll('time').length, 1);
  assert.equal(outsideBefore.querySelector('time'), null);
  assert.equal(inside.querySelector('time')?.getAttribute('datetime'), '2026-09-13T12:01:00.000Z');
  assert.equal(outsideAfter.querySelector('time'), null);
});

test('unclosed and mismatched markers do not change content inside an invalid location', () => {
  for (const ending of [null, ' dictatebar:end id="other" ']) {
    const dom = makeDOM('<div id="note"></div>');
    const root = dom.window.document.querySelector<HTMLElement>('#note')!;
    root.append(dom.window.document.createComment(' dictatebar:start id="managed" '));
    const entry = dom.window.document.createElement('li');
    entry.textContent = '[2026-09-13T12:01:00Z] invalid region';
    root.append(entry);
    if (ending) root.append(dom.window.document.createComment(ending));

    decorateTimestamps(root);

    assert.equal(root.querySelector('time'), null);
    assert.equal(root.querySelector('.dictatebar-location-boundary'), null);
    assert.match(entry.textContent ?? '', /^\[2026-09-13T12:01:00Z\]/);
  }
});

test('timestamps in a DictateBar code block are formatted across the block', () => {
  const dom = makeDOM('<div id="block"><ul><li>[2026-09-13T12:00:00Z] block entry</li></ul></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#block')!;

  decorateTimestamps(root, {
    insideLocation: false,
    isCurrentLocationValid: false,
    pendingItems: [],
    pendingBoundaries: [],
  }, true);

  assert.equal(root.querySelectorAll('time').length, 1);
});

test('rendering labels DictateBar location boundaries without changing source comments', () => {
  const dom = makeDOM('<div id="note"></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#note')!;
  root.append(dom.window.document.createComment(' dictatebar:start id="meeting-notes" '));
  const paragraph = dom.window.document.createElement('p');
  paragraph.textContent = 'Dictation';
  root.append(paragraph);
  root.append(dom.window.document.createComment(' dictatebar:end id="meeting-notes" '));

  decorateTimestamps(root);

  assert.deepEqual(Array.from(root.querySelectorAll('[role="separator"]')).map(element => element.getAttribute('aria-label')), [
    'Start of Meeting Notes',
    'End of Meeting Notes',
  ]);
  assert.equal(root.textContent, 'Start of Meeting NotesDictationEnd of Meeting Notes');
  assert.equal(root.querySelectorAll('p').length, 1);
  assert.equal(root.querySelectorAll('.dictatebar-location-boundary').length, 2);
});

test('manual-name markers use the exact name and unnamed end marker closes the visible location', () => {
  const dom = makeDOM('<div id="note"></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#note')!;
  root.append(dom.window.document.createComment(' dictatebar:start Weekly Review '));
  root.append(dom.window.document.createComment(' dictatebar:end '));

  decorateTimestamps(root);

  assert.deepEqual(Array.from(root.querySelectorAll('[role="separator"]')).map(element => element.getAttribute('aria-label')), [
    'Start of Weekly Review',
    'End of Weekly Review',
  ]);
});

test('manual-name labels carry across separate rendered sections', () => {
  const dom = makeDOM('<div id="start"></div><div id="end"></div>');
  const start = dom.window.document.querySelector<HTMLElement>('#start')!;
  const end = dom.window.document.querySelector<HTMLElement>('#end')!;
  start.append(dom.window.document.createComment(' dictatebar:start Weekly Review '));
  end.append(dom.window.document.createComment(' dictatebar:end '));

  const openLocationState = decorateTimestamps(start);
  decorateTimestamps(end, openLocationState);

  assert.equal(start.querySelector('[role="separator"]')?.getAttribute('aria-label'), 'Start of Weekly Review');
  assert.equal(end.querySelector('[role="separator"]')?.getAttribute('aria-label'), 'End of Weekly Review');
});

test('timestamp entries carry across rendered sections until the matching end marker', () => {
  const dom = makeDOM('<div id="start"></div><div id="content"></div><div id="end"></div>');
  const start = dom.window.document.querySelector<HTMLElement>('#start')!;
  const content = dom.window.document.querySelector<HTMLElement>('#content')!;
  const end = dom.window.document.querySelector<HTMLElement>('#end')!;
  start.append(dom.window.document.createComment(' dictatebar:start id="weekly-review" '));
  const entry = dom.window.document.createElement('li');
  entry.textContent = '[2026-09-13T12:01:00Z] managed entry';
  content.append(entry);
  end.append(dom.window.document.createComment(' dictatebar:end id="weekly-review" '));

  const afterStart = decorateTimestamps(start);
  const beforeEnd = decorateTimestamps(content, afterStart);
  assert.equal(entry.querySelector('time'), null);
  decorateTimestamps(end, beforeEnd);

  assert.equal(entry.querySelector('time')?.getAttribute('datetime'), '2026-09-13T12:01:00.000Z');
  assert.equal(start.querySelector('.dictatebar-location-boundary')?.getAttribute('aria-label'), 'Start of Weekly Review');
  assert.equal(end.querySelector('.dictatebar-location-boundary')?.getAttribute('aria-label'), 'End of Weekly Review');
});

test('marker-like comments in code blocks remain untouched', () => {
  const dom = makeDOM('<div id="note"><pre></pre></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#note')!;
  root.querySelector('pre')!.append(dom.window.document.createComment(' dictatebar:start id="example" '));

  decorateTimestamps(root);

  assert.equal(root.querySelectorAll('.dictatebar-location-boundary').length, 0);
  assert.equal(root.querySelector('pre')?.childNodes.length, 1);
});


test('source sections decorate Obsidian list bullets and preserve entries outside locations', () => {
  const source = ['<!-- dictatebar:start id="work" -->', '- [2026-10-21T09:31:12-07:00] **Hello**', '<!-- dictatebar:end id="work" -->', '- [2026-10-21T09:31:12-07:00] outside'].join('\n');
  const dom = makeDOM('<div><ul><li data-line="0"><span class="list-bullet"></span>[2026-10-21T09:31:12-07:00] <strong>Hello</strong></li></ul></div>');
  const section = dom.window.document.querySelector('div')!;
  decorateSourceSection(section, source, 1, 1);
  decorateSourceSection(section, source, 1, 1);
  assert.equal(section.querySelectorAll('time').length, 1);
  assert.match(section.textContent!, / Hello/);
  assert.doesNotMatch(section.textContent!, /\|/);
  assert.equal(section.querySelector('time')?.title, '2026-10-21T09:31:12-07:00');
  assert.equal(section.querySelector('strong')?.textContent, 'Hello');
  const outside = section.cloneNode(true) as HTMLElement;
  outside.querySelector('li')!.innerHTML = '<span class="list-bullet"></span>[2026-10-21T09:31:12-07:00] outside';
  decorateSourceSection(outside, source, 3, 3);
  assert.equal(outside.querySelector('time'), null);
});

test('source validation ignores fenced examples and rejects mismatched or duplicate markers', () => {
  const valid = '<!-- dictatebar:start Work -->\n- entry\n<!-- dictatebar:end -->';
  assert.equal(locationsInSource('```\n<!-- dictatebar:start ignored -->\n```\n' + valid).length, 1);
  assert.equal(locationsInSource(valid + '\n' + valid).length, 0);
  assert.equal(locationsInSource('<!-- dictatebar:start id="a" -->\n<!-- dictatebar:end id="b" -->').length, 0);
});


test('settings validate stored preferences and retain existing defaults', () => {
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ showStartSeparator: false, showEndSeparator: 'no', dateFormat: 'invalid', timeFormat: '24-hour' }), {
    ...DEFAULT_SETTINGS, showStartSeparator: false, timeFormat: '24-hour',
  });
});

test('date and time format choices use the local calendar and support midnight', () => {
  const date = new Date(2026, 9, 21, 0, 31);
  const settings = { ...DEFAULT_SETTINGS, timeFormat: '24-hour' as const };
  assert.equal(prettyTimestamp(date, 'en-US', { ...settings, dateFormat: 'month-first' }), '10/21/2026 00:31');
  assert.equal(prettyTimestamp(date, 'en-US', { ...settings, dateFormat: 'day-first' }), '21/10/2026 00:31');
  assert.equal(prettyTimestamp(date, 'en-US', { ...settings, dateFormat: 'iso' }), '2026-10-21 00:31');
  assert.equal(prettyTimestamp(date, 'en-US', { ...settings, dateFormat: 'iso', timeFormat: '12-hour' }), '2026-10-21 12:31 AM');
});

test('separator settings independently control boundaries while entries stay formatted', () => {
  const source = '<!-- dictatebar:start Work -->\n- [2026-10-21T09:31:12-07:00] text\n<!-- dictatebar:end -->';
  const dom = makeDOM('<div id="start"></div><div id="entry"><ul><li data-line="0"><span class="list-bullet"></span>[2026-10-21T09:31:12-07:00] text</li></ul></div><div id="end"></div>');
  const start = dom.window.document.querySelector<HTMLElement>('#start')!;
  const entry = dom.window.document.querySelector<HTMLElement>('#entry')!;
  const end = dom.window.document.querySelector<HTMLElement>('#end')!;
  const settings = { ...DEFAULT_SETTINGS, showStartSeparator: false, showEndSeparator: true, dateFormat: 'iso' as const, timeFormat: '24-hour' as const };
  decorateSourceSection(start, source, 0, 0, settings);
  decorateSourceSection(entry, source, 1, 1, settings);
  decorateSourceSection(end, source, 2, 2, settings);
  assert.equal(start.querySelector('[role="separator"]'), null);
  assert.equal(end.querySelector('[role="separator"]')?.getAttribute('aria-label'), 'End of Work');
  assert.match(entry.querySelector('time')!.textContent!, /^2026-10-21 \d{2}:\d{2}$/);
  assert.equal(entry.querySelector('time')!.title, '2026-10-21T09:31:12-07:00');
});

test('fenced block entries use the selected timestamp formats', () => {
  const dom = makeDOM('<div><ul><li>[2026-10-21T09:31:12-07:00] entry</li></ul></div>');
  const root = dom.window.document.querySelector<HTMLElement>('div')!;
  decorateTimestamps(root, undefined, true, { ...DEFAULT_SETTINGS, dateFormat: 'iso', timeFormat: '24-hour' });
  assert.match(root.querySelector('time')!.textContent!, /^2026-10-21 \d{2}:\d{2}$/);
});
