import { MarkdownRenderChild, MarkdownRenderer, MarkdownView, Plugin } from 'obsidian';
import { decorateTimestamps } from './render';
import { decorateSourceSection } from './sections';
import { DEFAULT_SETTINGS, normalizeSettings, type DictateBarSettings } from './preferences';
import { DictateBarSettingTab } from './settings';

export default class DictateBarPlugin extends Plugin {
  settings: DictateBarSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.addSettingTab(new DictateBarSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor('dictatebar', async (source, element, context) => {
      const child = new MarkdownRenderChild(element);
      context.addChild(child);
      element.addClass('dictatebar-block');
      // Native rendering preserves links, emphasis, lists, and other Markdown.
      await MarkdownRenderer.render(this.app, source, element, context.sourcePath, child);
      decorateTimestamps(element, {
        insideLocation: false,
        isCurrentLocationValid: false,
        pendingItems: [],
        pendingBoundaries: [],
      }, true, this.settings);
      // Rendered checkboxes are a read-only projection of the fenced source.
      element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
        input.disabled = true;
        input.setAttribute('aria-label', input.checked ? 'Completed dictation' : 'Incomplete dictation');
      });
    });
    this.registerMarkdownPostProcessor((element, context) => {
      const section = context.getSectionInfo(element);
      if (!section) return;
      decorateSourceSection(element, section.text, section.lineStart, section.lineEnd, this.settings);
    });
  }

  async updateSettings(changes: Partial<DictateBarSettings>): Promise<void> {
    this.settings = normalizeSettings({ ...this.settings, ...changes });
    await this.saveData(this.settings);
    for (const leaf of this.app.workspace.getLeavesOfType('markdown')) {
      if (leaf.view instanceof MarkdownView) leaf.view.previewMode.rerender(true);
    }
  }
}
