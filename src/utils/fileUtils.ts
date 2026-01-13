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

export function isPdfFile(filePath: string | null): boolean {
  if (!filePath) return false;
  
  const fileName = getFileName(filePath);
  if (!fileName) return false;
  
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return false;
  }
  
  const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  return extension === 'pdf';
}

/**
 * 템플릿 파일인지 확인 (나만의 메모 영역에 존재하는 .json 파일 중 CustomTemplate 형식)
 */
export async function isTemplateFile(filePath: string | null): Promise<boolean> {
  if (!filePath) return false;
  
  const fileName = getFileName(filePath);
  if (!fileName) return false;
  
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return false;
  }
  
  const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  if (extension !== 'json') {
    return false;
  }
  
  // 나만의 메모 영역에 존재하는지 확인
  if (window.api?.mymemo) {
    try {
      const isMyMemo = await window.api.mymemo.isMyMemoPath(filePath);
      if (!isMyMemo) {
        return false;
      }
      
      // 파일 내용을 읽어서 CustomTemplate 형식인지 확인
      if (window.api?.filesystem?.readFile) {
        try {
          const content = await window.api.filesystem.readFile(filePath);
          if (content) {
            const parsed = JSON.parse(content);
            // CustomTemplate 형식인지 확인 (id, name, parts 필드가 있는지)
            // TemplateInstance 형식이면 템플릿 파일이 아님
            if (parsed.templateId && typeof parsed.data === 'object') {
              // TemplateInstance 형식이면 템플릿 파일이 아님
              return false;
            }
            // CustomTemplate 형식인지 확인
            const hasId = typeof parsed.id === 'string' && parsed.id.trim() !== '';
            const hasName = typeof parsed.name === 'string' && parsed.name.trim() !== '';
            const hasParts = Array.isArray(parsed.parts);
            return hasId && hasName && hasParts;
          }
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * 템플릿 인스턴스 파일인지 확인 (나만의 메모 경로 내의 .json 파일 중 TemplateInstance 형식)
 */
export async function isTemplateInstanceFile(filePath: string | null): Promise<boolean> {
  if (!filePath) {
    return false;
  }
  
  const fileName = getFileName(filePath);
  if (!fileName) {
    return false;
  }
  
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    return false;
  }
  
  const extension = fileName.substring(lastDotIndex + 1).toLowerCase();
  if (extension !== 'json') {
    return false;
  }
  
  // 템플릿 파일이면 인스턴스가 아님
  const isTemplate = await isTemplateFile(filePath);
  if (isTemplate) {
    return false;
  }
  
  // 나만의 메모 경로인지 확인
  if (window.api?.mymemo) {
    try {
      const isMyMemo = await window.api.mymemo.isMyMemoPath(filePath);
      if (!isMyMemo) {
        return false;
      }
      
      // 파일 내용을 읽어서 TemplateInstance 형식인지 확인
      if (window.api?.filesystem?.readFile) {
        try {
          const content = await window.api.filesystem.readFile(filePath);
          if (content) {
            const parsed = JSON.parse(content);
            // TemplateInstance 형식인지 확인 (templateId, data 필드가 있는지)
            const hasTemplateId = !!parsed.templateId;
            const hasData = typeof parsed.data === 'object' && parsed.data !== null;
            const isInstance = hasTemplateId && hasData;
            return isInstance;
          }
        } catch (err) {
          return false;
        }
      }
    } catch (err) {
      return false;
    }
  }
  
  return false;
}
