import * as vscode from "vscode";
import { SaferVersionCodeLensProvider } from "../providers/code-lens-provider";
import { IPackageManagerService } from "../services/package-managers/package-manager.interface";
import { COMMANDS, CONFIG_SECTION, CONFIG_KEYS } from "../constants";

/**
 * Commands related to configuration management
 */
export class ConfigCommands {
  constructor(
    private codeLensProvider: SaferVersionCodeLensProvider,
    private getPackageManagerService: () => IPackageManagerService | null,
    private statusBarItem: vscode.StatusBarItem
  ) {}

  /**
   * Register all configuration commands
   */
  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        COMMANDS.SHOW_CONFIG,
        this.showConfig.bind(this)
      ),
      vscode.commands.registerCommand(
        COMMANDS.TOGGLE_ENABLED,
        this.toggleEnabled.bind(this)
      ),
      vscode.commands.registerCommand(
        COMMANDS.TOGGLE_PRERELEASE,
        this.togglePrerelease.bind(this)
      )
    );
  }

  private async showConfig(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showInformationMessage("No workspace folder open");
      return;
    }

    const vsConfig = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const enabled = vsConfig.get<boolean>(CONFIG_KEYS.ENABLED, true);
    const showPrerelease = vsConfig.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );
    const packageManagerService = this.getPackageManagerService();

    if (!packageManagerService) {
      vscode.window.showInformationMessage(
        `Lens: ${enabled ? "Enabled" : "Disabled"} | Pre-releases: ${showPrerelease ? "Shown" : "Hidden"} | No package manager detected`
      );
      return;
    }

    const pmInfo = packageManagerService.getInfo();
    const pmConfig = await packageManagerService.getConfig(
      workspaceFolders[0].uri
    );
    const minimumReleaseAge = pmConfig.minimumReleaseAge;

    if (minimumReleaseAge === 0) {
      vscode.window.showInformationMessage(
        `Lens: ${enabled ? "Enabled" : "Disabled"} | Pre-releases: ${showPrerelease ? "Shown" : "Hidden"} | Package Manager: ${pmInfo.fullSpec} | No time quarantine configured`
      );
    } else {
      const days = Math.floor(minimumReleaseAge / (60 * 24));
      const hours = Math.floor((minimumReleaseAge % (60 * 24)) / 60);
      vscode.window.showInformationMessage(
        `Lens: ${enabled ? "Enabled" : "Disabled"} | Pre-releases: ${showPrerelease ? "Shown" : "Hidden"} | Package Manager: ${pmInfo.fullSpec} | Quarantine: ${minimumReleaseAge} min (${days}d ${hours}h)`
      );
    }
  }

  private async toggleEnabled(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentValue = config.get<boolean>(CONFIG_KEYS.ENABLED, true);
    const newValue = !currentValue;

    await config.update(
      CONFIG_KEYS.ENABLED,
      newValue,
      vscode.ConfigurationTarget.Global
    );
    
    this.codeLensProvider.refresh();
    this.updateStatusBar(newValue);
    
    vscode.window.showInformationMessage(
      `Safer Version Lens ${newValue ? "enabled" : "disabled"}`
    );
  }

  public updateStatusBar(enabled: boolean): void {
    if (enabled) {
      this.statusBarItem.text = "$(eye) Safer Version Lens";
      this.statusBarItem.tooltip = "Safer Version Lens is enabled. Click to disable.";
    } else {
      this.statusBarItem.text = "$(eye-closed) Safer Version Lens";
      this.statusBarItem.tooltip = "Safer Version Lens is disabled. Click to enable.";
    }
  }

  private async togglePrerelease(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentValue = config.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );
    await config.update(
      CONFIG_KEYS.SHOW_PRERELEASE,
      !currentValue,
      vscode.ConfigurationTarget.Global
    );
    vscode.window.showInformationMessage(
      `Pre-release versions ${!currentValue ? "shown" : "hidden"}`
    );
    this.codeLensProvider.refresh();
  }
}
