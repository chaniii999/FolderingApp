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
  
  // 마크다운 가이드 파일 생성
  const guideFilePath = path.join(myNotesDir, '00_마크다운_가이드.md');
  if (!fs.existsSync(guideFilePath)) {
    const guideContent = `# 마크다운 문법 가이드

## 제목
\`\`\`
# 제목 1
## 제목 2
### 제목 3
\`\`\`

## 텍스트 스타일
\`\`\`
**굵게**
*기울임*
~~취소선~~
\`코드\`
\`\`\`

## 목록
\`\`\`
- 항목 1
- 항목 2
  - 하위 항목

1. 번호 목록
2. 번호 목록
\`\`\`

## 링크
\`\`\`
[링크 텍스트](https://example.com)
\`\`\`

## 이미지
\`\`\`
![이미지 설명](이미지경로.jpg)
\`\`\`

## 코드 블록
\`\`\`\`\`
\`\`\`언어
코드 내용
\`\`\`
\`\`\`\`\`

## 인용
\`\`\`
> 인용문
\`\`\`

## 구분선
\`\`\`
---
\`\`\`

## 체크박스
\`\`\`
- [ ] 미완료
- [x] 완료
\`\`\`

## 표
\`\`\`
| 열1 | 열2 |
|-----|-----|
| 값1 | 값2 |
\`\`\`
`;
    fs.writeFileSync(guideFilePath, guideContent, 'utf-8');
  }
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
