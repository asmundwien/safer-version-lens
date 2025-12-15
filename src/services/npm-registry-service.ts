import * as vscode from "vscode";
import { PackageMetadata } from "../types";
import { CacheService } from "./cache-service";

export class NpmRegistryService {
  private cache: CacheService<PackageMetadata>;

  constructor() {
    this.cache = new CacheService<PackageMetadata>(5 * 60 * 1000); // 5 minutes
  }

  /**
   * Fetch package metadata from npm registry
   */
  async fetchPackageMetadata(
    packageName: string
  ): Promise<PackageMetadata | null> {
    // Check cache first
    const cached = this.cache.get(packageName);
    if (cached) {
      return cached;
    }

    try {
      const registry = this.getRegistry();
      const url = `${registry}/${packageName.replace("/", "%2F")}`;

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to fetch ${packageName}: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as PackageMetadata;

      // Cache the result
      this.cache.set(packageName, data);

      return data;
    } catch (error) {
      console.error(
        `Error fetching package metadata for ${packageName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get the npm registry URL from configuration
   */
  private getRegistry(): string {
    const config = vscode.workspace.getConfiguration("saferVersionLens");
    return config.get<string>("registry") || "https://registry.npmjs.org";
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
