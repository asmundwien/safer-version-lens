# Safer Version Lens

**Inline package version updates with vulnerability checking for safer dependencies**

Stop manually checking NPM for updates. Safer Version Lens adds CodeLens directly in your `package.json` that show available versions with security vulnerabilities, and let you upgrade with a single click. Built-in security auditing helps you avoid vulnerable packages, and optional time quarantine support lets you wait for packages to mature before adopting them.

---

## Quick Start

1. **Install** the extension from the VS Code Marketplace
2. **Open** any `package.json` file
3. **Enable** it by clicking "Safer Version Lens" in the VSCode footer or via Command Palette: `Safer Version Lens: Toggle Enabled` (or in Settings: `saferVersionLens.enabled: true`).
4. **See** CodeLens buttons appear above each dependency showing available versions with vulnerability indicators
5. **Click** a version to update instantly or browse all versions with security details.

That's it! No configuration needed to get started.

---

## Features

### 📦 Inline Version Updates (All Package Managers)

Get intelligent version suggestions directly in your `package.json` without leaving your editor.

**Quick Update Buttons:**

- `↑ Latest in current major` - Safe patch/minor updates (e.g., `2.5.0` → `2.8.3`)
- `🚀 Latest major` - Major version upgrades (e.g., `2.5.0` → `3.1.0`)
- `📋 all versions` - Browse all available versions with detailed security analysis.

**Works on** all dependencies and package managers.

---

### 🛡️ Security Vulnerability Auditing (All Package Managers)

Automatically checks NPM security advisories for every version before you upgrade.

**Visual Security Indicators:**

- `⛔ Critical` - Critical severity vulnerabilities
- `🔴 High` - High severity vulnerabilities
- `🟠 Moderate` - Moderate severity vulnerabilities
- `🟡 Low` - Low severity vulnerabilities
- `✅` - No known vulnerabilities

**Smart Security Features:**

- **Accurate version matching**: Uses semver to show vulnerabilities affecting each specific version of a package.
- **Quick-update protection**: Set maximum acceptable severity for suggested package updates (default: low)
- **Clickable vulnerability links**: Click to view detailed NPM security advisories
- **Performance optimized**: Results cached for 30 minutes

**Note**: The "all versions" view shows complete version history including vulnerable packages, so you can make informed decisions on what to upgrade. The quick-update buttons (`↑` and `🚀`) automatically filter out versions exceeding your configured severity threshold.

---

### 🔒 Time Quarantine Support (pnpm, Yarn & npm)

For teams using pnpm, Yarn, or npm with time quarantine configuration, Safer Version Lens respects your settings.

**What is Time Quarantine?**
Time quarantine delays adoption of newly-published package versions, reducing risk from:

- Malicious packages that get quickly detected and removed
- Critical bugs discovered shortly after release
- Breaking changes not caught during initial testing

**Setup:**

**For pnpm users** - Add to your `pnpm-workspace.yaml`:

```yaml
minimumReleaseAge: 10080 # 7 days in minutes
```

**For Yarn users** - Add to your `.yarnrc.yml`:

```yaml
npmMinimalAgeGate: "7d"  # 7 days (supports: d=days, h=hours, m=minutes, s=seconds)
```

**For npm users** - Add to your `.npmrc`:

```ini
before=2024-12-09  # Only install packages published before this date (YYYY-MM-DD)
```

The extension will:

- Only suggest versions older than your configured threshold
- Show visual indicators for versions still in quarantine
- Display time-since-release for recent versions
- Automatically filter quick-update buttons to exclude quarantined versions

---

### Additional Features

- **Toggle controls**: Enable/disable extension on-the-fly via Command Palette
- **Pre-release filtering**: Show/hide alpha, beta, rc, canary, and dev versions
- **Custom registries**: Configure alternative NPM registries
- **Multi-workspace support**: Automatically detects package manager per workspace folder
- **Refresh on demand**: Force refresh cached data when needed

---

## Configuration

All settings are optional. The extension works with sensible defaults out of the box.

### Extension Settings

| Setting                             | Default                      | Description                                                   |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| `saferVersionLens.enabled`          | `false`                      | Enable/disable Safer Version Lens                             |
| `saferVersionLens.showPrerelease`   | `false`                      | Show pre-release versions (alpha, beta, rc, canary, dev)      |
| `saferVersionLens.registry`         | `https://registry.npmjs.org` | NPM registry URL to fetch package information from            |
| `saferVersionLens.auditEnabled`     | `true`                       | Enable security vulnerability auditing for package versions   |
| `saferVersionLens.auditMaxSeverity` | `low`                        | Maximum allowed vulnerability severity for suggested versions |

### Security Severity Levels

Configure `saferVersionLens.auditMaxSeverity` to control which versions appear in quick-update buttons:

| Value      | Behavior                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- |
| `critical` | Only exclude versions with critical vulnerabilities                                      |
| `high`     | Exclude versions with high or critical vulnerabilities                                   |
| `moderate` | Exclude versions with moderate, high, or critical vulnerabilities                        |
| `low`      | Exclude versions with low, moderate, high, or critical vulnerabilities (**recommended**) |
| `info`     | Show all versions regardless of vulnerabilities                                          |

### Commands

Available via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- `Safer Version Lens: Toggle Enabled` - Turn extension on/off
- `Safer Version Lens: Toggle Pre-release Versions` - Show/hide pre-release versions
- `Safer Version Lens: Refresh` - Clear cache and reload version data
- `Safer Version Lens: Show Configuration` - View current configuration

---

## How It Works

