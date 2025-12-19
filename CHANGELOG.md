# Changelog

모든 주요 변경사항은 이 파일에 기록됩니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
이 프로젝트는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

## [1.3.1] - 2025-01-XX

### 🔧 개선 (Improved)

#### 코드 리팩터링 및 구조 개선
- **FileContentViewer 컴포넌트 리팩터링**
  - 스크롤 가속도 로직을 `useScrollAcceleration` 커스텀 훅으로 분리
  - 마크다운 렌더링을 `MarkdownViewer` 컴포넌트로 분리
  - 파일 크기: 958줄 → 약 800줄 (약 16% 감소)
  - 코드 가독성 및 유지보수성 향상

- **App 컴포넌트 리팩터링**
  - 핫키 설정을 `src/config/appHotkeys.ts`로 분리
  - 파일 크기: 731줄 → 약 650줄 (약 11% 감소)
  - 핫키 관리 로직의 재사용성 향상

- **Electron 메인 프로세스 리팩터링**
  - 메뉴 템플릿 생성 로직을 `electron/menu/createMenuTemplate.ts`로 분리
  - 파일 크기: 397줄 → 약 250줄 (약 37% 감소)
  - 메뉴 설정 변경 시 유지보수 용이성 향상

#### 새로운 파일 구조
- `src/hooks/useScrollAcceleration.ts` - 스크롤 가속도 기능 제공
- `src/components/MarkdownViewer.tsx` - 마크다운 파일 렌더링 컴포넌트
- `src/config/appHotkeys.ts` - 앱 핫키 설정 관리
- `electron/menu/createMenuTemplate.ts` - 메뉴 템플릿 생성 함수
- `src/components/FileExplorer/TreeNode.tsx` - 트리 노드 컴포넌트 (작업 중)

### 📝 문서화 (Documentation)

- 리팩터링 검토 리포트 작성 (`docs/리팩터링-검토-리포트.md`)
- 코드 구조 개선 가이드 추가

### 🐛 버그 수정 (Fixed)

- 없음

### ✨ 새로운 기능 (Added)

- 없음

### ⚠️ 변경사항 (Changed)

- 없음

### 🗑️ 제거됨 (Removed)

- 없음

---

## [1.2.0] - 이전 버전

### 주요 기능
- 파일 탐색 및 편집 기능
- 마크다운 지원
- 텍스트 파일 편집
- 폴더 관리 기능

---

## 버전 형식

- **MAJOR**: 호환되지 않는 API 변경
- **MINOR**: 하위 호환성을 유지하면서 기능 추가
- **PATCH**: 하위 호환성을 유지하면서 버그 수정

