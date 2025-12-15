import * as vscode from "vscode";
import { SaferVersionCodeLensProvider } from "./providers/code-lens-provider";
import { NpmRegistryService } from "./services/npm-registry-service";
import { PnpmConfigService } from "./services/pnpm-config-service";
import { VersionFilterService } from "./services/version-filter-service";

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

  // Command to update package version
  const updatePackageVersionCommand = vscode.commands.registerCommand(
    "safer-version-lens.updatePackageVersion",
    async (packageName: string, targetVersion: string, sectionName: string) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith("package.json")) {
        vscode.window.showErrorMessage("No package.json file is open");
        return;
      }

      try {
        const document = editor.document;
        const text = document.getText();
        const packageJson = JSON.parse(text);

        // Update the version in the appropriate section
        const section = packageJson[sectionName];
        if (!section || !section[packageName]) {
          vscode.window.showErrorMessage(
            `Package ${packageName} not found in ${sectionName}`
          );
          return;
        }

        // Find the exact location in the text
        const sectionRegex = new RegExp(
          `"${sectionName}"\\s*:\\s*\\{([^}]*)\\}`,
          "s"
        );
        const sectionMatch = text.match(sectionRegex);
        if (!sectionMatch) {
          vscode.window.showErrorMessage(`Section ${sectionName} not found`);
          return;
        }

        // Find the package within the section
        const packageRegex = new RegExp(
          `("${packageName}"\\s*:\\s*")([^"]+)(")`
        );
        const packageMatch = text.match(packageRegex);
        if (!packageMatch) {
          vscode.window.showErrorMessage(`Package ${packageName} not found`);
          return;
        }

        const startPos = text.indexOf(packageMatch[0]) + packageMatch[1].length;
        const endPos = startPos + packageMatch[2].length;

        await editor.edit((editBuilder) => {
          editBuilder.replace(
            new vscode.Range(
              document.positionAt(startPos),
              document.positionAt(endPos)
            ),
            targetVersion
          );
        });

        vscode.window.showInformationMessage(
          `Updated ${packageName} to ${targetVersion}`
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to update package: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
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

      const config = vscode.workspace.getConfiguration("saferVersionLens");
      const showPrerelease = config.get<boolean>("showPrerelease", false);

      // Filter versions - exclude prereleases if showPrerelease is false
      const versions = versionFilter.filterVersions(
        metadata,
        minimumReleaseAge,
        !showPrerelease
      );

      if (versions.length === 0) {
        vscode.window.showInformationMessage(
          `No versions found for ${packageName}`
        );
        return;
      }

      // Show all versions in order, no sorting/grouping
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

      const vsConfig = vscode.workspace.getConfiguration("saferVersionLens");
      const enabled = vsConfig.get<boolean>("enabled", true);
      const showPrerelease = vsConfig.get<boolean>("showPrerelease", false);

      if (minimumReleaseAge === 0) {
        vscode.window.showInformationMessage(
          `Lens: ${enabled ? "Enabled" : "Disabled"} | Pre-releases: ${showPrerelease ? "Shown" : "Hidden"} | No time quarantine configured`
        );
      } else {
        const days = Math.floor(minimumReleaseAge / (60 * 24));
        const hours = Math.floor((minimumReleaseAge % (60 * 24)) / 60);
        vscode.window.showInformationMessage(
          `Lens: ${enabled ? "Enabled" : "Disabled"} | Pre-releases: ${showPrerelease ? "Shown" : "Hidden"} | Quarantine: ${minimumReleaseAge} min (${days}d ${hours}h)`
        );
      }
    }
  );

  // Command to toggle lens enabled/disabled
  const toggleEnabledCommand = vscode.commands.registerCommand(
    "safer-version-lens.toggleEnabled",
    async () => {
      const config = vscode.workspace.getConfiguration("saferVersionLens");
      const currentValue = config.get<boolean>("enabled", true);
      await config.update("enabled", !currentValue, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Safer Version Lens ${!currentValue ? "enabled" : "disabled"}`
      );
      codeLensProvider.refresh();
    }
  );

  // Command to toggle pre-release visibility
  const togglePrereleaseCommand = vscode.commands.registerCommand(
    "safer-version-lens.togglePrerelease",
    async () => {
      const config = vscode.workspace.getConfiguration("saferVersionLens");
      const currentValue = config.get<boolean>("showPrerelease", false);
      await config.update("showPrerelease", !currentValue, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        `Pre-release versions ${!currentValue ? "shown" : "hidden"}`
      );
      codeLensProvider.refresh();
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
    updatePackageVersionCommand,
    showVersionInfoCommand,
    refreshCommand,
    showConfigCommand,
    toggleEnabledCommand,
    togglePrereleaseCommand,
    configChangeDisposable,
    fileWatcher
  );
}

export function deactivate() {}
