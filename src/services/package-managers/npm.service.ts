import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import {
  PackageManagerConfig,
  PackageManagerInfo
} from "../../types/package-manager.types";

/**
 * NPM package manager service (stub - not yet implemented)
 */
export class NpmService implements IPackageManagerService {
  constructor(private info: PackageManagerInfo) {}

  getInfo(): PackageManagerInfo {
    return this.info;
  }

  async getConfig(_workspaceUri: vscode.Uri): Promise<PackageManagerConfig> {
    // TODO: Implement NPM support
    return {
      minimumReleaseAge: 0,
      isSupported: false,
      unsupportedReason:
        "NPM support is not yet implemented. Only pnpm is currently supported."
    };
  }

  isFeatureSupported(): boolean {
    // TODO: Check if NPM has equivalent time quarantine feature
    return false;
  }

  getUnsupportedReason(): string | undefined {
    return "NPM support is not yet implemented. Only pnpm is currently supported.";
  }
}
