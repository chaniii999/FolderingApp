/**
 * 경로 관련 유틸리티 함수
 */

/**
 * 경로에서 사용된 분리자를 반환합니다.
 * 
 * @param path 경로 문자열
 * @returns 경로 분리자 ('/' 또는 '\')
 */
export function getPathSeparator(path: string): string {
  return path.includes('\\') ? '\\' : '/';
}

/**
 * 경로에서 파일명을 추출합니다.
 * 
 * @param path 파일 경로
 * @returns 파일명 (경로가 없으면 빈 문자열)
 */
export function getFileName(path: string): string {
  const separator = getPathSeparator(path);
  return path.split(separator).pop() || '';
}

/**
 * 경로를 분리자로 분할합니다.
 * 
 * @param path 파일 경로
 * @returns 경로 부분들의 배열
 */
export function splitPath(path: string): string[] {
  return path.split(/[/\\]/).filter(part => part.length > 0);
}

/**
 * 경로의 마지막 부분(파일명 또는 폴더명)을 반환합니다.
 * 
 * @param path 파일 경로
 * @returns 마지막 부분 (경로가 없으면 빈 문자열)
 */
export function getLastPathPart(path: string): string {
  const parts = splitPath(path);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

/**
 * 두 경로를 결합합니다.
 * 
 * @param basePath 기본 경로
 * @param relativePath 상대 경로
 * @returns 결합된 경로
 */
export function joinPath(basePath: string, relativePath: string): string {
  const separator = getPathSeparator(basePath);
  // basePath 끝에 분리자가 없으면 추가
  const normalizedBase = basePath.endsWith(separator) ? basePath : `${basePath}${separator}`;
  // relativePath 앞에 분리자가 있으면 제거
  const normalizedRelative = relativePath.startsWith(separator) ? relativePath.slice(1) : relativePath;
  return `${normalizedBase}${normalizedRelative}`;
}

/**
 * 파일 경로에서 디렉토리 경로를 반환합니다.
 * 
 * @param path 파일 경로
 * @returns 디렉토리 경로 (경로가 없으면 빈 문자열)
 */
export function getDirectoryPath(path: string): string {
  const separator = getPathSeparator(path);
  const lastSeparatorIndex = path.lastIndexOf(separator);
  if (lastSeparatorIndex <= 0) {
    return '';
  }
  return path.slice(0, lastSeparatorIndex);
}

