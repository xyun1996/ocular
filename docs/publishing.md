# Publishing ocular

The npm package candidate is `ocular-mcp`; the installed executable remains `ocular`.

This document separates the **first npm publish** from later automated releases so repository secrets do not need to contain a long-lived npm write token.

## Before the first publish

Do not publish until the final npm package name and account ownership are confirmed from the publishing account.

From a clean local checkout of the intended release commit:

```bash
npm ci
npm run check
npm pack --dry-run --json
```

Confirm:

- `package.json` and `package-lock.json` have the same package name/version;
- the package name is the intended public identity;
- the tarball includes `dist/index.js`, `README.md`, `LICENSE`, and `.env.example`;
- no credentials, private images, cache directories, or local environment files are included.

For `v0.1.0`, the repository CI also installs the real tarball into a clean temporary npm project and executes the packed `ocular` CLI.

## First npm publish

npm Trusted Publishing is configured on an existing npm package, so the initial package must first be created on the npm registry from an authenticated maintainer session.

Perform this step on your own machine or another environment where you control the npm login/2FA session. Do not paste npm credentials or one-time codes into repository issues, pull requests, CI logs, or chat transcripts.

After authenticating with npm, publish the verified package:

```bash
npm publish --access public
```

If npm reports that the package name is unavailable or not owned by your account, stop. Choose the final package identity, update both package metadata files, rerun CI/package checks, and only then retry. Do not work around an ownership error by publishing unexpected contents or credentials.

After the first publish, verify the public package metadata and install it in a separate clean directory before treating the release as complete.

## Configure npm Trusted Publishing

After the package exists on npm, configure a GitHub Actions trusted publisher in the package settings with:

- GitHub user/organization: `xyun1996`
- repository: `ocular`
- workflow filename: `publish.yml`
- allowed action: `npm publish`

The workflow is `.github/workflows/publish.yml`.

It uses a GitHub-hosted runner with `id-token: write`, installs a compatible npm CLI, verifies the release tag/version, runs the project checks and package-content checks, and then invokes `npm publish --access public` without a long-lived npm token.

For stronger account security after Trusted Publishing is confirmed working, restrict traditional token-based publishing in the npm package settings and keep 2FA enabled.

## GitHub Release flow

Future releases should follow this sequence:

1. update `package.json` / `package-lock.json` version and changelog;
2. run CI and release checks through a pull request;
3. merge the release commit;
4. create the matching tag (for example `v0.2.0` for package version `0.2.0`);
5. publish the GitHub Release for that tag;
6. the `Publish npm package` workflow runs from the tagged source and uses npm Trusted Publishing;
7. verify the npm package and clean installation after the workflow completes.

The workflow refuses to publish when the GitHub Release tag does not exactly match `v${package.version}`.

## `v0.1.0` transition

The first release is special because npm Trusted Publishing cannot be configured until the package exists.

A safe transition is:

1. perform the first `ocular-mcp@0.1.0` publish from your authenticated local npm session;
2. verify the published package;
3. configure `publish.yml` as the npm Trusted Publisher;
4. create/publish the GitHub `v0.1.0` Release.

The workflow checks whether the exact package version is already public before publishing, so the GitHub `v0.1.0` Release can still exercise the release workflow without attempting to overwrite the manually published `0.1.0` version.

## Optional staged publishing

npm also supports staged publishing with Trusted Publishers. That model allows CI to submit a package for review and requires a maintainer to approve it with 2FA before it becomes public. Consider switching the trusted publisher permission and workflow to staged publishing if releases later need an explicit human approval gate.
