import * as vscode from "vscode";
import { SafeVersion, VulnerabilitySeverity } from "../types";
import { VersionFilterService } from "../services/version-filter-service";
import { COMMANDS, CONFIG_SECTION, CONFIG_KEYS } from "../constants";

/**
 * Factory for creating CodeLens buttons for version updates
 */
export class CodeLensButtonsFactory {
  constructor(private versionFilter: VersionFilterService) {}

  /**
   * Create version update buttons for a package
   */
  createVersionButtons(
    range: vscode.Range,
    packageName: string,
    currentVersion: string,
    allVersions: SafeVersion[],
    sectionName: string,
    commandPrefix: string = COMMANDS.UPDATE_PACKAGE_VERSION
  ): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const currentMajor = parseInt(currentVersion.split(".")[0], 10);
    const latestMajor = this.versionFilter.getLatestMajorVersion(allVersions);

    // Get max vulnerability severity from config
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const auditEnabled = config.get<boolean>(CONFIG_KEYS.AUDIT_ENABLED, true);
    const maxSeverity = config.get<VulnerabilitySeverity>(
      CONFIG_KEYS.AUDIT_MAX_SEVERITY,
      "low"
    );

    // Button 1: Latest safe in current major (with audit if enabled)
    const latestInCurrentMajor = auditEnabled
      ? this.versionFilter.getLatestSafeVersionInMajorWithAudit(
          allVersions,
          currentMajor,
          maxSeverity
        )
      : this.versionFilter.getLatestSafeVersionInMajor(
          allVersions,
          currentMajor
        );

    if (
      latestInCurrentMajor &&
      latestInCurrentMajor.version !== currentVersion
    ) {
      const vulnIcon = this.getVulnerabilityIndicator(latestInCurrentMajor);
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `$(arrow-up) ${latestInCurrentMajor.version}${vulnIcon}`,
          command: commandPrefix,
          arguments:
            sectionName === "packageManager"
              ? [`${packageName}@${latestInCurrentMajor.version}`]
              : [packageName, latestInCurrentMajor.version, sectionName],
          tooltip: this.getVersionTooltip(
            latestInCurrentMajor,
            `Update to latest safe version in v${currentMajor}`
          )
        })
      );
    }

    // Button 2: Latest safe in latest major (if different)
    if (latestMajor > currentMajor) {
      const latestInLatestMajor = auditEnabled
        ? this.versionFilter.getLatestSafeVersionInMajorWithAudit(
            allVersions,
            latestMajor,
            maxSeverity
          )
        : this.versionFilter.getLatestSafeVersionInMajor(
            allVersions,
            latestMajor
          );

      if (latestInLatestMajor) {
        const vulnIcon = this.getVulnerabilityIndicator(latestInLatestMajor);
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(rocket) ${latestInLatestMajor.version}${vulnIcon}`,
            command: commandPrefix,
            arguments:
              sectionName === "packageManager"
                ? [`${packageName}@${latestInLatestMajor.version}`]
                : [packageName, latestInLatestMajor.version, sectionName],
            tooltip: this.getVersionTooltip(
              latestInLatestMajor,
              `Update to latest safe version in v${latestMajor} (latest major)`
            )
          })
        );
      }
    }

    return codeLenses;
  }

  /**
   * Get vulnerability indicator for a version
   */
  private getVulnerabilityIndicator(version: SafeVersion): string {
    if (!version.vulnerabilities || version.vulnerabilities.length === 0) {
      return "";
    }

    const critical = version.vulnerabilities.filter(
      (v) => v.severity === "critical"
    ).length;
    const high = version.vulnerabilities.filter(
      (v) => v.severity === "high"
    ).length;
    const moderate = version.vulnerabilities.filter(
      (v) => v.severity === "moderate"
    ).length;
    const low = version.vulnerabilities.filter(
      (v) => v.severity === "low"
    ).length;

    if (critical > 0) return ` $(warning)${critical}C`;
    if (high > 0) return ` $(warning)${high}H`;
    if (moderate > 0) return ` $(alert)${moderate}M`;
    if (low > 0) return ` $(info)${low}L`;

    return "";
  }

  /**
   * Get tooltip with vulnerability information
   */
  private getVersionTooltip(version: SafeVersion, baseTooltip: string): string {
    if (!version.vulnerabilities || version.vulnerabilities.length === 0) {
      return baseTooltip;
    }

    const vulnSummary = version.vulnerabilities
      .map((v) => `${v.severity.toUpperCase()}: ${v.title}`)
      .join("\n");

    return `${baseTooltip}\n\nVulnerabilities:\n${vulnSummary}`;
  }

  /**
   * Create "all versions" button
   */
  createAllVersionsButton(
    range: vscode.Range,
    packageName: string,
    minimumReleaseAge: number,
    sectionName: string,
    isPackageManager: boolean = false,
    currentVersion?: string
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: "$(versions) all versions",
      command: isPackageManager
        ? COMMANDS.SHOW_PACKAGE_MANAGER_VERSIONS
        : COMMANDS.SHOW_VERSION_INFO,
      arguments: isPackageManager
        ? [packageName, minimumReleaseAge]
        : [packageName, minimumReleaseAge, sectionName, currentVersion],
      tooltip: `View all available ${isPackageManager ? packageName + " " : ""}versions`
    });
  }
}
