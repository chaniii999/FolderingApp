import type { HotkeyConfig } from '../hooks/useHotkeys';
import type { TextEditorConfig } from '../services/textEditorConfigService';

import type { Tab } from '../types/tabs';

interface AppHotkeysDependencies {
  currentPath: string;
  tabs: Tab[];
  activeTabId: string | null;
  textEditorConfig: TextEditorConfig;
  setShowNewFileDialog: (show: boolean) => void;
  setIsExplorerVisible: (updater: (prev: boolean) => boolean) => void;
  setShowSearchDialog: (show: boolean) => void;
  handleUndo: () => Promise<void>;
  handleTabClick: (tabId: string) => void;
  handleConfigChange: (config: Partial<TextEditorConfig>) => Promise<void>;
  handleExportPdf?: () => Promise<void>;
}

/**
 * 앱의 핫키 설정을 생성하는 함수
 */
export function createAppHotkeys(deps: AppHotkeysDependencies): HotkeyConfig[] {
  const {
    currentPath,
    tabs,
    activeTabId,
    textEditorConfig,
    setShowNewFileDialog,
    setIsExplorerVisible,
    setShowSearchDialog,
    handleUndo,
    handleTabClick,
    handleConfigChange,
    handleExportPdf,
  } = deps;

  return [
    // n 핫키: 새로 만들기
    {
      key: 'n',
      handler: () => {
        if (currentPath) {
          setShowNewFileDialog(true);
        }
      },
    },
    // b 핫키: 디렉토리 탭 토글
    {
      key: 'b',
      handler: () => {
        setIsExplorerVisible((prev) => !prev);
      },
    },
    // Ctrl+Z: 되돌리기 (입력 요소에서는 기본 동작 허용)
    {
      key: 'z',
      ctrl: true,
      handler: () => {
        handleUndo();
      },
    },
    // Ctrl+F: 검색 다이얼로그 열기
    {
      key: 'f',
      ctrl: true,
      handler: () => {
        setShowSearchDialog(true);
      },
    },
    // Ctrl+P: PDF 내보내기
    {
      key: 'p',
      ctrl: true,
      handler: () => {
        if (handleExportPdf) {
          handleExportPdf();
        }
      },
    },
    // /: 검색 다이얼로그 열기
    {
      key: '/',
      handler: () => {
        setShowSearchDialog(true);
      },
    },
    // Ctrl+Tab: 다음 탭으로 전환
    {
      key: 'Tab',
      ctrl: true,
      handler: () => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          handleTabClick(tabs[nextIndex]?.id);
        }
      },
    },
    // Ctrl+PageUp: 이전 탭으로 전환
    {
      key: 'PageUp',
      ctrl: true,
      handler: () => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
          handleTabClick(tabs[prevIndex]?.id);
        }
      },
    },
    // Ctrl+PageDown: 다음 탭으로 전환
    {
      key: 'PageDown',
      ctrl: true,
      handler: () => {
        if (tabs.length > 1) {
          const currentIndex = tabs.findIndex(t => t.id === activeTabId);
          const nextIndex = (currentIndex + 1) % tabs.length;
          handleTabClick(tabs[nextIndex]?.id);
        }
      },
    },
    // Ctrl++: 글씨 크기 증가
    {
      key: '+',
      ctrl: true,
      handler: () => {
        const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
        const currentIndex = fontSizeOptions.indexOf(textEditorConfig.fontSize);
        if (currentIndex < fontSizeOptions.length - 1) {
          const newFontSize = fontSizeOptions[currentIndex + 1];
          handleConfigChange({ fontSize: newFontSize });
        }
      },
    },
    {
      key: '=',
      ctrl: true,
      handler: () => {
        const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
        const currentIndex = fontSizeOptions.indexOf(textEditorConfig.fontSize);
        if (currentIndex < fontSizeOptions.length - 1) {
          const newFontSize = fontSizeOptions[currentIndex + 1];
          handleConfigChange({ fontSize: newFontSize });
        }
      },
    },
    // Ctrl+-: 글씨 크기 감소
    {
      key: '-',
      ctrl: true,
      handler: () => {
        const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
        const currentIndex = fontSizeOptions.indexOf(textEditorConfig.fontSize);
        if (currentIndex > 0) {
          const newFontSize = fontSizeOptions[currentIndex - 1];
          handleConfigChange({ fontSize: newFontSize });
        }
      },
    },
    {
      key: '_',
      ctrl: true,
      handler: () => {
        const fontSizeOptions = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40];
        const currentIndex = fontSizeOptions.indexOf(textEditorConfig.fontSize);
        if (currentIndex > 0) {
          const newFontSize = fontSizeOptions[currentIndex - 1];
          handleConfigChange({ fontSize: newFontSize });
        }
      },
    },
  ];
}

