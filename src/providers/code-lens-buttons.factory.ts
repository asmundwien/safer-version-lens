import * as vscode from "vscode";
import { SafeVersion } from "../types";
import { VersionFilterService } from "../services/version-filter-service";
import { COMMANDS } from "../constants";

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

    // Button 1: Latest safe in current major
    const latestInCurrentMajor = this.versionFilter.getLatestSafeVersionInMajor(
      allVersions,
      currentMajor
    );

    if (
      latestInCurrentMajor &&
      latestInCurrentMajor.version !== currentVersion
    ) {
      codeLenses.push(
        new vscode.CodeLens(range, {
          title: `$(arrow-up) ${latestInCurrentMajor.version}`,
          command: commandPrefix,
          arguments:
            sectionName === "packageManager"
              ? [`${packageName}@${latestInCurrentMajor.version}`]
              : [packageName, latestInCurrentMajor.version, sectionName],
          tooltip: `Update to latest safe version in v${currentMajor}`
        })
      );
    }

    // Button 2: Latest safe in latest major (if different)
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
            command: commandPrefix,
            arguments:
              sectionName === "packageManager"
                ? [`${packageName}@${latestInLatestMajor.version}`]
                : [packageName, latestInLatestMajor.version, sectionName],
            tooltip: `Update to latest safe version in v${latestMajor} (latest major)`
          })
        );
      }
    }

    return codeLenses;
  }

  /**
   * Create "all versions" button
   */
  createAllVersionsButton(
    range: vscode.Range,
    packageName: string,
    minimumReleaseAge: number,
    sectionName: string,
    isPackageManager: boolean = false
  ): vscode.CodeLens {
    return new vscode.CodeLens(range, {
      title: "$(versions) all versions",
      command: isPackageManager
        ? COMMANDS.SHOW_PACKAGE_MANAGER_VERSIONS
        : COMMANDS.SHOW_VERSION_INFO,
      arguments: isPackageManager
        ? [packageName, minimumReleaseAge]
        : [packageName, minimumReleaseAge, sectionName],
      tooltip: `View all available ${isPackageManager ? packageName + " " : ""}versions`
    });
  }
}
