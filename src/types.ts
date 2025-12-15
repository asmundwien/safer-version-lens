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
  minimumReleaseAge?: number; // in minutes
}

export interface SafeVersion {
  version: string;
  publishedAt: Date;
  isSafe: boolean;
  reason?: string;
}
