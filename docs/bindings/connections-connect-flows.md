---
title: Connect, reconnect, switch and disconnect
description: What people see and what your app sees when an account is connected, signs in again, changes accounts or is removed.
nav: Connect and disconnect
---

A connection has a life: it is made, it is used, sometimes it needs a fresh sign-in, and one day it is removed. This page follows that life from both sides, the person's and your app's.

In every flow the person signs in on the provider's own page. Your app never sees their password, a code or a token, and you do not register your own Google or Microsoft app.

## Connect as the owner

For an `owner` connection, an account owner or admin does this once in the dashboard.

1. Open **Connections** and choose a provider.
2. Choose the permissions to allow. They can allow less than your app asks for. To give the connection to a tool straight away, name the project and the tool's connection name.
3. The dashboard sends them to the provider's consent screen. One screen asks for the sign-in basics and every permission they chose, together.
4. They agree. The platform checks who signed in, stores the login encrypted, and brings them back to the Connections page, which shows the new connection.
5. If they did not give it to a tool in step 2, a project admin of the same account gives it to the tool later. Until then calls answer `no_grant`.

The link in step 3 works once and expires after 10 minutes. Starting the flow is limited to 10 attempts a minute per person. Only a signed-in person can start it: a service key is refused, and so is an AI assistant ("An AI assistant cannot connect an account: connecting an account is a person's consent. Open Connections in the dashboard to do it.").

Google asks for consent every time, even if the person agreed before.

## Connect as a visitor

For a `user` connection, your app sends the visitor to the `connect_url` it got from [`allowed()`](connections-allowed.md) or from a `connection_required` error. Show it as a button.

The page is a platform page, so the visitor must be signed in to Cohostly. It reads:

- A title: `Connect your <Provider> account`, with the provider's name filled in.
- `<project> would like to use your <Provider> account to:` and then one line for each permission, in the plain words from the permission tables.
- If your tool holds writes for approval: "Anything that changes something waits for your OK first."
- "The tool never sees your password or a token. The platform makes each request for it, only the ones listed above. You can disconnect any time on Connections."
- A button, `Continue to <Provider>`.

The page asks only for what your manifest names. The visitor can narrow it to files, never widen it.

After they agree at the provider, the connection is made and **given to your tool for that visitor automatically**. They land on a "You're connected" page that says the account is connected for your tool and to go back and carry on. If your tool uses a picked-files permission on Google, Google's file picker appears here first ([picked files](connections-picked-files.md)).

> **Careful** The done page tells the visitor to go back to your tool, but it does not send them back by itself. Say so on your own page ("Connect, then come back here and reload"). Then draw the connected state next time they arrive.

If the visitor changes their mind or something fails, they land on a page that says "That didn't connect", a message and a "Try again" link.

If the platform has not set up an OAuth app for the provider, the person sees `<Provider> is not set up on this platform yet, so this cannot be connected. Tell the person who runs the platform.` That is for the platform operator to fix. As an app developer you never add OAuth keys.

### When the connect fails

| What happened | What the person sees |
| --- | --- |
| They pressed cancel | "You chose not to allow access, so nothing was connected." |
| Their organisation must approve the app | "Your organization requires an administrator to approve this app before you can connect. Ask your IT administrator to approve it, then try again." |
| The provider wants a fresh sign-in | "The provider needs you to sign in again. Try connecting once more." |
| The provider did not accept the access asked for | "The provider did not accept the access that was asked for. Tell the platform operator." |
| The provider has a problem | "The provider is having a problem. Try again in a minute." |
| Anything else the provider reports | `The provider reported "<error>". Try again, and tell the platform operator if it keeps happening.` |
| The connect link is old or already used | "This connect link has expired or was already used. Start again from Connections." |
| The link is not a real one | "This connect link is not valid. Start again from Connections." |
| The provider sent nothing back | "The provider did not send back a code. Try again." |
| The provider did not name the account | `<Provider> did not say which account this is. Try again.` |
| Connected, but could not be given to the tool | `Connected <label>, but it could not be given to the tool: <reason>` |

The connect itself can also be refused with "Too many attempts. Wait a minute and try again."

## Reconnect

A connection goes to **needs reconnecting** (`needs_reauth`) when the provider no longer accepts its login. That happens when:

- The provider refuses for good to renew the login (for example, the person took the app's access away on the provider's side).
- The provider rejected a call with 401 even after the platform refreshed the login and tried once more.
- The login has expired and the platform has no way to renew it.

The platform renews short-lived logins by itself, a little before they run out. You do not manage that.

When a connection needs reconnecting:

- The account gets a warning notification, `connection_needs_reauth`.
- The dashboard shows "Sign in again" next to the connection.
- Calls answer `409 connection_needs_reauth`.
  - In `owner` mode the fix is: ask the person who connected it to open Connections and click Reconnect.
  - In `user` mode the error also carries a `connect_url`. Send the visitor there. One page, one consent, and calls work again as soon as they finish.
- [`allowed()`](connections-allowed.md) reports `status: "needs_reauth"`.

Reconnecting the **same** Google or Microsoft account updates the existing connection in place: new login, status active again, and the permissions it had before are kept and merged with the new ones. Calls work again at once.

Reconnecting is also how you add permissions. If you change your manifest to ask for more, the person connects again and allows the extra access. Until then calls answer `permission_not_granted` with the reason "The connection was not given the access this needs; it must be reconnected with more access."

## Switch to another account

**A visitor** opens the `connect_url` again and signs in with a different account. A new connection is made, and the visitor's grant for that tool moves to it. Offer this as a link, "Use a different account", next to a connected state. The old connection stays in their own Connections page until they remove it.

**A person with several accounts of the same service** can point their tool at another account they already connected, without signing in again. The platform allows this only for the person's own working connections. If that account needs to be connected again first, the person is told so. An AI assistant cannot do it for them.

**An owner** connects the other account and gives it to the tool. The new one replaces the old one, because an owner tool has only one grant.

## Disconnect

A person disconnects in the dashboard, under Connections. An account owner or admin disconnects account connections. Anyone can disconnect their own personal ones. An AI assistant cannot.

When a connection is disconnected:

- The platform asks Google to cancel the login, as a courtesy. Microsoft and Slack have no such step, so for them only the platform's copy is deleted. The dashboard may suggest that the person also remove the app from their Google or Microsoft account settings.
- The stored login is **deleted** for good.
- The connection is marked `revoked`, with a reason such as `Disconnected by <email>.` The grants stay on purpose, so the owner can see which tools just stopped working.
- Every tool that used it gets `410 connection_revoked` (`The connection "<name>" was disconnected.`) until someone connects it again. The error has **no** `connect_url`.
- [`allowed()`](connections-allowed.md) reports `status: "revoked"`. In `user` mode it still gives the `connect_url`.

Revoking is immediate. The platform reads the grant and the login again on every call.

To take a connection away from one tool without disconnecting the account, a project admin removes the connection from that tool. The account stays connected for its other tools.

## Test a connection

A connection can be tested. The platform runs a quick check with the stored login and reports "Working." or the provider's own message, and a 401 marks the connection as needing reconnecting. If a Google service is switched off for the whole platform, you may see the provider's message about the API not being enabled. Tell the platform operator.

## What the dashboard shows

The Connections page lists each connection with its provider, the account name, when it was connected and last used, its status (for example "Connected" or "Sign in again") and the tools it has been given to. It never shows a login.

Next: [calling the API](connections-calling-the-api.md).
