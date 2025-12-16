import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import {
  PackageManagerConfig,
  PackageManagerInfo
} from "../../types/package-manager.types";

/**
 * NPM package manager service
 * Supports npm with --before configuration
 */
export class NpmService implements IPackageManagerService {
  constructor(private info: PackageManagerInfo) {}

  getInfo(): PackageManagerInfo {
    return this.info;
  }

  async getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig> {
    // Read .npmrc for before configuration
    const npmrcUri = vscode.Uri.joinPath(workspaceUri, ".npmrc");

    try {
      const content = await vscode.workspace.fs.readFile(npmrcUri);
      const text = Buffer.from(content).toString("utf8");
      const before = this.parseBefore(text);

      return {
        minimumReleaseAge: before ?? 0
      };
    } catch (error) {
      // File doesn't exist - that's okay, just means no time quarantine configured
      console.log(
        "[SaferVersionLens] .npmrc not found or unreadable:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return {
        minimumReleaseAge: 0
      };
    }
  }

  /**
   * Parse before from .npmrc content
   * Format: before=2024-12-16 (Date string only, no timestamps)
   * Converts to minutes in the past from now
   */
  private parseBefore(content: string): number | undefined {
    const lines = content.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip comments
      if (trimmed.startsWith("#") || trimmed.startsWith(";")) {
        continue;
      }
      // Format: before=2024-12-16 or before=null
      if (trimmed.startsWith("before=")) {
        const value = trimmed.split("=")[1]?.trim();
        if (value && value !== "null") {
          return this.parseBeforeValue(value);
        }
      }
    }
    return undefined;
  }

  /**
   * Parse before value to minutes in the past
   * Accepts: Date string only (YYYY-MM-DD, ISO 8601, etc.)
   */
  private parseBeforeValue(value: string): number | undefined {
    try {
      // Parse as a date string
      const beforeDate = new Date(value);
      if (!isNaN(beforeDate.getTime())) {
        const now = new Date();
        const diffMs = now.getTime() - beforeDate.getTime();
        return Math.floor(diffMs / 60000); // Convert to minutes
      }

      return undefined;
    } catch (error) {
      return undefined;
    }
  }
}
