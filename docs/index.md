---
title: Cohostly docs
description: Put an app online, share it with the right people, and give it a database, AI and a clock without running any servers.
sections: true
---

Cohostly is a place to put an app online and share it. You bring the app. Cohostly gives it an address, decides who may open it, keeps it asleep when nobody is using it, and lends it a few services so you do not have to build them yourself.

These docs cover the public tools: the `cohostly` command line, the `@cohostly/sdk` package your app can use, the services the platform lends your app (we call them bindings), the limits, and a set of small sample apps explained in everyday words.

> **Early software** The CLI is on `0.1.x` and the SDK on `0.2.x`. While the first number is 0, a new minor version may change how something works. Each package's changelog says when.

## Pick where to start

- [I have an app and want it online](start/quickstart.md): five minutes, one command to sign in, one to deploy.
- [I want to know how it works first](start/what-is-cohostly.md): what Cohostly is, who it is for, and what it is not.
- [I want to see a whole app](examples/overview.md): nine small apps, each with every file and a plain explanation.
- [Something broke](limits/troubleshooting.md): failure codes, what they mean and the fix.

## What is supported

| Part | What it covers |
| --- | --- |
| Operating system | The CLI runs on macOS and Linux, on Intel and Arm. Windows is not supported yet. |
| Node.js | Version 20 or later, for both the CLI and the SDK. |
| Apps you can host | Node, Python, Go and plain websites. Other kinds (PHP, Ruby, Rust) are not run today. |
| SDK language | TypeScript and JavaScript, as ES modules. Python and Go clients are planned. |
| Not available | Self-hosting the platform, and CommonJS imports of the SDK. |
