import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import {
  PackageManagerInfo,
  PackageManagerType
} from "../../types/package-manager.types";
import {
  extractVersionFromSpec,
  extractNameFromSpec
} from "../../utils/version-validator";

/**
 * Detects which package manager is being used in the workspace
 */
export class PackageManagerDetector {
  /**
   * Detect package manager from package.json's packageManager field
   */
  async detectFromPackageJson(
    workspaceUri: vscode.Uri
  ): Promise<PackageManagerInfo | null> {
    try {
      const packageJsonPath = path.join(workspaceUri.fsPath, "package.json");
      const content = await fs.promises.readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(content);

      if (!packageJson.packageManager) {
        return null;
      }

      const fullSpec = packageJson.packageManager as string;
      const name = extractNameFromSpec(fullSpec);
      const version = extractVersionFromSpec(fullSpec);

      return {
        type: this.normalizePackageManagerType(name),
        version,
        fullSpec
      };
    } catch (error) {
      console.error("Error reading package.json:", error);
      return null;
    }
  }

  /**
   * Detect package manager from lock files (fallback method)
   */
  async detectFromLockFiles(
    workspaceUri: vscode.Uri
  ): Promise<PackageManagerInfo | null> {
    const lockFiles: Array<{ file: string; type: PackageManagerType }> = [
      { file: "pnpm-lock.yaml", type: "pnpm" },
      { file: "yarn.lock", type: "yarn" },
      { file: "package-lock.json", type: "npm" }
    ];

    for (const { file, type } of lockFiles) {
      const lockFilePath = path.join(workspaceUri.fsPath, file);
      try {
        await fs.promises.access(lockFilePath);
        return {
          type,
          version: "unknown",
          fullSpec: `${type}@unknown`
        };
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  /**
   * Find workspace root by searching upward for lock files or pnpm-workspace.yaml
   */
  async findWorkspaceRoot(
    startUri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<vscode.Uri | null> {
    const lockFiles = ["pnpm-lock.yaml", "yarn.lock", "package-lock.json", "pnpm-workspace.yaml"];
    let currentDir = startUri.fsPath;
    const workspaceRoot = workspaceFolder.uri.fsPath;

    // Search upward until we reach the workspace root
    while (currentDir.startsWith(workspaceRoot)) {
      // Check if any lock file or workspace file exists in current directory
      for (const lockFile of lockFiles) {
        const lockFilePath = path.join(currentDir, lockFile);
        try {
          await fs.promises.access(lockFilePath);
          console.log(`[SaferVersionLens] Found ${lockFile} at:`, currentDir);
          return vscode.Uri.file(currentDir);
        } catch {
          // File doesn't exist, continue
        }
      }

      // Move up one directory
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached filesystem root
        break;
      }
      currentDir = parentDir;
    }

    // If nothing found, return the workspace folder root
    return workspaceFolder.uri;
  }

  /**
   * Detect package manager using both methods (packageManager field first, then lock files)
   */
  async detect(workspaceUri: vscode.Uri): Promise<PackageManagerInfo> {
    const fromPackageJson = await this.detectFromPackageJson(workspaceUri);
    if (fromPackageJson) {
      return fromPackageJson;
    }

    const fromLockFiles = await this.detectFromLockFiles(workspaceUri);
    if (fromLockFiles) {
      return fromLockFiles;
    }

    return {
      type: "unknown",
      version: "unknown",
      fullSpec: "unknown"
    };
  }

  /**
   * Normalize package manager name to type
   */
  private normalizePackageManagerType(name: string): PackageManagerType {
    const normalized = name.toLowerCase();
    if (normalized === "pnpm") return "pnpm";
    if (normalized === "yarn") return "yarn";
    if (normalized === "npm") return "npm";
    return "unknown";
  }
}
