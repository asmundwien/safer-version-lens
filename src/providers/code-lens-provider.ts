import * as vscode from "vscode";
import { NpmRegistryService } from "../services/npm-registry-service";
import { PnpmConfigService } from "../services/pnpm-config-service";
import { VersionFilterService } from "../services/version-filter-service";
import {
  findDependencyInSection,
  shouldSkipVersion
} from "../utils/package-json-parser";

export class SaferVersionCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(
    private npmRegistry: NpmRegistryService,
    private pnpmConfig: PnpmConfigService,
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

    if (!document.fileName.endsWith("package.json")) {
      console.log("[SaferVersionLens] Not a package.json file, skipping");
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

      const minimumReleaseAge = await this.pnpmConfig.getMinimumReleaseAge(
        workspaceFolder.uri
      );

      console.log("[SaferVersionLens] Minimum release age:", minimumReleaseAge);

      const codeLenses: vscode.CodeLens[] = [];

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
    if (!dependencies) {
      return;
    }

    const text = document.getText();

    for (const [packageName, currentVersion] of Object.entries(dependencies)) {
      if (shouldSkipVersion(currentVersion)) {
        continue;
      }

      const location = findDependencyInSection(text, packageName, sectionName);
      if (!location) {
        continue;
      }

      const position = document.positionAt(location.position);
      const range = new vscode.Range(position, position);

      try {
        const metadata =
          await this.npmRegistry.fetchPackageMetadata(packageName);
        if (!metadata) {
          continue;
        }

        const allVersions = this.versionFilter.filterVersions(
          metadata,
          minimumReleaseAge
        );
        const latestSafe = this.versionFilter.getLatestSafeVersion(allVersions);

        if (latestSafe) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `✓ ${latestSafe.version} (safe)`,
              command: "safer-version-lens.showVersionInfo",
              arguments: [packageName, minimumReleaseAge]
            })
          );
        } else if (minimumReleaseAge > 0) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `⚠ No safe versions (quarantine: ${minimumReleaseAge} min)`,
              command: "safer-version-lens.showVersionInfo",
              arguments: [packageName, minimumReleaseAge]
            })
          );
        }
      } catch (error) {
        console.error(`Error processing ${packageName}:`, error);
      }
    }
  }
}
