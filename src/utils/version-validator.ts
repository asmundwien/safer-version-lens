/**
 * Utility for validating and comparing semantic versions
 */

/**
 * Parse a semantic version string into components
 */
function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version string: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);

  if (versionA.major !== versionB.major) {
    return versionA.major - versionB.major;
  }

  if (versionA.minor !== versionB.minor) {
    return versionA.minor - versionB.minor;
  }

  return versionA.patch - versionB.patch;
}

/**
 * Check if a version meets a minimum version requirement
 */
export function meetsMinimumVersion(
  currentVersion: string,
  minVersion: string
): boolean {
  try {
    return compareVersions(currentVersion, minVersion) >= 0;
  } catch {
    return false;
  }
}

/**
 * Extract version from package manager spec (e.g., "pnpm@10.25.0" -> "10.25.0")
 */
export function extractVersionFromSpec(spec: string): string {
  const match = spec.match(/@([\d.]+)/);
  return match ? match[1] : "";
}

/**
 * Extract package manager name from spec (e.g., "pnpm@10.25.0" -> "pnpm")
 */
export function extractNameFromSpec(spec: string): string {
  const match = spec.match(/^([^@]+)@/);
  return match ? match[1] : spec;
}
