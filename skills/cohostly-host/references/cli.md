# The `platform` CLI

Read this when you have a shell but no MCP tools, or when the person wants to run things themselves. Commands and flags below are the ones in `packages/cli/src/index.ts` and `commands/`. Run `platform` with no arguments to see the current help.

## Sign in first

```bash
platform login                       # device flow: a code to approve in the dashboard
platform login --token plk_...       # a key made in the dashboard (CI, or when a browser is not available)
platform whoami
platform logout
```

Never type a key as a command argument in a shared shell history if you can avoid it. Prefer a secret store in CI.

## Deploy

```bash
platform deploy [dir] --project <name>            # shows the settings it worked out and asks first (in a terminal)
platform deploy [dir] --project <name> --yes      # accept the settings without asking
platform deploy [dir] --project <name> --manifest manifest.json
platform deploy [dir] --project <name> --set visibility=private   # one setting, repeatable
platform deploy [dir] --project <name> --show-settings
platform deploy [dir] --project <name> --draft    # print the draft, do not deploy
```

- Run it from the project folder, or pass the folder. The archive leaves out `node_modules`, `.git`, `.vercel`, `.next`, `__pycache__` and `.DS_Store`.
- Without a terminal (an agent or CI), it does not ask. Use `--draft` first, read the draft, then deploy with `--manifest` or `--yes`. Only use `--yes` when the person has agreed to the settings.
- `--skip-types-check` skips checking code against the platform contract. Do not use it to hide a real error.

Start a small new project from a template:

```bash
platform new <static|flask|fastapi|express|go|nextjs> [folder]
```

## Check settings without deploying

```bash
platform manifest check [dir] [--manifest file] [--set setting=value]
```

It prints each effective setting and its source (flag, file or default).

## See and change what is live

```bash
platform ls                              # projects, live version, visibility, your role, address
platform versions [--project name]
platform promote <version> [--project name]
platform rollback [--project name]       # back to the previous ready version
platform open [project]                  # opens the address in a browser
platform stop <project>                  # stops running instances
platform bindings check <project>        # which platform services it uses, last used, any misuse signal
```

## Stateful apps

```bash
platform backup <project> [--stop | --dump] [--slot name]
platform backups <project>
platform restore <project> <backup-id>   # saves your current data first
```

Restore replaces the app's `/data` folder. Confirm with the person first, and say the current data is kept as a copy.

## Secrets

```bash
platform secrets list --project <name>
platform secrets set NAME --project <name>        # the value is typed at a hidden prompt, or piped in
platform secrets import --file .env --project <name>
platform secrets delete NAME --project <name>
platform secrets share NAME --project <name>      # move to the whole account
platform secrets request NAME --project <name>    # make a secure link for the person to type the value
```

A value is never a command argument. If you need to set a value, ask the person to run `platform secrets set NAME` in their own terminal, or send them the `request` link.

## Dev tokens and running locally

```bash
platform token create --dev --project <name>     # shown once; dev environment only
platform token list --project <name>
platform token revoke <id> --project <name>
platform dev --project <name> [--no-secrets] [--env-file f] -- <command>
platform types --project <name> [--check] [--out dir] [--lang python]
```

`platform dev` runs the command with a dev token, the platform's service addresses and the project's secrets in its environment, and writes nothing to disk. `platform types` writes `platform.gen.ts` (or Python) for the bindings the project declares; `--check` fails if the file is stale. See `secrets-and-tokens.md`.

## Logs

`platform logs <project> [-f] [--version N] [--lines N]` shows the app's recent output; `-f` keeps listening. Owners and editors only.
