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
   * Returns config with isSupported=false if feature not available
   */
  getConfig(workspaceUri: vscode.Uri): Promise<PackageManagerConfig>;

  /**
   * Check if the current version supports the required features
   */
  isFeatureSupported(): boolean;

  /**
   * Get the reason why a feature is not supported (if applicable)
   */
  getUnsupportedReason(): string | undefined;
}
