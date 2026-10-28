---
title: Failures and history
description: "Retries, overlap, missed runs, what happens after ten failures, run history, and the schedules and run commands."
nav: Failures and history
---

## What counts as a failure

A run fails when your app answers with an error, the command exits with a non-zero number, the call cannot reach your app, or the run passes its `timeout`. The platform enforces the timeout itself. Past the deadline it stops waiting, records `timed_out`, and applies your retry rule.

## Retries

Set `retries` (0 to 5) to try again after a failure.

- A run is retried after a timeout, a non-zero exit, a network error, or a **5xx** answer.
- A run is **not** retried after a **4xx** answer. The error message says so: "the platform does not retry a 4xx".
- The wait before each retry starts at 30 seconds and doubles each time, up to 10 minutes: 30, 60, 120, 240, 480, then 600 seconds.
- `attempt` starts at 1 and goes up on each try. A schedule with `retries: 2` has at most 3 attempts. The command line shows this as `try 2/3`.
- A timer gets one attempt and no retries.

> **Good to know** Delivery is at least once. A run can finish its work and still time out because the answer was late, and then it is tried again. Keep the **run id** and skip a run you have already done. The `Idempotency-Key` header changes with each attempt, so it will not help you here.

## Overlap

Overlap is what happens when a run is due while the last run of the same schedule is still going.

| `overlap` | Description |
| --- | --- |
| `skip` | The default. The new run is recorded as `skipped`. Choose this for work that must not run twice at once. |
| `queue` | One run waits behind the running one. If a second one is already waiting, the newer run is recorded as `skipped`. |
| `allow` | Runs start whatever else is going on. |

A manual run follows the same rule. With `skip`, `cohostly run` is skipped if the last run is still going.

## Missed runs

If the platform is late by more than `misfire`, the run is recorded as `missed` and does not start. After an outage, the platform never starts a burst of old runs. Set `catch_up: "latest"` if you want the newest missed time to run once. Details are in [schedules and syntax](cron-schedules-and-syntax.md).

Runs that would fall while a schedule is paused are skipped and are **not** made up later.

## After the retries run out

When a run fails and no retries remain, the platform opens an **incident**. It has a plain-words cause, the last 20 lines of the run's log, and a link to the Schedules tab. A later successful run resolves it.

People told: the project owner, the account owners and admins, and the project's editors and admins. They get an in-app notice and an email, as far as email is set up for the platform.

## Ten failures in a row

When a schedule fails **10 times in a row**, the platform switches it **off**. The incident is raised to an alert level, and the schedule shows `[PAUSED: failures]`. One success resets the count to zero.

To turn it back on, fix the cause and resume it:

```sh
cohostly schedules resume daily-report --project digest
```

Resuming resets the failure count, clears the next planned time, and closes the incident. This is a current default and can change.

## Pause and resume

```sh
cohostly schedules pause daily-report --project digest
cohostly schedules resume daily-report --project digest
```

Pausing works for schedules in the settings file too. You do not edit `cohostly.json`. The platform keeps a switch for each schedule. A schedule you pause shows `[PAUSED: owner]`.

## Deploys and rollbacks

Promoting or rolling back a version changes which schedules are live. A run that was queued for a schedule that is not in the live version any more is recorded as `skipped`, with the reason "no longer defined in the live version".

## Run history

Runs are kept for 30 days. Each run record holds:

| Field | Description |
| --- | --- |
| `id` | The run id. |
| `schedule` | The schedule or timer name. |
| `status` | One of `queued`, `running`, `succeeded`, `failed`, `timed_out`, `skipped`, `missed`. |
| `trigger` | `schedule`, `manual` or `timer`. |
| `scheduled_for` | The planned time. |
| `started_at`, `finished_at` | When the run began and ended. |
| `attempt`, `max_attempts` | Which try this is, and how many there can be. |
| `exit_code` | For a command run. |
| `http_status` | For a web call. |
| `duration_ms` | How long the run took. |
| `reason`, `error` | Why a run was skipped or missed, or what went wrong. |
| `version` | The version that ran it. |

## The command line

```sh
cohostly schedules list --project <name> [--json]
cohostly schedules show <name> --project <name>
cohostly schedules runs [name] --project <name> [--json]
cohostly schedules pause <name> --project <name>
cohostly schedules resume <name> --project <name>
cohostly schedules timers --project <name>
cohostly schedules cancel-timer <id> --project <name>
cohostly run <name> --project <name>
```

Who can do what:

| Command | Description |
| --- | --- |
| `list`, `show`, `runs` | Viewer access is enough. |
| `run`, `pause`, `resume`, `timers`, `cancel-timer` | Editor access is needed. |

What they print:

- `list` shows each schedule's name, the schedule in plain English with its zone named, `[PAUSED: reason]` if it is off, where it is defined and in which version, the last result with the exit or HTTP code and its time in UTC, and the **next 3 run times in UTC**. With `--json` you get more next times.
- `show` adds details, and a rough cost estimate worked out from how long runs take and the memory they use.
- `runs` shows the 50 most recent runs by default. `--json` returns the fields above.
- `cancel-timer` does not appear in the built-in help text, but it works.

### Run now

`cohostly run <name>` starts a **manual** run. It is queued at once and starts on the platform's next once-a-minute check, so expect it within about a minute. It follows the `overlap` rule, counts toward the monthly allowance, and honours `retries`. The command prints a message and the run id.

An AI assistant connected to your account can list, run, pause and resume schedules too. The dashboard offers the same under the app's Settings, in Schedules.

## Read next

- [Cron errors](cron-errors.md)
- [Limits](cron-limits.md)
- [A morning summary](../examples/morning-summary.md)
