import * as vscode from "vscode";
import { NpmRegistryService } from "../services/npm-registry-service";
import { VersionFilterService } from "../services/version-filter-service";
import { SaferVersionCodeLensProvider } from "../providers/code-lens-provider";
import { PackageManagerFactory } from "../services/package-managers/package-manager.factory";
import { IPackageManagerService } from "../services/package-managers/package-manager.interface";
import { COMMANDS, CONFIG_SECTION, CONFIG_KEYS } from "../constants";

/**
 * Commands related to package version management
 */
export class PackageVersionCommands {
  constructor(
    private npmRegistry: NpmRegistryService,
    private versionFilter: VersionFilterService,
    private codeLensProvider: SaferVersionCodeLensProvider,
    private packageManagerFactory: PackageManagerFactory,
    private getPackageManagerService: () => IPackageManagerService | null,
    private setPackageManagerService: (
      service: IPackageManagerService | null
    ) => void
  ) {}

  /**
   * Register all package version commands
   */
  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        COMMANDS.UPDATE_PACKAGE_VERSION,
        this.updatePackageVersion.bind(this)
      ),
      vscode.commands.registerCommand(
        COMMANDS.UPDATE_PACKAGE_MANAGER_VERSION,
        this.updatePackageManagerVersion.bind(this)
      ),
      vscode.commands.registerCommand(
        COMMANDS.SHOW_VERSION_INFO,
        this.showVersionInfo.bind(this)
      ),
      vscode.commands.registerCommand(
        COMMANDS.SHOW_PACKAGE_MANAGER_VERSIONS,
        this.showPackageManagerVersions.bind(this)
      ),
      vscode.commands.registerCommand(COMMANDS.REFRESH, this.refresh.bind(this))
    );
  }

  private async updatePackageVersion(
    packageName: string,
    targetVersion: string,
    sectionName: string
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith("package.json")) {
      vscode.window.showErrorMessage("No package.json file is open");
      return;
    }

    try {
      const document = editor.document;
      const text = document.getText();
      const packageJson = JSON.parse(text);

      const section = packageJson[sectionName];
      if (!section || !section[packageName]) {
        vscode.window.showErrorMessage(
          `Package ${packageName} not found in ${sectionName}`
        );
        return;
      }

      const packageRegex = new RegExp(`("${packageName}"\\s*:\\s*")([^"]+)(")`);
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

  private async updatePackageManagerVersion(
    targetVersion: string
  ): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !editor.document.fileName.endsWith("package.json")) {
      vscode.window.showErrorMessage("No package.json file is open");
      return;
    }

    try {
      const document = editor.document;
      const text = document.getText();
      const packageJson = JSON.parse(text);

      if (!packageJson.packageManager) {
        vscode.window.showErrorMessage(
          "No packageManager field found in package.json"
        );
        return;
      }

      const packageManagerRegex = /("packageManager"\s*:\s*")([^"]+)(")/;
      const match = text.match(packageManagerRegex);
      if (!match) {
        vscode.window.showErrorMessage("Could not locate packageManager field");
        return;
      }

      const startPos = text.indexOf(match[0]) + match[1].length;
      const endPos = startPos + match[2].length;

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
        `Updated packageManager to ${targetVersion}`
      );

      // Refresh the package manager service
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (workspaceFolders && workspaceFolders.length > 0) {
        const newService = await this.packageManagerFactory.create(
          workspaceFolders[0].uri
        );
        this.setPackageManagerService(newService);
      }
      this.codeLensProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update package manager: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async showVersionInfo(
    packageName: string,
    minimumReleaseAge: number,
    sectionName: string
  ): Promise<void> {
    const metadata = await this.npmRegistry.fetchPackageMetadata(packageName);
    if (!metadata) {
      vscode.window.showInformationMessage(`Package ${packageName} not found`);
      return;
    }

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const showPrerelease = config.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );

    const versions = this.versionFilter.filterVersions(
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

    const items = versions.map((v) => ({
      label: v.version,
      description: v.isSafe ? "✓ Safe" : "⚠ In quarantine",
      detail: `Published: ${v.publishedAt.toLocaleDateString()} ${v.publishedAt.toLocaleTimeString()}${v.reason ? " - " + v.reason : ""}`,
      version: v.version
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a version for ${packageName}`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await vscode.commands.executeCommand(
        COMMANDS.UPDATE_PACKAGE_VERSION,
        packageName,
        selected.version,
        sectionName
      );
    }
  }

  private async showPackageManagerVersions(
    packageName: string,
    minimumReleaseAge: number
  ): Promise<void> {
    const metadata = await this.npmRegistry.fetchPackageMetadata(packageName);
    if (!metadata) {
      vscode.window.showInformationMessage(`Package ${packageName} not found`);
      return;
    }

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const showPrerelease = config.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );

    const versions = this.versionFilter.filterVersions(
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

    const items = versions.map((v) => ({
      label: v.version,
      description: v.isSafe ? "✓ Safe" : "⚠ In quarantine",
      detail: `Published: ${v.publishedAt.toLocaleDateString()} ${v.publishedAt.toLocaleTimeString()}${v.reason ? " - " + v.reason : ""}`,
      version: v.version
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a version for ${packageName} package manager`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await vscode.commands.executeCommand(
        COMMANDS.UPDATE_PACKAGE_MANAGER_VERSION,
        `${packageName}@${selected.version}`
      );
    }
  }

  private refresh(): void {
    this.npmRegistry.clearCache();
    this.codeLensProvider.refresh();
    vscode.window.showInformationMessage("Safer Version Lens refreshed");
  }
}
