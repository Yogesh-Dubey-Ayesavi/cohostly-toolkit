---
title: Versions and rollback
description: "List versions, switch to an older one with promote, and step back with rollback. What each one does, and what it does not undo."
nav: Versions and rollback
---

Every deploy makes a new **version**: v1, v2, v3 and so on. Think of a stack of numbered photographs of your app. Only one photograph is on the shop window at a time. `promote` and `rollback` swap which one is in the window. They do not build anything, so they are fast.

## versions

```bash
cohostly versions [project]
cohostly versions --project <name>
```

Prints every version of a project, with no paging. Any role, viewer or higher.

```
VERSIONS for project 'hello' (current: v3):
- v3 (current): status=ready, engine=linux, pause_mode=filesystem, created=2026-10-27T10:00:00.000Z
- v2: status=ready, engine=linux, pause_mode=filesystem, created=2026-10-26T09:12:44.000Z
    notice: <a note about that version>
```

With no versions it prints `(no versions found)`.

Current behaviour: the `engine=` and `pause_mode=` fields are leftovers from an older design. You can ignore them. A viewer sees `engine=undefined`. The richer information the platform holds (whether a version is live, previous or never released) is not printed by the CLI.

## promote

```bash
cohostly promote <version> [project]
cohostly promote <version> --project <name>
```

Makes that version the live one. `v3` and `3` both work. It needs an **editor**. It acts at once and does not ask.

```
$ cohostly promote 2 hello
Promoted project 'hello' to version v2
```

- **Only the newest 10 versions can be promoted.** Older builds are removed. Promoting a removed version fails and the message says so.
- **A version that never went live cannot be promoted.** That covers one still waiting for approval or one that was never approved. You get `Version N is waiting for an admin to approve it. It goes live when they do.` or `Version N was never made live, so it cannot be switched to. Deploy the code again.`
- It moves a tag. It is not a rebuild.
- If the project keeps data, a backup is taken first (see [backup and restore](backup-and-restore.md)).

Errors: `Error: version number required (e.g. platform promote <version> [--project <name>])`, `Error: project name required ...`, `Promotion failed: <error>`.

## rollback

```bash
cohostly rollback [project]
cohostly rollback --project <name>
```

Goes back to the previous version that actually went live and is ready. A version that never went live is skipped. It needs an **editor** and does not ask.

```
$ cohostly rollback hello
successfully rolled back project 'hello' to version v2
```

Errors from the platform: `no previous ready version to rollback to for project '<p>' (currently at v<N>)` and `project '<p>' has no active current version to rollback from`.

Current behaviour: warnings the platform sends with a promote or a rollback are not printed by the CLI.

### What a rollback undoes, and what it does not

> **Careful** A rollback reverts the **code** and **only the data API's schema and row rules**. The database itself moves forward only. Rows already written stay written, and tables a newer version added stay in place. Plan changes to your data so an older version can still run against them.

For how tables and row rules are declared, see [the data binding](../bindings/data.md).

## Files read and written

None in your folder. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. A network failure prints `Failed to connect to API at <url>: <message>`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

See what you have, then go back one step because v3 broke:

```bash
cohostly versions hello
cohostly rollback hello
```

Jump to a specific older version:

```bash
cohostly promote 5 --project hello
```

Try to promote a version that was never approved:

```bash
cohostly promote 6 hello
# Version 6 is waiting for an admin to approve it. It goes live when they do.
```

## Related pages

- [Ship](ship.md): why a version can wait for approval.
- [Put an app online](deploy.md): every deploy makes a version.
- [Backup and restore](backup-and-restore.md): copies of an app's data.
