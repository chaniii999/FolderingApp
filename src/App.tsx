import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { type FileExplorerRef } from './components/FileExplorer';
import { type FileContentViewerRef } from './components/FileContentViewer';
import NewFileDialog from './components/NewFileDialog';
import SearchDialog from './components/SearchDialog';
import SaveConfirmDialog from './components/SaveConfirmDialog';
import ToastContainer from './components/ToastContainer';
import AppHeader from './components/layout/AppHeader';
import ExplorerPanel from './components/layout/ExplorerPanel';
import ContentViewerPanel from './components/layout/ContentViewerPanel';
import HelpPanel from './components/layout/HelpPanel';
import { toastService } from './services/toastService';
import type { Toast } from './components/Toast';
import { undoService } from './services/undoService';
import { type Theme } from './services/themeService';
import { useHotkeys, type HotkeyConfig } from './hooks/useHotkeys';
import { useTabs } from './hooks/useTabs';
import { useSettings } from './hooks/useSettings';

function App() {
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState<number>(240);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newlyCreatedFilePath, setNewlyCreatedFilePath] = useState<string | null>(null);
  const [isExplorerVisible, setIsExplorerVisible] = useState<boolean>(true);
  const fileExplorerRef = useRef<FileExplorerRef>(null);
  const fileContentViewerRef = useRef<FileContentViewerRef>(null);
  const [fileViewerState, setFileViewerState] = useState<{ isEditing: boolean; hasChanges: boolean }>({ isEditing: false, hasChanges: false });
  const [showFullPath, setShowFullPath] = useState<boolean>(false);
  const [showSearchDialog, setShowSearchDialog] = useState<boolean>(false);
  
  // 탭 관리
  const {
    tabs,
    activeTabId,
    pendingTabClose,
    updateTabState,
    addOrSwitchTab,
    handleTabClick,
    handleTabClose,
    handleSaveAndClose,
    handleDiscardAndClose,
    handleCancelClose,
  } = useTabs(
    setSelectedFilePath,
    setFileViewerState,
    fileContentViewerRef
  );
  
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

  useEffect(() => {
    initializeCurrentPath().then(() => {
      if (currentPath) {
        undoService.setCurrentPath(currentPath);
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
      await handleConfigChange({ horizontalPadding: e.detail });
    };
    
    const handleMenuChangeFontSize = async (e: CustomEvent<number>) => {
      await handleConfigChange({ fontSize: e.detail });
    };
    
    window.addEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as unknown as EventListener);
    window.addEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as unknown as EventListener);
    window.addEventListener('menu:changeTheme', handleMenuChangeTheme as unknown as EventListener);
    window.addEventListener('menu:selectPath', handleMenuSelectPath as unknown as EventListener);
    window.addEventListener('menu:openFolder', handleMenuOpenFolder as unknown as EventListener);
    window.addEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding as unknown as EventListener);
    window.addEventListener('menu:changeFontSize', handleMenuChangeFontSize as unknown as EventListener);
    
    return () => {
      window.removeEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as unknown as EventListener);
      window.removeEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as unknown as EventListener);
      window.removeEventListener('menu:changeTheme', handleMenuChangeTheme as unknown as EventListener);
      window.removeEventListener('menu:selectPath', handleMenuSelectPath as unknown as EventListener);
      window.removeEventListener('menu:openFolder', handleMenuOpenFolder as unknown as EventListener);
      window.removeEventListener('menu:changeHorizontalPadding', handleMenuChangeHorizontalPadding as unknown as EventListener);
      window.removeEventListener('menu:changeFontSize', handleMenuChangeFontSize as unknown as EventListener);
    };
  }, [handleSystemConfigChange, handleConfigChange]);

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
            error={error}
            selectedFilePath={selectedFilePath}
            isDialogOpen={showNewFileDialog || showSearchDialog}
            hideNonTextFiles={systemConfig.hideNonTextFiles}
            isEditing={fileViewerState.isEditing}
            onPathChange={handlePathChange}
            onFileSelect={handleFileSelect}
            onNewFileClick={() => setShowNewFileDialog(true)}
            onToggleFullPath={() => setShowFullPath(!showFullPath)}
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
          fileExplorerRef={fileExplorerRef}
          textEditorConfig={textEditorConfig}
          fileViewerState={fileViewerState}
          showNewFileDialog={showNewFileDialog}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onSelectPreviousFile={handleSelectPreviousFile}
          onSelectNextFile={handleSelectNextFile}
          onDeselectFile={() => {
            setSelectedFilePath(null);
            setNewlyCreatedFilePath(null);
            setFileViewerState({ isEditing: false, hasChanges: false });
          }}
          onEditStateChange={handleEditStateChange}
          onEditModeEntered={() => setNewlyCreatedFilePath(null)}
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
            if (fileExplorerRef.current) {
              fileExplorerRef.current.refresh();
            }
          }}
          onFocusExplorer={() => {
            if (fileExplorerRef.current) {
              fileExplorerRef.current.focus();
            }
          }}
        />
        {systemConfig.showHelp && <HelpPanel />}
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

