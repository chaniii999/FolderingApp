/**
 * 나만의 Memo 프론트엔드 서비스
 */

let cachedMyMemoPath: string | null = null;

/**
 * 나만의 Memo 경로 가져오기 (캐싱)
 */
export async function getMyMemoPath(): Promise<string> {
  if (cachedMyMemoPath) {
    return cachedMyMemoPath;
  }
  
  if (!window.api?.mymemo) {
    throw new Error('MyMemo API가 로드되지 않았습니다.');
  }
  
  cachedMyMemoPath = await window.api.mymemo.getPath();
  return cachedMyMemoPath;
}

/**
 * 경로가 나만의 Memo 경로인지 확인
 */
export async function isMyMemoPath(filePath: string): Promise<boolean> {
  if (!window.api?.mymemo || !filePath) {
    return false;
  }
  
  try {
    return await window.api.mymemo.isMyMemoPath(filePath);
  } catch (error) {
    console.error('Error checking my memo path:', error);
    return false;
  }
}

/**
 * 나만의 Memo 모드인지 확인
 */
export async function isMyMemoMode(currentPath: string): Promise<boolean> {
  if (!currentPath) {
    return false;
  }
  return await isMyMemoPath(currentPath);
}

/**
 * 템플릿 경로 가져오기 (캐싱)
 */
let cachedTemplatesPath: string | null = null;

export async function getTemplatesPath(): Promise<string> {
  if (cachedTemplatesPath) {
    return cachedTemplatesPath;
  }
  
  if (!window.api?.mymemo) {
    throw new Error('MyMemo API가 로드되지 않았습니다.');
  }
  
  cachedTemplatesPath = await window.api.mymemo.getTemplatesPath();
  return cachedTemplatesPath;
}
