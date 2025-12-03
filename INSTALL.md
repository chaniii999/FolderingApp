# 설치 가이드

## Windows에서 better-sqlite3 설치 문제 해결

`better-sqlite3`는 네이티브 모듈이므로 컴파일이 필요합니다. **Visual Studio Build Tools가 반드시 필요합니다.**

### ⚠️ 중요: Visual Studio Build Tools 설치 필수

Windows에서 `better-sqlite3`를 사용하려면 Visual Studio Build Tools가 필요합니다.

#### 단계별 설치 가이드

1. **Visual Studio Build Tools 다운로드**
   - [Visual Studio Build Tools 2022 다운로드](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - 또는 [Visual Studio Community 2022](https://visualstudio.microsoft.com/downloads/) (전체 IDE)

2. **설치 시 필수 워크로드 선택**
   - 설치 프로그램 실행
   - **"Desktop development with C++"** 워크로드를 반드시 선택
   - 다음 구성 요소도 포함되어야 합니다:
     - MSVC v143 - VS 2022 C++ x64/x86 build tools
     - Windows 10/11 SDK (최신 버전)

3. **설치 완료 후**
   - **모든 터미널을 완전히 종료**하고 새로 열기
   - PowerShell을 관리자 권한으로 실행하는 것을 권장

4. **프로젝트 설치**

```bash
# 기존 node_modules 정리 (선택사항)
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json

# 재설치
npm install

# Electron용 재빌드
npm run rebuild
```

### Visual Studio가 이미 설치된 경우

터미널에서 다음 명령어로 Visual Studio 경로를 확인:

```powershell
# Visual Studio 설치 경로 확인
Get-ChildItem "C:\Program Files\Microsoft Visual Studio" -Recurse -Filter "vcvarsall.bat" | Select-Object FullName
```

만약 Visual Studio가 설치되어 있지만 인식되지 않으면:

1. **Visual Studio 2025 Preview (버전 18) 사용 시**: 
   - 프로젝트 루트에 `.npmrc` 파일 생성 (이미 생성되어 있음)
   - 내용: `msvs_version=2022`
   - 이렇게 하면 node-gyp가 Visual Studio 2025를 2022로 인식합니다

2. Visual Studio Installer 실행
3. "Desktop development with C++" 워크로드가 설치되어 있는지 확인
4. 없다면 수정 버튼을 눌러 추가 설치

## 설치 후 확인

설치가 완료되면 다음 명령어로 개발 서버를 실행하세요:

```bash
npm run dev
```

## 문제 해결

### "Could not find Visual Studio installation" 오류

Visual Studio Build Tools가 설치되지 않았거나, PATH에 등록되지 않은 경우입니다.
- 방법 1을 따라 Visual Studio Build Tools를 설치하세요
- 또는 방법 2의 `electron-rebuild`를 사용하세요

### "prebuild-install" 경고

이는 정상입니다. prebuilt binary가 없으면 소스에서 빌드합니다.

### 여전히 문제가 발생하는 경우

#### 1. Visual Studio Build Tools 재설치

Visual Studio Installer에서:
- "Desktop development with C++" 워크로드 제거 후 재설치
- 또는 Visual Studio Community 전체 설치

#### 2. 환경 변수 확인

PowerShell에서 확인:

```powershell
# Visual Studio 경로 확인
$env:VCINSTALLDIR
$env:VCToolsInstallDir
```

#### 3. 수동 빌드 시도

```powershell
# Visual Studio Developer Command Prompt에서 실행
# 또는 다음 명령어로 환경 설정
& "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat"

# 그 후 npm install
npm install
npm run rebuild
```

#### 4. 완전 정리 후 재설치

```powershell
# 관리자 권한 PowerShell에서
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
npm run rebuild
```

#### 5. 대안: sql.js 사용 (성능 저하 있음)

Visual Studio Build Tools 설치가 어려운 경우, 순수 JavaScript SQLite 라이브러리인 `sql.js`를 사용할 수 있습니다. 
하지만 성능이 `better-sqlite3`보다 낮습니다.

### 설치 확인

설치가 성공했는지 확인:

```bash
node -e "require('better-sqlite3')"
```

오류가 없으면 성공입니다!

