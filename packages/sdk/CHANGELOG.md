# Changelog

All notable changes to `@cohostly/sdk`. Versions follow semver; while the major version is 0, a minor bump may change behaviour.

## 0.1.1

### Fixed

- **Connection calls no longer fail with `path_refused`.** `platform.connections.<name>.get({ path })` (and `post`, `put`, `patch`, `delete`) percent-encoded every `/` in the provider path, so `v4/spreadsheets/ID` went out as `v4%2Fspreadsheets%2FID` and the platform refused it ("The path has an encoded dot, slash, backslash or percent sign"). The path now keeps its slashes and any `?query`, and each segment is encoded. Only a connection's `{path}` is treated this way; every other path parameter is still fully encoded.
  If you added a workaround that decodes the path before sending (a custom `fetch` that undoes the encoding), you can remove it. Leaving it in does no harm.
- **The context-verification middleware now says why it refused a request.** When `middleware()` answers 401 "The platform's context for this request could not be verified", the reason (wrong host, expired token, keys not reachable) is written to the app's log on a line starting `[platform] context not verified:`. The visitor still sees only the generic message.
  This pairs with a platform change: the proxy now sends `X-Forwarded-Host`, so the token's audience is checked against the address the visitor used. Before it, signed-in requests to apps on the E2B provider could not verify.

### Added

- **The providers' own typed clients, through the connection.** `platform.connections.<name>.google(factory, options)` takes an official Google client factory (for example `gmail` from `@googleapis/gmail`) and `platform.connections.<name>.microsoft(graphSdk, kiota)` takes Microsoft's typed Graph SDK (`@microsoft/msgraph-sdk`). Every function and type is the provider's own and new ones arrive with their packages. Every request goes to the connection with the app's binding token; the provider's credential never reaches the app, and a request to any other address is refused. For Microsoft, use `drives.byDriveId('me')` for the person's own OneDrive. Microsoft's typed SDK is still labelled preview, and only Graph v1.0 is supported.
  The generated `platform.gen.ts` types each connection with the helper for its provider. Also exported: `googleFetch`, `microsoftFetch`, `providerHelpers` and the `GoogleConnection` and `MicrosoftConnection` types, for clients not covered above.
- **`PlatformError.connectUrl`.** When a connection acts as the visitor and they have not connected yet, the platform answers `409 connection_required` with a `connect_url`. It is now `err.connectUrl`, so an app can send the person there. All other extra fields of an error body are on `err.details`.

### Changed

- The generated types import `GoogleConnection` and `MicrosoftConnection` from this package when a project declares a Google or Microsoft connection, so run `platform types` again after upgrading.

## 0.1.0

First public release: the `platform` object generated from a project's declared bindings (AI gateway, managed data, approvals, connections, scheduled jobs), the request-context helpers (`context`, `middleware`, `me`, `loginUrl`, `bindingHeaders`), `mountHandlers`, the approvals and cron helpers, the structured logger, and the `platform types` generator.
