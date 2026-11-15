import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadingTimestamp, parseTimestamp, prettyTimestamp } from '../src/timestamps.ts';
import { decorateTimestamps } from '../src/render.ts';
import { JSDOM } from 'jsdom';

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
  assert.ok(prettyTimestamp(new Date('2026-09-13T12:00:00Z'), 'en-US').includes('Sep 13, 2026'));
  const text = '[2026-09-13T12:00:00Z] **Hello**';
  assert.equal(text.slice(leadingTimestamp(text)!.length), ' **Hello**');
});
test('rendering preserves links, tasks, source order, and is idempotent', () => {
  const dom = new JSDOM(`<ul><li>[2026-09-13T12:00:00Z] <strong>Hello</strong> <a href="note">note</a></li><li><p><input type="checkbox" checked> [9/13/2026, 1:00 PM] Done</p></li><li>Untimestamped</li><li><code>[2026-09-13T12:00:00Z]</code> example</li></ul>`);
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
  const dom = new JSDOM('<div id="note"></div>');
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
    const dom = new JSDOM('<div id="note"></div>');
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
  const dom = new JSDOM('<div id="block"><ul><li>[2026-09-13T12:00:00Z] block entry</li></ul></div>');
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
  const dom = new JSDOM('<div id="note"></div>');
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
  const dom = new JSDOM('<div id="note"></div>');
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
  const dom = new JSDOM('<div id="start"></div><div id="end"></div>');
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
  const dom = new JSDOM('<div id="start"></div><div id="content"></div><div id="end"></div>');
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
  const dom = new JSDOM('<div id="note"><pre></pre></div>');
  const root = dom.window.document.querySelector<HTMLElement>('#note')!;
  root.querySelector('pre')!.append(dom.window.document.createComment(' dictatebar:start id="example" '));

  decorateTimestamps(root);

  assert.equal(root.querySelectorAll('.dictatebar-location-boundary').length, 0);
  assert.equal(root.querySelector('pre')?.childNodes.length, 1);
});
