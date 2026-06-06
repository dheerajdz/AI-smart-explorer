export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// ── Query / Action Types ───────────────────────────────────

export { QueryAction, VALID_QUERY_ACTIONS, ParsedQuery, QUERY_ACTION_DESCRIPTIONS, QUERY_ACTION_EXAMPLES } from './query';
export type { QueryAction as QueryActionType } from './query';
