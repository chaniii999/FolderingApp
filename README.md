# 폴더링 앱

Electron + React + TypeScript + SQLite 기반의 로컬 전용 데스크톱 앱입니다.
폴더링과 텍스트 메모 기능을 제공합니다.

## 기술 스택

- **Electron**: 데스크톱 앱 프레임워크
- **React**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구 및 개발 서버
- **better-sqlite3**: SQLite 데이터베이스
- **electron-builder**: 설치 파일 빌드

## 프로젝트 구조

```
FolderingApp/
├── electron/              # Electron 메인 프로세스
│   ├── main.ts           # 메인 프로세스 진입점
│   ├── preload.ts        # Preload 스크립트
│   ├── services/         # 서비스 레이어 (DB 접근)
│   │   ├── database.ts   # DB 초기화 및 연결
│   │   ├── folderService.ts  # 폴더 CRUD 서비스
│   │   └── noteService.ts    # 노트 CRUD 서비스
│   └── handlers/         # IPC 핸들러
│       ├── folderHandlers.ts
│       └── noteHandlers.ts
├── src/                  # React 앱 (Renderer 프로세스)
│   ├── components/       # React 컴포넌트
│   │   └── FolderList.tsx
│   ├── types/            # TypeScript 타입 정의
│   │   └── electron.d.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── dist/                 # 빌드된 React 앱
├── dist-electron/        # 빌드된 Electron 파일
└── release/              # 빌드된 설치 파일
```

## 아키텍처

### 보안 구조
- **Renderer 프로세스**: React 앱만 실행, Node.js API 직접 접근 불가
- **Main 프로세스**: DB 접근 및 파일 시스템 작업 수행
- **Preload 스크립트**: `window.api` 객체를 통해 안전한 IPC 통신 인터페이스 제공

### 데이터베이스
- SQLite 데이터베이스는 `app.getPath('userData')/data/foldering.db`에 자동 생성됩니다
- UUID 기반 Primary Key 사용 (향후 클라우드 동기화 대비)
- 초기 스키마:
  - `folders`: id, name, created_at
  - `notes`: id, folder_id, title, content, created_at, updated_at

### IPC 통신
- Renderer는 `window.api` 객체를 통해 Main 프로세스와 통신
- 모든 DB 작업은 Main 프로세스의 서비스 레이어를 통해 수행

## 설치 및 실행

### 의존성 설치

**중요**: Windows에서 `better-sqlite3` 설치 시 Visual Studio Build Tools가 필요할 수 있습니다. 
자세한 내용은 [INSTALL.md](./INSTALL.md)를 참조하세요.

```bash
npm install
```

설치 후 자동으로 Electron용으로 재빌드됩니다. 문제가 발생하면:

```bash
npm run rebuild
```

### 개발 모드 실행
```bash
npm run dev
```
이 명령어는 Vite 개발 서버(포트 5173)와 Electron을 동시에 실행합니다.

### 빌드
```bash
# React 앱 및 Electron 빌드
npm run build

# Windows 설치 파일 생성
npm run build:app
```

빌드된 설치 파일은 `release` 폴더에 생성됩니다.

## API 사용법

### Renderer 프로세스에서 사용

```typescript
// 폴더 목록 가져오기
const folders = await window.api.folder.list();

// 폴더 생성
const folder = await window.api.folder.create('새 폴더');

// 폴더 수정
const updated = await window.api.folder.update(folderId, '수정된 이름');

// 폴더 삭제
await window.api.folder.delete(folderId);

// 노트 목록 가져오기
const notes = await window.api.note.list(folderId);

// 노트 생성
const note = await window.api.note.create(folderId, '제목', '내용');

// 노트 수정
const updated = await window.api.note.update(noteId, '새 제목', '새 내용');

// 노트 삭제
await window.api.note.delete(noteId);
```

## 향후 확장

이 프로젝트는 서버 동기화 기능을 쉽게 추가할 수 있도록 설계되었습니다:
- DB 접근이 서비스 레이어로 분리되어 있어, 네트워크 요청으로 쉽게 교체 가능
- UUID 기반 PK로 클라우드 동기화 시 충돌 방지 구조
- IPC 핸들러는 서비스 레이어를 호출하므로, 서비스 레이어만 수정하면 동기화 기능 추가 가능

## 라이선스

MIT

