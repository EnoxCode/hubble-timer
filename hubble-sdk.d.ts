/**
 * Hubble SDK Type Definitions
 *
 * Standalone declaration file for Hubble module developers.
 * Copy this file into your module project for full type support.
 */

// ─── Manifest Types ───────────────────────────────────────────────

export type PropertyType =
  | 'string'
  | 'text'
  | 'number'
  | 'range'
  | 'boolean'
  | 'choice'
  | 'datetime'
  | 'json'
  | 'color'
  | 'url'
  | 'secret';

export interface ModuleProperty {
  name: string;
  type: PropertyType;
  required: boolean;
  default?: unknown;
  description: string;
  /** For 'choice' type */
  choices?: { label: string; value: string }[];
  /** For 'text' type */
  rows?: number;
  /** For 'string' / 'text' types */
  maxLength?: number;
  /** For 'number' / 'range' types */
  min?: number;
  max?: number;
  step?: number;
}

export interface ConfigPanelEntry {
  /** Button label shown in the edit interface. */
  label: string;
  /** Panel identifier — maps to `visualizations/{vizPath}/panels/{panel}.tsx`. */
  panel: string;
}

export interface VisualizationEntry {
  /** Display name in the module picker. */
  name: string;
  /** Brief description of this visualization. */
  description: string;
  /** Relative path to the visualization directory (e.g., "pill", "notifications"). */
  path: string;
  /** Per-visualization properties (drives auto-generated config UI for this specific visualization). */
  properties?: ModuleProperty[];
  /** Custom config panel components rendered as modal buttons in the edit interface. */
  configPanels?: ConfigPanelEntry[];
}

export interface ModuleManifest {
  name: string;
  version: string;
  description: string;
  minAppVersion?: string;
  minSdkVersion?: string;
  type: ('connector' | 'visualization')[];
  visualizations?: VisualizationEntry[];
  dependencies?: { name: string; minVersion: string }[];
  hardwareButtons?: Record<string, string>;
  endpoints?: {
    name: string;
    method: string;
    path: string;
    description: string;
    summary?: string;
    public?: boolean;
    body?: {
      type: 'object';
      required?: string[];
      properties: Record<string, { type: string; description?: string; example?: unknown }>;
      example?: unknown;
    };
    querystring?: {
      type: 'object';
      properties: Record<string, { type: string; description?: string }>;
    };
    response?: {
      [statusCode: number]: {
        type: 'object';
        properties: Record<string, unknown>;
        example?: unknown;
      };
    };
  }[];
  properties?: ModuleProperty[];
  /** OAuth configuration for modules requiring third-party authorization. */
  oauth?: { provider: 'google'; scopes: string[] };
  /** Discrete events this module can emit (non-cached, ephemeral). */
  events?: {
    name: string;
    description: string;
    payload?: Record<string, { type: string; enum?: string[]; description?: string }>;
  }[];
}

// ─── Config Panel Props ──────────────────────────────────────────

/** Props received by config panel components loaded in the edit interface modal. */
export interface ConfigPanelProps {
  /** Current widget configuration object. */
  config: Record<string, unknown>;
  /** Callback to update widget configuration. Merges partial updates. */
  onConfigChange: (config: Record<string, unknown>) => void;
  /** The module's database ID. Useful for calling module API endpoints. */
  moduleId: number;
  /** The module's display name. */
  moduleName: string;
}

// ─── Storage Types ────────────────────────────────────────────────

export interface CollectionItem {
  id: number;
  data: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageApi {
  /** Get a stored value by key. Returns null if not found. */
  get(key: string): unknown | null;
  /** Set a value by key (upsert). Value is JSON-serialized. */
  set(key: string, value: unknown): void;
  /** Delete a key from storage. */
  delete(key: string): void;
  /** Access a named collection for ordered item storage. */
  collection(name: string): {
    list(): CollectionItem[];
    add(data: Record<string, unknown>): CollectionItem;
    update(id: number, partial: Record<string, unknown>): void;
    remove(id: number): void;
  };
}

// ─── Dashboard Types ──────────────────────────────────────────────

export interface DashboardState {
  activePage: number;
  screenOn: boolean;
  pages: { id: number; name: string; slug: string | null; sortOrder: number }[];
}

export type PresentationAction = 'default' | 'expand' | 'dismiss' | 'pin' | 'timed' | 'acknowledge';

export interface PresentationMode {
  action: PresentationAction;
  duration?: number;
}

export interface NotifyOptions {
  level?: 'info' | 'warning' | 'error' | 'critical';
  title?: string;
  permanent?: boolean;
  timer?: number;
  image?: string;
  /** @deprecated Use `permanent` instead */
  persistent?: boolean;
}

// ─── OAuth Types ─────────────────────────────────────────────────

export interface OAuthApi {
  /** Check if OAuth tokens exist in storage. */
  isAuthorized(): boolean;
  /** Get the stored access token. */
  getAccessToken(): string | null;
  /** Get all stored OAuth tokens for direct use with provider-specific libraries. */
  getTokens(): Record<string, unknown> | null;
}

// ─── Server SDK ───────────────────────────────────────────────────

export interface ServerSdk {
  /** The current SDK version string. Modules can read this to conditionally use features. */
  version: string;

