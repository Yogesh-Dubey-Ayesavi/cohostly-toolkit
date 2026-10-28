---
title: Look after projects
description: "List your projects and their states with ls, open an app, and read its logs, live or from the past."
nav: Projects
---

Three commands help you keep an eye on what you have put online: `ls` lists projects, `open` takes you to one, and `logs` shows what an app has been saying. Think of a caretaker's walk-round. First the list of flats, then the key to one door, then a look at its notice board.

Versions and rollbacks are on [versions and rollback](versions-and-rollback.md). Backups are on [backup and restore](backup-and-restore.md).

## ls

```bash
cohostly ls
cohostly list
```

`ls` and `list` are the same. There are no flags and no `--json`. It asks the platform for your projects and prints one line each.

```
$ cohostly ls
PROJECTS:
- hello  LIVE  (v2, private, you are admin, https://hello-4k2xq.cohostly.cloud)
- shop  CRASHED [1 approval waiting]  (v7, public, you are admin, https://shop-9m3tz.cohostly.cloud)
    The tool stopped running. It ran out of memory.
    Next: Restart
```

Each line is `- <name>  <STATE>[ [badges]]  (v<version or none>, <visibility>, you are <role>, <address>)`. A project in any state other than **Live** or **Asleep** gets two more lines: the reason, and `Next:` with what to do.

### The states

The state prints in capital letters.

| State | Description |
| --- | --- |
| `LIVE` | Running and open to visitors. |
| `ASLEEP` | Idle and paused. The next visit wakes it. |
| `NOT DEPLOYED YET` | The project exists but has no live version. |
| `UPLOADING`, `BUILDING`, `STARTING` | A deploy is in progress. |
| `WAKING` | Starting again after sleep. |
| `AWAITING APPROVAL` | A new version is built and waits for an admin. See [ship](ship.md). |
| `BUILD FAILED`, `FIRST DEPLOY FAILED` | The last deploy did not work. Read its `Code:` line. |
| `CRASHED`, `DEGRADED` | The app stopped or is struggling. Check [logs](#logs). |
| `BUSY` | The platform is busy. Try again soon. |
| `OVER LIMIT`, `SUSPENDED` | An account limit or a suspension. The `Next:` line says what to do. |
| `PAUSED BY YOU` | A state the platform knows. Nothing in the CLI sets it. |
| `DELETING` | Being removed. |

There is no `stopped` state. The closest are `ASLEEP` and `PAUSED BY YOU`.

### Which projects you see

The CLI's key belongs to **one account**, so `ls` lists that account's projects only. Each shows `you are admin`, because a CLI key acts as an admin on every project in its account. Projects another account shared with you by invitation do not appear. See [sign in and keys](login-and-keys.md).

If your platform also answers a local address for "active instances", `ls` adds an `ACTIVE INSTANCES:` block. On the hosted platform you will not see it.

Failures: `Failed to list projects: <status text>` and `Failed to connect to API: <message>`. Exit `1`.

## open

```bash
cohostly open [project] [--print]
cohostly open --project <name>
```

| Flag | Type | Description |
| --- | --- | --- |
| `[project]` | text | The project. Default: the current folder's name. |
| `--project <name>` | text | Same, as a flag. |
| `--print` | on or off | Print the address and do not open a browser. Default off. |

It prints the address **first**, then opens it in your browser. If `PLATFORM_NO_BROWSER` is set to any value, it never opens a browser. Any role, viewer or higher, may run it.

| Message | What to do |
| --- | --- |
| `There is no project called "<x>" that you can see. Run "platform ls" to list yours.` | Check the spelling, and that the key's account owns it. |
| `Could not look up <x>: <status text>` | A platform error. Try again. |
| `<x> has no live version yet. Run "platform deploy" first.` | Deploy it. Exit `1`. |

## logs

```bash
cohostly logs <project> [-f | --follow] [--version <N>] [--since <id>] [--lines <N> | -n <N>] [--json]
```

The project is positional (`cohostly logs hello`), or `--project <name>`.

| Flag | Type | Description |
| --- | --- | --- |
| `-f`, `--follow` | on or off | Keep listening for new lines. Default off. |
| `--version <N>` | number | Only the lines of version N. A whole number, 1 or more. |
| `--since <id>` | number | Only lines after this line id. 0 or more. Use the last id you saw. |
| `--lines <N>`, `-n <N>` | number | How many lines. 1 to 1000. Default 200, or 50 with `-f`. |
| `--json` | on or off | Print one JSON object per line. Default off. |

The help list shows only `-f`, `--version`, `--lines` and `--json`. `--since` and `-n` work too.

Who may run it: an **editor** or higher. Logs can hold visitors' data, so a viewer gets a permission error and a stranger gets "not found".

### What a line looks like

```
$ cohostly logs hello -f
12:34:56.789   listening on 8080
12:35:02.114   GET /
12:35:09.870 ! [r_8f21c3] TypeError: Cannot read properties of undefined (reading 'id')
```

A time, then a marker, then an optional request id in brackets, then the text. The marker is two spaces for normal output, ` !` for error output and ` #` for a note from the platform.

### Following

`-f` listens for new lines. A new line appears within about a second. The platform ends a follow after **60 minutes**, and the CLI then exits quietly with `0`. Run it again to keep following.

### When there is nothing

With no lines, the CLI asks the platform why and prints `(no log lines yet) <reason>`, followed by the app's last output with a `  | ` in front of each line. If that also fails: `(no log lines yet) If the app should be running, open it once; logs appear a second after it writes them.`

Logs are kept for a limited time, 7 days by default on the hosted platform.

### Failures

| Message | What to do |
| --- | --- |
| `Error: --version needs a version number, for example --version 3` | Give a whole number. |
| `--lines needs a number from 1 to 1000` | Pick a number in range. |
| `I do not know "<x>". Use: ...` | You gave a flag that does not exist. |
| `project name required (platform logs <project> -f)` | Give the project. |
| `Could not read logs: <error>` | Read the error. Exit `1`. |

## Files read and written

None in your folder. All three commands use the saved key (or `PLATFORM_API_KEY`) and `API_URL`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

See everything, then open the app that is not live:

```bash
cohostly ls
cohostly open shop --print
```

The last 100 lines of version 3, as JSON for a script:

```bash
cohostly logs shop --version 3 -n 100 --json
```

Follow, and pick up where you left off after a pause:

```bash
cohostly logs shop -f
cohostly logs shop --since 4182
```

## Related pages

- [Versions and rollback](versions-and-rollback.md): go back to an older version.
- [Backup and restore](backup-and-restore.md): safety copies of an app's data.
- [Troubleshooting](../limits/troubleshooting.md): what to do when an app is not healthy.
