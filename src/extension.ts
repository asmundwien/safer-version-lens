import * as vscode from "vscode";
import { SaferVersionCodeLensProvider } from "./providers/codeLensProvider";
import { NpmRegistryService } from "./services/npmRegistryService";
import { PnpmConfigService } from "./services/pnpmConfigService";
import { VersionFilterService } from "./services/versionFilterService";

let codeLensProvider: SaferVersionCodeLensProvider;

export function activate(context: vscode.ExtensionContext) {
  console.log("Safer Version Lens is now active!");

  // Initialize services
  const npmRegistry = new NpmRegistryService();
  const pnpmConfig = new PnpmConfigService();
  const versionFilter = new VersionFilterService();

  // Create and register CodeLens provider
  codeLensProvider = new SaferVersionCodeLensProvider(
    npmRegistry,
    pnpmConfig,
    versionFilter
  );

  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { language: "json", pattern: "**/package.json" },
    codeLensProvider
  );

  // Command to show detailed version information
  const showVersionInfoCommand = vscode.commands.registerCommand(
    "safer-version-lens.showVersionInfo",
    async (packageName: string, minimumReleaseAge: number) => {
      const metadata = await npmRegistry.fetchPackageMetadata(packageName);
      if (!metadata) {
        vscode.window.showInformationMessage(
          `Package ${packageName} not found`
        );
        return;
      }

      const versions = versionFilter.filterVersions(
        metadata,
        minimumReleaseAge
      );

      if (versions.length === 0) {
        vscode.window.showInformationMessage(
          `No versions found for ${packageName}`
        );
        return;
      }

      const items = versions.map((v) => ({
        label: v.version,
        description: v.isSafe ? "✓ Safe" : "⚠ In quarantine",
        detail: `Published: ${v.publishedAt.toLocaleDateString()} ${v.publishedAt.toLocaleTimeString()}${v.reason ? " - " + v.reason : ""}`,
        version: v
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Select a version for ${packageName}`,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (selected) {
        vscode.window.showInformationMessage(
          `${packageName}@${selected.version} - ${selected.description}`
        );
      }
    }
  );

  // Command to refresh code lenses
  const refreshCommand = vscode.commands.registerCommand(
    "safer-version-lens.refresh",
    () => {
      npmRegistry.clearCache();
      codeLensProvider.refresh();
      vscode.window.showInformationMessage("Safer Version Lens refreshed");
    }
  );

  // Command to show current configuration
  const showConfigCommand = vscode.commands.registerCommand(
    "safer-version-lens.showConfig",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showInformationMessage("No workspace folder open");
        return;
      }

      const config = await pnpmConfig.getPnpmConfig(workspaceFolders[0].uri);
      const minimumReleaseAge = config.minimumReleaseAge ?? 0;

      if (minimumReleaseAge === 0) {
        vscode.window.showInformationMessage(
          "No time quarantine configured. All versions will be shown."
        );
      } else {
        const days = Math.floor(minimumReleaseAge / (60 * 24));
        const hours = Math.floor((minimumReleaseAge % (60 * 24)) / 60);
        vscode.window.showInformationMessage(
          `Time quarantine: ${minimumReleaseAge} minutes (${days}d ${hours}h)`
        );
      }
    }
  );

  // Watch for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration("saferVersionLens")) {
        npmRegistry.clearCache();
        codeLensProvider.refresh();
      }
    }
  );

  // Watch for pnpm-workspace.yaml file changes
  const fileWatcher = vscode.workspace.createFileSystemWatcher(
    "**/pnpm-workspace.yaml"
  );
  fileWatcher.onDidChange(() => {
    codeLensProvider.refresh();
  });
  fileWatcher.onDidCreate(() => {
    codeLensProvider.refresh();
  });
  fileWatcher.onDidDelete(() => {
    codeLensProvider.refresh();
  });

  context.subscriptions.push(
    codeLensDisposable,
    showVersionInfoCommand,
    refreshCommand,
    showConfigCommand,
    configChangeDisposable,
    fileWatcher
  );
}

export function deactivate() {}
