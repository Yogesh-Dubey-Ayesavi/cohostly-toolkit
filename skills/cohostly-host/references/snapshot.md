# Snapshot: deploy what already runs

Read this when you have a shell, the app runs on this machine, and the person wants it online. Also read it when a deploy fails and the build settings need fixing. Flags are in `cli.md`.

## What it does

`cohostly snapshot -- <start command>` runs the app here, watches it for a few seconds and writes what it really did into `.cohostly/`:

| File | What it is |
| --- | --- |
| `Dockerfile` | The build plan: single-stage, generated, rewritten every time you snapshot. |
| `cohostly.json` | The platform's settings: name, port, health path, start command, the variable names. Edit it to change how the app runs. |
| `capture.json` | What was observed. Read-only; `cohostly check` compares against it. |
| `env.enc` | The values it saw, sealed so only the person's account can deploy them. Safe to commit. |

Nothing else needs to be learned. The Dockerfile is an ordinary Dockerfile and the settings are the same `cohostly.json` the platform always reads.

## Run it like this

1. Start command = the one production uses: the `start` script, `python app.py`, `gunicorn app:app`. Not a dev server with hot reload; it records the wrong command and port. Put it after `--`. It runs directly, with no shell: for `cd`, `&&` or `VAR=value`, write `-- sh -c "cd web && npm start"` or `-- env PORT=3000 npm start`.
2. `cohostly snapshot -- npm start`. You must be signed in for the values to be sealed; if not, they stay in `.cohostly/env.json` (git-ignored) and the tool says so.
3. Open `.cohostly/Dockerfile` and look at the first lines. A `TODO(cohostly):` line is a question the tool could not answer and the app cannot run without (which port, what starts it). `cohostly deploy` stops while one is open. Answer it, or tell the person you cannot decide it. A `NOTE(cohostly):` line is information that does not stop a deploy (a variable that had no value here).
4. `cohostly check` builds the Dockerfile that would be deployed and starts it. It needs Docker and never changes your files. Without Docker, skip it: the snapshot is still deployable and the platform builds it.
5. `cohostly deploy`. It prints the address when the app is live. Say it is online only then. It does not choose who can open the app; from a shell `cohostly ls` shows the visibility, and ask the person before changing it.

## Changing the build

- **Take over the Dockerfile.** Copy `.cohostly/Dockerfile` to `./Dockerfile` and edit that. A Dockerfile in the project root is used as it is, instead of the generated one. It must be single-stage.
- **A root Dockerfile that fails** shows its own build error and is left alone. `cohostly check --generated` and `cohostly deploy --generated` use the generated one instead, only when asked.
- **Settings** (port, health path, visibility, bindings) go in `.cohostly/cohostly.json`. Snapshot overwrites the generated Dockerfile but you can re-run it any time; it does not replace edits in a root Dockerfile.

## Machine size

The image is built on a machine of the same size the app then runs on, so a heavy build needs a bigger one. Snapshot picks the size from the project and writes it to `compute` in `cohostly.json` only when the default (512 MB, 1 vCPU) is not enough, and a `NOTE` says why. For example, `next build` gets 2048 MB and 2 vCPU; a plain API gets nothing and keeps the default. It looks at the build steps (a `package.json` script such as `npm run build` is followed), how many packages were installed, heavy Python packages such as torch, and the memory the app used while it was observed. Sizes are 512, 1024 or 2048 MB.

To change it, edit `compute` in `.cohostly/cohostly.json` (`{ "vcpu": 2, "memory": 2048 }`) or deploy with `--set compute.memory=2048`. A size you set by hand is kept when snapshot runs again. A build that is killed partway through an install or build step is usually out of memory: raise the size one step.

## Values the build needs

Some frameworks copy a value into the files the build makes (a browser bundle that holds a public URL or key). That value must exist while the app is built, not only when it starts, or the built app behaves as if it were unset (a login button that never appears is the usual sign). Snapshot finds these without knowing any framework: it builds a scratch copy of the project once with a unique marker as the value of every variable the app reads, and searches the files the build wrote for the markers. If the build rejects a marker it builds again with your own values. The project folder is not touched.

The variables it finds get a bare `ARG NAME` line before the build step in the Dockerfile (no value in the file) and a `NOTE`. On deploy the platform turns each `ARG NAME` into `ENV NAME="value"` using the sealed values, for the names the Dockerfile asks for and no others. A Dockerfile you write yourself works the same way: add `ARG NAME` before the step that needs it. Changing such a value means deploying again. A value the build reads without writing it anywhere leaves no trace and is not found.

## When `check` fails

It prints the failing step and the log with secret values removed, then what it observed (a module the app could not import, apt packages that provide files a command looked for), or `cannot decide` when nothing explains it. Fix the Dockerfile by hand using that evidence and run `check` again. Do not guess a package name; ask the person.

## Secrets

Values are read from the environment the app was started with or from a `.env` file. They are sealed into `env.enc`, sent only in the deploy request, and never written into the Dockerfile, `cohostly.json`, a command line or the output. Names are. `.env` files are never uploaded as files. `env.enc` is made for one account and expires in 30 days (`--expires 1d` to `30d`); after that, or for another account, run `cohostly snapshot` again.

## A single file: `.cohostly`

`cohostly pack --out app.cohostly` seals the app's files and settings into one file for handing over. In a folder with a snapshot it packs that snapshot (its settings and its Dockerfile). The values in `env.enc` are not carried; pass `--env-file` for those.

- `cohostly deploy app.cohostly` sends it. Over MCP: `get_upload_url`, upload the file, then `deploy` with the `upload_id`.
- The file is made for one account and expires in 7 days (`--expires 1d` to `30d`).
- Sealing means the code and secrets cannot be read by anyone who finds the file. It is not end-to-end encryption: Cohostly and its hosting provider still see the code while building and running it. Never describe it as more than that.
- Failures: `snapshot_invalid`, `snapshot_expired`, `snapshot_wrong_account`, `snapshot_tampered`. Make a fresh file; do not edit one.
