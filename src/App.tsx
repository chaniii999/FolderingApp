import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import FileExplorer, { type FileExplorerRef } from './components/FileExplorer';
import FileContentViewer, { type FileContentViewerRef } from './components/FileContentViewer';
import Resizer from './components/Resizer';
import NewFileDialog from './components/NewFileDialog';
import SearchDialog from './components/SearchDialog';
import TabBar from './components/TabBar';
import SaveConfirmDialog from './components/SaveConfirmDialog';
import ToastContainer from './components/ToastContainer';
import { toastService } from './services/toastService';
import type { Toast } from './components/Toast';
import { BackIcon } from './components/icons/BackIcon';
import { ForwardIcon } from './components/icons/ForwardIcon';
import { getHotkeys } from './config/hotkeys';
import { loadTextEditorConfig, saveTextEditorConfig, type TextEditorConfig } from './services/textEditorConfigService';
import { loadSystemConfig, saveSystemConfig, type SystemConfig } from './services/systemConfigService';
import { undoService, type UndoAction } from './services/undoService';
import { isTextFile } from './utils/fileUtils';
import { applyTheme, type Theme } from './services/themeService';
import type { Tab } from './types/tabs';
import { useHotkeys, type HotkeyConfig } from './hooks/useHotkeys';

function App() {
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState<number>(240);
  const [textEditorConfig, setTextEditorConfig] = useState<TextEditorConfig>({ horizontalPadding: 80, fontSize: 14 });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ hideNonTextFiles: false, theme: 'light', showHelp: false });
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newlyCreatedFilePath, setNewlyCreatedFilePath] = useState<string | null>(null);
  const [isExplorerVisible, setIsExplorerVisible] = useState<boolean>(true);
  const fileExplorerRef = useRef<FileExplorerRef>(null);
  const fileContentViewerRef = useRef<FileContentViewerRef>(null);
  const [fileViewerState, setFileViewerState] = useState<{ isEditing: boolean; hasChanges: boolean }>({ isEditing: false, hasChanges: false });
  const [showFullPath, setShowFullPath] = useState<boolean>(false);
  const [showSearchDialog, setShowSearchDialog] = useState<boolean>(false);
  
  // 탭 관리
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabStateRef = useRef<Map<string, { isEditing: boolean; hasChanges: boolean }>>(new Map());
  
  // 탭 닫기 확인 다이얼로그
  const [pendingTabClose, setPendingTabClose] = useState<{ tabId: string; fileName: string } | null>(null);
  
  // 토스트 관리
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  useEffect(() => {
    const unsubscribe = toastService.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  const initializeCurrentPath = async () => {
    try {
      if (!window.api || !window.api.filesystem) {
        console.warn('API가 로드되지 않았습니다.');
        return;
      }
      
      const path = await window.api.filesystem.getCurrentDirectory();
      setCurrentPath(path);
      
      // 가이드.md가 있으면 자동으로 선택 및 탭 추가
      try {
        const files = await window.api.filesystem.listDirectory(path);
        const guideFile = files.find(file => file.name === '가이드.md' && !file.isDirectory);
        if (guideFile) {
          // 약간의 지연 후 선택 및 탭 추가 (FileExplorer가 로드된 후)
          setTimeout(() => {
            addOrSwitchTab(guideFile.path);
          }, 500);
        }
      } catch (guideErr) {
        // 가이드.md 확인 실패해도 계속 진행
        console.log('Guide file check skipped:', guideErr);
      }
    } catch (err) {
      console.error('Error getting current directory:', err);
      try {
        if (window.api?.filesystem) {
          const homePath = await window.api.filesystem.getHomeDirectory();
          setCurrentPath(homePath);
        }
      } catch (homeErr) {
        console.error('Error getting home directory:', homeErr);
      }
    }
  };

  // FileContentViewer 상태 변경 핸들러
  const handleEditStateChange = useCallback((state: { isEditing: boolean; hasChanges: boolean }) => {
    setFileViewerState(state);
    // 활성 탭의 상태도 업데이트
    if (activeTabId) {
      tabStateRef.current.set(activeTabId, state);
      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTabId 
          ? { ...tab, isEditing: state.isEditing, hasChanges: state.hasChanges }
          : tab
      ));
    }
  }, [activeTabId]);
  
  // 탭 추가 또는 전환
  const addOrSwitchTab = useCallback((filePath: string) => {
    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    const tabId = filePath;
    
    setTabs(prevTabs => {
      // 이미 열려있는 탭인지 확인
      const existingTab = prevTabs.find(tab => tab.id === tabId);
      if (existingTab) {
        // 이미 열려있으면 해당 탭으로 전환
        setActiveTabId(tabId);
        setSelectedFilePath(filePath);
        // 저장된 상태 복원
        const savedState = tabStateRef.current.get(tabId);
        if (savedState) {
          setFileViewerState(savedState);
        }
        return prevTabs;
      }
      
      // 새 탭 추가
      const newTab: Tab = {
        id: tabId,
        filePath,
        fileName,
        isEditing: false,
        hasChanges: false,
      };
      
      setActiveTabId(tabId);
      setSelectedFilePath(filePath);
      tabStateRef.current.set(tabId, { isEditing: false, hasChanges: false });
      return [...prevTabs, newTab];
    });
  }, []);
  
  // 탭 전환
  const handleTabClick = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      setSelectedFilePath(tab.filePath);
      // 저장된 상태 복원
      const savedState = tabStateRef.current.get(tabId);
      if (savedState) {
        setFileViewerState(savedState);
      } else {
        setFileViewerState({ isEditing: false, hasChanges: false });
      }
    }
  }, [tabs]);
  
  // 실제 탭 닫기 로직
  const closeTabInternal = useCallback((tabId: string) => {
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    tabStateRef.current.delete(tabId);
    
    // 닫은 탭이 활성 탭이었으면 다른 탭으로 전환
    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // 닫은 탭의 이전 탭으로 전환 (없으면 다음 탭)
        const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
        setActiveTabId(newActiveTab.id);
        setSelectedFilePath(newActiveTab.filePath);
        const savedState = tabStateRef.current.get(newActiveTab.id);
        if (savedState) {
          setFileViewerState(savedState);
        } else {
          setFileViewerState({ isEditing: false, hasChanges: false });
        }
      } else {
        // 모든 탭이 닫혔으면
        setActiveTabId(null);
        setSelectedFilePath(null);
        setFileViewerState({ isEditing: false, hasChanges: false });
      }
    }
  }, [tabs, activeTabId]);
  
  // 탭 닫기
  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    
    // 편집 중이거나 변경사항이 있으면 확인 다이얼로그 표시
    const tabState = tabStateRef.current.get(tabId);
    if (tabState?.isEditing || tabState?.hasChanges) {
      setPendingTabClose({ tabId, fileName: tab.fileName });
      return;
    }
    
    // 변경사항이 없으면 바로 닫기
    closeTabInternal(tabId);
  }, [tabs, closeTabInternal]);
  
  // 저장 확인 다이얼로그에서 저장 선택
  const handleSaveAndClose = useCallback(async () => {
    if (!pendingTabClose) return;
    
    const { tabId } = pendingTabClose;
    const tab = tabs.find(t => t.id === tabId);
    
    // 해당 탭이 활성 탭이면 저장
    if (tab && activeTabId === tabId && fileContentViewerRef.current) {
      try {
        await fileContentViewerRef.current.handleSave();
        // 저장 후 탭 닫기
        closeTabInternal(tabId);
        setPendingTabClose(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일 저장 중 오류가 발생했습니다.';
        toastService.error(errorMessage);
        console.error('Error saving file:', err);
        // 저장 실패 시 다이얼로그는 유지
        return;
      }
    } else {
      // 활성 탭이 아니면 그냥 닫기 (이미 저장된 상태)
      closeTabInternal(tabId);
      setPendingTabClose(null);
    }
  }, [pendingTabClose, tabs, activeTabId, closeTabInternal]);
  
  // 저장 확인 다이얼로그에서 저장하지 않고 닫기 선택
  const handleDiscardAndClose = useCallback(() => {
    if (!pendingTabClose) return;
    
    const { tabId } = pendingTabClose;
    
    // 변경사항을 버리고 탭 닫기
    closeTabInternal(tabId);
    setPendingTabClose(null);
  }, [pendingTabClose, closeTabInternal]);
  
  // 저장 확인 다이얼로그 취소
  const handleCancelClose = useCallback(() => {
    setPendingTabClose(null);
  }, []);

  // 디렉토리 변경 시 선택된 파일 상태 검증
  useEffect(() => {
    if (selectedFilePath && currentPath && !selectedFilePath.startsWith(currentPath)) {
      // 선택된 파일이 현재 디렉토리에 없으면 선택 해제
      setSelectedFilePath(null);
      setFileViewerState({ isEditing: false, hasChanges: false });
    }
  }, [currentPath, selectedFilePath]);

  useEffect(() => {
    initializeCurrentPath().then(() => {
      if (currentPath) {
        undoService.setCurrentPath(currentPath);
      }
    });
    loadTextEditorConfig().then(setTextEditorConfig);
    loadSystemConfig().then(async (config) => {
      setSystemConfig(config);
      // 초기 테마 적용
      applyTheme(config.theme);
      // 초기 윈도우 테마 설정
      window.dispatchEvent(new CustomEvent('theme:change', { detail: config.theme }));
      // 초기 메뉴바 체크박스 상태 설정
      if (window.api?.menu) {
        try {
          await window.api.menu.updateCheckbox('hideNonTextFiles', config.hideNonTextFiles);
          await window.api.menu.updateCheckbox('showHelp', config.showHelp);
        } catch (err) {
          console.error('Error updating menu checkbox:', err);
        }
      }
    });
    
    // 메뉴바 이벤트 리스너
    const handleMenuToggleHideNonTextFiles = (e: CustomEvent<boolean>) => {
      handleSystemConfigChange({ hideNonTextFiles: e.detail });
    };
    
    const handleMenuToggleShowHelp = (e: CustomEvent<boolean>) => {
      handleSystemConfigChange({ showHelp: e.detail });
    };
    
    const handleMenuChangeTheme = (e: CustomEvent<Theme>) => {
      handleSystemConfigChange({ theme: e.detail });
    };
    
    const handleMenuSelectPath = () => {
      handleSelectStartPath();
    };
    
    const handleMenuOpenFolder = () => {
      handleOpenCurrentFolder();
    };
    
    const handleMenuChangeHorizontalPadding = async (e: CustomEvent<number>) => {
      const newConfig = { ...textEditorConfig, horizontalPadding: e.detail };
      setTextEditorConfig(newConfig);
      await saveTextEditorConfig(newConfig);
      // saveTextEditorConfig에서 메뉴 업데이트를 호출함
    };
    
    const handleMenuChangeFontSize = async (e: CustomEvent<number>) => {
      const newConfig = { ...textEditorConfig, fontSize: e.detail };
      setTextEditorConfig(newConfig);
      await saveTextEditorConfig(newConfig);
      // saveTextEditorConfig에서 메뉴 업데이트를 호출함
    };
    
    window.addEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as EventListener);
    window.addEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as EventListener);
    window.addEventListener('menu:changeTheme', handleMenuChangeTheme as EventListener);
    window.addEventListener('menu:selectPath', handleMenuSelectPath as EventListener);
    window.addEventListener('menu:openFolder', handleMenuOpenFolder as EventListener);
    window.addEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding as EventListener);
    window.addEventListener('menu:changeFontSize', handleMenuChangeFontSize as EventListener);
    
    return () => {
      window.removeEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as EventListener);
      window.removeEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as EventListener);
      window.removeEventListener('menu:changeTheme', handleMenuChangeTheme as EventListener);
      window.removeEventListener('menu:selectPath', handleMenuSelectPath as EventListener);
      window.removeEventListener('menu:openFolder', handleMenuOpenFolder as EventListener);
      window.removeEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding as EventListener);
      window.removeEventListener('menu:changeFontSize', handleMenuChangeFontSize as EventListener);
    };
  }, []);

  // 핫키가 작동하지 않아야 할 상황 체크
  const shouldBlockHotkey = useCallback(() => {
    return (
      showNewFileDialog || 
      showSearchDialog || 
      fileViewerState.isEditing ||
      pendingTabClose !== null
    );
  }, [showNewFileDialog, showSearchDialog, fileViewerState.isEditing, pendingTabClose]);
  
  // 입력 요소인지 확인 (textarea, input 등)
  const isInputElement = useCallback((target: EventTarget | null): boolean => {
    if (!target) return false;
    const element = target as HTMLElement;
    const tagName = element.tagName?.toLowerCase();
    const isContentEditable = element.isContentEditable;
    return (
      tagName === 'textarea' ||
      tagName === 'input' ||
      isContentEditable === true
    );
  }, []);

  const handleConfigChange = useCallback(async (updates: Partial<TextEditorConfig>) => {
    const newConfig = { ...textEditorConfig, ...updates };
    setTextEditorConfig(newConfig);
    await saveTextEditorConfig(newConfig);
    // saveTextEditorConfig에서 이미 메뉴 업데이트를 호출함
  }, [textEditorConfig]);

  const handleUndo = useCallback(async () => {
    const action = undoService.popLastAction();
    if (!action) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      switch (action.type) {
        case 'create':
          // 생성 작업을 되돌리려면 삭제
          if (action.isDirectory) {
            await window.api.filesystem.deleteDirectory(action.path);
          } else {
            await window.api.filesystem.deleteFile(action.path);
          }
          break;
        case 'delete':
          // 삭제 작업을 되돌리려면 다시 생성
          if (action.isDirectory) {
            await window.api.filesystem.createDirectory(action.path);
          } else {
            await window.api.filesystem.createFile(action.path, action.content || '');
          }
          break;
        case 'rename':
          // 이름 변경을 되돌리려면 원래 이름으로 다시 변경
          if (action.oldPath) {
            const oldName = action.oldPath.split(/[/\\]/).pop() || '';
            await window.api.filesystem.renameFile(action.path, oldName);
          }
          break;
      }

      // 디렉토리 새로고침
      if (fileExplorerRef.current) {
        fileExplorerRef.current.refresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '되돌리기 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error undoing action:', err);
    }
  }, []);

  // 핫키 설정 배열
  const hotkeys = useMemo<HotkeyConfig[]>(() => [
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
          handleTabClick(tabs[nextIndex].id);
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
          handleTabClick(tabs[prevIndex].id);
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
          handleTabClick(tabs[nextIndex].id);
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
  ], [currentPath, tabs, activeTabId, handleTabClick, handleUndo, textEditorConfig, handleConfigChange]);

  // 핫키 훅 사용
  useHotkeys(hotkeys, shouldBlockHotkey, isInputElement);

  const handleSystemConfigChange = async (updates: Partial<SystemConfig>) => {
    const newConfig = { ...systemConfig, ...updates };
    setSystemConfig(newConfig);
    await saveSystemConfig(newConfig);
    
    // 테마 적용
    if (updates.theme !== undefined) {
      applyTheme(updates.theme);
      // 메인 프로세스에 테마 변경 알림
      if (window.api?.filesystem) {
        // IPC를 통해 테마 변경 알림 (preload를 통해)
        window.dispatchEvent(new CustomEvent('theme:change', { detail: updates.theme }));
      }
    }
    
    // 메뉴바 체크박스 상태 업데이트
    if (window.api?.menu) {
      try {
        if (updates.hideNonTextFiles !== undefined) {
          await window.api.menu.updateCheckbox('hideNonTextFiles', updates.hideNonTextFiles);
        }
        if (updates.showHelp !== undefined) {
          await window.api.menu.updateCheckbox('showHelp', updates.showHelp);
        }
      } catch (err) {
        console.error('Error updating menu checkbox:', err);
      }
    }
    
    // "텍스트 파일만 표시" 옵션이 켜질 때, 현재 선택된 파일이 텍스트 파일이 아니면 선택 해제
    if (updates.hideNonTextFiles === true && selectedFilePath && !isTextFile(selectedFilePath)) {
      setSelectedFilePath(null);
      setNewlyCreatedFilePath(null);
    }
    
    // 설정 변경 시 FileExplorer 새로고침
    if (fileExplorerRef.current) {
      fileExplorerRef.current.refresh();
    }
  };

  const handlePathChange = (newPath: string) => {
    undoService.setCurrentPath(newPath);
    setCurrentPath(newPath);
    setSelectedFilePath(null);
  };


  const handleNewFileCreated = (filePath?: string) => {
    // 파일/폴더 생성 후 디렉토리 새로고침
    if (fileExplorerRef.current) {
      fileExplorerRef.current.refresh();
      
      // 작업 히스토리에 추가
      if (filePath) {
        undoService.addAction({
          type: 'create',
          path: filePath,
          isDirectory: false,
        });
        setTimeout(() => {
          addOrSwitchTab(filePath);
          setNewlyCreatedFilePath(filePath);
        }, 200); // 디렉토리 새로고침 후 파일 선택 및 탭 추가
      } else {
        // 폴더 생성은 FileExplorer에서 처리하므로 여기서는 포커스만 (다이얼로그가 닫힌 후)
        // 다이얼로그가 열려있지 않을 때만 포커스 이동
        if (!showNewFileDialog) {
          setTimeout(() => {
            fileExplorerRef.current?.focus();
          }, 100);
        }
      }
    }
  };

  const handleFileSelect = (filePath: string) => {
    // 빈 문자열이 전달되면 선택 해제
    if (!filePath || filePath === '') {
      setSelectedFilePath(null);
      setNewlyCreatedFilePath(null);
      return;
    }
    // 탭 추가 또는 전환
    addOrSwitchTab(filePath);
    // 파일 선택 후에는 포커스를 이동시키지 않음 (뒤로가기 버튼을 누를 때만 포커스 이동)
  };

  const getFileList = async (): Promise<string[]> => {
    if (!currentPath) return [];
    
    try {
      if (!window.api?.filesystem) {
        return [];
      }
      
      const items = await window.api.filesystem.listDirectory(currentPath);
      // 폴더 제외하고 파일만 반환
      return items.filter(item => !item.isDirectory).map(item => item.path);
    } catch (err) {
      console.error('Error getting file list:', err);
      return [];
    }
  };

  const handleSelectPreviousFile = async () => {
    const files = await getFileList();
    if (files.length === 0 || !selectedFilePath) return;
    
    const currentIndex = files.indexOf(selectedFilePath);
    if (currentIndex > 0) {
      setSelectedFilePath(files[currentIndex - 1]);
    }
  };

  const handleSelectNextFile = async () => {
    const files = await getFileList();
    if (files.length === 0 || !selectedFilePath) return;
    
    const currentIndex = files.indexOf(selectedFilePath);
    if (currentIndex < files.length - 1) {
      setSelectedFilePath(files[currentIndex + 1]);
    }
  };

  const handleBackClick = async () => {
    // 다이얼로그가 열려있으면 뒤로가기 무시
    if (showNewFileDialog) {
      return;
    }
    
    // 파일이 선택되어 있으면 파일 선택 해제 (탭은 유지)
    if (selectedFilePath) {
      setSelectedFilePath(null);
      if (!showNewFileDialog) {
        setTimeout(() => {
          fileExplorerRef.current?.focus();
        }, 100);
      }
      return;
    }
    
    if (!currentPath) return;
    
    try {
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return;
      }
      
      const parentPath = await window.api.filesystem.getParentDirectory(currentPath);
      if (parentPath) {
        setCurrentPath(parentPath);
        if (!showNewFileDialog) {
          setTimeout(() => {
            fileExplorerRef.current?.focus();
          }, 100);
        }
      }
    } catch (err) {
      console.error('Error going back:', err);
    }
  };

  const handleToggleExplorer = () => {
    setIsExplorerVisible(!isExplorerVisible);
  };

  const handleSelectStartPath = async () => {
    try {
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return;
      }

      // 이전 시작 경로 확인 (처음 설정인지 확인)
      const previousPath = await window.api.filesystem.getCurrentDirectory();
      const isFirstTime = !previousPath || previousPath === (await window.api.filesystem.getHomeDirectory());

      const selectedPath = await window.api.filesystem.selectStartPath();
      if (selectedPath) {
        // 선택된 경로를 저장하고 현재 경로 업데이트
        await window.api.filesystem.saveStartPath(selectedPath);
        setCurrentPath(selectedPath);
        setSelectedFilePath(null);
        undoService.setCurrentPath(selectedPath);
        
        // 처음 시작 위치 설정 시 가이드.md 생성 및 자동 선택 및 탭 추가
        if (isFirstTime) {
          try {
            const guidePath = await window.api.filesystem.createGuideFile(selectedPath);
            if (guidePath) {
              // FileExplorer 새로고침 후 가이드.md 자동 선택 및 탭 추가
              if (fileExplorerRef.current) {
                fileExplorerRef.current.refresh();
                // 새로고침 후 파일 목록이 로드된 후 가이드.md 선택 및 탭 추가
                setTimeout(() => {
                  addOrSwitchTab(guidePath);
                }, 300);
              }
            }
          } catch (guideErr) {
            console.error('Error creating guide file:', guideErr);
            // 가이드 파일 생성 실패해도 계속 진행
            if (fileExplorerRef.current) {
              fileExplorerRef.current.refresh();
            }
          }
        } else {
          // FileExplorer 새로고침
          if (fileExplorerRef.current) {
            fileExplorerRef.current.refresh();
          }
        }
      }
    } catch (err) {
      console.error('Error selecting start path:', err);
    }
  };

  const handleOpenCurrentFolder = async () => {
    try {
      if (!currentPath) return;
      
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return;
      }

      await window.api.filesystem.openFolder(currentPath);
    } catch (err) {
      console.error('Error opening folder:', err);
    }
  };


  // 선택된 파일 이름 추출
  const getSelectedFileName = (): string | null => {
    if (!selectedFilePath) return null;
    const fileName = selectedFilePath.split(/[/\\]/).pop() || null;
    return fileName;
  };

  // 현재 폴더 이름만 추출 (예: d:~~~/app -> app)
  const getCurrentFolderName = (): string => {
    if (!currentPath) return '';
    const parts = currentPath.split(/[/\\]/).filter(part => part.length > 0);
    return parts.length > 0 ? parts[parts.length - 1] : currentPath;
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex flex-col gap-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-4 px-6 py-2">
          <button
            onClick={handleToggleExplorer}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
            title={`${isExplorerVisible ? '디렉토리 탭 닫기' : '디렉토리 탭 열기'} (${getHotkeys().toggleExplorer})`}
          >
            {isExplorerVisible ? <BackIcon /> : <ForwardIcon />}
          </button>
          <div className="flex items-center gap-2 flex-1">
            {getSelectedFileName() && (
              <span className="text-lg text-gray-700 dark:text-gray-300 font-semibold">
                {getSelectedFileName()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedFilePath && !fileViewerState.isEditing && (
              <>
                <button
                  onClick={() => fileContentViewerRef.current?.handleEdit()}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title={`편집 (${getHotkeys().edit})`}
                >
                  Edit
                </button>
                <button
                  onClick={() => fileContentViewerRef.current?.handleDelete()}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="삭제"
                >
                  Del
                </button>
              </>
            )}
            {selectedFilePath && fileViewerState.isEditing && (
              <>
                {fileViewerState.hasChanges && (
                  <span className="text-xs text-orange-600 dark:text-orange-400">변경됨</span>
                )}
                <button
                  onClick={() => fileContentViewerRef.current?.handleSave()}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title={`저장 (${getHotkeys().save})`}
                >
                  저장
                </button>
                <button
                  onClick={() => fileContentViewerRef.current?.handleCancel()}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title={`취소 (${getHotkeys().cancel})`}
                >
                  취소
                </button>
                <button
                  onClick={() => fileContentViewerRef.current?.handleDelete()}
                  className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  title="삭제"
                >
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {isExplorerVisible && (
          <>
            <div
              className="flex flex-col overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              style={{ width: `${explorerWidth}px`, minWidth: `${explorerWidth}px` }}
            >
              <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-2">
                {currentPath && (
                  <span 
                    className="text-sm text-gray-500 dark:text-gray-400 font-mono cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 flex-1 min-w-0 truncate"
                    onClick={() => setShowFullPath(!showFullPath)}
                    title="클릭하여 전체 경로 표시/숨기기"
                  >
                    {showFullPath ? currentPath : getCurrentFolderName()}
                  </span>
                )}
                <button
                  onClick={() => setShowNewFileDialog(true)}
                  className="px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center justify-center flex-shrink-0"
                  title="새 파일/폴더 만들기 (n)"
                >
                  📁
                </button>
              </div>
              <div className="flex flex-col p-4 flex-1 overflow-hidden">
                {error && (
                  <div className="mb-4 px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
                    {error}
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <FileExplorer
                    ref={fileExplorerRef}
                    currentPath={currentPath}
                    onPathChange={handlePathChange}
                    onFileSelect={handleFileSelect}
                    selectedFilePath={selectedFilePath}
                    isDialogOpen={showNewFileDialog || showSearchDialog}
                    hideNonTextFiles={systemConfig.hideNonTextFiles}
                    isEditing={fileViewerState.isEditing}
                  />
                </div>
              </div>
            </div>
            <Resizer
              onResize={setExplorerWidth}
              minWidth={200}
              maxWidth={600}
            />
          </>
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
            />
          )}
          <div className="flex-1 overflow-hidden">
            <FileContentViewer 
            ref={fileContentViewerRef}
            filePath={selectedFilePath}
            onSelectPreviousFile={handleSelectPreviousFile}
            onSelectNextFile={handleSelectNextFile}
            onDeselectFile={() => {
              setSelectedFilePath(null);
              setNewlyCreatedFilePath(null);
              setFileViewerState({ isEditing: false, hasChanges: false });
            }}
            textEditorConfig={textEditorConfig}
            autoEdit={newlyCreatedFilePath === selectedFilePath}
            onEditModeEntered={() => setNewlyCreatedFilePath(null)}
            onEditModeChange={useCallback((_isEditing: boolean) => {
              // 상태는 onEditStateChange에서 추적
            }, [])}
            onEditStateChange={handleEditStateChange}
            onRenameRequest={(filePath) => {
              if (fileExplorerRef.current && !showNewFileDialog) {
                fileExplorerRef.current.startRenameForPath(filePath);
                setTimeout(() => {
                  fileExplorerRef.current?.focus();
                }, 100);
              }
            }}
            onFileDeleted={() => {
              setFileViewerState({ isEditing: false, hasChanges: false });
              // 파일 삭제 후 디렉토리 새로고침
              if (fileExplorerRef.current) {
                fileExplorerRef.current.refresh();
              }
            }}
            isDialogOpen={showNewFileDialog}
            onFocusExplorer={() => {
              if (fileExplorerRef.current) {
                fileExplorerRef.current.focus();
              }
            }}
          />
          </div>
        </div>
        {systemConfig.showHelp && (
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
        )}
      </main>
      {showNewFileDialog && (
        <NewFileDialog
          currentPath={currentPath}
          onClose={() => {
            setShowNewFileDialog(false);
            // 다이얼로그가 닫힐 때 FileExplorer에 포커스 복귀
            setTimeout(() => {
              fileExplorerRef.current?.focus();
            }, 100);
          }}
          onCreated={handleNewFileCreated}
        />
      )}
      {showSearchDialog && (
        <SearchDialog
          currentPath={currentPath}
          onClose={() => {
            setShowSearchDialog(false);
            // 다이얼로그가 닫힐 때 FileExplorer에 포커스 복귀
            setTimeout(() => {
              fileExplorerRef.current?.focus();
            }, 100);
          }}
          onFileSelect={handleFileSelect}
          onPathChange={handlePathChange}
        />
      )}
      {pendingTabClose && (
        <SaveConfirmDialog
          fileName={pendingTabClose.fileName}
          onSave={handleSaveAndClose}
          onDiscard={handleDiscardAndClose}
          onCancel={handleCancelClose}
        />
      )}
      <ToastContainer
        toasts={toasts}
        onClose={(id) => toastService.close(id)}
      />
    </div>
  );
}

export default App;

