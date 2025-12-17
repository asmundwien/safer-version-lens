import * as vscode from "vscode";
import { SaferVersionCodeLensProvider } from "./providers/code-lens-provider";
import { NpmRegistryService } from "./services/npm-registry-service";
import { VersionFilterService } from "./services/version-filter-service";
import { PackageManagerFactory } from "./services/package-managers/package-manager.factory";
import { IPackageManagerService } from "./services/package-managers/package-manager.interface";
import { PackageVersionCommands, ConfigCommands } from "./commands";
import { CodeLensButtonsFactory } from "./providers/code-lens-buttons.factory";
import { PATTERNS, CONFIG_SECTION } from "./constants";

let codeLensProvider: SaferVersionCodeLensProvider;
let packageManagerService: IPackageManagerService | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log("Safer Version Lens is now active!");

  // Initialize services
  const npmRegistry = new NpmRegistryService();
  const versionFilter = new VersionFilterService();
  const packageManagerFactory = new PackageManagerFactory();
  const codeLensButtonsFactory = new CodeLensButtonsFactory(versionFilter);

  // Detect and create package manager service
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    packageManagerService = await packageManagerFactory.create(
      workspaceFolders[0].uri
    );
    if (packageManagerService) {
      const info = packageManagerService.getInfo();
      console.log(`[SaferVersionLens] Detected ${info.type}@${info.version}`);
    }
  }

  // Create and register CodeLens provider
  codeLensProvider = new SaferVersionCodeLensProvider(
    npmRegistry,
    packageManagerService,
    versionFilter,
    codeLensButtonsFactory,
    packageManagerFactory
  );

  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { language: "json", pattern: PATTERNS.PACKAGE_JSON },
    codeLensProvider
  );

  // Register command handlers
  const packageVersionCommands = new PackageVersionCommands(
    npmRegistry,
    versionFilter,
    codeLensProvider,
    packageManagerFactory,
    () => packageManagerService,
    (service) => {
      packageManagerService = service;
    }
  );
  packageVersionCommands.register(context);

  // Create status bar item for enable/disable toggle
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = "safer-version-lens.toggleEnabled";
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const enabled = config.get<boolean>("enabled", true);

  const configCommands = new ConfigCommands(
    codeLensProvider,
    () => packageManagerService,
    statusBarItem
  );
  configCommands.register(context);
  configCommands.updateStatusBar(enabled);
  statusBarItem.show();

  context.subscriptions.push(statusBarItem);

  // Watch for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration(
    (e) => {
      if (e.affectsConfiguration(CONFIG_SECTION)) {
        npmRegistry.clearCache();
        codeLensProvider.refresh();
      }
    }
  );

  // Watch for pnpm-workspace.yaml file changes
  const fileWatcher = vscode.workspace.createFileSystemWatcher(
    PATTERNS.PNPM_WORKSPACE
  );
  fileWatcher.onDidChange(() => codeLensProvider.refresh());
  fileWatcher.onDidCreate(() => codeLensProvider.refresh());
  fileWatcher.onDidDelete(() => codeLensProvider.refresh());

  context.subscriptions.push(
    codeLensDisposable,
    configChangeDisposable,
    fileWatcher
  );
}

export function deactivate() {}
