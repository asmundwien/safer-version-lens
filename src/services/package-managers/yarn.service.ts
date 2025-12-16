import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import {
  PackageManagerConfig,
  PackageManagerInfo
} from "../../types/package-manager.types";

/**
 * Yarn package manager service
 * Supports npmMinimalAgeGate configuration
 */
export class YarnService implements IPackageManagerService {
  constructor(private info: PackageManagerInfo) {}

  getInfo(): PackageManagerInfo {
    return this.info;
  }

  async getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig> {
    // Read .yarnrc.yml for npmMinimalAgeGate
    const yarnrcUri = vscode.Uri.joinPath(workspaceUri, ".yarnrc.yml");

    try {
      const content = await vscode.workspace.fs.readFile(yarnrcUri);
      const text = Buffer.from(content).toString("utf8");
      const npmMinimalAgeGate = this.parseNpmMinimalAgeGate(text);

      return {
        minimumReleaseAge: npmMinimalAgeGate ?? 0
      };
    } catch (error) {
      // File doesn't exist - that's okay, just means no time quarantine configured
      console.log(
        "[SaferVersionLens] .yarnrc.yml not found or unreadable:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        minimumReleaseAge: 0
      };
    }
  }

  /**
   * Parse npmMinimalAgeGate from .yarnrc.yml content
   * Format: npmMinimalAgeGate: "3d" (duration string like "3d", "7d", "24h", etc.)
   * Converts to minutes for consistency with pnpm
   *
   * Supported units: d (days), h (hours), m (minutes), s (seconds)
   */
  private parseNpmMinimalAgeGate(content: string): number | undefined {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // YAML format: npmMinimalAgeGate: "3d" or npmMinimalAgeGate: 3d
      if (trimmed.startsWith("npmMinimalAgeGate:")) {
        const value = trimmed.split(":")[1]?.trim().replace(/["']/g, "");
        if (value) {
          return this.parseDuration(value);
        }
      }
    }
    return undefined;
  }

  /**
   * Parse duration string (e.g., "3d", "7d", "24h", "10080m") to minutes
   */
  private parseDuration(duration: string): number | undefined {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      // Try parsing as plain number (assume minutes for backwards compatibility)
      const num = parseInt(duration, 10);
      return isNaN(num) ? undefined : num;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s": // seconds
        return Math.floor(value / 60);
      case "m": // minutes
        return value;
      case "h": // hours
        return value * 60;
      case "d": // days
        return value * 60 * 24;
      default:
        return undefined;
    }
  }
}
