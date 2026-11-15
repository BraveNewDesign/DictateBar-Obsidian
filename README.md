# DictateBar for Obsidian

A small companion plugin that brings DictateBar's readable dictations into an Obsidian vault. DictateBar captures and saves your words; Obsidian displays the same Markdown with friendlier dates.

The goal is a reading experience inspired by DictateBar's Dictations Viewer. The essential improvement is a compact, readable timestamp and separator before each entry, for example `10/21/2026 9:31am | Shipped the routing fix`, with presentation adapted to the reader's locale and time zone. Keep the note's Markdown and Obsidian's normal editing and task behavior intact.

**Current status:** The formatting has been verified in Obsidian Reading view on macOS for a note with two ID-based locations and three entries. Live Preview, mobile, and PDF export remain unverified.

## Use with DictateBar

1. Keep a Markdown note inside your Obsidian vault.
2. Select that same file as a Note File in DictateBar using its file picker.
3. Enable this plugin in Obsidian and open the note in Reading view.

Existing DictateBar bullets and checkboxes work without conversion:

```markdown
## Meeting notes

<!-- dictatebar:start id="meeting-notes" -->
- [2026-09-13T19:30:00-04:00] Discuss **next steps** with the team.
- [ ] [2026-09-13T19:32:00-04:00] Send the follow-up.
<!-- dictatebar:end id="meeting-notes" -->
```

The plugin keeps insertion comments in the Markdown source so DictateBar can continue finding its locations. For complete, matching marker pairs, it shows the start as a named heading with a rule extending to the right, and the end as **End of Meeting Notes** centered between two rules, following DictateBar's viewer treatment. For ID-based markers, it turns the stable ID into a readable label; manual-name markers display their exact name. Inside a managed location, valid timestamps appear as compact localized dates and times followed by a separator. Hover over a date to see its original timestamp.

Current ISO timestamps include an offset and display in the device's local time zone. Older `9/13/2026, 7:30 PM` timestamps are interpreted as local time, matching DictateBar's legacy format. Invalid or omitted timestamps remain as written. Entries stay in source order. These formatting rules apply only inside a managed location or a `dictatebar` fenced block; matching timestamps elsewhere in the note are left alone.

## Optional dictation code block

Wrap pasted dictations in a `dictatebar` fence to render Markdown inside that code block:

````markdown
```dictatebar
- [2026-09-13T19:30:00-04:00] Discuss **next steps**.
- [ ] [2026-09-13T19:32:00-04:00] Send the follow-up.
```
````

Checkboxes inside this block are read-only; edit their Markdown source to change them. Normal Markdown tasks outside a fence keep Obsidian's behavior.

For ongoing captures, use the regular Markdown insertion location above. DictateBar protects fenced code from insertion, so don't place its insertion markers inside a fence.

## Install locally

Copy `main.js`, `manifest.json`, and `styles.css` into:

```text
<your-vault>/.obsidian/plugins/dictatebar/
```

Reload Obsidian, then enable **DictateBar** under Settings → Community plugins. For a fresh build, run `npm ci` and `npm run build` before copying the files.

Until the plugin is listed in Obsidian's Community Plugins directory, install it manually using the files above.

## Scope

- Native Markdown rendering, including emphasis, links, bullets, and tasks.
- Clearly labeled start and end boundaries for DictateBar insertion locations.
- Readable timestamps on entries inside managed locations and `dictatebar` fenced blocks, also supporting older dates.
- Optional `dictatebar` code blocks with theme-aware spacing.
- No settings, capture, purchases, filtering, network requests, or vault writes.

Timestamp formatting requires a managed location or the dedicated `dictatebar` fence. The plugin leaves timestamps outside those boundaries, ordinary prose, inline-code examples, and the Markdown source unchanged.

Reading view is the primary supported surface. Code blocks also use Obsidian's standard preview processor. Ordinary list timestamp styling in Live Preview, mobile behavior, and PDF export need verification inside Obsidian.

## Development

Requires a current Node.js version with TypeScript stripping support (Node 22.18+ or newer).

```sh
npm ci
npm test
npm run build
```

`npm run dev` watches and rebuilds `main.js`. Runtime imports are limited to Obsidian's API; build and test dependencies aren't shipped in the plugin bundle.

Validation: TypeScript check, production bundle, and focused parser and rendering tests passed. The installed plugin was also verified in Obsidian Reading view on macOS; the original Markdown remained visible in the editing pane.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
