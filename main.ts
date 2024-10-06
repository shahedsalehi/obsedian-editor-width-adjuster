import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface WidthAdjustSettings {
  defaultWidth?: number;
  minWidth: number;
  maxWidthType: 'screen' | 'custom';
  customMaxWidth?: number;
  scrollIncrement: number;
  showWidthValue: boolean; // New setting to toggle displaying the current width value
}

const DEFAULT_SETTINGS: WidthAdjustSettings = {
  defaultWidth: undefined, // No hardcoded default
  minWidth: 600, // Minimum width default
  maxWidthType: 'screen', // Default max width to screen width
  customMaxWidth: 2000, // Custom max width default
  scrollIncrement: 100, // Default scroll size increment
  showWidthValue: true, // Default is to show the width value beside the slider
};

export default class WidthAdjustPlugin extends Plugin {
  settings: WidthAdjustSettings;
  statusBarEl: HTMLElement;
  currentWidth?: number;
  slider: HTMLInputElement;
  styleEl: HTMLStyleElement;
  widthValueEl: HTMLElement; // New element to show the current width value

  async onload() {
    console.log('Loading Width Adjust Plugin');

    // Load settings (user's previous interaction width if any)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Create a <style> element to hold the dynamic CSS rule
    this.styleEl = document.createElement('style');
    document.head.appendChild(this.styleEl);

    // Add the setting tab for configuration
    this.addSettingTab(new WidthAdjustSettingTab(this.app, this));

    // Create the slider in the status bar
    this.createStatusBarSlider();

    // Apply the saved width if the user has set one
    if (this.settings.defaultWidth !== undefined) {
      this.currentWidth = this.settings.defaultWidth;
      this.updateEditorWidth(this.currentWidth);
      this.slider.value = this.currentWidth.toString(); // Set slider value on load
      this.updateWidthValueDisplay(); // Update width value display on load
    }

    // Add functionality to adjust slider with Ctrl + Scroll
    this.addScrollControl();
  }

  onunload() {
    console.log('Unloading Width Adjust Plugin');
    // Remove the injected <style> element
    if (this.styleEl) {
      this.styleEl.remove();
    }
  }

  // Function to update the editor width using CSS and save the new width
  updateEditorWidth(width: number) {
    // Get the maximum width based on user settings (either screen width or custom value)
    const maxWidth = this.getMaxWidth();

    // Ensure the width is constrained by the user-defined minimum and maximum
    const finalWidth = Math.max(this.settings.minWidth, Math.min(width, maxWidth));

    // Update the CSS rule that controls the width of the .workspace-leaf element
    this.styleEl.innerText = `.workspace-leaf { max-width: ${finalWidth}px; margin: 0 auto; }`;

    this.currentWidth = finalWidth; // Set the current width
    this.saveWidthSetting();        // Save the updated width to settings
    this.updateWidthValueDisplay();  // Update width value display
  }

  // Get the maximum width based on user settings
  getMaxWidth(): number {
    if (this.settings.maxWidthType === 'screen') {
      return window.innerWidth;
    } else {
      return this.settings.customMaxWidth ?? 2000;
    }
  }

  // Create a status bar item with a slider for adjusting editor width
  createStatusBarSlider() {
    // Get the maximum width dynamically based on the settings
    const maxWidth = this.getMaxWidth();

    // Create the status bar element
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.setText('Editor Width:');

    // Create the element to display the current width value (if enabled)
    this.widthValueEl = document.createElement('span');
    this.widthValueEl.style.marginLeft = '10px'; // Add some spacing
    if (this.settings.showWidthValue) {
      this.widthValueEl.innerText = this.currentWidth?.toString() || 'N/A';
      this.statusBarEl.appendChild(this.widthValueEl);
    }

    // Create the slider element
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = this.settings.minWidth.toString();  // Set minimum width from the settings
    this.slider.max = maxWidth.toString();                // Set the max width (screen or custom)
    this.slider.style.marginLeft = '10px';
    this.slider.style.cursor = 'pointer';

    // Set slider value only if user has previously interacted
    if (this.currentWidth !== undefined) {
      this.slider.value = this.currentWidth.toString(); // Set slider value based on last setting
    }

    // Update editor width and CSS when slider value changes
    this.slider.oninput = (e) => {
      const newWidth = (e.target as HTMLInputElement).value;
      this.currentWidth = parseInt(newWidth);
      this.updateEditorWidth(this.currentWidth); // Update and save width on slider change
    };

    // Append the slider to the status bar
    this.statusBarEl.appendChild(this.slider);
  }

  // Add functionality to adjust slider using Ctrl + Mouse Scroll in customizable increments
  addScrollControl() {
    window.addEventListener('wheel', (event) => {
      if (event.ctrlKey) {
        event.preventDefault(); // Prevent default zoom behavior

        // Ensure currentWidth is initialized, fallback to minWidth if undefined
        const currentWidth = this.currentWidth ?? this.settings.minWidth;

        // Determine scroll direction and adjust the slider value by customizable increments
        const stepSize = this.settings.scrollIncrement;
        if (event.deltaY < 0) {
          // Scrolling up (increase width by step size)
          this.currentWidth = Math.min(currentWidth + stepSize, parseInt(this.slider.max));
        } else {
          // Scrolling down (decrease width by step size)
          this.currentWidth = Math.max(currentWidth - stepSize, parseInt(this.slider.min));
        }

        // Update the slider and editor width
        this.slider.value = this.currentWidth.toString();
        this.updateEditorWidth(this.currentWidth);
      }
    });
  }

