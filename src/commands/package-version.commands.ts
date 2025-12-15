import * as vscode from "vscode";
import { NpmRegistryService } from "../services/npm-registry-service";
import { VersionFilterService } from "../services/version-filter-service";
import { SaferVersionCodeLensProvider } from "../providers/code-lens-provider";
import { PackageManagerFactory } from "../services/package-managers/package-manager.factory";
import { IPackageManagerService } from "../services/package-managers/package-manager.interface";
import { AuditService } from "../services/audit-service";
import { COMMANDS, CONFIG_SECTION, CONFIG_KEYS } from "../constants";

/**
 * Commands related to package version management
 */
export class PackageVersionCommands {
  private auditService: AuditService;

  constructor(
    private npmRegistry: NpmRegistryService,
    private versionFilter: VersionFilterService,
    private codeLensProvider: SaferVersionCodeLensProvider,
    private packageManagerFactory: PackageManagerFactory,
    private getPackageManagerService: () => IPackageManagerService | null,
    private setPackageManagerService: (
      service: IPackageManagerService | null
    ) => void
  ) {
    this.auditService = new AuditService();
  }

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
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);
    const maxSeverity = config.get<string>(
      CONFIG_KEYS.AUDIT_MAX_SEVERITY,
      "low"
    );

    const versions = this.versionFilter.filterVersions(
      metadata,
      minimumReleaseAge,
      !showPrerelease
    );

    // Audit versions if enabled
    if (auditEnabled) {
      const versionStrings = versions.map((v) => v.version);
      const auditResults = await this.auditService.auditPackageVersions(
        packageName,
        versionStrings
      );

      // Attach vulnerability data to versions
      versions.forEach((v) => {
        v.vulnerabilities = auditResults.get(v.version) || [];
      });
    }

    if (versions.length === 0) {
      vscode.window.showInformationMessage(
        `No versions found for ${packageName}`
      );
      return;
    }

    const items = versions.map((v) => {
      const vulnDescription = this.getVulnerabilitySummary(v.vulnerabilities);
      const safetyStatus = this.getSafetyStatus(v, maxSeverity);

      // Build description: comprehensive safety status + vulnerability summary
      const description = vulnDescription
        ? `${safetyStatus.icon} ${safetyStatus.text} | ${vulnDescription}`
        : `${safetyStatus.icon} ${safetyStatus.text}`;

      return {
        label: v.version,
        description,
        detail: `Published: ${v.publishedAt.toLocaleDateString()} ${v.publishedAt.toLocaleTimeString()}${v.reason ? " - " + v.reason : ""}`,
        version: v.version,
        vulnerabilities: v.vulnerabilities
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a version for ${packageName}`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      // If version has vulnerabilities, offer to view them first
      if (selected.vulnerabilities && selected.vulnerabilities.length > 0) {
        const viewedVuln = await this.showVulnerabilityDetails(
          selected.vulnerabilities,
          packageName,
          selected.version
        );

        // Ask if they want to proceed with the update
        if (viewedVuln) {
          const proceed = await vscode.window.showWarningMessage(
            `Update ${packageName} to ${selected.version} (has ${selected.vulnerabilities.length} vulnerabilities)?`,
            "Update Anyway",
            "Cancel"
          );

          if (proceed !== "Update Anyway") {
            return;
          }
        }
      }

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
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);
    const maxSeverity = config.get<string>(
      CONFIG_KEYS.AUDIT_MAX_SEVERITY,
      "low"
    );

    const versions = this.versionFilter.filterVersions(
      metadata,
      minimumReleaseAge,
      !showPrerelease
    );

    // Audit versions if enabled
    if (auditEnabled) {
      const versionStrings = versions.map((v) => v.version);
      const auditResults = await this.auditService.auditPackageVersions(
        packageName,
        versionStrings
      );

      // Attach vulnerability data to versions
      versions.forEach((v) => {
        v.vulnerabilities = auditResults.get(v.version) || [];
      });
    }

    if (versions.length === 0) {
      vscode.window.showInformationMessage(
        `No versions found for ${packageName}`
      );
      return;
    }

    const items = versions.map((v) => {
      const vulnDescription = this.getVulnerabilitySummary(v.vulnerabilities);
      const safetyStatus = this.getSafetyStatus(v, maxSeverity);

      // Build description: comprehensive safety status + vulnerability summary
      const description = vulnDescription
        ? `${safetyStatus.icon} ${safetyStatus.text} | ${vulnDescription}`
        : `${safetyStatus.icon} ${safetyStatus.text}`;

      return {
        label: `${packageName}@${v.version}`,
        description,
        detail: `Published: ${v.publishedAt.toLocaleDateString()} ${v.publishedAt.toLocaleTimeString()}${v.reason ? " - " + v.reason : ""}`,
        version: v.version,
        vulnerabilities: v.vulnerabilities
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `Select a version for ${packageName} package manager`,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      // If version has vulnerabilities, offer to view them first
      if (selected.vulnerabilities && selected.vulnerabilities.length > 0) {
        const viewedVuln = await this.showVulnerabilityDetails(
          selected.vulnerabilities,
          packageName,
          selected.version
        );

        // Ask if they want to proceed with the update
        if (viewedVuln) {
          const proceed = await vscode.window.showWarningMessage(
            `Update packageManager to ${packageName}@${selected.version} (has ${selected.vulnerabilities.length} vulnerabilities)?`,
            "Update Anyway",
            "Cancel"
          );

          if (proceed !== "Update Anyway") {
            return;
          }
        }
      }

      await vscode.commands.executeCommand(
        COMMANDS.UPDATE_PACKAGE_MANAGER_VERSION,
        `${packageName}@${selected.version}`
      );
    }
  }

  private refresh(): void {
    this.npmRegistry.clearCache();
    this.auditService.clearCache();
    this.codeLensProvider.refresh();
    vscode.window.showInformationMessage("Safer Version Lens refreshed");
  }

  /**
   * Get comprehensive safety status considering both quarantine and vulnerabilities
   */
  private getSafetyStatus(
    version: any,
    maxSeverity: string
  ): { icon: string; text: string } {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);

    const passesQuarantine = version.isSafe;
    const hasVulnerabilities =
      version.vulnerabilities && version.vulnerabilities.length > 0;

    // Check if has vulnerabilities above threshold
    let hasBlockingVulns = false;
    if (auditEnabled && hasVulnerabilities) {
      const severityOrder = ["critical", "high", "moderate", "low", "info"];
      const maxSeverityIndex = severityOrder.indexOf(maxSeverity);

      hasBlockingVulns = version.vulnerabilities.some((v: any) => {
        const vulnIndex = severityOrder.indexOf(v.severity);
        return vulnIndex < maxSeverityIndex;
      });
    }

    // Determine status
    if (passesQuarantine && !hasBlockingVulns) {
      return { icon: "✓", text: "Ok" };
    } else if (!passesQuarantine && hasBlockingVulns) {
      return { icon: "⚠🔒", text: "Quarantine + Vulnerable" };
    } else if (!passesQuarantine) {
      return { icon: "⚠", text: "In quarantine" };
    } else {
      return { icon: "🔒", text: "Has vulnerabilities" };
    }
  }

  /**
   * Get vulnerability indicator for display
   */
  private getVulnerabilityIndicator(vulnerabilities?: any[]): string {
    if (!vulnerabilities || vulnerabilities.length === 0) return "";

    const critical = vulnerabilities.filter(
      (v) => v.severity === "critical"
    ).length;
    const high = vulnerabilities.filter((v) => v.severity === "high").length;
    const moderate = vulnerabilities.filter(
      (v) => v.severity === "moderate"
    ).length;
    const low = vulnerabilities.filter((v) => v.severity === "low").length;

    const parts: string[] = [];
    if (critical > 0) parts.push(`${critical}C`);
    if (high > 0) parts.push(`${high}H`);
    if (moderate > 0) parts.push(`${moderate}M`);
    if (low > 0) parts.push(`${low}L`);

    return parts.length > 0 ? ` 🔒[${parts.join("/")}]` : "";
  }

  /**
   * Show vulnerability details with clickable links
   * @returns true if user viewed a vulnerability, false if cancelled
   */
  private async showVulnerabilityDetails(
    vulnerabilities: any[],
    packageName: string,
    version: string
  ): Promise<boolean> {
    const items = vulnerabilities.map((v) => ({
      label: `${this.getSeverityIcon(v.severity)} ${v.title}`,
      description: v.severity.toUpperCase(),
      detail: v.url,
      url: v.url
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `${vulnerabilities.length} vulnerabilities found in ${packageName}@${version}`,
      matchOnDescription: true,
      matchOnDetail: true,
      title: "Security Vulnerabilities"
    });

    if (selected) {
      await vscode.env.openExternal(vscode.Uri.parse(selected.url));
      return true;
    }

    return false;
  }

  /**
   * Get severity icon for vulnerability display
   */
  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case "critical":
        return "⛔";
      case "high":
        return "🔴";
      case "moderate":
        return "🟠";
      case "low":
        return "🟡";
      default:
        return "ℹ️";
    }
  }

  /**
   * Get vulnerability summary for description field
   */
  private getVulnerabilitySummary(vulnerabilities?: any[]): string {
    if (!vulnerabilities || vulnerabilities.length === 0) return "";

    const critical = vulnerabilities.filter(
      (v) => v.severity === "critical"
    ).length;
    const high = vulnerabilities.filter((v) => v.severity === "high").length;
    const moderate = vulnerabilities.filter(
      (v) => v.severity === "moderate"
    ).length;
    const low = vulnerabilities.filter((v) => v.severity === "low").length;

    const parts: string[] = [];
    if (critical > 0) parts.push(`⛔ ${critical} Critical`);
    if (high > 0) parts.push(`🔴 ${high} High`);
    if (moderate > 0) parts.push(`🟠 ${moderate} Moderate`);
    if (low > 0) parts.push(`🟡 ${low} Low`);

    return parts.join(", ");
  }
}
