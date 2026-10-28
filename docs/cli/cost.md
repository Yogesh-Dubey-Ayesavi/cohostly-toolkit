---
title: Cost
description: "cohostly cost describes what AI and hosting cost in plain sentences, with every figure marked as an estimate."
nav: Cost
---

`cohostly cost` tells you, in plain sentences, roughly what a project or all your projects cost. Think of a fuel gauge, not a receipt. It tells you about how much is left and how fast you are using it. It is **not a bill**.

Every figure is an **estimate** and the output says so. Hosting is estimated from the time the app ran. AI is estimated from recorded use and a price table. Models you pay for with your own key are billed by their provider. The platform only estimates them.

## Usage

```bash
cohostly cost [project] [--project <name> | -p <name>] [--terms] [--json]
```

| Flag | Type | Description |
| --- | --- | --- |
| `[project]` | text | One project. With none, you get all your projects. |
| `--project <name>`, `-p <name>` | text | Same, as a flag. |
| `--terms` | on or off | Also print the prices used and what each word means. Default off. |
| `--json` | on or off | Print the raw answer for a script. Default off. |

Who may run it: a **viewer** or higher, for a project. For all projects, anyone signed in sees their own account's projects.

## What it prints

```
$ cohostly cost --project todo
Cost of todo

This month so far: about $2 (AI $1.5, hosting 50 cents). This is an estimate.

At the pace of the last 7 days: about $7 a month, of which $2 is fixed hosting and $5 grows with use (an estimate).

Assumptions: AI cost is what the model providers charged for each call, as recorded when the call was made; ...

AI budget this month: $1.70 of $2.00 (85%) - close to the limit. Set bindings.ai.monthly_cap_usd in the manifest (up to the account limit) and deploy.
```

In order:

1. A title (`Cost of <project>`, or `Cost across your projects`).
2. Sentences: this month so far, the pace of the last 7 days, spend on your own keys, and an `If 50 people used it` projection when the number of recent users is known. Then `Assumptions: ...`.
3. The AI budget line: `AI budget this month: $X of $Y (N%)`. At 80% it adds `- close to the limit.` and how to raise it. When the limit is reached it adds `- AI calls are stopped until next month.` and how to raise it.
4. With `--terms`: `Prices used (per million tokens: input / output / cached input):` and `What the words mean:`.
5. Up to 10 notices: `Notice (<date>): ...`.
6. `Who used the AI (last 7 days):` and `Per project (this month so far / monthly pace):`.

The default budget is a small amount per project and per account each month. For the current numbers see [limits](../limits/limits.md). To raise a project's cap, see [AI models and costs](../bindings/ai-models-and-costs.md).

## Files read and written

None. Uses the saved key (or `PLATFORM_API_KEY`) and `API_URL`. A network failure prints `Fatal: TypeError: fetch failed`.

## Exit codes

`0` on success. `1` on any failure, and for an unknown flag the usage line `Usage: platform cost [--project name] [--terms] [--json]`.

## Examples

See one project and the words behind the numbers:

```bash
cohostly cost shop --terms
```

See all projects:

```bash
cohostly cost
```

Feed a dashboard script:

```bash
cohostly cost --project shop --json
```

## Related pages

- [AI keys](ai-keys.md): models you pay for yourself.
- [AI models and costs](../bindings/ai-models-and-costs.md): how a cost is worked out.
- [Limits](../limits/limits.md): the numbers.
