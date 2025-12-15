import { PackageMetadata, SafeVersion } from "../types";
import { formatAge, minutesToMs } from "../utils/date-utils";

export class VersionFilterService {
  /**
   * Filter versions based on minimum release age
   */
  filterVersions(
    metadata: PackageMetadata,
    minimumReleaseAgeMinutes: number
  ): SafeVersion[] {
    const now = Date.now();
    const minimumAgeMs = minutesToMs(minimumReleaseAgeMinutes);
    const safeVersions: SafeVersion[] = [];

    for (const [version, versionData] of Object.entries(metadata.versions)) {
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
   * Get the latest safe version
   */
  getLatestSafeVersion(allVersions: SafeVersion[]): SafeVersion | null {
    const safe = this.getSafeVersions(allVersions);
    return safe.length > 0 ? safe[0] : null;
  }
}
