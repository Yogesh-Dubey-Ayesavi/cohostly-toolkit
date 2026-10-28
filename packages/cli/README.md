# cohostly

The Cohostly command line: put an app online and share it.

```bash
npm install -g cohostly            # or: npx cohostly <command>
cohostly login
cd my-app
cohostly snapshot -- npm start     # run the app once and write .cohostly/ (Dockerfile, settings, sealed secrets)
cohostly check                     # build the snapshot locally and compare it with your app (needs Docker)
cohostly deploy                    # build it on the platform and get a link
```

Run `cohostly` with no arguments for every command. The `platform` command is the same program under its older name.

- **Node 20 or later.** Capture, the tool `snapshot` runs, is included for macOS and Linux (arm64 and x64). Windows is not supported yet.
- **Railpack** (which plans builds) is downloaded on first use and checked against a pinned checksum.
- **API address:** `https://api.cohostly.cloud`. Set `API_URL` to use another.
- **Release (maintainers):** `scripts/release-cli.sh` builds, tests and packs it into `.release/`. Publish the SDK it depends on first.