  // Update the displayed width value based on the current width
  updateWidthValueDisplay() {
    if (this.settings.showWidthValue) {
      this.widthValueEl.innerText = this.currentWidth?.toString() || 'N/A';
    } else {
      this.widthValueEl.innerText = ''; // Hide the value if disabled
    }
  }

  // Save the current width to plugin settings immediately when the width is changed
  async saveWidthSetting() {
    this.settings.defaultWidth = this.currentWidth; // Store the width only after user interaction
    await this.saveData(this.settings); // Save settings to persist the last user-set width
  }

  // Save the plugin settings (called from the settings tab)
  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Settings tab for customizing the plugin's behavior
class WidthAdjustSettingTab extends PluginSettingTab {
  plugin: WidthAdjustPlugin;

  constructor(app: App, plugin: WidthAdjustPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Set/Default Editor Width')
      .setDesc('Set the default editor width in pixels.')
      .addText((text) =>
        text
          .setPlaceholder('Enter width in pixels')
          .setValue(this.plugin.settings.defaultWidth?.toString() || '')
          .onChange(async (value) => {
            this.plugin.settings.defaultWidth = parseInt(value);
            await this.plugin.saveSettings();
            this.plugin.updateEditorWidth(this.plugin.settings.defaultWidth);
          })
      );

    new Setting(containerEl)
      .setName('Minimum Width')
      .setDesc('Set the minimum width for the editor in pixels.')
      .addText((text) =>
        text
          .setPlaceholder('Enter minimum width in pixels')
          .setValue(this.plugin.settings.minWidth.toString())
          .onChange(async (value) => {
            this.plugin.settings.minWidth = parseInt(value);
            await this.plugin.saveSettings();

            // Dynamically update slider's minimum value
            this.plugin.slider.min = this.plugin.settings.minWidth.toString();

            this.plugin.updateEditorWidth(this.plugin.currentWidth ?? this.plugin.settings.minWidth);
          })
      );

    const maxWidthDropdown = new Setting(containerEl)
      .setName('Maximum Width')
      .setDesc('Choose between screen width or a custom maximum width.')
      .addDropdown(dropdown =>
        dropdown
          .addOption('screen', 'Screen Width')
          .addOption('custom', 'Custom Value')
          .setValue(this.plugin.settings.maxWidthType)
          .onChange(async (value) => {
            this.plugin.settings.maxWidthType = value as 'screen' | 'custom';
            await this.plugin.saveSettings();

            // Dynamically update slider's max value
            const maxWidth = this.plugin.getMaxWidth();
            this.plugin.slider.max = maxWidth.toString();

            this.plugin.updateEditorWidth(this.plugin.currentWidth ?? this.plugin.settings.minWidth);
            // Enable or disable the custom max width field based on the selection
            if (value === 'custom') {
              customMaxWidthSetting.settingEl.style.display = 'block';
            } else {
              customMaxWidthSetting.settingEl.style.display = 'none';
            }
          })
      );

    const customMaxWidthSetting = new Setting(containerEl)
      .setName('Custom Maximum Width')
      .setDesc('Set a custom maximum width (if chosen above).')
      .addText((text) =>
        text
          .setPlaceholder('Enter maximum width in pixels')
          .setValue(this.plugin.settings.customMaxWidth?.toString() || '')
          .onChange(async (value) => {
            this.plugin.settings.customMaxWidth = parseInt(value);
            await this.plugin.saveSettings();

            // Dynamically update slider's max value
            const maxWidth = this.plugin.getMaxWidth();
            this.plugin.slider.max = maxWidth.toString();

            this.plugin.updateEditorWidth(this.plugin.currentWidth ?? this.plugin.settings.minWidth);
          })
      );

    // Hide the custom max width field if screen width is selected
    if (this.plugin.settings.maxWidthType === 'screen') {
      customMaxWidthSetting.settingEl.style.display = 'none';
    }

    new Setting(containerEl)
      .setName('Scroll Size Increment')
      .setDesc('Set the increment size (in pixels) for Ctrl + Scroll.')
      .addText((text) =>
        text
          .setPlaceholder('Enter scroll increment in pixels')
          .setValue(this.plugin.settings.scrollIncrement.toString())
          .onChange(async (value) => {
            this.plugin.settings.scrollIncrement = parseInt(value);
            await this.plugin.saveSettings();
          })
      );

    // Toggle for showing or hiding the current width value beside the slider
    new Setting(containerEl)
      .setName('Show Width Value')
      .setDesc('Toggle showing the current width value beside the slider.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showWidthValue)
          .onChange(async (value) => {
            this.plugin.settings.showWidthValue = value;
            await this.plugin.saveSettings();

            // Show or hide the width value display
            if (value) {
              this.plugin.widthValueEl.innerText = this.plugin.currentWidth?.toString() || 'N/A';
              this.plugin.widthValueEl.style.display = 'inline';
            } else {
              this.plugin.widthValueEl.style.display = 'none';
            }
          })
      );
  }
}
