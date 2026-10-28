# Managing a project's scheduled jobs

Read this when the person asks what runs on a clock, wants a job stopped or started, or wants to run one now. How to write a job is in `cohostly-app-code/references/cron.md`.

- `list_schedules` shows each job in plain English with its time zone, the next five run times, whether it is on, its last result, and where it was defined (the manifest or the code). Name a schedule to also see its latest runs.
- `pause_schedule` stops it until resumed. Runs it would have made meanwhile are **not** made up. Say that.
- `resume_schedule` turns a paused (or automatically switched off) schedule back on; it runs at its next time. A schedule can switch itself off after repeated failures: check `list_schedules` for the last result before resuming.
- `run_schedule` starts one run within a minute, the same way its clock would. Delivery is at least once and jobs are meant to be safe to run twice, but say which schedule you are running before you do it, because it may email, charge or delete.

All four need editor access. A schedule defined in the manifest changes only by deploying a new manifest; pausing is a runtime switch and does not edit it.
