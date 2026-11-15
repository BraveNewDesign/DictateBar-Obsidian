import { App, PluginSettingTab, Setting } from 'obsidian';
import type DictateBarPlugin from './main';
import { DEFAULT_SETTINGS, normalizeSettings } from './preferences';

export class DictateBarSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly dictatebar: DictateBarPlugin) {
    super(app, dictatebar);
  }

  display(): void {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName('Show start separator')
      .setDesc('Show the start of each Dictate Bar insertion location in Reading view.')
      .addToggle(toggle => toggle.setValue(this.dictatebar.settings.showStartSeparator).onChange(async value => {
        await this.dictatebar.updateSettings({ showStartSeparator: value });
      }));
    new Setting(this.containerEl)
      .setName('Show end separator')
      .setDesc('Show the end of each Dictate Bar insertion location in Reading view.')
      .addToggle(toggle => toggle.setValue(this.dictatebar.settings.showEndSeparator).onChange(async value => {
        await this.dictatebar.updateSettings({ showEndSeparator: value });
      }));
    new Setting(this.containerEl)
      .setName('Date format')
      .setDesc('Choose the order used to display dates. Timestamps remain in your local time zone.')
      .addDropdown(dropdown => dropdown.addOptions({
        locale: 'System locale',
        'month-first': 'Month / Day / Year (10/21/2026)',
        'day-first': 'Day / Month / Year (21/10/2026)',
        iso: 'Year-Month-Day (2026-10-21)',
      }).setValue(this.dictatebar.settings.dateFormat).onChange(async value => {
        await this.dictatebar.updateSettings({ dateFormat: normalizeSettings({ dateFormat: value }).dateFormat });
      }));
    new Setting(this.containerEl)
      .setName('Time format')
      .setDesc('Choose how to display the time of day.')
      .addDropdown(dropdown => dropdown.addOptions({
        locale: 'System locale',
        '12-hour': '12-hour (9:31 AM)',
        '24-hour': '24-hour (09:31)',
      }).setValue(this.dictatebar.settings.timeFormat).onChange(async value => {
        await this.dictatebar.updateSettings({ timeFormat: normalizeSettings({ timeFormat: value }).timeFormat });
      }));
    new Setting(this.containerEl)
      .setName('Reset display settings')
      .setDesc('Restore both separators and the system date and time formats.')
      .addButton(button => button.setButtonText('Reset to defaults').onClick(async () => {
        await this.dictatebar.updateSettings({ ...DEFAULT_SETTINGS });
        this.display();
      }));

    new Setting(this.containerEl).setName('About and support').setHeading();
    new Setting(this.containerEl)
      .setName('Dictate Bar for Obsidian')
      .setDesc(`Version ${this.dictatebar.manifest.version} · Read Dictate Bar notes in Obsidian.`);
    this.addLink('Plugin guide', 'Installation, setup, and display options.', 'Read guide', 'https://github.com/BraveNewDesign/DictateBar-Obsidian#readme');
    this.addLink('Report an issue', 'Report a plugin bug or suggest an improvement on GitHub.', 'Open GitHub', 'https://github.com/BraveNewDesign/DictateBar-Obsidian/issues');
    this.addLink('Dictate Bar support', 'Find app support and contact information.', 'Open support', 'https://www.bravenewdesign.com/dictatebar/support');
    this.addLink('Email support', 'Ask for help with the Obsidian plugin.', 'Email support', 'mailto:support@bravenewdesign.com?subject=Dictate%20Bar%20Plugin');
    this.addLink('Get Dictate Bar', 'Learn about the Mac app.', 'Visit website', 'https://www.bravenewdesign.com/dictatebar');
  }

  private addLink(name: string, description: string, label: string, href: string): void {
    const setting = new Setting(this.containerEl).setName(name).setDesc(description);
    setting.controlEl.createEl('a', { text: label, href, cls: 'external-link' });
  }
}
