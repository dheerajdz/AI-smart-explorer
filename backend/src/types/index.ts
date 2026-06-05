export interface HealthResponse {
  status: string;
  service: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}
