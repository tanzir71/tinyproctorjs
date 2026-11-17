/* Type definitions for tinyproctor.js 1.1 */

export type ViolationKey =
  | 'tab_hidden'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'devtools_key'
  | 'devtools_resize'
  | 'copy_attempt'
  | 'cut_attempt'
  | 'paste_attempt'
  | 'context_menu'
  | 'print_attempt'
  | 'page_idle'
  | 'multi_screen'
  | 'automation_flag'
  | 'drop_attempt'
  | 'insert_burst'

export type EventType =
  | 'session'
  | 'heartbeat'
  | 'visibility'
  | 'focus'
  | 'fullscreen'
  | 'devtools'
  | 'clipboard'
  | 'contextmenu'
  | 'print'
  | 'idle'
  | 'screen'
  | 'automation'
  | 'input'
  | 'custom'

export interface TinyProctorConfig {
  /** Collector URL. Without it, events stay in the page (onEvent still fires). */
  endpoint?: string
  examId?: string
  /** Your exam system's attempt ID. Also enables session continuity across pages. */
  attemptId?: string
  candidateLabel?: string
  sessionId?: string
  /** Show the live score badge. Default true (badge hidden). */
  silent?: boolean
  heartbeatMs?: number
  flushMs?: number
  batchMax?: number
  /** Max bytes per batch, default 49152 (keepalive bodies share a 64 KiB budget). */
  batchBytes?: number
  queueMax?: number
  idleMs?: number
  devtools?: boolean
  clipboard?: boolean
  blockClipboard?: boolean
  contextmenu?: boolean
  blockContextmenu?: boolean
  print?: boolean
  idle?: boolean
  /** multi_screen signal (screen.isExtended, Chromium). Default true. */
  screens?: boolean
  /** automation_flag signal (navigator.webdriver). Default true. */
  automation?: boolean
  /** insert_burst signal. Default true. */
  insert?: boolean
  /** Characters inserted at once that count as insert_burst. Default 40. */
  insertChars?: number
  /** Drop a window_blur that comes with a tab_hidden within this many ms. Default 0 (off). */
  blurDedupeMs?: number
  /** Keep one session per attempt across page loads (sessionStorage). Default true when attemptId is set. */
  persist?: boolean
  resizeThrottleMs?: number
  devtoolsResizeThreshold?: number
  devtoolsResizeCooldownMs?: number
  credentials?: 'omit' | 'same-origin' | 'include'
  /** json (default), text (text/plain JSON, no CORS preflight) or form (payload=<json>). */
  payloadFormat?: 'json' | 'text' | 'form'
  weights?: Partial<Record<ViolationKey, number>> & Record<string, number>
  onViolation?: (key: string, data: Record<string, unknown> | null, state: TinyProctorState) => void
  onEvent?: (event: TinyProctorEvent) => void
}

export interface TinyProctorEvent {
  schemaVersion: 1
  clientVersion: string
  /** Monotonic per session. Dedupe on (sessionId, seq). */
  seq: number
  sessionId: string
  examId: string
  attemptId: string
  candidateLabel: string
  clientTime: string
  eventType: EventType
  violationKey: string | null
  eventData: Record<string, unknown> | null
  pageUrl: string
  referrer: string
  visibilityState: string
  hasFocus: boolean
  isFullscreen: boolean
  violationCount: number
  integrityScore: number
}

export interface TinyProctorState {
  version: string
  sessionId: string
  examId: string
  attemptId: string
  candidateLabel: string
  startedAt: string
  lastHeartbeatAt: string | null
  devtoolsSuspected: boolean
  visibilityState: string
  isFocused: boolean
  isFullscreen: boolean
  isIdle: boolean
  violationCounts: Record<string, number>
  violationCount: number
  integrityScore: number
  recentViolations: Array<{ t: string; eventType: string; violationKey: string | null; eventData: Record<string, unknown> | null }>
  sentEvents: number
  droppedEvents: number
  queuedEvents: number
  failedFlushes: number
  seq: number
  /** Total milliseconds the candidate spent away (tab hidden or window unfocused). */
  awayMs: number
  /** True when this page continued a saved session. */
  resumed: boolean
  flags: Record<string, number>
}

export interface TinyProctorInstance {
  start(): void
  stop(): void
  flush(): void
  getState(): TinyProctorState
  getConfig(): Required<Omit<TinyProctorConfig, 'onViolation' | 'onEvent'>> & Pick<TinyProctorConfig, 'onViolation' | 'onEvent'>
  requestFullscreen(el?: Element): Promise<void>
  exitFullscreen(): Promise<void>
  markViolation(key: string, data?: Record<string, unknown>): void
  /** Forget the saved session for this attempt. */
  clearSession(): void
}

export interface TinyProctorStatic {
  init(config?: TinyProctorConfig): TinyProctorInstance
  get(): TinyProctorInstance | null
  /** Stop monitoring. Pass true to also forget the saved session (e.g. after submit). */
  destroy(clearSession?: boolean): void
  version: string
  defaultWeights: Record<ViolationKey, number>
}

declare const TinyProctor: TinyProctorStatic
export default TinyProctor
export { TinyProctor }

declare global {
  interface Window {
    TinyProctor: TinyProctorStatic
  }
}
