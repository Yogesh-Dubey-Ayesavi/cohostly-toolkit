---
title: Start from a template
description: "cohostly new writes a tiny starter project in one of six kinds, so you can see the whole path once."
nav: New and templates
---

`cohostly new` writes a small working project into a folder. It is a seed packet: you plant it, then watch it grow with `cohostly deploy`. It needs no network and no sign-in.

```bash
cohostly new <template> [folder]
```

## The six templates

| Template | Description |
| --- | --- |
| `static` | A plain website. Writes `index.html`. |
| `flask` | A Python web app with Flask. Writes `requirements.txt` (Flask 3.0.3) and `app.py`, which listens on port 8080 on all addresses. |
| `fastapi` | A Python API with FastAPI. Writes `requirements.txt` (FastAPI 0.115.0 and Uvicorn 0.30.6) and `main.py`. It writes no start command, so a deploy relies on the platform detecting one. |
| `express` | A Node web app with Express 4.19.2. Writes `package.json` (with a `start` script that runs `node server.js`) and `server.js`, which listens on port 3000. |
| `go` | A Go web server. Writes `go.mod` (Go 1.21) and `main.go`, which listens on port 8080. |
| `nextjs` | A Next.js 14.2.15 site. Writes `package.json`, `app/layout.js` and `app/page.js`. |

## Usage

- `folder` is optional. The default is `my-<template>-app` inside the current folder.
- The folder must be new or empty. If it is not, the command stops.
- Anything that starts with `--` is ignored.

## What it prints

```
$ cohostly new express hello
Created hello/ (A Node web app with Express.)

Next:
  cd hello
  platform deploy
```

The last line says `platform deploy`. Typing `cohostly deploy` does the same.

## Failures

| Message | What to do |
| --- | --- |
| `Unknown template "x". Usage: platform new <template> [folder]` | Pick one of the six names. The message lists them. Exit code `1`. |
| `<dir> already exists and is not empty. Pick another folder name.` | Choose a new folder name, or empty the old one. Exit code `1`. |

## Examples

Make a plain website in the default folder:

```bash
cohostly new static
cd my-static-app
cohostly deploy
```

Make a Flask app called `notes`, then deploy it under a name of your choice:

```bash
cohostly new flask notes
cd notes
cohostly deploy --project notes-demo
```

> **Good to know** The templates are meant to deploy as they are. The `fastapi` one has no start command written, so if its first deploy fails with a start problem, add a start command with `--start` or in `cohostly.json`. See [put an app online](deploy.md).

## Read next

- [Put an app online](deploy.md): what `deploy` does with the folder.
- [The settings file](../settings/cohostly-json.md): the `cohostly.json` you can add next to the code.
