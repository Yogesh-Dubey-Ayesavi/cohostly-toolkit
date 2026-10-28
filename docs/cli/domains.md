---
title: cohostly domains
description: Put an app on your own web address, such as app.yourcompany.com, and follow its progress until it is live.
nav: Domains
---

Every app gets an address of its own. If you would rather use `app.yourcompany.com`, `cohostly domains` sets that up. You prove you own the name by adding a few records at the company that looks after your DNS (the phone book of the internet). Cohostly watches for them and turns the domain on by itself, with HTTPS.

## Usage

```bash
cohostly domains [list] --project <name>
cohostly domains <name>
cohostly domains add <hostname> --project <name>
cohostly domains show <hostname> --project <name>
cohostly domains remove <hostname> --project <name>
```

| Flag | Type | Description |
| --- | --- | --- |
| `--project <name>` | text | The project to act on. A single bare word with the list form is also taken as the project. |
| `--json` | on or off | Print the raw answer for a script. Default off. |

The hostname is lower-cased for you.

### Who may run it

| Subcommand | Role needed |
| --- | --- |
| `list`, `show` | viewer |
| `add`, `remove` | editor |

### Hostname rules

Give a full domain name only. The platform refuses a name with `https://`, a path, spaces, a wildcard, an IP address or a port, one longer than 253 characters, a platform domain, or a shared public suffix. The message it prints is a plain sentence saying which rule you broke.

A project can have at most **10** custom domains.

## Add a domain

```bash
cohostly domains add app.yourcompany.com --project hello
```

It prints the state, then the records to create:

```
app.yourcompany.com  waiting for your DNS records
Add these records at the company that hosts DNS for app.yourcompany.com.
  CNAME  app.yourcompany.com  ->  <address of the platform>
      Sends traffic for this name to Cohostly.
  TXT    <record name>  ->  <value>
      Proves you own this domain.
DNS changes can take from a few minutes up to an hour to show up.
Check progress with: platform domains show app.yourcompany.com --project hello
```

Notes on the records:

- You get one CNAME plus the TXT records the platform names. More than one TXT is normal, so create every one that is printed, exactly as shown.
- A bare "root" domain such as `example.com` cannot have an ordinary CNAME. The line then says `CNAME (flattened)`, and the notes tell you to use your DNS host's ALIAS, ANAME or CNAME flattening feature, or to use a `www` subdomain instead.
- If a CDN or proxy sits in front of the domain, turn it off until the status says it is live. It can stop Cohostly from seeing your records.

Some printed messages still say `platform` where this page says `cohostly`. Both names run the same program.

### The domain is already claimed (a 202, not an error)

Sometimes `add` answers that the name is claimed by someone who has not proved they own it. The command does not fail. It prints the platform's message, then:

```
Add this record at the DNS for app.yourcompany.com:
  TXT  <record name>  ->  <value>
It is checked every few minutes until <date>.
```

Add that one TXT record. When the platform sees it, the name moves to your project by itself. This is how a real owner takes a name back from someone who only typed it in first.

### Failures

| What you see | What it means and the fix |
| --- | --- |
| A message about the name being invalid | Remove `https://`, paths, ports and wildcards. Use a plain host name. |
| `That domain is already in use on the platform. If it is yours, contact support and we will sort it out.` | Another project holds the name and the ownership check cannot move it. |
| `A project can have at most 10 custom domains. Remove one you no longer use, or ask us to raise the limit.` | You are at the cap. Remove one, then add again. |
| `We could not set that domain up just now. Nothing was saved. Try again in a few minutes.` | A temporary problem. Retry. |

## See where it stands

```bash
cohostly domains show app.yourcompany.com --project hello
```

It prints a status, any error, `Last checked ... UTC.` while it is not live, and the records again.

| Status printed | Meaning |
| --- | --- |
| `waiting for your DNS records` | The records are not visible yet. |
| `verified` | Ownership proved. |
| `verified, certificate being issued` | HTTPS certificate is on the way. |
| `live over HTTPS` | Done. The address works. |
| `failed` | See the error line, fix the records, then remove and add again. |
| `removed` | The domain was detached. |

How often it checks: every 30 seconds for the first 10 minutes, then every 5 minutes, for up to 72 hours. If the records are still missing after 72 hours the domain fails with a message to check that the TXT and CNAME are exactly as shown and that no CDN or proxy is in front. After going live it is re-checked about every 15 minutes, and goes back to waiting if the records disappear. There is no command to check right now. Waiting is the way.

A private project stays private on its own domain. The same sharing rules apply.

## Remove a domain

```bash
cohostly domains remove app.yourcompany.com --project hello
```

It prints `Removed. The domain no longer reaches this project and its certificate is being deleted. You can delete its DNS records now.` The project's default address is not affected. Nothing asks you to confirm first. If the platform cannot remove it just now it says so and the domain stays attached, so run the command again later.

## Exit codes

`0` on success, including the claimed-name case. `1` for any failure.

## Examples

```bash
cohostly domains add shop.example.com --project shop
cohostly domains show shop.example.com --project shop
cohostly domains --project shop --json
```

## Related pages

- [Share](sharing.md): who can open the app on any address.
- [Sharing and roles](../settings/sharing-and-roles.md): what viewer and editor can do.
