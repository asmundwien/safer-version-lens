# Safer Version Lens

A VS Code extension that shows safe package versions respecting your package manager's time quarantine configuration, with built-in security vulnerability auditing.

## Features

### 🔒 Time Quarantine Support

- **Respects pnpm's `minimum-release-age`**: Only suggests versions that have aged beyond your configured quarantine period
- **Visual indicators**: Clear badges showing which versions are safe vs. in quarantine
- **Multi-package manager**: Support for pnpm (with npm/yarn detection coming)

### 🛡️ Security Vulnerability Auditing

- **Automatic vulnerability scanning**: Checks NPM security advisories for all package versions
- **Visual vulnerability indicators**: Shows security status with color-coded emojis
  - `⛔ Critical` - Critical severity vulnerabilities
  - `🔴 High` - High severity vulnerabilities
  - `🟠 Moderate` - Moderate severity vulnerabilities
  - `🟡 Low` - Low severity vulnerabilities
- **Accurate version matching**: Uses semver ranges to show only vulnerabilities that affect each specific version
- **Smart filtering**: Won't suggest versions with vulnerabilities above your configured threshold (default: low severity)
- **Clickable vulnerability links**: View detailed security advisories in your browser
- **Cached results**: 30-minute cache for fast subsequent checks

### 📦 Version Update CodeLens

- **Inline version buttons**: Click to update directly from CodeLens
  - `↑ Latest in current major` - Safest patch/minor update
  - `🚀 Latest major` - Upgrade to newest major version
  - `📋 all versions` - Browse complete version list
- **Works on dependencies**: supports `dependencies`, `devDependencies`, `peerDependencies`
- **Package manager updates**: Update `packageManager` field (e.g., `pnpm@10.21.0`)

### ⚙️ Toggle Controls

- Enable/disable the extension on-the-fly
- Show/hide pre-release versions (alpha, beta, rc, etc.)

## Requirements

- **VS Code 1.107.0 or higher**
- **Package manager**: One of:
  - pnpm 10.21.0+ (for `minimum-release-age` support)
  - npm (time quarantine not yet supported)
  - yarn (time quarantine not yet supported)
- **Corepack** (recommended): For automatic package manager version detection

## Extension Settings

This extension contributes the following settings:

- `saferVersionLens.enabled`: Enable/disable Safer Version Lens (default: `false`)
- `saferVersionLens.showPrerelease`: Show pre-release versions like alpha, beta, rc (default: `false`)
- `saferVersionLens.registry`: NPM registry URL to fetch package information from (default: `"https://registry.npmjs.org"`)
- `saferVersionLens.auditEnabled`: Enable security vulnerability auditing (default: `true`)
- `saferVersionLens.auditMaxSeverity`: Maximum allowed vulnerability severity for suggested versions (default: `"low"`)
  - `"critical"` - Allow only versions with critical vulnerabilities or lower
  - `"high"` - Allow up to and including high severity
  - `"moderate"` - Allow up to and including moderate severity
  - `"low"` - Allow up to and including low severity (**recommended**)
  - `"info"` - Show all versions regardless of vulnerabilities

## How It Works

### Time Quarantine

**Note**: Currently only supported for pnpm 10.21.0+. Yarn and npm quarantine support is on the roadmap.

When you set `minimumReleaseAge` in your `pnpm-workspace.yaml` file:

```yaml
minimumReleaseAge: 10080 # 7 days in minutes
```

The extension will:

1. Fetch package metadata from the NPM registry
2. Calculate the age of each version since publication
3. Only suggest versions older than your configured threshold
4. Show time-since-release info for versions in quarantine

### Security Auditing

The extension:

1. Queries the NPM security advisory API for all displayed versions
2. Uses semver range matching to show only vulnerabilities affecting each specific version
3. Filters versions with vulnerabilities above your `auditMaxSeverity` setting
4. Shows vulnerability counts and severities in version descriptions
5. Provides clickable links to detailed security advisories

**Note**: The version list shows ALL versions (including vulnerable ones) so you can make informed decisions, but the quick-update buttons only suggest secure versions.

## Known Issues

- Yarn and npm time quarantine support not yet implemented (detection only)
- No keyboard shortcuts for common actions

## Roadmap

- [ ] Yarn time quarantine support (via `--install.update-stable-delay`)
- [ ] npm time quarantine support (via custom config)
- [ ] Workspace-wide package updates
- [ ] Batch vulnerability remediation

---

**Enjoy safer dependency management!**
