import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getStartPathOrHome, loadStartPath } from './startPathService';

export interface FileSystemItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export function getCurrentDirectory(): string {
  // 저장된 시작 경로가 있으면 사용, 없으면 홈 디렉토리
  return getStartPathOrHome();
}

export function listDirectory(dirPath: string): FileSystemItem[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }

    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const validItems: FileSystemItem[] = [];
    
    for (const item of items) {
      try {
        const fullPath = path.join(dirPath, item.name);
        let stats;
        
        // statSync에서 권한 오류가 발생할 수 있으므로 try-catch로 처리
        try {
          stats = fs.statSync(fullPath);
        } catch (statError: any) {
          // 권한 오류나 기타 오류가 발생하면 건너뛰기
          if (statError.code === 'EPERM' || statError.code === 'EACCES') {
            console.warn(`Permission denied for ${fullPath}, skipping...`);
            continue;
          }
          throw statError; // 다른 오류는 다시 throw
        }
        
        validItems.push({
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size: item.isFile() ? stats.size : undefined,
        });
      } catch (error: any) {
        // 개별 항목 처리 중 오류 발생 시 건너뛰기
        console.warn(`Error processing item ${item.name}:`, error.message);
        continue;
      }
    }
    
    // 정렬
    validItems.sort((a, b) => {
      // 디렉토리를 먼저, 그 다음 이름순 정렬
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return validItems;
  } catch (error) {
    console.error('Error listing directory:', error);
    throw error;
  }
}

export function changeDirectory(currentPath: string, targetName: string): string | null {
  try {
    const targetPath = path.join(currentPath, targetName);
    
    if (!fs.existsSync(targetPath)) {
      return null;
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return null;
    }

    return targetPath;
  } catch (error) {
    console.error('Error changing directory:', error);
    return null;
  }
}

export function getParentDirectory(dirPath: string): string | null {
  try {
    const parent = path.dirname(dirPath);
    
    // 루트 디렉토리인 경우 null 반환
    if (parent === dirPath) {
      return null;
    }
    
    // SelectPath로 지정한 루트 디렉토리인 경우 null 반환
    const rootPath = loadStartPath();
    if (rootPath) {
      // 절대 경로로 변환하여 비교 (대소문자 무시)
      const resolvedDirPath = path.resolve(dirPath);
      const resolvedRootPath = path.resolve(rootPath);
      const resolvedParent = path.resolve(parent);
      
      // Windows에서는 대소문자를 구분하지 않으므로 소문자로 변환하여 비교
      const isWindows = process.platform === 'win32';
      const comparePath = (p1: string, p2: string): boolean => {
        if (isWindows) {
          return p1.toLowerCase() === p2.toLowerCase();
        }
        return p1 === p2;
      };
      
      const startsWithPath = (p1: string, p2: string): boolean => {
        if (isWindows) {
          return p1.toLowerCase().startsWith(p2.toLowerCase() + path.sep);
        }
        return p1.startsWith(p2 + path.sep);
      };
      
      // 현재 경로가 루트 경로와 같으면 null 반환 (상위 디렉토리로 이동 불가)
      if (comparePath(resolvedDirPath, resolvedRootPath)) {
        return null;
      }
      
      // 루트 경로 내부에 있는지 확인
      if (startsWithPath(resolvedDirPath, resolvedRootPath) || comparePath(resolvedDirPath, resolvedRootPath)) {
        // 루트 경로 내부이므로 부모 디렉토리 확인
        // 부모가 루트 경로와 같으면 null 반환 (상위 디렉토리로 이동 불가)
        if (comparePath(resolvedParent, resolvedRootPath)) {
          return null;
        }
        // 부모가 루트 경로 내부에 있으면 부모 반환
        if (startsWithPath(resolvedParent, resolvedRootPath) || comparePath(resolvedParent, resolvedRootPath)) {
          return parent;
        }
        // 부모가 루트 경로 밖이면 null 반환
        return null;
      }
      
      // 루트 경로 밖이면 null 반환 (루트 경로로 제한)
      return null;
    }
    
    return parent;
  } catch (error) {
    console.error('Error getting parent directory:', error);
    return null;
  }
}

