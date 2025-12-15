/**
 * Package manager types and minimum versions for feature support
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

  /**
   * Whether the feature is supported by this package manager version
   */
  isSupported: boolean;

  /**
   * Reason if not supported (e.g., "Requires pnpm 10.21+")
   */
  unsupportedReason?: string;
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

/**
 * Feature support requirements for package managers
 */
export interface FeatureRequirement {
  /**
   * Minimum version required (semver string)
   */
  minVersion: string;

  /**
   * Description of the feature
   */
  feature: string;
}

/**
 * Feature requirements for each package manager
 */
export const FEATURE_REQUIREMENTS: Record<
  PackageManagerType,
  FeatureRequirement | null
> = {
  pnpm: {
    minVersion: "10.21.0",
    feature: "minimum-release-age configuration"
  },
  yarn: null, // TODO: Yarn support not yet implemented
  npm: null, // TODO: NPM support not yet implemented
  unknown: null
};
