import { getFileName } from './pathUtils';

export function isTextFile(filePath: string | null): boolean {
  if (!filePath) return false;
  
  // 파일명만 추출 (경로에서 마지막 부분)
  const fileName = getFileName(filePath);
  if (!fileName) return true; // 파일명이 없으면 텍스트로 간주
  
  // 파일명에서 확장자 추출
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return true; // 확장자가 없으면 텍스트로 간주
  }
  
  const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  
  // 텍스트 파일이 아닌 확장자 목록
  const nonTextExtensions = [
    // 이미지
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif',
    // 비디오
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v',
    // 오디오
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
    // 압축
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
    // 실행 파일
    'exe', 'dll', 'so', 'dylib',
    // 기타 바이너리
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'db', 'sqlite', 'sqlite3',
  ];
  
  return !nonTextExtensions.includes(extension);
}

