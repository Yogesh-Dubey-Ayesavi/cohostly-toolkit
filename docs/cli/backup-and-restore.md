---
title: Backup and restore
description: "Take a safety copy of an app's /data folder, list copies, and restore one. Needs storage.stateful: true."
nav: Backup and restore
---

Some apps keep files in a `/data` folder. `cohostly backup` takes a copy of that folder, `backups` lists the copies, and `restore` puts a copy back. Think of a photocopy of your notebook, kept in a drawer. If you ruin the notebook, you take the copy out.

> **Good to know** A backup is a safety copy, not a promise that a disk lasts forever. Information that matters belongs in the [managed database](../bindings/data.md).

## When it works

- **The project must say `storage.stateful: true`** in its settings. Otherwise the platform answers `Project <p> does not keep data (storage.stateful is not true), so there is nothing to back up.`
- **The app must have started** at least once. Otherwise: `There is nothing to back up or restore yet: this project has not started. Open the app once, then try again.`
- The `/data` folder must be **256 MiB or less**. A larger folder is refused with a plain message.
- The platform needs backup storage. If not: `Backups are not set up on this platform yet ...`.

All three commands need an **editor**. None of them asks you to confirm.

## backup

```bash
cohostly backup <project> [--stop | --dump] [--slot <name>]
```

| Flag | Type | Description |
| --- | --- | --- |
| `<project>` | text | The project (or `--project <name>`). |
| `--stop` | on or off | Stop the app for a few seconds while the files are copied. Gives a fully consistent copy. Default off. |
| `--dump` | on or off | Run the project's `storage.backup_command` first, then copy. Default off. |
| `--slot <name>` | text | A name for the copy. |

With neither `--stop` nor `--dump`, the platform picks: it uses the project's `storage.backup_command` if it has one, otherwise a plain copy of the live files. Using both stops with `Error: choose one of --stop and --dump.` The old `--freeze` flag stops with `Error: --freeze is gone. Use --stop ... or --dump ...`.

```
$ cohostly backup notes --stop
Backup bkp-1a2b3c4d5e created (stopped-consistent, 20480 bytes) at 2026-10-27T10:00:00.000Z
This backup is fully consistent: the app was stopped for a few seconds while its files were copied.
```

A plain copy prints: `This backup is crash-consistent: it is a copy of the live files, so a file being written at that moment may be half-written. Add a backup command (storage.backup_command) or use --stop for a consistent one.`

## backups

```bash
cohostly backups <project>
```

```
BACKUPS for project 'notes':
- bkp-1a2b3c4d5e  2026-10-27T10:00:00.000Z  manual  stopped-consistent  slot=before-upgrade
```

The kind is `manual`, `daily` or `weekly`. With none: `(none yet; take one with: platform backup notes)`.
## restore

```bash
cohostly restore <project> <backup-id>
```

> **Careful** `restore` does **not** ask. It replaces the app's `/data` folder with the copy and restarts the app. Read the id twice.

In order, the platform:

1. Takes a safety backup of your **current** data and keeps it as a manual backup. If that fails, nothing is changed: `Nothing was changed. The restore needs to save the current data first, and that failed: <why>`.
2. Checks the stored copy's checksum.
3. Replaces `/data` in place.
4. Restarts the app.

```
Restored notes to backup bkp-1a2b3c4d5e (taken 2026-10-27T10:00:00.000Z).
Your data from just before the restore was saved as backup bkp-9f8e7d6c5b. Restore that one to undo this.
The app was restarted on the restored data.
```

To undo a restore, restore the id it printed.

## Files read and written

None in your folder. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

A consistent copy before a risky change:

```bash
cohostly backup notes --stop --slot before-upgrade
```

See the copies, then put one back:

```bash
cohostly backups notes
cohostly restore notes bkp-1a2b3c4d5e
```

Undo that restore:

```bash
cohostly restore notes bkp-9f8e7d6c5b
```

## Related pages

- [Versions and rollback](versions-and-rollback.md): a promote of a project that keeps data takes a backup first.
- [The settings file](../settings/cohostly-json.md): where `storage.stateful` and `storage.backup_command` are set.