export function readFile(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return null;
    }

    // 파일 크기가 10MB를 초과하면 읽지 않음
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (stats.size > maxSize) {
      throw new Error('파일이 너무 큽니다 (최대 10MB)');
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}

export function readFileAsBase64(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      return null;
    }

    // PDF 파일 크기 제한 (50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (stats.size > maxSize) {
      throw new Error('PDF 파일이 너무 큽니다 (최대 50MB)');
    }

    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return base64;
  } catch (error) {
    console.error('Error reading file as base64:', error);
    throw error;
  }
}

export function writeFile(filePath: string, content: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('파일이 존재하지 않습니다.');
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      throw new Error('디렉토리는 저장할 수 없습니다.');
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
}

export function createFile(filePath: string, content: string = ''): void {
  try {
    if (fs.existsSync(filePath)) {
      throw new Error('파일이 이미 존재합니다.');
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
}

export function createGuideFile(dirPath: string): string | null {
  try {
    const guidePath = path.join(dirPath, '가이드.md');
    
    // 이미 존재하면 생성하지 않음
    if (fs.existsSync(guidePath)) {
      return guidePath;
    }

    const guideContent = `# Foldering 사용 가이드

안녕하세요! Foldering을 사용해 주셔서 감사합니다. 이 가이드는 앱을 처음 사용하시는 분들을 위한 간단한 안내입니다.

## 🚀 빠른 시작

### 1. 파일 탐색하기
- **\`↑/↓\`** 키로 파일 목록을 위아래로 이동할 수 있습니다
- **\`z\`** 또는 **\`Enter\`** 키로 파일을 선택하여 내용을 확인할 수 있습니다
- **\`x\`** 또는 **\`Esc\`** 키로 뒤로 갈 수 있습니다

### 2. 파일 편집하기
- 파일을 선택한 후 **\`i\`** 키를 누르면 편집 모드가 시작됩니다
- 내용을 수정한 후 **\`Ctrl+S\`** 키로 저장할 수 있습니다
- **\`Esc\`** 키로 편집을 취소할 수 있습니다
- **\`Tab\`** 키를 누르면 탭 문자가 삽입됩니다 (코딩 에디터처럼 동작)

### 3. 파일 검색하기
- **\`Ctrl+F\`** 또는 **\`/\`** 키를 누르면 검색 창이 열립니다
- 파일명을 입력하면 즉시 검색 결과가 표시됩니다
- **\`↑/↓\`** 키로 검색 결과를 이동하고 **\`Enter\`** 키로 선택할 수 있습니다

### 4. 파일 관리하기
- **\`n\`** 키로 새 파일이나 폴더를 만들 수 있습니다
- 파일이나 폴더를 **우클릭**하면 잘라내기, 복사, 붙여넣기, 삭제, 이름 바꾸기 메뉴가 나타납니다
- **\`e\`** 또는 **\`F2\`** 키로 파일이나 폴더 이름을 변경할 수 있습니다
- **\`Delete\`** 키로 파일이나 폴더를 삭제할 수 있습니다
- **\`Ctrl+Z\`** 키로 실수한 작업을 되돌릴 수 있습니다

## 🎹 자주 쓰는 단축키

### 파일 탐색
- **\`↑/↓\`**: 위/아래로 이동
- **\`z\`** 또는 **\`Enter\`**: 선택/확인
- **\`x\`** 또는 **\`Esc\`**: 뒤로가기
- **\`Ctrl+F\`** 또는 **\`/\`**: 파일 검색

### 파일 편집
- **\`i\`**: 편집 모드 시작
- **\`Ctrl+S\`**: 저장
- **\`Esc\`**: 편집 취소
- **\`Tab\`**: 탭 문자 삽입 (편집 모드에서)

### 파일 관리
- **\`n\`**: 새로 만들기
- **\`e\`** 또는 **\`F2\`**: 이름 변경
- **\`Delete\`**: 삭제
- **\`Ctrl+Z\`**: 되돌리기

### 화면 이동
- **\`←/→\`**: 이전/다음 파일 보기
- **\`b\`**: 파일 목록 창 열기/닫기
- **\`p\`**: 경로 선택
- **\`o\`**: 폴더 열기
- **\`F1\`**: 나만의 Memo 모드 토글

### 텍스트 편집기
- **\`Ctrl + +\`**: 글씨 크기 키우기
- **\`Ctrl + -\`**: 글씨 크기 줄이기

## 💡 유용한 팁

1. **마크다운 파일**: \`.md\` 파일은 자동으로 보기 좋게 표시됩니다
2. **다크 모드**: 상단 메뉴에서 테마를 변경할 수 있습니다
3. **도움말**: 메뉴바의 **Help > 도움말**에서 모든 단축키를 확인할 수 있습니다
4. **빈 공간 우클릭**: 파일 목록의 빈 공간을 우클릭하면 붙여넣기 메뉴가 나타납니다
5. **탭 문자**: 텍스트 편집 모드에서 \`Tab\` 키를 누르면 탭 문자가 삽입되고 포커스가 이동하지 않습니다
6. **빠른 이름 변경**: 파일을 선택한 상태에서 \`F2\` 키를 누르면 바로 이름 변경 모드로 진입합니다
7. **나만의 Memo 모드**: \`F1\` 키를 누르면 나만의 Memo 모드와 일반 모드를 빠르게 전환할 수 있습니다

## 📚 더 알아보기

더 자세한 정보는 README.md 파일을 참조하세요.

---

**Foldering v1.4.0.2** - 키보드 중심의 빠른 파일 탐색 및 텍스트 편집 앱
`;

    createFile(guidePath, guideContent);
    return guidePath;
  } catch (error) {
    console.error('Error creating guide file:', error);
    return null;
  }
}

export function createDirectory(dirPath: string): void {
  try {
    // 경로 정규화 (상대 경로, 중복된 경로 분리자 등 처리)
    const normalizedPath = path.normalize(dirPath);
    
    // 디렉토리 생성 시도 (recursive: true로 상위 디렉토리도 자동 생성)
    // existsSync 체크를 먼저 하지 않고 바로 mkdirSync를 호출하여 Race Condition 방지
    fs.mkdirSync(normalizedPath, { recursive: true });
    
    // 생성 후 디렉토리인지 확인
    const stats = fs.statSync(normalizedPath);
    if (!stats.isDirectory()) {
      throw new Error('같은 이름의 파일이 이미 존재합니다.');
    }
  } catch (error: any) {
    // EEXIST 에러는 이미 존재하는 경우이므로 디렉토리인지 확인 후 성공으로 처리
    if (error.code === 'EEXIST') {
      try {
        const stats = fs.statSync(path.normalize(dirPath));
        if (stats.isDirectory()) {
          return; // 이미 존재하는 디렉토리면 성공으로 처리
        }
        throw new Error('같은 이름의 파일이 이미 존재합니다.');
      } catch (statError: any) {
        // statSync 실패 시 원래 에러를 다시 throw
        console.error('Error checking directory existence:', statError);
        throw new Error('디렉토리 생성 중 오류가 발생했습니다.');
      }
    }
    
    // 권한 오류 처리
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw new Error('디렉토리 생성 권한이 없습니다.');
    }
    
    console.error('Error creating directory:', error);
    throw error;
  }
}

export function renameFile(oldPath: string, newName: string): void {
  try {
    if (!fs.existsSync(oldPath)) {
      throw new Error('파일 또는 폴더가 존재하지 않습니다.');
    }

    const dir = path.dirname(oldPath);
    const newPath = path.join(dir, newName);

    if (fs.existsSync(newPath)) {
      throw new Error('같은 이름의 파일 또는 폴더가 이미 존재합니다.');
    }

    fs.renameSync(oldPath, newPath);
  } catch (error) {
    console.error('Error renaming file:', error);
    throw error;
  }
}

export function deleteFile(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) {
      // 파일이 존재하지 않으면 조용히 성공 (이미 삭제된 것으로 간주)
      return;
    }

    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      throw new Error('디렉토리는 deleteDirectory를 사용하세요.');
    }

    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

