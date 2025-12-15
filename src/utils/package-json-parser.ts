/**
 * Escape special regex characters in a string
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a version string should be skipped (workspace, file, etc.)
 */
export function shouldSkipVersion(version: string): boolean {
  return (
    version.startsWith("workspace:") ||
    version.startsWith("file:") ||
    version.startsWith("link:") ||
    version.startsWith("git:")
  );
}

export interface DependencyLocation {
  packageName: string;
  version: string;
  position: number;
}

/**
 * Find a specific dependency within a section (dependencies, devDependencies, etc.)
 */
export function findDependencyInSection(
  text: string,
  packageName: string,
  sectionName: string
): DependencyLocation | null {
  // First, find the section
  const sectionRegex = new RegExp(
    `"${sectionName}"\\s*:\\s*{([^}]*(?:{[^}]*}[^}]*)*)}`
  );
  const sectionMatch = sectionRegex.exec(text);

  if (!sectionMatch) {
    return null;
  }

  const sectionStart = sectionMatch.index + sectionMatch[0].indexOf("{");
  const sectionContent = sectionMatch[1];

  // Find the package within this section
  return findPackageInText(sectionContent, packageName, sectionStart);
}

/**
 * Helper function to find a package in text and return its location
 */
function findPackageInText(
  text: string,
  packageName: string,
  offset: number = 0
): DependencyLocation | null {
  const packageRegex = new RegExp(
    `"${escapeRegex(packageName)}"\\s*:\\s*"([^"]*)"`,
    "g"
  );
  const match = packageRegex.exec(text);

  if (!match) {
    return null;
  }

  return {
    packageName,
    version: match[1],
    position: offset + match.index
  };
}

/**
 * Find the packageManager field in package.json
 */
export function findPackageManagerField(
  text: string
): { spec: string; position: number } | null {
  const packageManagerRegex = /"packageManager"\s*:\s*"([^"]+)"/;
  const match = packageManagerRegex.exec(text);

  if (!match) {
    return null;
  }

  return {
    spec: match[1],
    position: match.index
  };
}
