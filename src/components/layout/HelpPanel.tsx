import { getHotkeys } from '../../config/hotkeys';

interface HelpPanelProps {
  // 현재는 props가 없지만, 나중에 확장 가능성을 위해 유지
}

export default function HelpPanel(_props: HelpPanelProps) {
  return (
    <div className="flex flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900" style={{ width: '240px', minWidth: '240px' }}>
      <div className="px-2 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold dark:text-gray-200">사용 가능한 핫키</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2 bg-white dark:bg-gray-800">
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">파일 탐색</h4>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">위로 이동</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">↑</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">아래로 이동</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">↓</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">선택/확인</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().enter} / Enter</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">뒤로가기</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().goBack} / Esc</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">파일 검색</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">Ctrl+F / /</kbd>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">파일 편집</h4>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">편집 모드</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().edit}</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">저장</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().save}</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">취소</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().cancel}</kbd>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">텍스트 편집기 설정</h4>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">글씨 크기 증가</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">Ctrl + +</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">글씨 크기 감소</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">Ctrl + -</kbd>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">파일 관리</h4>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">새로 만들기</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">n</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">이름 변경</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">e</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">삭제</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">Delete</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">되돌리기</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">Ctrl+Z</kbd>
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">레이아웃</h4>
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">디렉토리 탭 토글</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">b</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">이전 파일</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">←</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">다음 파일</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">→</kbd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 dark:text-gray-300">텍스트 스크롤</span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">↑ / ↓</kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

