import { MarkdownRenderChild, MarkdownRenderer, Plugin } from 'obsidian';
import { decorateTimestamps } from './render';

export default class DictateBarPlugin extends Plugin {
  private readonly openLocationNamesByDocument = new Map<string, string>();

  onload(): void {
    this.registerMarkdownCodeBlockProcessor('dictatebar', async (source, element, context) => {
      const child = new MarkdownRenderChild(element);
      context.addChild(child);
      element.addClass('dictatebar-block');
      // Native rendering preserves links, emphasis, lists, and other Markdown.
      await MarkdownRenderer.render(this.app, source, element, context.sourcePath, child);
      decorateTimestamps(element);
      // Rendered checkboxes are a read-only projection of the fenced source.
      element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
        input.disabled = true;
        input.setAttribute('aria-label', input.checked ? 'Completed dictation' : 'Incomplete dictation');
      });
    });
    this.registerMarkdownPostProcessor((element, context) => {
      const openLocationName = this.openLocationNamesByDocument.get(context.docId);
      const nextOpenLocationName = decorateTimestamps(element, openLocationName);
      if (nextOpenLocationName) this.openLocationNamesByDocument.set(context.docId, nextOpenLocationName);
      else this.openLocationNamesByDocument.delete(context.docId);
    });
  }
}
