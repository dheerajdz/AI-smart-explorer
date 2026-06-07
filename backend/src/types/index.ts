export type PlanTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export type ReputationTier = 'NEWBIE' | 'EXPLORER' | 'VETERAN' | 'ELITE' | 'LEGEND';

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
