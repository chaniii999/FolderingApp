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
import { isMyMemoMode } from './services/myMemoService';

function App() {
  
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
  const [showTemplateListInNewFile, setShowTemplateListInNewFile] = useState<boolean>(false);
  const [isMyMemoModeActive, setIsMyMemoModeActive] = useState<boolean>(false);
  const [showMyMemoToggleConfirmDialog, setShowMyMemoToggleConfirmDialog] = useState<boolean>(false);
  const pendingMyMemoToggleRef = useRef<(() => void) | null>(null);
  const [templateInstanceFileName, setTemplateInstanceFileName] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: string; name: string } | null>(null);
  const previousPathRef = useRef<string>(''); // 나만의 메모 모드 진입 전 경로 저장
  const hasInitializedGuideRef = useRef<boolean>(false);
  
  // 모드별 상태 저장 (탭, 경로, 선택된 파일 모두 모드별로 저장)
  interface ModeState {
    tabs: Tab[];
    activeTabId: string | null;
    tabStates: Map<string, { isEditing: boolean; hasChanges: boolean }>;
    currentPath: string;
    selectedFilePath: string | null;
  }
  
  const normalModeStateRef = useRef<ModeState>({
    tabs: [],
    activeTabId: null,
    tabStates: new Map(),
    currentPath: '',
    selectedFilePath: null,
  });
  
  const myMemoModeStateRef = useRef<ModeState>({
    tabs: [],
    activeTabId: null,
    tabStates: new Map(),
    currentPath: '',
    selectedFilePath: null,
  });
  
  const isModeSwitchingRef = useRef<boolean>(false);
  
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
    getState,
    setState,
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

  // 모드별 상태 자동 저장 (탭, 경로, 선택된 파일 모두 저장)
  useEffect(() => {
    // 모드 전환 중에는 상태 저장하지 않음
    if (isModeSwitchingRef.current) {
      return;
    }
    
    if (isMyMemoModeActive) {
      // 나만의 메모 모드일 때 상태 저장
      const currentTabState = getState();
      myMemoModeStateRef.current = {
        tabs: currentTabState.tabs,
        activeTabId: currentTabState.activeTabId,
        tabStates: currentTabState.tabStates,
        currentPath: currentPath,
        selectedFilePath: selectedFilePath,
      };
    } else {
      // 일반 모드일 때 상태 저장
      const currentTabState = getState();
      normalModeStateRef.current = {
        tabs: currentTabState.tabs,
        activeTabId: currentTabState.activeTabId,
        tabStates: currentTabState.tabStates,
        currentPath: currentPath,
        selectedFilePath: selectedFilePath,
      };
    }
  }, [tabs, activeTabId, currentPath, selectedFilePath, isMyMemoModeActive, getState]);
  
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
            setTimeout(async () => {
              // 최신 tabs 참조 사용
              const isAlreadyOpen = tabsRef.current.some(tab => tab.filePath === guideFile.path);
              if (!isAlreadyOpen) {
                await addOrSwitchTab(guideFile.path);
              }
              hasInitializedGuideRef.current = true;
            }, 500);
          } else {
            hasInitializedGuideRef.current = true;
          }
        } catch (guideErr) {
          // 가이드.md 확인 실패해도 계속 진행
          hasInitializedGuideRef.current = true;
        }
      }
    } catch (err) {
      try {
        if (window.api?.filesystem) {
          const homePath = await window.api.filesystem.getHomeDirectory();
          setCurrentPath(homePath);
        }
      } catch (homeErr) {
        // 홈 디렉토리 가져오기 실패 시 무시
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
                setTimeout(async () => {
                  const isAlreadyOpen = tabsRef.current.some(tab => tab.filePath === guidePath);
                  if (!isAlreadyOpen) {
                    await addOrSwitchTab(guidePath);
                  }
                }, 300);
              }
            }
          } catch (guideErr) {
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
      // 시작 경로 선택 실패 시 무시
    }
  }, [addOrSwitchTab]);

  const handleOpenCurrentFolder = useCallback(async () => {
    try {
      if (!currentPath) return;
      
      if (!window.api?.filesystem) {
        return;
      }

      await window.api.filesystem.openFolder(currentPath);
    } catch (err) {
      // 폴더 열기 실패 시 무시
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
      // 개발자 도구에서 사용할 수 있는 유틸리티 함수 추가
      interface WindowWithDeleteStartPath extends Window {
        deleteStartPath?: () => Promise<void>;
      }
      const windowWithUtil = window as WindowWithDeleteStartPath;
      
      windowWithUtil.deleteStartPath = async (): Promise<void> => {
        try {
          if (!window.api) {
            return;
          }
          if (!window.api.filesystem) {
            return;
          }
          // 타입 단언을 사용하여 직접 호출 시도
          const filesystem = window.api.filesystem as { deleteStartPath?: () => Promise<void> };
          if (filesystem.deleteStartPath) {
            await filesystem.deleteStartPath();
          }
        } catch (error) {
          // 시작 경로 삭제 실패 시 무시
        }
      };

      return () => {
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
    // 메뉴바 이벤트 리스너 - ref를 통해 최신 함수 참조
    const handleMenuToggleHideNonTextFiles = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      handleSystemConfigChangeRef.current({ hideNonTextFiles: customEvent.detail });
    };
    
    const handleMenuToggleShowHelp = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      handleSystemConfigChangeRef.current({ showHelp: customEvent.detail });
    };
    
    const handleMenuChangeTheme = (e: Event) => {
      const customEvent = e as CustomEvent<Theme>;
      handleSystemConfigChangeRef.current({ theme: customEvent.detail });
    };
    
    const handleMenuSelectPath = () => {
      handleSelectStartPathRef.current();
    };
    
    const handleMenuOpenFolder = () => {
      handleOpenCurrentFolderRef.current();
    };
    
    const handleMenuChangeHorizontalPadding = async (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      await handleConfigChangeRef.current({ horizontalPadding: customEvent.detail });
    };
    
    const handleMenuChangeFontSize = async (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      await handleConfigChangeRef.current({ fontSize: customEvent.detail });
    };
    
    const handleMenuChangeTextAlign = async (e: Event) => {
      const customEvent = e as CustomEvent<'left' | 'center' | 'right'>;
      await handleConfigChangeRef.current({ textAlign: customEvent.detail });
    };
    
    window.addEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles);
    window.addEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp);
    window.addEventListener('menu:changeTheme', handleMenuChangeTheme);
    window.addEventListener('menu:selectPath', handleMenuSelectPath);
    window.addEventListener('menu:openFolder', handleMenuOpenFolder);
    window.addEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding);
    window.addEventListener('menu:changeFontSize', handleMenuChangeFontSize);
    window.addEventListener('menu:changeTextAlign', handleMenuChangeTextAlign);
    
    return () => {
      window.removeEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles);
      window.removeEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp);
      window.removeEventListener('menu:changeTheme', handleMenuChangeTheme);
      window.removeEventListener('menu:selectPath', handleMenuSelectPath);
      window.removeEventListener('menu:openFolder', handleMenuOpenFolder);
      window.removeEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding);
      window.removeEventListener('menu:changeFontSize', handleMenuChangeFontSize);
      window.removeEventListener('menu:changeTextAlign', handleMenuChangeTextAlign);
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

      // 디렉토리 새로고침 및 포커스 복원
      if (fileExplorerRef.current) {
        fileExplorerRef.current.refresh();
        setTimeout(() => {
          if (fileExplorerRef.current) {
            fileExplorerRef.current.focus();
          }
        }, 100);
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
  const handleTemplateSelect = useCallback(async (templatePath: string) => {
    // 파일 경로를 먼저 명시적으로 설정
    setSelectedFilePath(templatePath);
    // 탭 추가 또는 전환 (내부에서도 setSelectedFilePath 호출하지만 중복은 문제 없음)
    await addOrSwitchTab(templatePath);
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

  // 뷰어 모드일 때만 텍스트 정렬 메뉴 활성화
  useEffect(() => {
    const updateTextAlignMenu = async (): Promise<void> => {
      if (!window.api?.menu) return;
      
      // 뷰어 모드일 때만 활성화 (편집 모드가 아니고 파일이 선택되어 있을 때)
      const isViewerMode = !fileViewerState.isEditing && selectedFilePath !== null;
      
      const textAlignMenuIds = ['textalign-left', 'textalign-center', 'textalign-right'];
      for (const menuId of textAlignMenuIds) {
        await window.api.menu.setEnabled(menuId, isViewerMode);
      }
    };
    
    void updateTextAlignMenu();
  }, [fileViewerState.isEditing, selectedFilePath]);

  // 나만의 Memo 모드 전환 실행 함수
  const executeMyMemoToggle = useCallback(async () => {
    try {
      if (!window.api?.mymemo) {
        toastService.error('MyMemo API가 로드되지 않았습니다.');
        return;
      }
      
      // 모드 전환 시작
      isModeSwitchingRef.current = true;
      
      // 현재 나만의 메모 모드인지 확인
      const isCurrentlyMyMemo = await isMyMemoMode(currentPath);
      
      if (isCurrentlyMyMemo) {
        // 나만의 메모 모드 → 일반 모드로 전환
        // 현재 상태 저장 (나만의 메모 모드)
        const currentTabState = getState();
        myMemoModeStateRef.current = {
          tabs: currentTabState.tabs,
          activeTabId: currentTabState.activeTabId,
          tabStates: currentTabState.tabStates,
          currentPath: currentPath,
          selectedFilePath: selectedFilePath,
        };
        
        // 일반 모드 상태 복원
        const normalState = normalModeStateRef.current;
        setState({
          tabs: normalState.tabs,
          activeTabId: normalState.activeTabId,
          tabStates: normalState.tabStates,
        });
        
        if (normalState.currentPath) {
          handlePathChange(normalState.currentPath);
        } else {
          const previousPath = previousPathRef.current || '';
          if (previousPath) {
            handlePathChange(previousPath);
          } else {
            // 이전 경로가 없으면 홈 경로로
            const homePath = await window.api.filesystem.getHomePath();
            handlePathChange(homePath);
          }
        }
        
        // 선택된 파일 복원 (경로 변경 후)
        setTimeout(() => {
          if (normalState.selectedFilePath) {
            setSelectedFilePath(normalState.selectedFilePath);
          } else {
            setSelectedFilePath(null);
          }
          isModeSwitchingRef.current = false;
        }, 150);
        
        previousPathRef.current = '';
      } else {
        // 일반 모드 → 나만의 메모 모드로 전환
        // 현재 상태 저장 (일반 모드)
        const currentTabState = getState();
        normalModeStateRef.current = {
          tabs: currentTabState.tabs,
          activeTabId: currentTabState.activeTabId,
          tabStates: currentTabState.tabStates,
          currentPath: currentPath,
          selectedFilePath: selectedFilePath,
        };
        
        // 현재 경로를 저장
        if (currentPath) {
          previousPathRef.current = currentPath;
        }
        
        // 나만의 메모 모드 상태 복원
        const myMemoState = myMemoModeStateRef.current;
        setState({
          tabs: myMemoState.tabs,
          activeTabId: myMemoState.activeTabId,
          tabStates: myMemoState.tabStates,
        });
        
        const myMemoPath = await window.api.mymemo.getPath();
        handlePathChange(myMemoPath);
        
        // 선택된 파일 복원 (경로 변경 후)
        setTimeout(() => {
          if (myMemoState.selectedFilePath) {
            setSelectedFilePath(myMemoState.selectedFilePath);
          } else {
            setSelectedFilePath(null);
          }
          isModeSwitchingRef.current = false;
        }, 150);
      }
      
      // FileExplorer 새로고침 및 포커스 복원 (약간의 지연 후)
      setTimeout(() => {
        if (fileExplorerRef.current) {
          fileExplorerRef.current.refresh();
          // 새로고침 후 포커스 복원
          setTimeout(() => {
            if (fileExplorerRef.current) {
              fileExplorerRef.current.focus();
            }
          }, 100);
        }
      }, 100);
    } catch (err) {
      isModeSwitchingRef.current = false;
      toastService.error('나만의 Memo 전환에 실패했습니다.');
    }
  }, [currentPath, selectedFilePath, handlePathChange, getState, setState, setSelectedFilePath]);

  // 나만의 Memo 버튼 클릭 핸들러 (토글)
  const handleMyMemoClick = useCallback(async () => {
    // 저장되지 않은 변경사항이 있으면 경고 팝업 표시
    if (fileViewerState.hasChanges) {
      pendingMyMemoToggleRef.current = executeMyMemoToggle;
      setShowMyMemoToggleConfirmDialog(true);
      return;
    }
    
    // 변경사항이 없으면 바로 전환
    await executeMyMemoToggle();
  }, [fileViewerState.hasChanges, executeMyMemoToggle]);

  // 나만의 Memo 토글 확인 다이얼로그 핸들러
  const handleMyMemoToggleConfirm = useCallback(async () => {
    setShowMyMemoToggleConfirmDialog(false);
    if (pendingMyMemoToggleRef.current) {
      await pendingMyMemoToggleRef.current();
      pendingMyMemoToggleRef.current = null;
    }
  }, []);

  const handleMyMemoToggleCancel = useCallback(() => {
    setShowMyMemoToggleConfirmDialog(false);
    pendingMyMemoToggleRef.current = null;
  }, []);

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
    handleMyMemoClick,
  }), [currentPath, tabs, activeTabId, textEditorConfig, handleTabClick, handleUndo, handleConfigChange, handleExportPdf, handleNewFileClick, handleMyMemoClick]);

  // 핫키 훅 사용
  useHotkeys(hotkeys, shouldBlockHotkey, isInputElement);

  const handleNewFileCreated = useCallback(async (filePath?: string, isDirectory?: boolean) => {
    // 템플릿 인스턴스 생성 모드인 경우
    // filePath가 문자열이지만 실제 파일 경로가 아닌 경우 (템플릿 인스턴스 생성)
    // 또는 filePath가 없고 selectedTemplate이 있는 경우
    const isTemplateInstanceMode = selectedTemplate && (
      !filePath || 
      (typeof filePath === 'string' && filePath.trim() && !filePath.includes('\\') && !filePath.includes('/'))
    );
    
    if (isTemplateInstanceMode) {
      try {
        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        // filePath가 파일명인 경우 사용, 아니면 templateInstanceFileName 사용
        const instanceFileName = (filePath && typeof filePath === 'string' && filePath.trim()) 
          ? filePath.trim() 
          : (templateInstanceFileName || '템플릿 인스턴스');
        
        const { joinPath } = await import('./utils/pathUtils');
        const instanceFilePath = joinPath(newFileDialogPath, `${instanceFileName}.json`);

        // 템플릿 인스턴스 생성
        const instance: import('./types/myMemo').TemplateInstance = {
          id: `instance-${Date.now()}`,
          templateId: selectedTemplate.id,
          fileName: `${instanceFileName}.json`,
          filePath: instanceFilePath,
          data: {}, // 템플릿 파트 정보는 템플릿 파일에서 가져와야 함
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 템플릿 파일에서 파트 정보 가져오기
        if (window.api?.mymemo) {
          const { getTemplatesPath } = await import('./services/myMemoService');
          const templatesPath = await getTemplatesPath();
          const items = await window.api.filesystem.listDirectory(templatesPath);
          const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));

          for (const file of jsonFiles) {
            try {
              const content = await window.api.filesystem.readFile(file.path);
              if (content) {
                const template = JSON.parse(content) as import('./types/myMemo').CustomTemplate;
                if (template.id === selectedTemplate.id) {
                  // 템플릿 파트를 기본값으로 초기화 (파트 제목을 키로 사용)
                  instance.data = template.parts.reduce((acc, part) => {
                    acc[part.title] = part.default || '';
                    return acc;
                  }, {} as Record<string, string>);
                  break;
                }
              }
            } catch {
              // 무시
            }
          }
        }

        const instanceContent = JSON.stringify(instance, null, 2);
        await window.api.filesystem.createFile(instanceFilePath, instanceContent);

        toastService.success('템플릿 인스턴스가 생성되었습니다.');
        
        // 파일 경로 설정하여 일반 파일 생성 로직 실행
        filePath = instanceFilePath;
        
        // 선택된 템플릿 초기화
        setSelectedTemplate(null);
        setTemplateInstanceFileName('');
      } catch (err) {
        const errorMessage = handleError(err, '템플릿 인스턴스 생성 중 오류가 발생했습니다.');
        toastService.error(errorMessage);
        return;
      }
    }

    // 파일/폴더 생성 후 디렉토리 새로고침
    if (fileExplorerRef.current) {
      if (filePath) {
        // 파일/폴더가 생성된 폴더의 부모 폴더만 새로고침 (확장 상태 유지)
        const separator = filePath.includes('\\') ? '\\' : '/';
        const parentFolderPath = filePath.substring(0, filePath.lastIndexOf(separator));
        
        // 부모 폴더가 있으면 해당 폴더만 새로고침, 없으면 전체 새로고침
        if (parentFolderPath && parentFolderPath !== currentPath) {
          await fileExplorerRef.current.refreshFolder(parentFolderPath);
        } else {
          // 루트 폴더이거나 부모 폴더가 현재 경로와 같으면 전체 새로고침
          await fileExplorerRef.current.refreshFolder(currentPath);
        }
        
        undoService.addAction({
          type: 'create',
          path: filePath,
          isDirectory: isDirectory ?? false,
        });
        
        // 파일인 경우에만 탭 추가
        if (!isDirectory) {
          setTimeout(async () => {
            await addOrSwitchTab(filePath);
            setNewlyCreatedFilePath(filePath);
          }, 200); // 디렉토리 새로고침 후 파일 선택 및 탭 추가
        } else {
          // 폴더 생성 후 포커스 복원
          setTimeout(() => {
            if (fileExplorerRef.current) {
              fileExplorerRef.current.focus();
            }
          }, 200);
        }
      }
    }
  }, [addOrSwitchTab, showNewFileDialog, currentPath, selectedTemplate, templateInstanceFileName, newFileDialogPath]);

  // 템플릿 인스턴스 생성 핸들러
  const handleTemplateInstanceCreate = useCallback(async (template: import('./types/myMemo').CustomTemplate, fileName: string) => {
    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const { joinPath } = await import('./utils/pathUtils');
      const filePath = joinPath(newFileDialogPath, `${fileName}.json`);

      // 템플릿 인스턴스 생성
      const instance: import('./types/myMemo').TemplateInstance = {
        id: `instance-${Date.now()}`,
        templateId: template.id,
        fileName: `${fileName}.json`,
        filePath: filePath,
        data: template.parts.reduce((acc, part) => {
          acc[part.id] = part.default || '';
          return acc;
        }, {} as Record<string, string>),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const instanceContent = JSON.stringify(instance, null, 2);
      await window.api.filesystem.createFile(filePath, instanceContent);

      toastService.success('템플릿 인스턴스가 생성되었습니다.');
      await handleNewFileCreated(filePath);
    } catch (err) {
      const errorMessage = handleError(err, '템플릿 인스턴스 생성 중 오류가 발생했습니다.');
      toastService.error(errorMessage);
    }
  }, [newFileDialogPath, handleNewFileCreated]);

  const handleFileSelect = useCallback(async (filePath: string) => {
    // 빈 문자열이 전달되면 선택 해제
    if (!filePath || filePath === '') {
      setSelectedFilePath(null);
      setNewlyCreatedFilePath(null);
      return;
    }
    // 탭 추가 또는 전환
    await addOrSwitchTab(filePath);
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
      await switchCurrentTab(previousFilePath);
    }
  }, [getFileList, selectedFilePath, switchCurrentTab]);

  const handleSelectNextFile = useCallback(async () => {
    const files = await getFileList();
    if (files.length === 0 || !selectedFilePath) return;
    
    const currentIndex = files.indexOf(selectedFilePath);
    if (currentIndex < files.length - 1) {
      const nextFilePath = files[currentIndex + 1];
      // 현재 탭의 파일만 변경 (탭 추가하지 않음)
      await switchCurrentTab(nextFilePath);
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
    // 파일 선택 해제 후 FileExplorer에 포커스 복원
    setTimeout(() => {
      if (fileExplorerRef.current) {
        fileExplorerRef.current.focus();
      }
    }, 0);
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
  const handleContentViewerFileDeleted = useCallback((filePath: string) => {
    // 삭제된 파일의 탭 닫기
    closeTabByFilePath(filePath);
    setFileViewerState({ isEditing: false, hasChanges: false });
    if (fileExplorerRef.current) {
      fileExplorerRef.current.refresh();
    }
  }, [closeTabByFilePath, setFileViewerState]);

  // FileExplorer 포커스 핸들러
  const handleFocusExplorer = useCallback(() => {
    if (fileExplorerRef.current) {
      fileExplorerRef.current.focus();
    }
  }, []);

  // 새 파일 다이얼로그 닫기 핸들러
  const handleNewFileDialogClose = useCallback(() => {
    setShowNewFileDialog(false);
    setSelectedTemplate(null);
    setTemplateInstanceFileName('');
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
          onSelectTemplate={(template: import('./types/myMemo').CustomTemplate) => {
            setSelectedTemplate({ id: template.id, name: template.name });
            if (!templateInstanceFileName) {
              setTemplateInstanceFileName(template.name);
            }
            setShowTemplateListInNewFile(false);
          }}
          selectedTemplateName={selectedTemplate?.name || null}
          showTemplateList={showTemplateListInNewFile}
          onTemplateListClose={() => setShowTemplateListInNewFile(false)}
          onRequestTemplateList={() => {
            setShowTemplateListInNewFile(true);
          }}
        />
      )}
      {showTemplateManageDialog && (
        <TemplateManageDialog
          onClose={() => {
            setShowTemplateManageDialog(false);
            setTemplateInstanceFileName('');
            setSelectedTemplate(null);
          }}
          onTemplateSelect={handleTemplateSelect}
          onTemplateInstanceCreate={undefined}
          isInstanceMode={!!templateInstanceFileName}
          defaultFileName={templateInstanceFileName}
          onBackToNewFile={templateInstanceFileName ? (template: import('./types/myMemo').CustomTemplate) => {
            setSelectedTemplate({ id: template.id, name: template.name });
            setShowTemplateManageDialog(false);
            setShowNewFileDialog(true);
          } : undefined}
        />
      )}
      {showTemplateListInNewFile && showNewFileDialog && (
        <TemplateManageDialog
          onClose={() => {
            setShowTemplateListInNewFile(false);
          }}
          onTemplateSelect={handleTemplateSelect}
          onTemplateInstanceCreate={undefined}
          isInstanceMode={true}
          defaultFileName={templateInstanceFileName}
          onBackToNewFile={(template: import('./types/myMemo').CustomTemplate) => {
            setSelectedTemplate({ id: template.id, name: template.name });
            setShowTemplateListInNewFile(false);
          }}
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
      {showMyMemoToggleConfirmDialog && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleMyMemoToggleCancel();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
              e.preventDefault();
              handleMyMemoToggleCancel();
            }
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                handleMyMemoToggleCancel();
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleMyMemoToggleConfirm();
              }
            }}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-200">
              나만의 메모 모드 전환
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              저장되지 않은 변경사항이 있습니다. 모드를 전환하면 변경사항이 저장되지 않을 수 있습니다. 계속하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleMyMemoToggleCancel}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소 (Esc)
              </button>
              <button
                onClick={handleMyMemoToggleConfirm}
                className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
              >
                계속 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer
        toasts={toasts}
        onClose={handleToastClose}
      />
    </div>
  );
}

export default App;

