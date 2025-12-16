import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import {
  PackageManagerConfig,
  PackageManagerInfo
} from "../../types/package-manager.types";

/**
 * pnpm package manager service
 */
export class PnpmService implements IPackageManagerService {
  constructor(private info: PackageManagerInfo) {}

  getInfo(): PackageManagerInfo {
    return this.info;
  }

  async getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig> {
    // Read pnpm-workspace.yaml for minimum-release-age
    const workspaceYamlUri = vscode.Uri.joinPath(
      workspaceUri,
      "pnpm-workspace.yaml"
    );

    try {
      const content = await vscode.workspace.fs.readFile(workspaceYamlUri);
      const text = Buffer.from(content).toString("utf8");
      const minimumReleaseAge = this.parseMinimumReleaseAge(text);

      return {
        minimumReleaseAge: minimumReleaseAge ?? 0
      };
    } catch (error) {
      // File doesn't exist - that's okay, just means no time quarantine configured
      console.log(
        "[SaferVersionLens] pnpm-workspace.yaml not found or unreadable:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        minimumReleaseAge: 0
      };
    }
  }

  /**
   * Parse minimumReleaseAge from pnpm-workspace.yaml content
   * Format: minimumReleaseAge: 10080 (in minutes)
   */
  private parseMinimumReleaseAge(content: string): number | undefined {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // YAML format: minimumReleaseAge: 10080
      if (trimmed.startsWith("minimumReleaseAge:")) {
        const value = trimmed.split(":")[1]?.trim();
        if (value) {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    return undefined;
  }
}