export function deleteDirectory(dirPath: string): void {
  try {
    if (!fs.existsSync(dirPath)) {
      // 디렉토리가 존재하지 않으면 조용히 성공 (이미 삭제된 것으로 간주)
      return;
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new Error('파일은 deleteFile을 사용하세요.');
    }

    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error('Error deleting directory:', error);
    throw error;
  }
}

export function copyFile(sourcePath: string, destPath: string): void {
  try {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('원본 파일 또는 폴더가 존재하지 않습니다.');
    }

    const stats = fs.statSync(sourcePath);
    
    if (stats.isDirectory()) {
      // 디렉토리 복사
      if (fs.existsSync(destPath)) {
        throw new Error('대상 위치에 같은 이름의 파일 또는 폴더가 이미 존재합니다.');
      }
      fs.cpSync(sourcePath, destPath, { recursive: true });
    } else {
      // 파일 복사
      if (fs.existsSync(destPath)) {
        throw new Error('대상 위치에 같은 이름의 파일이 이미 존재합니다.');
      }
      fs.copyFileSync(sourcePath, destPath);
    }
  } catch (error) {
    console.error('Error copying file:', error);
    throw error;
  }
}

export function moveFile(sourcePath: string, destPath: string): void {
  try {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('원본 파일 또는 폴더가 존재하지 않습니다.');
    }

    if (fs.existsSync(destPath)) {
      throw new Error('대상 위치에 같은 이름의 파일 또는 폴더가 이미 존재합니다.');
    }

    fs.renameSync(sourcePath, destPath);
  } catch (error) {
    console.error('Error moving file:', error);
    throw error;
  }
}

