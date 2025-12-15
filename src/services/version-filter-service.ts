import { PackageMetadata, SafeVersion } from "../types";
import { formatAge, minutesToMs } from "../utils/date-utils";

export class VersionFilterService {
  /**
   * Check if a version is a pre-release (contains a dash)
   */
  private isPrerelease(version: string): boolean {
    return version.includes("-");
  }

  /**
   * Filter versions based on minimum release age and optionally exclude pre-releases
   */
  filterVersions(
    metadata: PackageMetadata,
    minimumReleaseAgeMinutes: number,
    excludePrerelease: boolean = false
  ): SafeVersion[] {
    const now = Date.now();
    const minimumAgeMs = minutesToMs(minimumReleaseAgeMinutes);
    const safeVersions: SafeVersion[] = [];

    for (const [version, versionData] of Object.entries(metadata.versions)) {
      // Skip pre-releases if requested
      if (excludePrerelease && this.isPrerelease(version)) {
        continue;
      }

      const publishTimeStr = metadata.time[version];
      if (!publishTimeStr) {
        continue;
      }

      const publishedAt = new Date(publishTimeStr);
      const age = now - publishedAt.getTime();
      const isSafe = age >= minimumAgeMs;

      safeVersions.push({
        version,
        publishedAt,
        isSafe,
        reason: isSafe
          ? undefined
          : `Released ${formatAge(age)} ago (quarantine: ${formatAge(minimumAgeMs)})`
      });
    }

    // Sort by version (descending)
    safeVersions.sort((a, b) =>
      b.version.localeCompare(a.version, undefined, { numeric: true })
    );

    return safeVersions;
  }

  /**
   * Get only safe versions (outside quarantine)
   */
  getSafeVersions(allVersions: SafeVersion[]): SafeVersion[] {
    return allVersions.filter((v) => v.isSafe);
  }

  /**
   * Get the latest safe version, preferring stable releases over pre-releases
   */
  getLatestSafeVersion(allVersions: SafeVersion[]): SafeVersion | null {
    const safe = this.getSafeVersions(allVersions);
    if (safe.length === 0) {
      return null;
    }

    // First try to find a stable version
    const stableVersion = safe.find((v) => !this.isPrerelease(v.version));
    if (stableVersion) {
      return stableVersion;
    }

    // If no stable version, return the latest pre-release
    return safe[0];
  }

  /**
   * Get the latest stable (non-prerelease) safe version
   */
  getLatestStableVersion(allVersions: SafeVersion[]): SafeVersion | null {
    const safe = this.getSafeVersions(allVersions);
    const stable = safe.filter((v) => !this.isPrerelease(v.version));
    return stable.length > 0 ? stable[0] : null;
  }

  /**
   * Extract major version from a version string (e.g., "16.0.1" -> 16)
   */
  private getMajorVersion(version: string): number {
    const match = version.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the latest safe version within a specific major version
   */
  getLatestSafeVersionInMajor(
    allVersions: SafeVersion[],
    majorVersion: number
  ): SafeVersion | null {
    const safe = this.getSafeVersions(allVersions);
    const inMajor = safe.filter(
      (v) => this.getMajorVersion(v.version) === majorVersion
    );

    if (inMajor.length === 0) {
      return null;
    }

    // Prefer stable over prerelease
    const stable = inMajor.find((v) => !this.isPrerelease(v.version));
    return stable || inMajor[0];
  }

  /**
   * Get the highest major version available
   */
  getLatestMajorVersion(allVersions: SafeVersion[]): number {
    const safe = this.getSafeVersions(allVersions);
    if (safe.length === 0) {
      return 0;
    }

    return Math.max(...safe.map((v) => this.getMajorVersion(v.version)));
  }
}
