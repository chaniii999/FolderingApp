# 빌드 및 배포 가이드

## 사전 요구사항

1. Node.js (v18 이상 권장)
2. npm 또는 yarn
3. Windows: Visual Studio Build Tools (better-sqlite3 네이티브 모듈 빌드용)

## 빌드 방법

### 1. 개발 빌드 (테스트용)

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev
```

### 2. 프로덕션 빌드

```bash
# 전체 빌드 (Vite + Electron)
npm run build

# 설치 파일 생성 (Windows)
npm run build:app
```

빌드된 파일은 `release` 폴더에 생성됩니다.

## 빌드 출력

### Windows
- `release/Foldering App Setup x.x.x.exe`: 설치 파일
- `release/Foldering App x.x.x.exe`: 포터블 실행 파일 (선택적)

## 배포 체크리스트

- [ ] 버전 번호 확인 (`package.json`의 `version`)
- [ ] 아이콘 파일 확인 (`build/icon.ico`)
- [ ] 빌드 테스트 (로컬에서 설치 파일 실행)
- [ ] 기능 테스트 (모든 주요 기능 동작 확인)
- [ ] 바이러스 검사 (배포 전 필수)

## 배포 플랫폼

### 직접 배포
1. GitHub Releases
2. 직접 다운로드 링크 제공
3. 파일 공유 서비스

### 자동 업데이트 (선택사항)
- electron-updater를 사용하여 자동 업데이트 기능 추가 가능
- 서버에 업데이트 정보 제공 필요

## 문제 해결

### 빌드 실패 시

1. **네이티브 모듈 빌드 오류**
   ```bash
   npm run rebuild
   ```

2. **캐시 정리**
   ```bash
   npm run clean
   rm -rf node_modules dist dist-electron release
   npm install
   ```

3. **Electron 재빌드**
   ```bash
   npm run postinstall
   ```

## 빌드 최적화

현재 설정된 최적화 옵션:
- ✅ 코드 압축 (esbuild)
- ✅ 소스맵 제거 (프로덕션)
- ✅ ASAR 압축
- ✅ 최대 압축률
- ✅ 청크 분리 (React, Markdown)

## 빌드 크기

예상 빌드 크기:
- 설치 파일: 약 80-120MB (압축 후)
- 압축 해제 후: 약 200-300MB

