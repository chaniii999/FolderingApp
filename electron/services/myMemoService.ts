import fs from 'fs';
import path from 'path';
import { app } from 'electron';

/**
 * 나만의 Memo 디렉토리 경로 가져오기
 * 앱 설치 경로(userData)에 프라이빗하게 저장
 */
export function getMyMemoPath(): string {
  const userDataPath = app.getPath('userData');
  const myMemoPath = path.join(userDataPath, 'myMemo');
  
  // 디렉토리가 없으면 생성
  if (!fs.existsSync(myMemoPath)) {
    fs.mkdirSync(myMemoPath, { recursive: true });
  }
  
  return myMemoPath;
}

/**
 * 나만의 Memo 기본 폴더 구조 초기화
 */
export function initializeMyMemoStructure(): void {
  const myMemoPath = getMyMemoPath();
  
  // 회고록 폴더들
  const reflectionDirs = [
    path.join(myMemoPath, '회고록', '일일'),
    path.join(myMemoPath, '회고록', '주간'),
    path.join(myMemoPath, '회고록', '월간'),
  ];
  
  // 내 메모 폴더
  const myNotesDir = path.join(myMemoPath, '내 메모');
  
  // 모든 폴더 생성
  [...reflectionDirs, myNotesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * 나만의 Memo 경로인지 확인
 */
export function isMyMemoPath(filePath: string): boolean {
  const myMemoPath = getMyMemoPath();
  return filePath.startsWith(myMemoPath);
}

/**
 * 템플릿 디렉토리 경로 가져오기
 * 앱 설치 경로(userData)에 프라이빗하게 저장
 */
export function getTemplatesPath(): string {
  const userDataPath = app.getPath('userData');
  const templatesPath = path.join(userDataPath, 'templates');
  
  // 디렉토리가 없으면 생성
  if (!fs.existsSync(templatesPath)) {
    fs.mkdirSync(templatesPath, { recursive: true });
  }
  
  return templatesPath;
}

/**
 * 템플릿 파일 경로인지 확인
 */
export function isTemplatePath(filePath: string): boolean {
  const templatesPath = getTemplatesPath();
  return filePath.startsWith(templatesPath);
}
