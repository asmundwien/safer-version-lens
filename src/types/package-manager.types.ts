/**
 * Package manager types and configuration interfaces
 */

export type PackageManagerType = "pnpm" | "yarn" | "npm" | "unknown";

/**
 * Configuration returned by package manager services
 */
export interface PackageManagerConfig {
  /**
   * Minimum release age in minutes (0 if not configured)
   */
  minimumReleaseAge: number;
}

/**
 * Information about the detected package manager
 */
export interface PackageManagerInfo {
  /**
   * Type of package manager (pnpm, yarn, npm, unknown)
   */
  type: PackageManagerType;

  /**
   * Version string (e.g., "10.25.0")
   */
  version: string;

  /**
   * Full packageManager field value (e.g., "pnpm@10.25.0")
   */
  fullSpec: string;
}
