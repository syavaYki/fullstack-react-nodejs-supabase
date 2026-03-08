/** Standard success response */
export function successResponse<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message && { message }),
  };
}

/** Standard error response */
export function errorResponse(error: string, details?: Record<string, unknown>) {
  return {
    success: false as const,
    error,
    ...(details && { details }),
  };
}

/** Paginated response */
export function paginatedResponse<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number; totalPages: number },
  message?: string
) {
  return {
    success: true as const,
    data,
    pagination,
    ...(message && { message }),
  };
}

/** Simple message response (no data) */
export function messageResponse(message: string) {
  return {
    success: true as const,
    message,
  };
}

/** Created response (201) */
export function createdResponse<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message && { message }),
  };
}

/** Deleted response */
export function deletedResponse(message = 'Resource deleted successfully') {
  return {
    success: true as const,
    message,
  };
}
