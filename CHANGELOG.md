# Changelog

All notable changes to `ocular` will be documented here.

The project is currently pre-1.0, so interfaces and configuration may still evolve as real-world MCP integrations are tested.

## Unreleased

## 0.1.0 - 2026-08-12

### Added

- MCP server with eight vision-oriented tools for coding-agent workflows
- Local stdio and remote HTTP transports
- Binary image upload side channel with content-addressed `file_id` references
- OpenAI-compatible multimodal provider integration
- Structured JSON output for image, OCR, UI, error, table, chart, and comparison workflows
- Result caching and persistent upload storage
- Open-source contribution and security documentation
- Continuous integration on Node.js 20 and 22
- npm package-content smoke checks
- Integration, demo, and screenshot-debugging examples
- Architecture and deployment documentation
- GitHub issue and pull request templates
- Dependabot configuration

### Changed

- README reorganized around project value, quick start, demo, common workflows, and contribution paths
- npm package metadata expanded for repository discovery and public distribution
- npm release package proposed as `ocular-mcp` while preserving the `ocular` CLI command

## Release process

When a release is prepared:

1. Run `npm run check`.
2. Run `npm pack --dry-run --json` and inspect the package contents.
3. Confirm the npm package name and ownership before publishing.
4. Create the Git tag and GitHub Release.
5. Publish to npm only after registry ownership and package contents are verified.
6. Verify installation from the published package in a clean directory.