export interface SearchResult extends FileSystemItem {
  relativePath: string; // 검색 기준 폴더로부터의 상대 경로
}

export function searchFiles(dirPath: string, query: string, recursive: boolean = false): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();
  
  if (!fs.existsSync(dirPath)) {
    return [];
  }

  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const item of items) {
      try {
        const fullPath = path.join(dirPath, item.name);
        let stats;
        
        try {
          stats = fs.statSync(fullPath);
        } catch (statError: any) {
          if (statError.code === 'EPERM' || statError.code === 'EACCES') {
            continue;
          }
          throw statError;
        }
        
        // 파일명에 검색어가 포함되어 있는지 확인
        const matches = item.name.toLowerCase().includes(queryLower);
        
        if (matches) {
          const relativePath = path.relative(dirPath, fullPath);
          results.push({
            name: item.name,
            path: fullPath,
            isDirectory: item.isDirectory(),
            size: item.isFile() ? stats.size : undefined,
            relativePath: relativePath,
          });
        }
        
        // 재귀 검색이 활성화되어 있고 디렉토리인 경우
        if (recursive && item.isDirectory()) {
          try {
            const subResults = searchFiles(fullPath, query, true);
            results.push(...subResults);
          } catch (error) {
            // 하위 디렉토리 검색 중 오류 발생 시 건너뛰기
            console.warn(`Error searching in ${fullPath}:`, error);
            continue;
          }
        }
      } catch (error: any) {
        console.warn(`Error processing item ${item.name}:`, error.message);
        continue;
      }
    }
  } catch (error) {
    console.error('Error searching files:', error);
    throw error;
  }
  
  // 정렬: 디렉토리 먼저, 그 다음 이름순
  results.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
  
  return results;
}

