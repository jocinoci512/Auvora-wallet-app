import type { ApiErrorBody, ApiResponse, ApiResponseMeta } from '@auvora/types';

export function successResponse<T>(data: T, meta?: Partial<ApiResponseMeta>): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

export function errorResponse(error: ApiErrorBody, meta?: Partial<ApiResponseMeta>): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}
