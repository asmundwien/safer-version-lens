# Change Log

All notable changes to the "safer-version-lens" extension will be documented in this file.

## [0.0.1] - 2025-12-16

### Added

- Initial release with core functionality
- Time quarantine support for pnpm's `minimum-release-age` configuration
- Security vulnerability auditing with NPM advisory integration
- CodeLens buttons for inline version updates (patch/minor, major, all versions)
- Support for updating `packageManager` field versions
- Visual indicators for safe versions, quarantined versions, and security vulnerabilities
- Toggle controls to enable/disable extension and show/hide pre-release versions
- Smart caching for registry and audit data (30-minute cache)
- Support for dependencies, devDependencies, and peerDependencies
- Semver-based vulnerability filtering to show only relevant security issues
