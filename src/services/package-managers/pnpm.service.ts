import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import {
  PackageManagerConfig,
  PackageManagerInfo,
  FEATURE_REQUIREMENTS
} from "../../types/package-manager.types";
import { meetsMinimumVersion } from "../../utils/version-validator";

/**
 * pnpm package manager service
 */
export class PnpmService implements IPackageManagerService {
  constructor(private info: PackageManagerInfo) {}

  getInfo(): PackageManagerInfo {
    return this.info;
  }

  async getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig> {
    // Check if feature is supported
    if (!this.isFeatureSupported()) {
      return {
        minimumReleaseAge: 0,
        isSupported: false,
        unsupportedReason: this.getUnsupportedReason()
      };
    }

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
        minimumReleaseAge: minimumReleaseAge ?? 0,
        isSupported: true
      };
    } catch (error) {
      // File doesn't exist - that's okay, just means no time quarantine configured
      return {
        minimumReleaseAge: 0,
        isSupported: true
      };
    }
  }

  isFeatureSupported(): boolean {
    const requirement = FEATURE_REQUIREMENTS.pnpm;
    if (!requirement) return false;

    // If version is unknown, assume not supported
    if (this.info.version === "unknown") {
      return false;
    }

    return meetsMinimumVersion(this.info.version, requirement.minVersion);
  }

  getUnsupportedReason(): string | undefined {
    const requirement = FEATURE_REQUIREMENTS.pnpm;
    if (!requirement) return undefined;

    if (this.info.version === "unknown") {
      return `pnpm version not specified in package.json. Requires pnpm ${requirement.minVersion}+ for ${requirement.feature}`;
    }

    if (!this.isFeatureSupported()) {
      return `pnpm ${this.info.version} does not support ${requirement.feature}. Requires pnpm ${requirement.minVersion}+`;
    }

    return undefined;
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
