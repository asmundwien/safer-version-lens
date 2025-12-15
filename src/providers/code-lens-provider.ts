import * as vscode from "vscode";
import { NpmRegistryService } from "../services/npm-registry-service";
import { IPackageManagerService } from "../services/package-managers/package-manager.interface";
import { VersionFilterService } from "../services/version-filter-service";
import {
  findDependencyInSection,
  findPackageManagerField,
  shouldSkipVersion
} from "../utils/package-json-parser";

export class SaferVersionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private npmRegistry: NpmRegistryService,
    private packageManagerService: IPackageManagerService | null,
    private versionFilter: VersionFilterService
  ) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    console.log(
      "[SaferVersionLens] provideCodeLenses called for:",
      document.fileName
    );

    // Check if lens is enabled
    const config = vscode.workspace.getConfiguration("saferVersionLens");
    const enabled = config.get<boolean>("enabled", true);

    if (!document.fileName.endsWith("package.json")) {
      console.log("[SaferVersionLens] Not a package.json file, skipping");
      return [];
    }

    // If disabled, only show the enable button
    if (!enabled) {
      console.log(
        "[SaferVersionLens] Extension is disabled, showing enable button only"
      );
      const topRange = new vscode.Range(0, 0, 0, 0);
      return [
        new vscode.CodeLens(topRange, {
          title: "$(check) Enable Safer Version Lens",
          command: "safer-version-lens.toggleEnabled",
          tooltip: "Click to enable Safer Version Lens"
        })
      ];
    }

    try {
      const text = document.getText();
      const packageJson = JSON.parse(text);

      console.log(
        "[SaferVersionLens] Parsed package.json, dependencies:",
        Object.keys(packageJson.dependencies || {}).length
      );

      const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
      if (!workspaceFolder) {
        console.log("[SaferVersionLens] No workspace folder found");
        return [];
      }

      // Check if package manager service is available and supports the feature
      if (!this.packageManagerService) {
        console.log("[SaferVersionLens] No package manager detected");
        return [];
      }

      if (!this.packageManagerService.isFeatureSupported()) {
        const reason = this.packageManagerService.getUnsupportedReason();
        console.log("[SaferVersionLens] Feature not supported:", reason);
        
        // Show warning at top of file
        const topRange = new vscode.Range(0, 0, 0, 0);
        return [
          new vscode.CodeLens(topRange, {
            title: `$(warning) ${reason}`,
            command: "",
            tooltip: reason
          })
        ];
      }

      const pmConfig = await this.packageManagerService.getConfig(workspaceFolder.uri);
      const minimumReleaseAge = pmConfig.minimumReleaseAge;

      console.log("[SaferVersionLens] Minimum release age:", minimumReleaseAge);

      const codeLenses: vscode.CodeLens[] = [];

      // Add toggle buttons at the top of the file
      const topRange = new vscode.Range(0, 0, 0, 0);

      // Toggle enabled button
      codeLenses.push(
        new vscode.CodeLens(topRange, {
          title: "$(circle-slash) Disable Lens",
          command: "safer-version-lens.toggleEnabled",
          tooltip: "Click to disable Safer Version Lens"
        })
      );

      // Toggle pre-release button
      const showPrerelease = config.get<boolean>("showPrerelease", false);
      codeLenses.push(
        new vscode.CodeLens(topRange, {
          title: showPrerelease
            ? "$(eye-closed) Hide Pre-releases"
            : "$(eye) Show Pre-releases",
          command: "safer-version-lens.togglePrerelease",
          tooltip: showPrerelease
            ? "Click to hide pre-release versions"
            : "Click to show pre-release versions"
        })
      );

      // Add packageManager version update button
      if (packageJson.packageManager) {
        await this.processPackageManager(
          document,
          text,
          packageJson.packageManager,
          minimumReleaseAge,
          codeLenses
        );
      }

      await this.processDependencies(
        document,
        packageJson.dependencies,
        "dependencies",
        minimumReleaseAge,
        codeLenses
      );
      await this.processDependencies(
        document,
        packageJson.devDependencies,
        "devDependencies",
        minimumReleaseAge,
        codeLenses
      );
      await this.processDependencies(
        document,
        packageJson.peerDependencies,
        "peerDependencies",
        minimumReleaseAge,
        codeLenses
      );

      console.log(
        "[SaferVersionLens] Generated",
        codeLenses.length,
        "code lenses"
      );
      return codeLenses;
    } catch (error) {
      console.error("Error parsing package.json:", error);
      return [];
    }
  }

  private async processDependencies(
    document: vscode.TextDocument,
    dependencies: Record<string, string> | undefined,
    sectionName: string,
    minimumReleaseAge: number,
    codeLenses: vscode.CodeLens[]
  ): Promise<void> {
    if (!dependencies) return;

    const config = vscode.workspace.getConfiguration("saferVersionLens");
    const showPrerelease = config.get<boolean>("showPrerelease", false);
    const text = document.getText();

    for (const [packageName, currentVersion] of Object.entries(dependencies)) {
      if (shouldSkipVersion(currentVersion)) continue;

      const location = findDependencyInSection(text, packageName, sectionName);
      if (!location) continue;

      const position = document.positionAt(location.position);
      const range = new vscode.Range(position, position);

      try {
        const metadata =
          await this.npmRegistry.fetchPackageMetadata(packageName);

        if (!metadata) continue;

        // Filter versions - exclude prereleases if showPrerelease is false
        const allVersions = this.versionFilter.filterVersions(
          metadata,
          minimumReleaseAge,
          !showPrerelease
        );

        // Extract current major version
        const currentVersionClean = currentVersion.replace(/^[^\d]*/, ""); // Remove ^, ~, etc.
        const currentMajor = parseInt(currentVersionClean.split(".")[0], 10);

        // Get latest major version
        const latestMajor =
          this.versionFilter.getLatestMajorVersion(allVersions);

        // Button 1: Latest safe in current major
        const latestInCurrentMajor =
          this.versionFilter.getLatestSafeVersionInMajor(
            allVersions,
            currentMajor
          );
        if (
          latestInCurrentMajor &&
          latestInCurrentMajor.version !== currentVersionClean
        ) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(arrow-up) ${latestInCurrentMajor.version}`,
              command: "safer-version-lens.updatePackageVersion",
              arguments: [
                packageName,
                latestInCurrentMajor.version,
                sectionName
              ],
              tooltip: `Update to latest safe version in v${currentMajor}`
            })
          );
        }

        // Button 2: Latest safe in latest major (if different from current major)
        if (latestMajor > currentMajor) {
          const latestInLatestMajor =
            this.versionFilter.getLatestSafeVersionInMajor(
              allVersions,
              latestMajor
            );
          if (latestInLatestMajor) {
            codeLenses.push(
              new vscode.CodeLens(range, {
                title: `$(rocket) ${latestInLatestMajor.version}`,
                command: "safer-version-lens.updatePackageVersion",
                arguments: [
                  packageName,
                  latestInLatestMajor.version,
                  sectionName
                ],
                tooltip: `Update to latest safe version in v${latestMajor} (latest major)`
              })
            );
          }
        }

        // Button 3: Show all versions
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: "$(versions) all versions",
            command: "safer-version-lens.showVersionInfo",
            arguments: [packageName, minimumReleaseAge, sectionName],
            tooltip: "View all available versions"
          })
        );
      } catch (error) {
        console.error(`Error processing ${packageName}:`, error);
      }
    }
  }

  /**
   * Process packageManager field and add CodeLens for version updates
   */
  private async processPackageManager(
    document: vscode.TextDocument,
    text: string,
    packageManagerSpec: string,
    minimumReleaseAge: number,
    codeLenses: vscode.CodeLens[]
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration("saferVersionLens");
    const showPrerelease = config.get<boolean>("showPrerelease", false);

    // Find the packageManager field location
    const location = findPackageManagerField(text);
    if (!location) {
      return;
    }

    // Extract package manager name and version from spec (e.g., "pnpm@10.25.0")
    const match = packageManagerSpec.match(/^([^@]+)@([\d.]+)$/);
    if (!match) {
      return;
    }

    const [, packageName, currentVersion] = match;
    const position = document.positionAt(location.position);
    const range = new vscode.Range(position, position);

    try {
      // Fetch package metadata from npm registry
      const metadata = await this.npmRegistry.fetchPackageMetadata(packageName);
      if (!metadata) {
        return;
      }

      // Filter versions
      const allVersions = this.versionFilter.filterVersions(
        metadata,
        minimumReleaseAge,
        !showPrerelease
      );

      const currentMajor = parseInt(currentVersion.split(".")[0], 10);
      const latestMajor = this.versionFilter.getLatestMajorVersion(allVersions);

      // Button 1: Latest safe in current major
      const latestInCurrentMajor = this.versionFilter.getLatestSafeVersionInMajor(
        allVersions,
        currentMajor
      );
      if (latestInCurrentMajor && latestInCurrentMajor.version !== currentVersion) {
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(arrow-small-up) ${packageName}@${latestInCurrentMajor.version}`,
            command: "safer-version-lens.updatePackageManagerVersion",
            arguments: [`${packageName}@${latestInCurrentMajor.version}`],
            tooltip: `Update to latest safe ${packageName} version in v${currentMajor}`
          })
        );
      }

      // Button 2: Latest safe in latest major (if different)
      if (latestMajor > currentMajor) {
        const latestInLatestMajor = this.versionFilter.getLatestSafeVersionInMajor(
          allVersions,
          latestMajor
        );
        if (latestInLatestMajor) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(rocket) ${packageName}@${latestInLatestMajor.version}`,
              command: "safer-version-lens.updatePackageManagerVersion",
              arguments: [`${packageName}@${latestInLatestMajor.version}`],
              tooltip: `Update to latest safe ${packageName} version in v${latestMajor} (latest major)`
            })
          );
        }
      }

      // Button 3: Show all versions
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: "$(versions) all versions",
          command: "safer-version-lens.showPackageManagerVersions",
          arguments: [packageName, minimumReleaseAge],
          tooltip: `View all available ${packageName} versions`
        })
      );
    } catch (error) {
      console.error(`Error processing package manager ${packageName}:`, error);
    }
  }
}
