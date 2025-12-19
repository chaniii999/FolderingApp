import { toastService } from '../services/toastService';

/**
 * 에러 처리 유틸리티 함수
 */

/**
 * 에러를 처리하고 사용자에게 메시지를 표시합니다.
 * 
 * @param error 에러 객체 또는 문자열
 * @param defaultMessage 기본 에러 메시지
 * @param logError 콘솔에 에러를 출력할지 여부 (기본값: true)
 * @returns 에러 메시지 문자열
 */
export function handleError(
  error: unknown,
  defaultMessage: string = '오류가 발생했습니다.',
  logError: boolean = true
): string {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  
  if (logError) {
    console.error('Error:', error);
  }
  
  toastService.error(errorMessage);
  
  return errorMessage;
}

/**
 * 에러를 처리하고 콘솔에만 출력합니다 (사용자에게 토스트를 표시하지 않음).
 * 
 * @param error 에러 객체 또는 문자열
 * @param defaultMessage 기본 에러 메시지
 * @returns 에러 메시지 문자열
 */
export function handleErrorSilent(
  error: unknown,
  defaultMessage: string = '오류가 발생했습니다.'
): string {
  const errorMessage = error instanceof Error ? error.message : defaultMessage;
  console.error('Error:', error);
  return errorMessage;
}

/**
 * 에러 메시지를 추출합니다 (토스트 표시 없음).
 * 
 * @param error 에러 객체 또는 문자열
 * @param defaultMessage 기본 에러 메시지
 * @returns 에러 메시지 문자열
 */
export function getErrorMessage(
  error: unknown,
  defaultMessage: string = '오류가 발생했습니다.'
): string {
  return error instanceof Error ? error.message : defaultMessage;
}

