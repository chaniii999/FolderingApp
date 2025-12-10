# Foldering App v1.1.1

**키보드 중심의 빠른 파일 탐색 및 텍스트 편집 데스크톱 앱**

마우스 없이도 모든 작업을 키보드로 빠르게 수행할 수 있는 파일 관리 및 텍스트 편집 도구입니다. 개발자, 작가, 메모 작성자에게 최적화된 경험을 제공합니다.

## 🚀 빠른 시작

1. **경로 선택**: 메뉴바 `File > Select Path` 또는 `p` 키로 작업할 폴더 선택
2. **파일 탐색**: `↑/↓` 키로 파일 목록 탐색
3. **파일 열기**: `z` 또는 `Enter` 키로 파일 선택
4. **편집하기**: `i` 키를 눌러 편집 모드 진입
5. **저장하기**: `Ctrl+F5`로 저장
6. **검색하기**: `Ctrl+F` 또는 `/` 키로 파일 검색

## ✨ 주요 기능

### 📁 파일 탐색 및 관리
- **키보드 중심 탐색**: 마우스 없이도 모든 작업을 키보드로 수행 가능
- **디렉토리 탐색**: 폴더 구조를 직관적으로 탐색
- **파일 미리보기**: 텍스트 파일을 선택하면 즉시 내용 확인
- **경로 선택**: 시작 경로를 자유롭게 선택 가능
- **경로 토글**: 현재 위치 텍스트 클릭 시 전체 경로/폴더명 토글
- **파일 검색**: `Ctrl+F` 또는 `/` 키로 빠른 파일 검색
  - 현재 폴더만 검색 또는 하위 폴더까지 재귀 검색
  - 실시간 검색 결과 표시
  - 검색어 하이라이트

### ✏️ 텍스트 편집
- **빠른 편집 모드**: `i` 키로 즉시 편집 시작
- **마크다운 지원**: `.md` 파일을 마크다운으로 렌더링
- **가속 스크롤**: 위/아래 화살표 키로 텍스트 스크롤 (크롬 스타일 가속도)
- **커스터마이징**: 폰트 크기 및 가로 여백 조절 가능
- **글씨 크기 핫키**: `Ctrl + +` (증가), `Ctrl + -` (감소)

### 📋 파일 관리
- **컨텍스트 메뉴**: 파일/폴더 우클릭으로 빠른 작업
  - 잘라내기: 파일/폴더 잘라내기
  - 복사: 파일만 복사 (폴더는 복사 불가)
  - 붙여넣기: 복사/잘라내기된 파일 붙여넣기
  - 삭제: 파일/폴더 삭제
- **빈 공간 우클릭**: 파일 목록 영역 빈 공간 우클릭으로 붙여넣기
- **작업 되돌리기**: 파일/폴더 생성, 삭제, 이름 변경 작업 취소 가능 (`Ctrl+Z`)

### 🎹 풍부한 핫키 지원
- **파일 탐색**: `↑/↓` 이동, `z/Enter` 선택, `x/Esc` 뒤로가기
- **파일 편집**: `i` 편집 모드, `Ctrl+F5` 저장, `Esc` 취소
- **파일 관리**: `n` 새로 만들기, `e` 이름 변경, `Delete` 삭제, `Ctrl+Z` 되돌리기
- **파일 검색**: `Ctrl+F` 또는 `/` 검색 다이얼로그 열기
- **네비게이션**: `←/→` 이전/다음 파일, `b` 디렉토리 탭 토글, `p` 경로 선택, `o` 폴더 열기
- **텍스트 편집기**: `Ctrl + +` 글씨 크기 증가, `Ctrl + -` 글씨 크기 감소

### ⚙️ 편의 기능
- **메뉴바 통합**: File 메뉴 (Select Path, Open Folder), Font 메뉴 (가로 여백, 폰트 크기)
- **텍스트 파일 필터링**: 텍스트 파일만 표시하는 옵션
- **도움말 패널**: 사용 가능한 모든 핫키 확인 (`?` 키 또는 메뉴)
- **다크 테마**: 라이트/다크 테마 전환 지원
- **모달 키보드 격리**: 다이얼로그가 열려있을 때 외부 핫키 차단

## 📦 설치 및 실행

### 설치 파일 다운로드
최신 버전의 설치 파일을 다운로드하여 설치하세요.

### 개발자용 설치 (소스 코드에서 빌드)

**중요**: Windows에서 `better-sqlite3` 설치 시 Visual Studio Build Tools가 필요할 수 있습니다. 
자세한 내용은 [INSTALL.md](./INSTALL.md)를 참조하세요.

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 빌드
npm run build

