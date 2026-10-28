---
title: Exit codes and environment variables
description: "What each exit code means, every variable the CLI reads, and what Fatal: TypeError: fetch failed tells you."
nav: Exit codes and env
---

If you run `cohostly` from a script, two things matter: the number it exits with, and the variables that change how it behaves.

## Exit codes

An exit code is a small number a program leaves behind when it stops. `0` means all went well. Anything else means something did not.

| Code | Description |
| --- | --- |
| `0` | Success. Also: you answered `n` to the deploy question, and a `logs -f` follow that the platform ended after 60 minutes. |
| `1` | Every failure. A bad flag, a missing project, a refused request, a failed deploy, no arguments, an unknown command. |
| `2` | Only from `deploy`: the settings needed your confirmation, there was no terminal to ask in, and you used `--draft`. Nothing was deployed. |
| `130` | You pressed Ctrl-C at a hidden prompt (`secrets set` or `ai-keys set`). |
| `127` | Only from `dev`: your command could not start. Otherwise `dev` returns your command's own exit code. |

Two commands pass on the code of something else:

- `snapshot` and `check` return the exit status of the capture tool.
- `types --project` sets the exit code from the result of its check.

Current behaviour: a deploy that is built but **held for approval** exits `0` when you deploy a folder, and `1` when you deploy from a `.cohostly/` folder. See [put an app online](deploy.md) and [deploy what already runs](snapshot.md).

## Environment variables

| Variable | Description |
| --- | --- |
| `API_URL` | Which Cohostly API to talk to. Default `https://api.cohostly.cloud`. |
| `PLATFORM_API_KEY` | A key used instead of the saved one. It wins over `credentials.json`. Meant for CI. |
| `PLATFORM_CONFIG_DIR` | The folder that holds `credentials.json`. Default `~/.config/cohostly`. |
| `PLATFORM_NO_BROWSER` | Set to any value and `open` prints the address without launching a browser. |
| `PLATFORM_VERBOSE` | Set to `1` and `deploy` prints every build line. Same as `--verbose`. |
| `VISUAL`, `EDITOR` | The editor opened by the `[e]dit` answer in the deploy question. Default `vi` (`notepad` on Windows). |
| `COHOSTLY_RAILPACK` | Path to your own Railpack program. It is checked first, before the downloaded one. It must be the exact version the CLI expects. |
| `COHOSTLY_CAPTURE` | Path to your own capture program for `snapshot` and `check`. An error if the file does not exist. |
| `HOME` | Where the CLI keeps its downloaded tools and cached public keys, under `~/.cohostly/`. |

> **Good to know** The names are exactly `API_URL` and `PLATFORM_API_KEY`. There is no `COHOSTLY_API_KEY` and no `COHOSTLY_API_URL`.

## Fatal: TypeError: fetch failed

You may see this:

```
Fatal: TypeError: fetch failed
    at ...
```

It means the CLI could not reach the platform at all, and the command had no tidy message for that. The cause is nearly always one of these:

1. You have no internet connection, or a proxy or firewall blocks it.
2. `API_URL` points somewhere wrong. Check `echo $API_URL`.

It exits with code `1`. Fix the connection or the address and run the command again.

Some commands print a clearer line instead, `Failed to connect to API at <url>: <message>`. These are `deploy`, `versions`, `promote`, `rollback`, `backup`, `backups`, `restore`, `logs`, `manifest check` and `ls`. The commands that show the `Fatal:` line are `secrets`, `token`, `ai-keys`, `bindings`, `cost`, `dev`, `types`, `whoami`, `open`, `schedules`, `share`, `domains`, `ship` and `approvals`. The cure is the same for both.

Any other uncaught error prints `Fatal: <error>`, with a stack trace, and exits with `1`.

## No help flags

`--help`, `-h` and `--version` are not supported. They print `Unknown command: <x>`, then the command list, and exit with `1`. Plain `cohostly` prints the list and also exits with `1`.

## Where the CLI keeps files

| Path | Description |
| --- | --- |
| `~/.config/cohostly/credentials.json` | Your saved key, one per API address. Mode `0600`. Moved by `PLATFORM_CONFIG_DIR`. |
| `~/.cohostly/tools/` | The build planner, downloaded once. |
| `~/.cohostly/keys/` | The cached public key used by `pack` and `snapshot` to seal values. |

## Read next

- [Sign in and keys](login-and-keys.md): what `PLATFORM_API_KEY` stands for.
- [The command line](overview.md): every command.