  /** Emit data to all subscribed visualizations via WebSocket. */
  emit(topic: string, data: unknown): void;

  /** Emit a discrete, non-cached event to all subscribed visualizations via WebSocket. */
  emitEvent(topic: string, payload: Record<string, unknown>): void;

  /** Schedule a recurring task. Runs immediately, then every intervalMs. */
  schedule(intervalMs: number, callback: () => void | Promise<void>): { stop: () => void };

  /** HTTP client with automatic retry (3 retries, exponential backoff). */
  http: {
    get(url: string, options?: RequestInit): Promise<unknown>;
    post(url: string, body: unknown, options?: RequestInit): Promise<unknown>;
    put(url: string, body: unknown, options?: RequestInit): Promise<unknown>;
    patch(url: string, body: unknown, options?: RequestInit): Promise<unknown>;
    delete(url: string, options?: RequestInit): Promise<unknown>;
  };

  /** Structured logging scoped to this module. */
  log: {
    info(message: string): void;
    warn(message: string): void;
    error(message: string): void;
  };

  /** Log an error to the error_logs table for studio display. */
  logError(message: string, stack?: string): void;

  /** Get module config: manifest property defaults merged with stored config. */
  getConfig(): Record<string, unknown>;

  /** Persistent key-value and collection storage scoped to this module. */
  storage: StorageApi;

  /** OAuth helpers for modules requiring third-party authorization. */
  oauth: OAuthApi;

  /** Read another module's cached connector state. */
  getConnectorState(moduleName: string, topic?: string): unknown | null;

  /** Get current dashboard state (active page, screen status, pages list). */
  getDashboardState(): DashboardState;

  /** Send a notification to the dashboard. */
  notify(message: string, options?: NotifyOptions): void;

  /** Get the config object (plus `id`) for every widget instance using this module. */
  getWidgetConfigs(): ({ id: number } & Record<string, unknown>)[];

  /** Select a specific widget by its database ID, or pass null to deselect. */
  selectWidget(widgetId: number | null): void;

  /** Register a handler for custom API endpoint calls declared in manifest "endpoints". */
  onApiCall(
    handler: (payload: { action: string; params: Record<string, string>; body: unknown }) => Promise<unknown>
  ): void;
}

// ─── Client SDK ───────────────────────────────────────────────────

export interface ClientSdk {
  /** Subscribe to a connector data topic. Returns unsubscribe function. */
  subscribe(topic: string, callback: (data: unknown) => void): () => void;

  /** Get per-widget-instance local state. */
  getState(): Record<string, unknown>;

  /** Merge partial state into per-widget-instance local state. */
  setState(partial: Record<string, unknown>): void;

  /** Read cached connector data received via WebSocket. */
  getConnectorState(topic?: string): unknown | null;

  /** Fetch the latest connector state from the server (REST fallback for initial load). */
  requestLatestData(moduleName?: string, topic?: string): Promise<unknown>;

  /** Expand widget to full page. */
  expandWidget(): void;

  /** Dismiss expanded widget back to default. */
  dismissWidget(): void;

  /** Pin widget as permanent full-page (never auto-dismisses). */
  pinWidget(): void;

  /** Expand widget for a set duration, then auto-dismiss. */
  timedExpand(durationMs: number): void;

  /** Expand widget and require user acknowledgment to dismiss. */
  requestAcknowledge(): void;

  /** Register a hardware button handler. Returns unsubscribe function. */
  onButton(buttonId: string, callback: (action: string, payload?: unknown) => void): () => void;

  /** Call a module API endpoint (authenticated). Action is the endpoint path without leading slash. Optionally target another module's API. */
  callApi(action: string, body?: Record<string, unknown>, targetModule?: string): Promise<unknown>;
}

// ─── React Hooks ──────────────────────────────────────────────────

/**
 * Subscribe to connector data with automatic re-render.
 * Defaults to current module if moduleName omitted.
 * Fetches initial cached state on mount.
 */
export declare function useConnectorData<T = unknown>(moduleName?: string, topic?: string): T | null;

/**
 * Per-widget-instance state with React integration.
 * Returns [state, setState] tuple similar to React.useState.
 */
export declare function useWidgetState<T extends Record<string, unknown>>(
  initial?: T,
): [T, (partial: Partial<T>) => void];

/**
 * Returns parsed widget config from HubbleSdkProvider context. Memoized.
 */
export declare function useWidgetConfig<T = Record<string, unknown>>(): T;

/**
 * Returns raw imperative ClientSdk for edge cases (buttons, presentation modes).
 */
export declare function useHubbleSDK(): ClientSdk;

// ─── Module Entry Types ───────────────────────────────────────────

/** Connector entry point: receives ServerSdk, optionally returns stop function. */
export type HubbleConnector = (sdk: ServerSdk) => { stop?: () => void } | void;

/** Visualization component. Use useConnectorData(), useWidgetConfig(), useHubbleSDK() hooks inside. */
export type HubbleVisualization = React.ComponentType;
