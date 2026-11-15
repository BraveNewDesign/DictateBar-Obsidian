import { MarkdownRenderChild, MarkdownRenderer, Plugin } from 'obsidian';
import { decorateTimestamps } from './render';
import type { LocationRenderState } from './locations';

export default class DictateBarPlugin extends Plugin {
  private readonly locationStatesByDocument = new Map<string, LocationRenderState>();

  onload(): void {
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
      }, true);
      // Rendered checkboxes are a read-only projection of the fenced source.
      element.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(input => {
        input.disabled = true;
        input.setAttribute('aria-label', input.checked ? 'Completed dictation' : 'Incomplete dictation');
      });
    });
    this.registerMarkdownPostProcessor((element, context) => {
      const locationState = this.locationStatesByDocument.get(context.docId) ?? {
        insideLocation: false,
        isCurrentLocationValid: false,
        pendingItems: [],
        pendingBoundaries: [],
      };
      const nextLocationState = decorateTimestamps(element, locationState);
      if (nextLocationState.insideLocation) this.locationStatesByDocument.set(context.docId, nextLocationState);
      else this.locationStatesByDocument.delete(context.docId);
    });
  }
}
