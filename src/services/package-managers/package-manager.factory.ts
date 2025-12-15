import * as vscode from "vscode";
import { IPackageManagerService } from "./package-manager.interface";
import { PackageManagerDetector } from "./package-manager-detector";
import { PnpmService } from "./pnpm.service";
import { YarnService } from "./yarn.service";
import { NpmService } from "./npm.service";
import { PackageManagerInfo } from "../../types/package-manager.types";

/**
 * Factory for creating package manager service instances
 */
export class PackageManagerFactory {
  private detector: PackageManagerDetector;

  constructor() {
    this.detector = new PackageManagerDetector();
  }

  /**
   * Create a package manager service based on workspace detection
   */
  async create(
    workspaceUri: vscode.Uri
  ): Promise<IPackageManagerService | null> {
    const info = await this.detector.detect(workspaceUri);

    return this.createFromInfo(info);
  }

  /**
   * Create a package manager service from package manager info
   */
  createFromInfo(info: PackageManagerInfo): IPackageManagerService | null {
    switch (info.type) {
      case "pnpm":
        return new PnpmService(info);
      case "yarn":
        return new YarnService(info);
      case "npm":
        return new NpmService(info);
      case "unknown":
      default:
        return null;
    }
  }

  /**
   * Get the detector instance (useful for CodeLens)
   */
  getDetector(): PackageManagerDetector {
    return this.detector;
  }
}
