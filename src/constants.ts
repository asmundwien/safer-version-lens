/**
 * Command identifiers used throughout the extension
 */
export const COMMANDS = {
  UPDATE_PACKAGE_VERSION: "safer-version-lens.updatePackageVersion",
  UPDATE_PACKAGE_MANAGER_VERSION:
    "safer-version-lens.updatePackageManagerVersion",
  SHOW_VERSION_INFO: "safer-version-lens.showVersionInfo",
  SHOW_PACKAGE_MANAGER_VERSIONS:
    "safer-version-lens.showPackageManagerVersions",
  REFRESH: "safer-version-lens.refresh",
  SHOW_CONFIG: "safer-version-lens.showConfig",
  TOGGLE_ENABLED: "safer-version-lens.toggleEnabled",
  TOGGLE_PRERELEASE: "safer-version-lens.togglePrerelease"
} as const;

/**
 * Configuration section name
 */
export const CONFIG_SECTION = "saferVersionLens";

/**
 * Configuration keys
 */
export const CONFIG_KEYS = {
  ENABLED: "enabled",
  SHOW_PRERELEASE: "showPrerelease",
  REGISTRY: "registry"
} as const;

/**
 * File patterns
 */
export const PATTERNS = {
  PACKAGE_JSON: "**/package.json",
  PNPM_WORKSPACE: "**/pnpm-workspace.yaml"
} as const;
