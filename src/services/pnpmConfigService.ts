import * as vscode from "vscode";
import { PnpmConfig } from "../types";

export class PnpmConfigService {
  /**
   * Reads pnpm configuration to get minimumReleaseAge setting
   * Only reads from pnpm-workspace.yaml as this is a pnpm-specific feature
   */
  async getPnpmConfig(workspaceFolder: vscode.Uri): Promise<PnpmConfig> {
    const config: PnpmConfig = {};

    // Read pnpm-workspace.yaml
    const workspaceYamlUri = vscode.Uri.joinPath(
      workspaceFolder,
      "pnpm-workspace.yaml"
    );
    try {
      const content = await vscode.workspace.fs.readFile(workspaceYamlUri);
      const text = Buffer.from(content).toString("utf8");
      const minimumReleaseAge = this.parseMinimumReleaseAge(text);
      if (minimumReleaseAge !== undefined) {
        config.minimumReleaseAge = minimumReleaseAge;
      }
    } catch (error) {
      // File doesn't exist or can't be read - that's okay, no time quarantine
    }

    return config;
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
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      }
    }
    return undefined;
  }

  /**
   * Get the minimum release age in minutes
   * Returns 0 if not configured (no time quarantine)
   */
  async getMinimumReleaseAge(workspaceFolder: vscode.Uri): Promise<number> {
    const config = await this.getPnpmConfig(workspaceFolder);
    return config.minimumReleaseAge ?? 0;
  }
}
