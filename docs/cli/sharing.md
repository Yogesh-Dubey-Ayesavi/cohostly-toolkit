---
title: cohostly share
description: Choose who can open an app, invite people by email, and change their roles from the command line.
nav: Share
---

`cohostly share` is how you decide who gets to open an app. Think of it as the guest list at the door. A new app starts with a list of one: you. This command widens or narrows that list.

Two related commands have their own pages. [Domains](domains.md) puts the app on your own web address. [Ship](ship.md) decides who may release new versions.

## Usage

```bash
cohostly share --project <name>
cohostly share <name>
cohostly share visibility <level> --project <name>
cohostly share invite <email> [--role viewer|editor|admin] --project <name>
cohostly share role <email> <viewer|editor|admin> --project <name>
cohostly share remove <email> --project <name>
```

With no subcommand, `share` lists. If you give a single bare word and nothing else, it is taken as the project name, so `cohostly share hello` works.

| Flag | Type | Description |
| --- | --- | --- |
| `--project <name>` | text | The project to act on. Not needed when you give the name as a bare word with the list form. |
| `--role <role>` | `viewer`, `editor` or `admin` | Only for `invite`. Default `viewer`. Any other value stops with `--role must be one of: viewer, editor, admin.` |
| `--json` | on or off | Print the raw answer from the platform, for a script to read. Default off. |

### Who may run it

Every `share` command, including the plain list, needs **admin** on the project. An editor cannot even list the people an app is shared with.

> **Good to know** A sign-in made with `cohostly login` is an account-wide key that acts as admin on every project in its account. So for your own account's projects, these commands pass. See [the command line overview](overview.md) for what that means.

## See who can open it

```bash
cohostly share --project hello
```

It prints one line describing the current visibility, then the people the app is shared with by name:

```
Only people you invite, plus the account owners and admins, can open this app.
- ana@example.com  viewer
- raj@example.com  editor  (pending)
```

`(pending)` means the person was invited but has not confirmed their address yet. If nobody is on the list you see `Not shared with anyone by name.`

## Change who can open it

```bash
cohostly share visibility link --project hello
```

On success it prints the project name and a plain sentence for the new level, such as `hello: Anyone who has the link can open this app. The link has a random part that cannot be guessed.`

There are five levels, from narrowest to widest.

| Level | Who can open the app |
| --- | --- |
| `private` | Only people you invite, plus the account's owners and admins. |
| `account` | Any signed-in member of the owning account. |
| `signed_in` | Anyone with a Cohostly account, once they sign in. Signing up is open to everyone, so this is nearly as wide as `link`. |
| `link` | Anyone who has the address, signed in or not. The address has a random part that cannot be guessed, but anyone holding it can pass it on. |
| `public` | Anyone on the internet. |

A level that is not one of these five stops with `Choose one of: public, link, signed_in, account, private.`

A new project starts `private`. A deploy never changes who can open an app. A `visibility` line in your settings file is ignored with a warning, and the file only accepts `link`, `private` or `public` there. Use this command instead.

### Widening can wait for approval

Making an app wider is a bigger decision than making it narrower, so the platform treats them differently.

- **Narrowing** takes effect at once. Visitors see the change within about 30 seconds.
- **Widening** to `signed_in`, `link` or `public` is held as a request when the person acting is not an account owner or admin, or when an assistant made the change. Nothing changes until an owner or admin approves.

> **Careful** When a change is only held for approval, the command still prints a success-looking line, and that line shows the **old** visibility. For example you ask for `public` and see `hello: Only people you invite, plus the account owners and admins, can open this app.` Do not read that as done. Check with `cohostly approvals waiting` (the requests you made), or run the command again with `--json` and read the `message`. See [approvals](approvals-command.md).

An outsider with no access sees a plain "not found", not "forbidden", so an app does not reveal that it exists.

## Invite someone

```bash
cohostly share invite ana@example.com --role editor --project hello
```

Output is one of two lines:

- `ana@example.com is invited as editor.` The person does not have a confirmed account yet. They get an invitation email that stays valid for 14 days and becomes active when they confirm their address.
- `ana@example.com is on the list as editor.` They already had a confirmed account, so they have access at once.

Inviting the same address again changes the role. Pick the lowest role that does the job. That is why `viewer` is the default.

[Sharing and roles](../settings/sharing-and-roles.md) lists exactly what each role can do. In short, a viewer opens the app, an editor can also deploy and manage secrets and schedules, and an admin can also change sharing.

Failures:

| What you see | What it means and the fix |
| --- | --- |
| `That does not look like an email address. Use a full address such as ana@example.com.` | The address is malformed. Retype it. |
| `<email> already has full access to this project through the account, so there is nothing to add.` | Account owners and admins already see every project. Nothing to do. |
| The command errors after the invite email fails to send | The invite is rolled back. Try again in a few minutes. |

## Change or remove a role

```bash
cohostly share role ana@example.com viewer --project hello
cohostly share remove ana@example.com --project hello
```

- `role` prints `ana@example.com is now viewer.`
- `remove` prints `ana@example.com was removed.` It also ends that person's connections from AI assistants to this project.
- Neither asks you to confirm first. They act at once.
- An address that is not on the list stops with `<email> is not on <project>'s share list.` Run `cohostly share --project <name>` to see who is.

## Exit codes

`0` on success. `1` for any failure, including a refused role or a missing project. A held widening still exits `0`, which is why you must check it.

## Examples

Share a draft with one teammate who should only look:

```bash
cohostly share invite ana@example.com --project hello
```

Open an app to anyone with the address, then read the answer in a script:

```bash
cohostly share visibility link --project hello --json
```

Close it again after a demo:

```bash
cohostly share visibility private --project hello
```

## Related pages

- [Domains](domains.md): put the app on your own address.
- [Ship](ship.md): hold new versions until an admin approves them.
- [Approvals](approvals-command.md): answer or follow a held request.
- [Sharing and roles](../settings/sharing-and-roles.md): the full rules for who can do what.
