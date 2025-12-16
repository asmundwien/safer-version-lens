import * as vscode from "vscode";
import {
  PackageManagerConfig,
  PackageManagerInfo
} from "../../types/package-manager.types";

/**
 * Abstract interface for package manager services
 * Each package manager (pnpm, yarn, npm) should implement this interface
 */
export interface IPackageManagerService {
  /**
   * Get package manager information
   */
  getInfo(): PackageManagerInfo;

  /**
   * Get configuration including minimum release age
   */
  getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig>;
}
