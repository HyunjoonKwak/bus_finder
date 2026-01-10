/**
 * API 응답 표준화 유틸리티
 */

import { NextResponse } from 'next/server';

export interface ApiErrorResponse {
  error: string;
  code?: string;
  detail?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
}

/**
 * 성공 응답 생성
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * 에러 응답 생성
 */
export function errorResponse(
  message: string,
  status = 500,
  code?: string,
  detail?: string
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = { error: message };
  if (code) response.code = code;
  if (detail) response.detail = detail;
  return NextResponse.json(response, { status });
}

/**
 * 공통 에러 응답들
 */
export const ApiErrors = {
  badRequest: (message = '잘못된 요청입니다.', detail?: string) =>
    errorResponse(message, 400, 'BAD_REQUEST', detail),

  unauthorized: (message = '인증이 필요합니다.') =>
    errorResponse(message, 401, 'UNAUTHORIZED'),

  notFound: (message = '리소스를 찾을 수 없습니다.') =>
    errorResponse(message, 404, 'NOT_FOUND'),

  internalError: (message = '서버 오류가 발생했습니다.', detail?: string) =>
    errorResponse(message, 500, 'INTERNAL_ERROR', detail),

  externalApiError: (service: string, detail?: string) =>
    errorResponse(`${service} API 호출에 실패했습니다.`, 502, 'EXTERNAL_API_ERROR', detail),
};

/**
 * 입력값 검증 유틸리티
 */
export function validateRequired(
  params: Record<string, string | null | undefined>,
  requiredFields: string[]
): { valid: true } | { valid: false; missing: string[] } {
  const missing = requiredFields.filter(
    (field) => !params[field] || params[field]?.trim() === ''
  );

  if (missing.length > 0) {
    return { valid: false, missing };
  }
  return { valid: true };
}

/**
 * 안전한 JSON 파싱
 */
export async function safeJsonParse<T>(
  response: Response
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
