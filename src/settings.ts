import { App, PluginSettingTab, type SettingDefinitionItem, type SettingDefinition } from 'obsidian';
import type DictateBarPlugin from './main';
import { DEFAULT_SETTINGS, normalizeSettings, type DictateBarSettings } from './preferences';

export class DictateBarSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly dictatebar: DictateBarPlugin) {
    super(app, dictatebar);
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (!(key in DEFAULT_SETTINGS)) return;
    const changes = { [key]: value };
    const normalized = normalizeSettings({ ...this.dictatebar.settings, ...changes });
    await this.dictatebar.updateSettings({ [key]: normalized[key as keyof DictateBarSettings] });
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const link = (name: string, desc: string, label: string, href: string): SettingDefinition => ({
      name, desc, render: setting => { setting.controlEl.createEl('a', { text: label, href, cls: 'external-link' }); },
    });
    return [
      {
        name: 'Show start separator',
        desc: 'Show the start of each Dictate Bar insertion location in Reading view.',
        control: { type: 'toggle', key: 'showStartSeparator', defaultValue: true },
      },
      {
        name: 'Show end separator',
        desc: 'Show the end of each Dictate Bar insertion location in Reading view.',
        control: { type: 'toggle', key: 'showEndSeparator', defaultValue: true },
      },
      {
        name: 'Date format',
        desc: 'Choose the order used to display dates. Timestamps remain in your local time zone.',
        control: { type: 'dropdown', key: 'dateFormat', defaultValue: 'locale', options: {
          locale: 'System locale', 'month-first': 'Month / Day / Year (10/21/2026)',
          'day-first': 'Day / Month / Year (21/10/2026)', iso: 'Year-Month-Day (2026-10-21)',
        } },
      },
      {
        name: 'Time format', desc: 'Choose how to display the time of day.',
        control: { type: 'dropdown', key: 'timeFormat', defaultValue: 'locale', options: {
          locale: 'System locale', '12-hour': '12-hour (9:31 AM)', '24-hour': '24-hour (09:31)',
        } },
      },
      {
        name: 'Reset display settings', desc: 'Restore both separators and the system date and time formats.',
        render: setting => { setting.addButton(button => button.setButtonText('Reset to defaults').onClick(async () => {
          await this.dictatebar.updateSettings({ ...DEFAULT_SETTINGS });
          this.update();
        })); },
      },
      { type: 'group', heading: 'About and support', items: [
        { name: 'Dictate Bar for Obsidian', desc: `Version ${this.dictatebar.manifest.version} · Read Dictate Bar notes in Obsidian.` },
        link('Plugin guide', 'Installation, setup, and display options.', 'Read guide', 'https://github.com/BraveNewDesign/DictateBar-Obsidian#readme'),
        link('Report an issue', 'Report a plugin bug or suggest an improvement on GitHub.', 'Open GitHub', 'https://github.com/BraveNewDesign/DictateBar-Obsidian/issues'),
        link('Dictate Bar support', 'Find app support and contact information.', 'Open support', 'https://www.bravenewdesign.com/dictatebar/support'),
        link('Email support', 'Ask for help with the Obsidian plugin.', 'Email support', 'mailto:support@bravenewdesign.com?subject=Dictate%20Bar%20Plugin'),
        link('Get Dictate Bar', 'Learn about the Mac app.', 'Visit website', 'https://www.bravenewdesign.com/dictatebar'),
      ] },
    ];
  }
}
