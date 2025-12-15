export interface PackageMetadata {
  name: string;
  versions: Record<string, VersionInfo>;
  "dist-tags": {
    latest: string;
    [key: string]: string;
  };
  time: {
    created: string;
    modified: string;
    [version: string]: string;
  };
}

export interface VersionInfo {
  version: string;
  publishedAt: Date;
}

export interface PnpmConfig {
  /**
   * Minimum release age in minutes
   */
  minimumReleaseAge?: number;
}

export interface SafeVersion {
  version: string;
  publishedAt: Date;
  isSafe: boolean;
  reason?: string;
  vulnerabilities?: Vulnerability[];
}

export type VulnerabilitySeverity =
  | "critical"
  | "high"
  | "moderate"
  | "low"
  | "info";

export interface Vulnerability {
  id: number;
  title: string;
  severity: VulnerabilitySeverity;
  url: string;
  vulnerable_versions: string;
  module_name: string;
}

export interface AuditResponse {
  [packageName: string]: Vulnerability[];
}
