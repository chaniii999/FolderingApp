import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { type FileExplorerRef } from './components/FileExplorer';
import { type FileContentViewerRef } from './components/FileContentViewer';
import NewFileDialog from './components/NewFileDialog';
import SearchDialog from './components/SearchDialog';
import SaveConfirmDialog from './components/SaveConfirmDialog';
import ToastContainer from './components/ToastContainer';
import TemplateManageDialog from './components/MyMemo/TemplateManageDialog';
import AppHeader from './components/layout/AppHeader';
import ExplorerPanel from './components/layout/ExplorerPanel';
import ContentViewerPanel from './components/layout/ContentViewerPanel';
import HelpPanel from './components/layout/HelpPanel';
import { toastService } from './services/toastService';
import type { Toast } from './components/Toast';
import { undoService } from './services/undoService';
import { type Theme } from './services/themeService';
import { useHotkeys } from './hooks/useHotkeys';
import { createAppHotkeys } from './config/appHotkeys';
import { getFileName, getLastPathPart } from './utils/pathUtils';
import { handleError } from './utils/errorHandler';
import { useTabs } from './hooks/useTabs';
import { useSettings } from './hooks/useSettings';
import { usePerformanceMeasure } from './utils/usePerformanceMeasure';
import { performanceMonitor } from './utils/performanceMonitor';
import { isMyMemoMode } from './services/myMemoService';

