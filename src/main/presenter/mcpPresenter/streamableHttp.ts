import { EventSource, type ErrorEvent, type EventSourceInit } from 'eventsource'
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { JSONRPCMessage, JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js'
import {
  auth,
  AuthResult,
  OAuthClientProvider,
  UnauthorizedError
} from '@modelcontextprotocol/sdk/client/auth.js'

export class StreamableHttpError extends Error {
  constructor(
    public readonly code: number | undefined,
    message: string | undefined,
    public readonly event?: ErrorEvent
  ) {
    super(`Streamable HTTP error: ${message}`)
  }
}

/**
 * Configuration options for the `StreamableHttpClientTransport`.
 */
export type StreamableHttpClientTransportOptions = {
  /**
   * An OAuth client provider to use for authentication.
   *
   * When an `authProvider` is specified and the connection is started:
   * 1. The connection is attempted with any existing access token from the `authProvider`.
   * 2. If the access token has expired, the `authProvider` is used to refresh the token.
   * 3. If token refresh fails or no access token exists, and auth is required, `OAuthClientProvider.redirectToAuthorization` is called, and an `UnauthorizedError` will be thrown from `connect`/`start`.
   *
   * After the user has finished authorizing via their user agent, and is redirected back to the MCP client application, call `StreamableHttpClientTransport.finishAuth` with the authorization code before retrying the connection.
   *
   * If an `authProvider` is not provided, and auth is required, an `UnauthorizedError` will be thrown.
   *
   * `UnauthorizedError` might also be thrown when sending any message over the transport, indicating that the session has expired, and needs to be re-authed and reconnected.
   */
  authProvider?: OAuthClientProvider

  /**
   * Customizes the initial SSE request to the server (the request that begins the stream).
   *
   * NOTE: Setting this property will prevent an `Authorization` header from
   * being automatically attached to the SSE request, if an `authProvider` is
   * also given. This can be worked around by setting the `Authorization` header
   * manually.
   */
  eventSourceInit?: EventSourceInit

  /**
   * Customizes recurring POST requests to the server.
   */
  requestInit?: RequestInit

  /**
   * Whether to use SSE for receiving responses to requests.
   * If true, the client will establish an SSE connection to receive responses.
   * If false, the client will use direct HTTP responses.
   * @default true
   */
  useSSE?: boolean
}

/**
 * Client transport for Streamable HTTP: this implements the MCP Streamable HTTP transport specification.
 * It supports both SSE streaming and direct HTTP responses, with session management and message resumability.
 *
 * Usage example:
 *
 * ```typescript
 * // With SSE streaming (default)
 * const sseTransport = new StreamableHttpClientTransport(new URL("http://example.com/mcp"));
 *
 * // With direct HTTP responses
 * const httpTransport = new StreamableHttpClientTransport(new URL("http://example.com/mcp"), {
 *   useSSE: false
 * });
 * ```
 */
export class StreamableHttpClientTransport implements Transport {
  private _eventSource?: EventSource
  private _endpoint?: URL
  private _abortController?: AbortController
  private _url: URL
  private _eventSourceInit?: EventSourceInit
  private _requestInit?: RequestInit
  private _authProvider?: OAuthClientProvider
  private _useSSE: boolean
  private _sessionId?: string
  private _pendingRequests: Map<string, (response: JSONRPCMessage) => void> = new Map()

  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  constructor(url: URL, opts?: StreamableHttpClientTransportOptions) {
    this._url = url
    this._eventSourceInit = opts?.eventSourceInit
    this._requestInit = opts?.requestInit
    this._authProvider = opts?.authProvider
    this._useSSE = opts?.useSSE !== false
  }

  private async _authThenStart(): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError('No auth provider')
    }

    let result: AuthResult
    try {
      result = await auth(this._authProvider, { serverUrl: this._url })
    } catch (error) {
      this.onerror?.(error as Error)
      throw error
    }

    if (result !== 'AUTHORIZED') {
      throw new UnauthorizedError()
    }

    return await this._startOrAuth()
  }

  private async _commonHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {}
    if (this._authProvider) {
      const tokens = await this._authProvider.tokens()
      if (tokens) {
        headers['Authorization'] = `Bearer ${tokens.access_token}`
      }
    }

    if (this._sessionId) {
      headers['mcp-session-id'] = this._sessionId
    }

    return headers
  }

  private _startOrAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this._useSSE) {
        this._eventSource = new EventSource(
          this._url.href,
          this._eventSourceInit ?? {
            fetch: (url, init) =>
              this._commonHeaders().then((headers) =>
                fetch(url, {
                  ...init,
                  headers: {
                    ...headers,
                    Accept: 'text/event-stream'
                  }
                })
              )
          }
        )
        this._abortController = new AbortController()

        this._eventSource.onerror = (event) => {
          if (event.code === 401 && this._authProvider) {
            this._authThenStart().then(resolve, reject)
            return
          }

          const error = new StreamableHttpError(event.code, event.message, event)
          reject(error)
          this.onerror?.(error)
        }

        this._eventSource.onopen = () => {
          // The connection is open, but we need to wait for the endpoint to be received.
        }

        this._eventSource.addEventListener('endpoint', (event: Event) => {
          const messageEvent = event as MessageEvent

          try {
            this._endpoint = new URL(messageEvent.data, this._url)
            if (this._endpoint.origin !== this._url.origin) {
              throw new Error(
                `Endpoint origin does not match connection origin: ${this._endpoint.origin}`
              )
            }
          } catch (error) {
            reject(error)
            this.onerror?.(error as Error)

            void this.close()
            return
          }

          resolve()
        })

        this._eventSource.onmessage = (event: Event) => {
          const messageEvent = event as MessageEvent
          let message: JSONRPCMessage
          try {
            message = JSONRPCMessageSchema.parse(JSON.parse(messageEvent.data))
          } catch (error) {
            this.onerror?.(error as Error)
            return
          }

          // Check if this is a response to a pending request
          if ('id' in message && message.id !== null && message.id !== undefined) {
            const requestId = String(message.id)
            const resolveRequest = this._pendingRequests.get(requestId)
            if (resolveRequest) {
              resolveRequest(message)
              this._pendingRequests.delete(requestId)
              return
            }
          }

          this.onmessage?.(message)
        }
      } else {
        // For non-SSE mode, we just need to set the endpoint and resolve
        this._endpoint = this._url
        resolve()
      }
    })
  }

  async start() {
    if (this._eventSource) {
      throw new Error(
        'StreamableHttpClientTransport already started! If using Client class, note that connect() calls start() automatically.'
      )
    }

    return await this._startOrAuth()
  }

  /**
   * Call this method after the user has finished authorizing via their user agent and is redirected back to the MCP client application. This will exchange the authorization code for an access token, enabling the next connection attempt to successfully auth.
   */
  async finishAuth(authorizationCode: string): Promise<void> {
    if (!this._authProvider) {
      throw new UnauthorizedError('No auth provider')
    }

    const result = await auth(this._authProvider, {
      serverUrl: this._url,
      authorizationCode
    })
    if (result !== 'AUTHORIZED') {
      throw new UnauthorizedError('Failed to authorize')
    }
  }

  async close(): Promise<void> {
    this._abortController?.abort()
    this._eventSource?.close()
    this.onclose?.()
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this._endpoint) {
      throw new Error('Not connected')
    }

    try {
      const commonHeaders = await this._commonHeaders()
      const headers = new Headers({
        ...commonHeaders,
        ...this._requestInit?.headers
      })
      headers.set('content-type', 'application/json')

      // Set Accept header based on whether we're using SSE
      if (this._useSSE) {
        headers.set('Accept', 'text/event-stream')
      } else {
        headers.set('Accept', 'application/json')
      }

      const init = {
        ...this._requestInit,
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: this._abortController?.signal
      }

      const response = await fetch(this._endpoint, init)

      // Check for session ID in response headers
      const sessionId = response.headers.get('mcp-session-id')
      if (sessionId) {
        this._sessionId = sessionId
      }

      if (!response.ok) {
        if (response.status === 401 && this._authProvider) {
          const result = await auth(this._authProvider, {
            serverUrl: this._url
          })
          if (result !== 'AUTHORIZED') {
            throw new UnauthorizedError()
          }

          // Purposely _not_ awaited, so we don't call onerror twice
          return this.send(message)
        }

        const text = await response.text().catch(() => null)
        throw new Error(`Error POSTing to endpoint (HTTP ${response.status}): ${text}`)
      }

      // If we're not using SSE and this is a request with an ID, wait for the response
      if (!this._useSSE && 'id' in message && message.id !== null && message.id !== undefined) {
        const requestId = String(message.id)

        // Parse the response as JSON
        const responseData = await response.json()
        const responseMessage = JSONRPCMessageSchema.parse(responseData)

        // Check if this is a response to our request
        if ('id' in responseMessage && String(responseMessage.id) === requestId) {
          this.onmessage?.(responseMessage)
        } else {
          // If it's not a response to our request, it might be a notification
          this.onmessage?.(responseMessage)
        }
      }
    } catch (error) {
      this.onerror?.(error as Error)
      throw error
    }
  }

  /**
   * Returns the session ID for this transport.
   */
  get sessionId(): string | undefined {
    return this._sessionId
  }
}
