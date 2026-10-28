// The official Google and Microsoft clients, through the connections broker. The app imports the provider's own package (@googleapis/gmail,
// @microsoft/msgraph-sdk, ...) and hands its factory to the connection, so every function and type is the provider's own and new ones arrive with the
// package. Underneath, every request the client makes goes to the connection's address with the binding token; the provider's credential stays outside the
// sandbox. A request for any other host is refused, so the token can never leave for an address the platform did not choose.
import { bindingHeaders } from './context.js'
import { PlatformError } from './platform.js'

type Env = Record<string, string | undefined>

export interface ProviderFetchOptions {
  env?: Env
  fetch?: typeof fetch
}

const GOOGLE_HOST = /^[a-z0-9-]+\.googleapis\.com$/
const GRAPH_HOST = 'graph.microsoft.com'

/** A fetch that sends what an official client asks for to the connection instead. `rewrite` turns the provider's path into the connection's, or refuses it. */
function viaConnection(address: () => string, allowHost: (host: string) => boolean, rewrite: (path: string) => string, o: ProviderFetchOptions): typeof fetch {
  const env = o.env ?? process.env
  const f = o.fetch ?? fetch
  return async (input, init = {}) => {
    const req = input instanceof Request ? input : undefined
    const u = new URL(req ? req.url : String(input))
    if (u.protocol !== 'https:' || !allowHost(u.hostname)) throw new PlatformError(0, 'host_refused', `The client tried to call ${u.host}, which is not this connection's service.`, 'Use the client for the connection\'s own provider. Other addresses are refused so the platform token stays with the platform.')
    const token = env.PLATFORM_TOKEN
    if (!token) throw new PlatformError(0, 'not_configured', 'PLATFORM_TOKEN is not set.', 'Run on the platform, or locally with `platform dev -- <command>`.')
    const headers = new Headers(req?.headers)
    new Headers(init.headers).forEach((v, k) => headers.set(k, v))
    headers.delete('authorization') // whatever the client thinks its credential is; the platform adds the real one
    headers.set('x-platform-binding-token', token)
    for (const [k, v] of Object.entries(bindingHeaders())) headers.set(k, v) // who the visitor is, for access: "user"
    const target = address().replace(/\/$/, '') + rewrite(u.pathname) + u.search
    if (!req) return f(target, { ...init, headers })
    // A Request with a stream body can only be rebuilt with duplex: 'half'.
    return f(new Request(target, { method: req.method, headers, body: req.body, signal: init.signal ?? req.signal, redirect: req.redirect, ...(req.body ? { duplex: 'half' } : {}) } as RequestInit))
  }
}

/** The fetch an official Google client should use (`fetchImplementation`). Any *.googleapis.com address goes to the connection, path unchanged. */
export function googleFetch(address: () => string, o: ProviderFetchOptions = {}): typeof fetch {
  return viaConnection(address, (h) => GOOGLE_HOST.test(h), (p) => p, o)
}

/** The fetch Microsoft Graph's client should use. Graph v1.0 paths go to the connection (whose address is already v1.0); /me stays /me. */
export function microsoftFetch(address: () => string, o: ProviderFetchOptions = {}): typeof fetch {
  return viaConnection(address, (h) => h === GRAPH_HOST, (p) => {
    if (!/^\/v1\.0(\/|$)/.test(p)) throw new PlatformError(0, 'version_not_supported', `Only Microsoft Graph v1.0 goes through connections (this call was ${p.split('/')[1] || 'unversioned'}).`, 'Use the v1.0 client (@microsoft/msgraph-sdk), not the beta one.')
    // The typed client writes /me as /users/TokenToReplace and expects its own middleware to put it back. It reaches files only through /drives/{id}, so
    // drives.byDriveId('me') means the person's own OneDrive (/me/drive), which is what onedrive.* permissions open; other drive ids need files.all.*.
    return p.slice('/v1.0'.length).replace(/^\/users\/TokenToReplace(?=\/|$)/, '/me').replace(/^\/drives\/me(?=\/|$)/, '/me/drive')
  }, o)
}

/** Shape of an official Google client factory, for example `gmail` from @googleapis/gmail or `sheets` from @googleapis/sheets. */
export type GoogleFactory<O, C> = (options: O) => C
/** What a Google client needs from us; the rest of its options are the app's. */
type GoogleWired = 'auth' | 'fetchImplementation' | 'rootUrl'

/** The parts of @microsoft/msgraph-sdk and @microsoft/kiota-http-fetchlibrary the Graph client is assembled from. Pass the modules themselves. */
export interface GraphSdk<C> {
  createGraphServiceClient(adapter: any): C
  GraphRequestAdapter: new (authenticationProvider: any, parseNodeFactory?: any, serializationWriterFactory?: any, httpClient?: any) => any
}
export interface KiotaFetch {
  HttpClient: new (customFetch?: any, ...middlewares: any[]) => any
  MiddlewareFactory: { getDefaultMiddlewares(customFetch?: any): any[] }
}

export interface GoogleConnection {
  /**
   * An official Google client that works through this connection: every function and type is Google's own.
   * `platform.connections.mail.google(gmail, { version: 'v1' })` with `import { gmail } from '@googleapis/gmail'`.
   */
  google<O extends object, C>(factory: GoogleFactory<O, C>, options: Omit<O, GoogleWired>): C
  /** fetch() for any other Google client: send it to a *.googleapis.com address and it goes through this connection. */
  fetch: typeof fetch
}

export interface MicrosoftConnection {
  /**
   * The official, typed Microsoft Graph client working through this connection.
   * `platform.connections.office.microsoft(graphSdk, kiota)` with `import * as graphSdk from '@microsoft/msgraph-sdk'` and
   * `import * as kiota from '@microsoft/kiota-http-fetchlibrary'` (import the service packages you use too, for example '@microsoft/msgraph-sdk-users').
   */
  microsoft<C>(sdk: GraphSdk<C>, kiota: KiotaFetch): C
  /** fetch() for any other Graph client: send it to https://graph.microsoft.com/v1.0/... and it goes through this connection. Use `drives.byDriveId('me')` for the person's own OneDrive. */
  fetch: typeof fetch
}

/** The helpers one connection gets, for its provider (both when the provider map is missing; none for a provider that has no official client here). */
export function providerHelpers(provider: string | undefined, address: () => string, o: ProviderFetchOptions = {}): Partial<GoogleConnection & MicrosoftConnection> {
  const google = (): Pick<GoogleConnection, 'google'> => {
    const fetchImplementation = googleFetch(address, o)
    // No auth client: the connection adds the credential. rootUrl is not enough on its own (Google's media uploads ignore it), the fetch is what holds.
    return { google: (factory, options) => factory({ ...(options as object), fetchImplementation } as never) }
  }
  const microsoft = (): Pick<MicrosoftConnection, 'microsoft'> => {
    const f = microsoftFetch(address, o)
    return {
      microsoft: (sdk, kiota) => {
        const http = new kiota.HttpClient(undefined, ...kiota.MiddlewareFactory.getDefaultMiddlewares(f))
        const noAuth = { authenticateRequest: async () => {} } // the connection adds the credential
        return sdk.createGraphServiceClient(new sdk.GraphRequestAdapter(noAuth, undefined, undefined, http))
      },
    }
  }
  if (provider === 'google') return { ...google(), fetch: googleFetch(address, o) }
  if (provider === 'microsoft') return { ...microsoft(), fetch: microsoftFetch(address, o) }
  if (provider !== undefined) return {} // a provider with no official client here (Slack): the plain calls only
  return { ...google(), ...microsoft() }
}