function App() {
  usePerformanceMeasure('App');
  
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState<number>(240);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileDialogPath, setNewFileDialogPath] = useState<string>('');
  const [newlyCreatedFilePath, setNewlyCreatedFilePath] = useState<string | null>(null);
  const [isExplorerVisible, setIsExplorerVisible] = useState<boolean>(true);
  const fileExplorerRef = useRef<FileExplorerRef>(null);
  const fileContentViewerRef = useRef<FileContentViewerRef>(null);
  const [fileViewerState, setFileViewerState] = useState<{ isEditing: boolean; hasChanges: boolean }>({ isEditing: false, hasChanges: false });
  const [showFullPath, setShowFullPath] = useState<boolean>(false);
  const [showSearchDialog, setShowSearchDialog] = useState<boolean>(false);
  const [showTemplateManageDialog, setShowTemplateManageDialog] = useState<boolean>(false);
  const [isMyMemoModeActive, setIsMyMemoModeActive] = useState<boolean>(false);
  const previousPathRef = useRef<string>(''); // 나만의 메모 모드 진입 전 경로 저장
  const hasInitializedGuideRef = useRef<boolean>(false);
  
  // 탭 관리
  const {
    tabs,
    activeTabId,
    pendingTabClose,
    updateTabState,
    addOrSwitchTab,
    switchCurrentTab,
    handleTabClick,
    handleTabClose,
    handleSaveAndClose,
    handleDiscardAndClose,
    handleCancelClose,
    closeTabByFilePath,
  } = useTabs(
    setSelectedFilePath,
    setFileViewerState,
    fileContentViewerRef
  );
  
  // 최신 tabs 참조를 위한 ref
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  
  // 설정 관리
  const {
    textEditorConfig,
    systemConfig,
    handleConfigChange,
    handleSystemConfigChange,
  } = useSettings(
    fileExplorerRef,
    selectedFilePath,
    setSelectedFilePath
  );

  // 토스트 관리
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  useEffect(() => {
    const unsubscribe = toastService.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return unsubscribe;
  }, []);

  const initializeCurrentPath = useCallback(async () => {
    try {
      if (!window.api || !window.api.filesystem) {
        console.warn('API가 로드되지 않았습니다.');
        return;
      }
      
      const path = await window.api.filesystem.getCurrentDirectory();
      setCurrentPath(path);
      
      // 가이드.md가 있으면 자동으로 선택 및 탭 추가 (초기 마운트 시에만, 이미 열려있지 않은 경우만)
      if (!hasInitializedGuideRef.current) {
        try {
          const files = await window.api.filesystem.listDirectory(path);
          const guideFile = files.find(file => file.name === '가이드.md' && !file.isDirectory);
          if (guideFile) {
            // 약간의 지연 후 선택 및 탭 추가 (FileExplorer가 로드된 후)
            setTimeout(() => {
              // 최신 tabs 참조 사용
              const isAlreadyOpen = tabsRef.current.some(tab => tab.filePath === guideFile.path);
              if (!isAlreadyOpen) {
                addOrSwitchTab(guideFile.path);
              }
              hasInitializedGuideRef.current = true;
            }, 500);
          } else {
            hasInitializedGuideRef.current = true;
          }
        } catch (guideErr) {
          // 가이드.md 확인 실패해도 계속 진행
          console.log('Guide file check skipped:', guideErr);
          hasInitializedGuideRef.current = true;
        }
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
  }, [addOrSwitchTab]);

  // FileContentViewer 상태 변경 핸들러
  const handleEditStateChange = useCallback((state: { isEditing: boolean; hasChanges: boolean }) => {
    setFileViewerState(state);
    // 활성 탭의 상태도 업데이트
    updateTabState(activeTabId, state);
  }, [activeTabId, updateTabState]);

  // 디렉토리 변경 시 선택된 파일 상태 검증
  useEffect(() => {
    if (selectedFilePath && currentPath && !selectedFilePath.startsWith(currentPath)) {
      // 선택된 파일이 현재 디렉토리에 없으면 선택 해제
      setSelectedFilePath(null);
      setFileViewerState({ isEditing: false, hasChanges: false });
    }
  }, [currentPath, selectedFilePath]);

  // 초기 경로 설정 (마운트 시 한 번만 실행)
  useEffect(() => {
    initializeCurrentPath().then(() => {
      if (currentPath) {
        undoService.setCurrentPath(currentPath);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 초기 마운트 시에만 실행

  const handleSelectStartPath = useCallback(async () => {
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
                // 새로고침 후 파일 목록이 로드된 후 가이드.md 선택 및 탭 추가 (이미 열려있지 않은 경우만)
                setTimeout(() => {
                  const isAlreadyOpen = tabsRef.current.some(tab => tab.filePath === guidePath);
                  if (!isAlreadyOpen) {
                    addOrSwitchTab(guidePath);
                  }
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
  }, [addOrSwitchTab]);

  const handleOpenCurrentFolder = useCallback(async () => {
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
  }, [currentPath]);

  useEffect(() => {
    // 개발 모드에서 성능 리포트 출력 (5초 후)
    interface ImportMeta {
      env?: {
        DEV?: boolean;
      };
    }
    const importMeta = import.meta as ImportMeta;
    const isDev = importMeta.env?.DEV || process.env.NODE_ENV === 'development';
    if (isDev) {
      const timeoutId = setTimeout(() => {
        console.log('📊 초기 렌더링 성능 리포트:');
        performanceMonitor.printReport();
        console.log('\n💡 성능 리포트를 다시 보려면: window.showPerformanceReport()');
        console.log('💡 시작 경로를 삭제하려면: window.deleteStartPath()');
      }, 5000);

      // 개발자 도구에서 사용할 수 있는 유틸리티 함수 추가
      interface WindowWithDeleteStartPath extends Window {
        deleteStartPath?: () => Promise<void>;
      }
      const windowWithUtil = window as WindowWithDeleteStartPath;
      
      windowWithUtil.deleteStartPath = async (): Promise<void> => {
        try {
          if (!window.api) {
            console.error('❌ window.api가 없습니다. 앱을 재시작해주세요.');
            return;
          }
          if (!window.api.filesystem) {
            console.error('❌ window.api.filesystem이 없습니다. 앱을 재시작해주세요.');
            return;
          }
          // 타입 단언을 사용하여 직접 호출 시도
          const filesystem = window.api.filesystem as { deleteStartPath?: () => Promise<void> };
          if (filesystem.deleteStartPath) {
            await filesystem.deleteStartPath();
            console.log('✅ 시작 경로가 삭제되었습니다. 앱을 재시작하면 첫 실행처럼 동작합니다.');
          } else {
            console.error('❌ deleteStartPath가 없습니다. 앱을 재시작해주세요.');
            console.log('사용 가능한 filesystem 메서드:', Object.keys(filesystem));
            console.log('💡 앱을 재시작하면 새로운 API가 로드됩니다.');
          }
        } catch (error) {
          console.error('❌ 시작 경로 삭제 중 오류:', error);
        }
      };

      return () => {
        clearTimeout(timeoutId);
        delete windowWithUtil.deleteStartPath;
      };
    }
  }, []);

  // 메뉴바 이벤트 리스너 - useRef로 함수 참조 유지
  const handleSystemConfigChangeRef = useRef(handleSystemConfigChange);
  const handleConfigChangeRef = useRef(handleConfigChange);
  const handleSelectStartPathRef = useRef(handleSelectStartPath);
  const handleOpenCurrentFolderRef = useRef(handleOpenCurrentFolder);

  useEffect(() => {
    handleSystemConfigChangeRef.current = handleSystemConfigChange;
    handleConfigChangeRef.current = handleConfigChange;
    handleSelectStartPathRef.current = handleSelectStartPath;
    handleOpenCurrentFolderRef.current = handleOpenCurrentFolder;
  }, [handleSystemConfigChange, handleConfigChange, handleSelectStartPath, handleOpenCurrentFolder]);

  useEffect(() => {
    console.log('[App] Setting up menu event listeners...');
    
    // 메뉴바 이벤트 리스너 - ref를 통해 최신 함수 참조
    const handleMenuToggleHideNonTextFiles = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      console.log('[App] handleMenuToggleHideNonTextFiles called, detail:', customEvent.detail);
      handleSystemConfigChangeRef.current({ hideNonTextFiles: customEvent.detail });
    };
    
    const handleMenuToggleShowHelp = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      console.log('[App] handleMenuToggleShowHelp called, detail:', customEvent.detail);
      handleSystemConfigChangeRef.current({ showHelp: customEvent.detail });
    };
    
    const handleMenuChangeTheme = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      console.log('[App] handleMenuChangeTheme called, detail:', customEvent.detail);
      handleSystemConfigChangeRef.current({ theme: customEvent.detail });
    };
    
    const handleMenuSelectPath = () => {
      console.log('[App] handleMenuSelectPath called');
      handleSelectStartPathRef.current();
    };
    
    const handleMenuOpenFolder = () => {
      console.log('[App] handleMenuOpenFolder called');
      handleOpenCurrentFolderRef.current();
    };
    
    const handleMenuChangeHorizontalPadding = async (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      console.log('[App] handleMenuChangeHorizontalPadding called, detail:', customEvent.detail);
      await handleConfigChangeRef.current({ horizontalPadding: customEvent.detail });
    };
    
    const handleMenuChangeFontSize = async (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      console.log('[App] handleMenuChangeFontSize called, detail:', customEvent.detail);
      await handleConfigChangeRef.current({ fontSize: customEvent.detail });
    };
    
    console.log('[App] Registering menu event listeners');
    window.addEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles);
    window.addEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp);
    window.addEventListener('menu:changeTheme', handleMenuChangeTheme);
    window.addEventListener('menu:selectPath', handleMenuSelectPath);
    window.addEventListener('menu:openFolder', handleMenuOpenFolder);
    window.addEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding);
    window.addEventListener('menu:changeFontSize', handleMenuChangeFontSize);
    console.log('[App] Menu event listeners registered');
    
    return () => {
      console.log('[App] Removing menu event listeners');
      window.removeEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles);
      window.removeEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp);
      window.removeEventListener('menu:changeTheme', handleMenuChangeTheme);
      window.removeEventListener('menu:selectPath', handleMenuSelectPath);
      window.removeEventListener('menu:openFolder', handleMenuOpenFolder);
      window.removeEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding);
      window.removeEventListener('menu:changeFontSize', handleMenuChangeFontSize);
    };
  }, []); // 빈 dependency 배열 - 한 번만 등록

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
            const oldName = getFileName(action.oldPath);
            await window.api.filesystem.renameFile(action.path, oldName);
          }
          break;
      }

      // 디렉토리 새로고침
      if (fileExplorerRef.current) {
        fileExplorerRef.current.refresh();
      }
    } catch (err) {
      handleError(err, '되돌리기 중 오류가 발생했습니다.');
    }
  }, []);

  // PDF 내보내기 핸들러
  const handleExportPdf = useCallback(async (): Promise<void> => {
    fileContentViewerRef.current?.handleExportPdf();
  }, []);

  // 새 파일 버튼 클릭 핸들러
  const handleNewFileClick = useCallback(() => {
    // 우선순위: 드래그 중인 폴더 > 선택된 폴더 > currentPath
    const draggedFolderPath = fileExplorerRef.current?.getDraggedFolderPath();
    const selectedFolderPath = fileExplorerRef.current?.getSelectedFolderPath();
    const targetPath = draggedFolderPath || selectedFolderPath || currentPath;
    setNewFileDialogPath(targetPath);
    setShowNewFileDialog(true);
  }, [currentPath]);

  // 템플릿 관리 버튼 클릭 핸들러
  const handleTemplateManageClick = useCallback(() => {
    setShowTemplateManageDialog(true);
  }, []);

  // 템플릿 선택 핸들러 (템플릿 관리에서 편집 클릭 시)
  const handleTemplateSelect = useCallback((templatePath: string) => {
    // 파일 경로를 먼저 명시적으로 설정
    setSelectedFilePath(templatePath);
    // 탭 추가 또는 전환 (내부에서도 setSelectedFilePath 호출하지만 중복은 문제 없음)
    addOrSwitchTab(templatePath);
  }, [addOrSwitchTab]);

  // activeTabId 변경 시 selectedFilePath 동기화
  useEffect(() => {
    if (activeTabId) {
      const activeTab = tabs.find(tab => tab.id === activeTabId);
      if (activeTab && activeTab.filePath !== selectedFilePath) {
        setSelectedFilePath(activeTab.filePath);
      }
    } else if (activeTabId === null && selectedFilePath !== null) {
      // 활성 탭이 없으면 파일 선택 해제
      setSelectedFilePath(null);
    }
  }, [activeTabId, tabs]); // selectedFilePath를 dependency에서 제거하여 무한 루프 방지

  const handlePathChange = useCallback((newPath: string) => {
    undoService.setCurrentPath(newPath);
    setCurrentPath(newPath);
    setSelectedFilePath(null);
  }, []);

  // 나만의 memo 모드 상태 확인
  useEffect(() => {
    const checkMyMemoMode = async (): Promise<void> => {
      // API가 로드될 때까지 대기
      if (!window.api?.mymemo) {
        console.warn('[App] MyMemo API not available yet');
        setIsMyMemoModeActive(false);
        return;
      }
      
      if (currentPath) {
        try {
          const isMyMemo = await isMyMemoMode(currentPath);
          setIsMyMemoModeActive(isMyMemo);
          
          // Select Path 메뉴 활성화/비활성화
          if (window.api?.menu) {
            await window.api.menu.setEnabled('selectPath', !isMyMemo);
          }
        } catch (error) {
          console.error('[App] Error checking my memo mode:', error);
          setIsMyMemoModeActive(false);
        }
      } else {
        setIsMyMemoModeActive(false);
        if (window.api?.menu) {
          await window.api.menu.setEnabled('selectPath', true);
        }
      }
    };
    
    void checkMyMemoMode();
  }, [currentPath]);

  // 나만의 Memo 버튼 클릭 핸들러 (토글)
  const handleMyMemoClick = useCallback(async () => {
    try {
      if (!window.api?.mymemo) {
        toastService.error('MyMemo API가 로드되지 않았습니다.');
        return;
      }
      
      // 현재 나만의 메모 모드인지 확인
      const isCurrentlyMyMemo = await isMyMemoMode(currentPath);
      
      if (isCurrentlyMyMemo) {
        // 나만의 메모 모드 → 일반 모드로 전환
        const previousPath = previousPathRef.current || '';
        if (previousPath) {
          handlePathChange(previousPath);
        } else {
          // 이전 경로가 없으면 홈 경로로
          const homePath = await window.api.filesystem.getHomePath();
          handlePathChange(homePath);
        }
        previousPathRef.current = '';
      } else {
        // 일반 모드 → 나만의 메모 모드로 전환
        // 현재 경로를 저장
        if (currentPath) {
          previousPathRef.current = currentPath;
        }
        
        const myMemoPath = await window.api.mymemo.getPath();
        console.log('[App] Switching to MyMemo path:', myMemoPath);
        handlePathChange(myMemoPath);
      }
      
      // FileExplorer 새로고침 (약간의 지연 후)
      setTimeout(() => {
        if (fileExplorerRef.current) {
          fileExplorerRef.current.refresh();
        }
      }, 100);
    } catch (err) {
      console.error('Error toggling my memo:', err);
      toastService.error('나만의 Memo 전환에 실패했습니다.');
    }
  }, [currentPath, handlePathChange]);

  // 핫키 설정 배열
  const hotkeys = useMemo(() => createAppHotkeys({
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
    handleNewFileClick,
  }), [currentPath, tabs, activeTabId, textEditorConfig, handleTabClick, handleUndo, handleConfigChange, handleExportPdf, handleNewFileClick]);

  // 핫키 훅 사용
  useHotkeys(hotkeys, shouldBlockHotkey, isInputElement);

  const handleNewFileCreated = useCallback(async (filePath?: string) => {
    // 파일/폴더 생성 후 디렉토리 새로고침
    if (fileExplorerRef.current) {
      // 작업 히스토리에 추가
      if (filePath) {
        // 파일이 생성된 폴더의 부모 폴더만 새로고침 (확장 상태 유지)
        const separator = filePath.includes('\\') ? '\\' : '/';
        const parentFolderPath = filePath.substring(0, filePath.lastIndexOf(separator));
        
        // 부모 폴더가 있으면 해당 폴더만 새로고침, 없으면 전체 새로고침
        if (parentFolderPath && parentFolderPath !== currentPath) {
          await fileExplorerRef.current.refreshFolder(parentFolderPath);
        } else {
          // 루트 폴더이거나 부모 폴더가 현재 경로와 같으면 전체 새로고침
          fileExplorerRef.current.refresh();
        }
        
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
  }, [addOrSwitchTab, showNewFileDialog, currentPath]);

  const handleFileSelect = useCallback((filePath: string) => {
    // 빈 문자열이 전달되면 선택 해제
    if (!filePath || filePath === '') {
      setSelectedFilePath(null);
      setNewlyCreatedFilePath(null);
      return;
    }
    // 탭 추가 또는 전환
    addOrSwitchTab(filePath);
    // 파일 선택 후에는 포커스를 이동시키지 않음 (뒤로가기 버튼을 누를 때만 포커스 이동)
  }, [addOrSwitchTab]);

  const getFileList = useCallback(async (): Promise<string[]> => {
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
  }, [currentPath]);

  const handleSelectPreviousFile = useCallback(async () => {
    const files = await getFileList();
    if (files.length === 0 || !selectedFilePath) return;
    
    const currentIndex = files.indexOf(selectedFilePath);
    if (currentIndex > 0) {
      const previousFilePath = files[currentIndex - 1];
      // 현재 탭의 파일만 변경 (탭 추가하지 않음)
      switchCurrentTab(previousFilePath);
    }
  }, [getFileList, selectedFilePath, switchCurrentTab]);

  const handleSelectNextFile = useCallback(async () => {
    const files = await getFileList();
    if (files.length === 0 || !selectedFilePath) return;
    
    const currentIndex = files.indexOf(selectedFilePath);
    if (currentIndex < files.length - 1) {
      const nextFilePath = files[currentIndex + 1];
      // 현재 탭의 파일만 변경 (탭 추가하지 않음)
      switchCurrentTab(nextFilePath);
    }
  }, [getFileList, selectedFilePath, switchCurrentTab]);

  const handleToggleExplorer = useCallback(() => {
    setIsExplorerVisible(!isExplorerVisible);
  }, [isExplorerVisible]);

  // 선택된 파일 이름 추출
  const getSelectedFileName = useCallback((): string | null => {
    if (!selectedFilePath) return null;
    return getFileName(selectedFilePath);
  }, [selectedFilePath]);

  // 현재 폴더 이름만 추출 (예: d:~~~/app -> app)
  const getCurrentFolderName = useCallback((): string => {
    if (!currentPath) return '';
    return getLastPathPart(currentPath);
  }, [currentPath]);

  // 파일 삭제 핸들러
  const handleFileDeleted = useCallback((filePath: string) => {
    closeTabByFilePath(filePath);
    setSelectedFilePath(null);
    setFileViewerState({ isEditing: false, hasChanges: false });
    setTimeout(() => {
      if (fileExplorerRef.current) {
        fileExplorerRef.current.focus();
      }
    }, 100);
  }, [closeTabByFilePath]);

  // 전체 경로 토글 핸들러
  const handleToggleFullPath = useCallback(() => {
    setShowFullPath(!showFullPath);
  }, [showFullPath]);

  // 파일 선택 해제 핸들러
  const handleDeselectFile = useCallback(() => {
    setSelectedFilePath(null);
    setNewlyCreatedFilePath(null);
    setFileViewerState({ isEditing: false, hasChanges: false });
  }, []);

  // 편집 모드 진입 핸들러
  const handleEditModeEntered = useCallback(() => {
    setNewlyCreatedFilePath(null);
  }, []);

  // 파일 이름 변경 요청 핸들러
  const handleRenameRequest = useCallback((filePath: string) => {
    if (fileExplorerRef.current && !showNewFileDialog) {
      fileExplorerRef.current.startRenameForPath(filePath);
      setTimeout(() => {
        fileExplorerRef.current?.focus();
      }, 100);
    }
  }, [showNewFileDialog]);

  // 콘텐츠 뷰어에서 파일 삭제 핸들러
  const handleContentViewerFileDeleted = useCallback(() => {
    setFileViewerState({ isEditing: false, hasChanges: false });
    if (fileExplorerRef.current) {
      fileExplorerRef.current.refresh();
    }
  }, []);

  // FileExplorer 포커스 핸들러
  const handleFocusExplorer = useCallback(() => {
    if (fileExplorerRef.current) {
      fileExplorerRef.current.focus();
    }
  }, []);

  // 새 파일 다이얼로그 닫기 핸들러
  const handleNewFileDialogClose = useCallback(() => {
    setShowNewFileDialog(false);
    // 다이얼로그가 닫힐 때 FileExplorer에 포커스 복귀
    setTimeout(() => {
      fileExplorerRef.current?.focus();
    }, 100);
  }, []);

  // 검색 다이얼로그 닫기 핸들러
  const handleSearchDialogClose = useCallback(() => {
    setShowSearchDialog(false);
    // 다이얼로그가 닫힐 때 FileExplorer에 포커스 복귀
    setTimeout(() => {
      fileExplorerRef.current?.focus();
    }, 100);
  }, []);

  // 토스트 닫기 핸들러
  const handleToastClose = useCallback((id: string) => {
    toastService.close(id);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen">
      <AppHeader
        isExplorerVisible={isExplorerVisible}
        onToggleExplorer={handleToggleExplorer}
        selectedFileName={getSelectedFileName()}
        selectedFilePath={selectedFilePath}
        fileViewerState={fileViewerState}
        fileContentViewerRef={fileContentViewerRef}
      />
      <main className="flex-1 flex overflow-hidden">
        {isExplorerVisible && (
          <ExplorerPanel
            fileExplorerRef={fileExplorerRef}
            currentPath={currentPath}
            explorerWidth={explorerWidth}
            showFullPath={showFullPath}
            error={null}
            selectedFilePath={selectedFilePath}
            isDialogOpen={showNewFileDialog || showSearchDialog}
            hideNonTextFiles={systemConfig.hideNonTextFiles}
            isEditing={fileViewerState.isEditing}
            isMyMemoModeActive={isMyMemoModeActive}
            onPathChange={handlePathChange}
            onFileSelect={handleFileSelect}
            onFileDeleted={handleFileDeleted}
            onNewFileClick={handleNewFileClick}
            onMyMemoClick={handleMyMemoClick}
            onTemplateManageClick={handleTemplateManageClick}
            onToggleFullPath={handleToggleFullPath}
            onResize={setExplorerWidth}
            getCurrentFolderName={getCurrentFolderName}
          />
        )}
        <ContentViewerPanel
          tabs={tabs}
          activeTabId={activeTabId}
          selectedFilePath={selectedFilePath}
          newlyCreatedFilePath={newlyCreatedFilePath}
          fileContentViewerRef={fileContentViewerRef}
          textEditorConfig={textEditorConfig}
          showNewFileDialog={showNewFileDialog}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onSelectPreviousFile={handleSelectPreviousFile}
          onSelectNextFile={handleSelectNextFile}
          onDeselectFile={handleDeselectFile}
          onEditStateChange={handleEditStateChange}
          onEditModeEntered={handleEditModeEntered}
          onRenameRequest={handleRenameRequest}
          onFileDeleted={handleContentViewerFileDeleted}
          onFocusExplorer={handleFocusExplorer}
        />
        {systemConfig.showHelp && <HelpPanel />}
      </main>
      {showNewFileDialog && (
        <NewFileDialog
          currentPath={newFileDialogPath}
          onClose={handleNewFileDialogClose}
          onCreated={handleNewFileCreated}
          onSelectTemplate={() => {
            setShowNewFileDialog(false);
            setShowTemplateManageDialog(true);
          }}
        />
      )}
      {showTemplateManageDialog && (
        <TemplateManageDialog
          onClose={() => setShowTemplateManageDialog(false)}
          onTemplateSelect={handleTemplateSelect}
        />
      )}
      {showSearchDialog && (
        <SearchDialog
          currentPath={currentPath}
          onClose={handleSearchDialogClose}
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
        onClose={handleToastClose}
      />
    </div>
  );
}

export default App;