# 설치 파일 생성
npm run build:app
```

## 📖 사용 가이드

### 기본 작업 흐름
1. 앱 실행 후 `p` 키로 작업할 폴더 선택
2. `↑/↓` 키로 파일 목록 탐색
3. `z` 또는 `Enter`로 파일 선택하여 내용 확인
4. `i` 키로 편집 모드 진입
5. `Ctrl+F5`로 저장

### 파일 검색
- `Ctrl+F` 또는 `/` 키로 검색 다이얼로그 열기
- 파일명 입력 (실시간 검색)
- "하위 폴더까지 검색" 체크박스로 재귀 검색 활성화
- `↑/↓`로 결과 이동, `Enter`로 선택

### 파일 복사 및 이동
1. 파일/폴더 우클릭 → **잘라내기** 또는 **복사** (파일만)
2. 대상 폴더로 이동
3. 빈 공간 우클릭 → **붙여넣기**

### 컨텍스트 메뉴
- 파일/폴더 우클릭: 잘라내기, 복사(파일만), 붙여넣기, 삭제
- 빈 공간 우클릭: 붙여넣기 (복사된 파일이 있을 때만)

## 🎯 주요 개선사항 (v1.1.1)

### 새로 추가된 기능
- 파일 검색 기능 (`Ctrl+F` 또는 `/`)
- 컨텍스트 메뉴 (잘라내기, 복사, 붙여넣기, 삭제)
- 파일 복사 및 이동 API

### 개선사항
- 스크롤 속도 개선 (키보드 이동 시 즉시 반응)
- 모달 키보드 이벤트 격리 (다이얼로그 내부에서만 작동)
- 빈 공간 클릭 처리 개선

자세한 변경사항은 [릴리즈 노트](./docs/note/RELEASE_NOTES_v1.1.1.md)를 참조하세요.

---

## 🔧 기술 정보

### 기술 스택
- **Electron 28.0.0**: 데스크톱 앱 프레임워크
- **React 18.2**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구 및 개발 서버
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **react-markdown**: 마크다운 렌더링
- **electron-builder**: 설치 파일 빌드

### 프로젝트 구조
```
FolderingApp/
├── electron/              # Electron 메인 프로세스
│   ├── main.ts           # 메인 프로세스 진입점
│   ├── preload.ts        # Preload 스크립트
│   ├── services/         # 서비스 레이어
│   │   ├── fileSystemService.ts  # 파일 시스템 작업
│   │   ├── startPathService.ts   # 시작 경로 관리
│   │   ├── devConfigService.ts   # 개발 설정
│   │   └── ...
│   └── handlers/         # IPC 핸들러
│       ├── folderHandlers.ts
│       ├── noteHandlers.ts
│       └── fileSystemHandlers.ts
├── src/                  # React 앱 (Renderer 프로세스)
│   ├── components/       # React 컴포넌트
│   │   ├── FileExplorer.tsx      # 파일 탐색기
│   │   ├── FileContentViewer.tsx # 파일 내용 뷰어
│   │   ├── SearchDialog.tsx      # 검색 다이얼로그
│   │   ├── ContextMenu.tsx       # 컨텍스트 메뉴
│   │   ├── NewFileDialog.tsx    # 새 파일/폴더 다이얼로그
│   │   └── ...
│   ├── services/         # 프론트엔드 서비스
│   │   ├── textEditorConfigService.ts
│   │   ├── systemConfigService.ts
│   │   └── ...
│   ├── types/            # TypeScript 타입 정의
│   │   └── electron.d.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── dist/                 # 빌드된 React 앱
├── dist-electron/        # 빌드된 Electron 파일
└── release/              # 빌드된 설치 파일
```

### 아키텍처

#### 보안 구조
- **Renderer 프로세스**: React 앱만 실행, Node.js API 직접 접근 불가
- **Main 프로세스**: 파일 시스템 작업 및 메뉴바 관리 수행
- **Preload 스크립트**: `window.api` 객체를 통해 안전한 IPC 통신 인터페이스 제공

#### IPC 통신
- Renderer는 `window.api` 객체를 통해 Main 프로세스와 통신
- 모든 파일 시스템 작업은 Main 프로세스의 서비스 레이어를 통해 수행
- 메뉴바 이벤트는 CustomEvent를 통해 전달

### API 사용법

#### Renderer 프로세스에서 사용

```typescript
// 파일 시스템 작업
const files = await window.api.filesystem.listDirectory(path);
const content = await window.api.filesystem.readFile(filePath);
await window.api.filesystem.writeFile(filePath, content);
await window.api.filesystem.deleteFile(filePath);
await window.api.filesystem.copyFile(sourcePath, destPath);
await window.api.filesystem.moveFile(sourcePath, destPath);

// 파일 검색
const results = await window.api.filesystem.searchFiles(dirPath, query, recursive);

// 경로 관리
const currentPath = await window.api.filesystem.getCurrentDirectory();
await window.api.filesystem.selectStartPath();

// 설정 관리
await window.api.menu.updateCheckbox('hideNonTextFiles', true);
await window.api.menu.updateFontMenu();
```

### 빌드 및 배포

자세한 빌드 및 배포 가이드는 [패키징 설정 문서](./docs/패키징-설정.md)를 참조하세요.

#### 빠른 빌드

```bash
# 전체 빌드 및 설치 파일 생성
npm run build:app

# Windows용만 빌드
npm run build:app:win

# 디렉토리 형태로 빌드 (설치 파일 없이)
npm run build:app:dir
```

빌드된 파일은 `release` 폴더에 생성됩니다.

## 📚 문서

- [설치 가이드](./INSTALL.md)
- [패키징 설정](./docs/패키징-설정.md)
- [릴리즈 노트 v1.1.1](./docs/note/RELEASE_NOTES_v1.1.1.md)
- [릴리즈 노트 v1.1.0](./docs/note/RELEASE_NOTES_v1.1.0.md)

## 라이선스

MIT