### Version Updates

1. When you open a `package.json` file, the extension detects your package manager
2. For each dependency, it fetches available versions from the NPM registry
3. Filters versions based on your pre-release and time quarantine settings
4. Runs security audits on all available versions
5. Displays CodeLens buttons above each dependency
6. Clicking a version updates the `package.json` file in place

### Security Auditing

1. Queries the NPM security advisory API for each displayed package
2. Uses semver range matching to determine which versions are affected
3. Caches results for 30 minutes to optimize performance
4. Shows vulnerability severity indicators inline with version numbers
5. Filters quick-update buttons to exclude versions above your threshold

### Time Quarantine (pnpm, Yarn & npm)

1. Reads configuration from package manager config files:
   - pnpm: `minimumReleaseAge` from `pnpm-workspace.yaml` (in minutes)
   - Yarn: `npmMinimalAgeGate` from `.yarnrc.yml` (duration string like "7d", "24h", etc.)
   - npm: `before` from `.npmrc` (date string like "2024-12-09")
2. Fetches package publish timestamps from NPM registry
3. Calculates age of each version since publication
4. Filters out versions younger than the configured threshold
5. Shows time-since-release for versions near the quarantine boundary

---

## Requirements

- **VS Code**: 1.107.0 or higher
- **Package Manager**: npm, pnpm, or yarn
  - Time quarantine: Works with all package managers when configured
- **Internet connection**: Fetches data from NPM registry and security advisory APIs

**Optional:**

- **Corepack**: Enables automatic package manager version detection

---

## FAQ / Troubleshooting

### The extension isn't showing any CodeLens buttons

1. Make sure the extension is enabled: `Safer Version Lens: Toggle Enabled`
2. Verify you have a `package.json` file open
3. Check that `package.json` contains a `dependencies`, `devDependencies`, `peerDependencies`, or `packageManager` field

### Version suggestions seem outdated

The extension caches registry and audit data for 30 minutes. Run `Safer Version Lens: Refresh` to clear the cache and fetch fresh data.

### I'm using pnpm but time quarantine isn't working

Ensure you:

1. Have `minimumReleaseAge` configured in `pnpm-workspace.yaml`
2. Have a `packageManager` field in `package.json` specifying pnpm (e.g., `"packageManager": "pnpm@10.25.0"`)

### I'm using Yarn but time quarantine isn't working

Ensure you:

1. Have `npmMinimalAgeGate` configured in `.yarnrc.yml`
2. Have a `packageManager` field in `package.json` specifying Yarn (e.g., `"packageManager": "yarn@4.0.0"`)
3. The value uses duration string format (e.g., `"7d"` for 7 days, `"24h"` for 24 hours)

### I'm using npm but time quarantine isn't working

Ensure you:

1. Have `before` configured in `.npmrc` in your project root
2. Have a `packageManager` field in `package.json` specifying npm (e.g., `"packageManager": "npm@10.0.0"`)
3. The value uses a date format (e.g., `2024-12-09` for YYYY-MM-DD)

### Does this work with private registries?

Yes! Configure your registry URL in settings: `saferVersionLens.registry: "https://your-registry.com"`

### Does this slow down my editor?

No. The extension:

- Only activates when viewing `package.json` files
- Caches all network requests for 30 minutes
- Fetches data asynchronously without blocking the editor
- Uses CodeLens for non-intrusive UI and great DX

### How is this different from Version Lens?

| Feature                                 | Safer Version Lens | Version Lens |
| --------------------------------------- | ------------------ | ------------ |
| Security vulnerability auditing         | ✅ Built-in        | ❌ No        |
| Time quarantine (pnpm, Yarn & npm)      | ✅ Yes             | ❌ No        |
| Inline version updates                  | ✅ Yes             | ✅ Yes       |

Safer Version Lens focuses on **secure dependency management** with optional time quarantine for risk-averse teams.

### How is this different from Dependabot/Renovate?

**Dependabot/Renovate**: Automated PR-based updates via GitHub/GitLab.

**Safer Version Lens**: Manual on-demand updates with security visibility in your editor

Use both together! Dependabot/Renovate for automation, Safer Version Lens for in editor updates with security context.

---

## Known Issues

- No keyboard shortcuts for common actions
- Large `package.json` files (100+ dependencies) may show slight delay on first load

---

## Roadmap

### Upcoming Features

- [ ] Workspace-wide package updates (update all package.json files at once)
- [ ] Batch vulnerability remediation (fix all vulnerable packages)
- [ ] Keyboard shortcuts for version update actions
- [ ] Export security audit report

### Under Consideration

- [ ] Integration with GitHub Security Advisories
- [ ] Automatic updates on schedule
- [ ] Version comparison diff view
- [ ] Custom vulnerability filtering rules

---

## Privacy & Data

This extension:

- Fetches package metadata from NPM registry (or your configured registry)
- Queries NPM security advisory API for vulnerability information
- Caches responses locally for 30 minutes
- **Does not collect or transmit any personal data or telemetry**
- All network requests are read-only

---

## Contributing

Found a bug? Have a feature request? Contributions are welcome!

- **Repository**: [github.com/asmundwien/safer-version-lens](https://github.com/asmundwien/safer-version-lens)
- **Issues**: Report bugs or request features via GitHub Issues
- **Pull Requests**: See CONTRIBUTING.md for guidelines

---

## License

See [LICENSE](LICENSE) file for details.

---

**Enjoy safer dependency management!** 🛡️

If you find this extension helpful, please consider leaving a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=asmundwien.safer-version-lens).
