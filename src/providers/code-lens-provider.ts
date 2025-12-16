import * as vscode from "vscode";
import { NpmRegistryService } from "../services/npm-registry-service";
import { IPackageManagerService } from "../services/package-managers/package-manager.interface";
import { VersionFilterService } from "../services/version-filter-service";
import { AuditService } from "../services/audit-service";
import { CodeLensButtonsFactory } from "./code-lens-buttons.factory";
import {
  findDependencyInSection,
  findPackageManagerField,
  shouldSkipVersion
} from "../utils/package-json-parser";
import { getMaxSeverity, getVulnerabilityIcon } from "../utils/vulnerability-helpers";
import { COMMANDS, CONFIG_SECTION, CONFIG_KEYS } from "../constants";

export class SaferVersionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private auditService: AuditService;

  constructor(
    private npmRegistry: NpmRegistryService,
    private packageManagerService: IPackageManagerService | null,
    private versionFilter: VersionFilterService,
    private buttonsFactory: CodeLensButtonsFactory
  ) {
    this.auditService = new AuditService();
  }

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
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const enabled = config.get<boolean>(CONFIG_KEYS.ENABLED, true);

    if (!document.fileName.endsWith("package.json")) {
      console.log("[SaferVersionLens] Not a package.json file, skipping");
      return [];
    }

    // If disabled, return empty array (use status bar to enable)
    if (!enabled) {
      console.log(
        "[SaferVersionLens] Extension is disabled"
      );
      return [];
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

      const pmConfig = await this.packageManagerService.getConfig(
        workspaceFolder.uri
      );
      const minimumReleaseAge = pmConfig.minimumReleaseAge;

      console.log("[SaferVersionLens] Minimum release age:", minimumReleaseAge);

      const codeLenses: vscode.CodeLens[] = [];

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

    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const showPrerelease = config.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);
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

        const currentVersionClean = currentVersion.replace(/^[^\d]*/, "");
        const currentMajor = parseInt(currentVersionClean.split(".")[0], 10);

        // Audit versions if enabled - include current version to check for vulnerabilities
        let currentVersionVulns: any[] = [];
        if (auditEnabled) {
          const versionStrings = allVersions.map((v) => v.version);
          // Add current version if not already in the list
          if (!versionStrings.includes(currentVersionClean)) {
            versionStrings.push(currentVersionClean);
          }
          
          const auditResults = await this.auditService.auditPackageVersions(
            packageName,
            versionStrings
          );

          // Attach vulnerability data to versions
          allVersions.forEach((v) => {
            v.vulnerabilities = auditResults.get(v.version) || [];
          });
          
          // Get vulnerabilities for current version
          currentVersionVulns = auditResults.get(currentVersionClean) || [];
        }

        // Add vulnerability warning CodeLens if current version has vulnerabilities
        if (currentVersionVulns.length > 0) {
          const maxSeverity = getMaxSeverity(currentVersionVulns);
          const vulnIcon = getVulnerabilityIcon(maxSeverity);
          const vulnCount = currentVersionVulns.length;
          
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `${vulnIcon} ${vulnCount} vulnerabilit${vulnCount === 1 ? "y" : "ies"}`,
              command: "",
              tooltip: currentVersionVulns
                .map((v) => `${v.severity.toUpperCase()}: ${v.title}`)
                .join("\n")
            })
          );
        }

        // Create version update buttons
        const versionButtons = this.buttonsFactory.createVersionButtons(
          range,
          packageName,
          currentVersionClean,
          allVersions,
          sectionName
        );
        codeLenses.push(...versionButtons);

        // Add "all versions" button
        codeLenses.push(
          this.buttonsFactory.createAllVersionsButton(
            range,
            packageName,
            minimumReleaseAge,
            sectionName,
            false,
            currentVersionClean
          )
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
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const showPrerelease = config.get<boolean>(
      CONFIG_KEYS.SHOW_PRERELEASE,
      false
    );
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);

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

      const allVersions = this.versionFilter.filterVersions(
        metadata,
        minimumReleaseAge,
        !showPrerelease
      );

      // Audit versions if enabled
      if (auditEnabled) {
        const versionStrings = allVersions.map((v) => v.version);
        const auditResults = await this.auditService.auditPackageVersions(
          packageName,
          versionStrings
        );

        // Attach vulnerability data to versions
        allVersions.forEach((v) => {
          v.vulnerabilities = auditResults.get(v.version) || [];
        });
      }

      // Create version update buttons
      const versionButtons = this.buttonsFactory.createVersionButtons(
        range,
        packageName,
        currentVersion,
        allVersions,
        "packageManager",
        COMMANDS.UPDATE_PACKAGE_MANAGER_VERSION
      );
      codeLenses.push(...versionButtons);

      // Add "all versions" button
      codeLenses.push(
        this.buttonsFactory.createAllVersionsButton(
          range,
          packageName,
          minimumReleaseAge,
          "packageManager",
          true
        )
      );
    } catch (error) {
      console.error(`Error processing ${packageName}:`, error);
    }
  }
}
