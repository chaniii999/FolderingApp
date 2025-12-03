# Cursor 설정 파일

이 폴더에는 Cursor IDE의 프로젝트별 설정이 포함되어 있습니다.

## 커밋 메시지 자동 생성 설정

`.cursor/settings.json` 파일에 커밋 메시지 자동 생성 프롬프트가 설정되어 있습니다.

### 사용 방법

1. Cursor에서 커밋 메시지를 자동 생성하려면:
   - Git 패널에서 변경사항을 스테이징한 후
   - 커밋 메시지 입력란에서 `Ctrl+Enter` (또는 Cursor의 커밋 메시지 생성 단축키)를 누르면
   - 자동으로 한글 커밋 메시지가 생성됩니다

2. 커밋 메시지 형식:
   - 타입: feat, fix, docs, style, refactor, test, chore
   - 제목: 50자 이내, 명령문
   - 본문: "무엇을", "왜" 변경했는지 설명
   - 꼬리말: 이슈 번호 참조 시에만 사용

### 설정 적용 확인

Cursor가 이 설정을 자동으로 인식하는지 확인하려면:
- Cursor 설정에서 "Generate Git Commit Message" 옵션을 확인하세요
- 또는 Cursor의 설정 파일 위치를 확인하세요

### 수동 설정 (필요한 경우)

만약 자동으로 적용되지 않는다면, Cursor의 사용자 설정에 다음을 추가하세요:

```json
{
  "cursor.generateGitCommitMessage": {
    "prompt": "...",
    "system": "..."
  }
}
```

설정 파일 위치:
- Windows: `%APPDATA%\Cursor\User\settings.json`
- macOS: `~/Library/Application Support/Cursor/User/settings.json`
- Linux: `~/.config/Cursor/User/settings.json`

