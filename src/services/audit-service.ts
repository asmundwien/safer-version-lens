import { AuditResponse, Vulnerability } from "../types";
import { CacheService } from "./cache-service";
import * as semver from "semver";

/**
 * Service for auditing npm packages for security vulnerabilities
 */
export class AuditService {
  private cache: CacheService<Vulnerability[]>;
  private readonly auditEndpoint =
    "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";

  constructor(cacheDurationMs: number = 30 * 60 * 1000) {
    // 30 minutes default
    this.cache = new CacheService<Vulnerability[]>(cacheDurationMs);
  }

  /**
   * Audit multiple versions of a package for vulnerabilities
   * @param packageName The package to audit
   * @param versions Array of versions to check
   * @returns Map of version to vulnerabilities
   */
  async auditPackageVersions(
    packageName: string,
    versions: string[]
  ): Promise<Map<string, Vulnerability[]>> {
    const result = new Map<string, Vulnerability[]>();

    // Check cache first for each version
    const uncachedVersions: string[] = [];
    for (const version of versions) {
      const cacheKey = `${packageName}@${version}`;
      const cached = this.cache.get(cacheKey);
      if (cached) {
        result.set(version, cached);
      } else {
        uncachedVersions.push(version);
      }
    }

    // If all versions were cached, return early
    if (uncachedVersions.length === 0) {
      return result;
    }

    try {
      // Prepare bulk audit request
      const requestBody: Record<string, string[]> = {
        [packageName]: uncachedVersions
      };

      const response = await fetch(this.auditEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        console.error(`Audit API failed: ${response.status}`);
        // Return empty vulnerabilities for uncached versions
        uncachedVersions.forEach((v) => result.set(v, []));
        return result;
      }

      const auditData = (await response.json()) as AuditResponse;

      // Process audit results
      for (const version of uncachedVersions) {
        const vulns = this.filterVulnerabilitiesForVersion(
          auditData[packageName] || [],
          version
        );

        // Cache the result
        const cacheKey = `${packageName}@${version}`;
        this.cache.set(cacheKey, vulns);
        result.set(version, vulns);
      }

      return result;
    } catch (error) {
      console.error("Error auditing package:", error);
      // Return empty vulnerabilities for uncached versions on error
      uncachedVersions.forEach((v) => result.set(v, []));
      return result;
    }
  }

  /**
   * Filter vulnerabilities that apply to a specific version using semver range matching
   */
  private filterVulnerabilitiesForVersion(
    vulnerabilities: Vulnerability[],
    version: string
  ): Vulnerability[] {
    return vulnerabilities.filter((vuln) => {
      try {
        // The vulnerable_versions field contains a semver range like ">=16.0.0 <16.14.0"
        // Check if this specific version satisfies the vulnerable range
        const isVulnerable = semver.satisfies(
          version,
          vuln.vulnerable_versions
        );
        return isVulnerable;
      } catch (error) {
        // If we can't parse the range, be conservative and include the vulnerability
        console.warn(
          `Could not parse vulnerable_versions range "${vuln.vulnerable_versions}" for ${vuln.title}:`,
          error
        );
        return true;
      }
    });
  }

  /**
   * Get the highest severity level from a list of vulnerabilities
   */
  getHighestSeverity(
    vulnerabilities: Vulnerability[]
  ): "critical" | "high" | "moderate" | "low" | "info" | null {
    if (vulnerabilities.length === 0) return null;

    const severityOrder = ["critical", "high", "moderate", "low", "info"];
    for (const severity of severityOrder) {
      if (vulnerabilities.some((v) => v.severity === severity)) {
        return severity as any;
      }
    }
    return null;
  }

  /**
   * Clear the audit cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
