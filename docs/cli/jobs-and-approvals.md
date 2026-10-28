---
title: Schedules and run
description: "List, inspect, pause, resume and run the jobs your app has on a clock, and see or cancel one-off timers."
nav: Jobs and approvals
---

Jobs are things the platform does on a clock for your app: a summary every morning, a clean-up every hour. How to define them is in [the clock binding](../bindings/cron.md). `cohostly schedules` and `cohostly run` let you look after them. Think of the dial on a central-heating timer. You can see what is set, switch a slot off and on, or press "boost" for one run.

Requests that wait on a person are a different command: see [approvals](approvals-command.md).

## Usage

```bash
cohostly schedules [list] --project <name> [--json]
cohostly schedules <project>
cohostly schedules show <name> --project <name> [--json]
cohostly schedules runs [name] --project <name> [--json]
cohostly schedules pause <name> --project <name>
cohostly schedules resume <name> --project <name>
cohostly schedules timers --project <name>
cohostly schedules cancel-timer <id> --project <name>
cohostly run <schedule> --project <name> [--json]
```

`cohostly run <schedule>` is the same as `cohostly schedules run <schedule>`. `--project` is **required** for `run`. For `schedules`, a single bare word can stand for the project (`cohostly schedules shop` lists). `cancel-timer` works but is missing from the printed help list.

| Flag | Type | Description |
| --- | --- | --- |
| `--project <name>` | text | The project. |
| `--json` | on or off | Print the raw answer for a script. Default off. |

You see the schedules of the project's **live version**. A name that is not in it: `There is no schedule called "<n>" in the live version of <p>.`

### Who may run what

| Subcommand | Role needed |
| --- | --- |
| `list`, `show`, `runs` | viewer |
| `run`, `pause`, `resume`, `timers`, `cancel-timer` | editor |

## list

```
daily-digest  Every weekday at 9:00 AM, India time
  Defined in the manifest. Last: ok (exit 0) at 2026-10-27 03:30 UTC.
  Next: 2026-10-28 03:30, 2026-10-29 03:30, 2026-10-30 03:30 UTC
```

For each job: its name and its schedule in plain English, `[PAUSED]` (with a reason) if switched off, where it was defined (`the manifest`, or `code (version N)`), the last result (`exit N` or `HTTP N`, the time in **UTC**, or `not run yet`), and the **next 3** times in **UTC**. `--json` has the next 5. With no jobs: `<p> has no schedules. Add bindings.cron to the manifest, or use platform.cron in the code.`

## show

The same block, plus `Cost: <a sentence>` and `Recent runs:`, up to 10 lines.

```
2026-10-27 03:30  ok  daily-digest  try 1/3  exit 0  4s
```

A line is the time, the status, the schedule, `try a/b`, then the exit code or HTTP code, the duration and a reason when there is one.

## runs

```bash
cohostly schedules runs [name] --project shop
```

The latest runs, for all jobs or one. With none: `No runs yet.` History is kept for 30 days.

## pause and resume

- `pause` prints `Paused. It will not run until you resume it.`
- `resume` prints `Resumed. It runs at its next time; the runs it slept through are not made up.`

A job can switch itself off after repeated failures, so check the last result before you resume. A job defined in the settings file changes only when you deploy new settings. Pausing is a switch and does not edit the file.

## run

```bash
cohostly run daily-digest --project shop
```

Starts one run. It prints `Started. It runs within a minute. Follow it in the Schedules tab or with platform schedules runs.` and the run id. The run counts toward your monthly allowance, and its retries apply. If the job's overlap rule is `skip` and the last run is still going, a manual run is skipped too.

> **Careful** A job might send an email or delete something. Check which job you are running before you press Enter.

## timers

`timers` lists one-off timers your app made: `<id>  <name>  <time> UTC`, or `No timers are waiting.` `cancel-timer <id>` prints `Cancelled.`

## Limits

The platform sets a smallest gap between runs of 15 minutes, a cap on the number of schedules per project, and a time limit per run (10 minutes by default). The exact numbers for your platform are on [limits](../limits/limits.md) and [schedule limits](../bindings/cron-limits.md).

## Files read and written

None. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. A network failure prints `Fatal: TypeError: fetch failed`.

## Exit codes

`0` on success, `1` on any failure.

## Examples

See what is set, and when it runs next:

```bash
cohostly schedules list --project shop
```

Stop a noisy job while you fix it, then bring it back:

```bash
cohostly schedules pause daily-digest --project shop
cohostly schedules resume daily-digest --project shop
```

Run it once now and watch the result:

```bash
cohostly run daily-digest --project shop
cohostly schedules runs daily-digest --project shop
```

## Related pages

- [The clock binding](../bindings/cron.md): how to define jobs.
- [Approvals](approvals-command.md): the inbox of requests waiting on a person.
- [Build and test locally](develop.md): why `cohostly dev` cannot create timers.
