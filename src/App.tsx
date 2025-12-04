import { useState, useEffect, useRef } from 'react';
import FileExplorer, { type FileExplorerRef } from './components/FileExplorer';
import FileContentViewer from './components/FileContentViewer';
import Resizer from './components/Resizer';
import NewFileDialog from './components/NewFileDialog';
import { BackIcon } from './components/icons/BackIcon';
import { ForwardIcon } from './components/icons/ForwardIcon';
import { getHotkeys } from './config/hotkeys';
import { loadTextEditorConfig, saveTextEditorConfig, type TextEditorConfig } from './services/textEditorConfigService';
import { loadSystemConfig, saveSystemConfig, type SystemConfig } from './services/systemConfigService';
import { undoService, type UndoAction } from './services/undoService';
import { isTextFile } from './utils/fileUtils';
import { applyTheme, type Theme } from './services/themeService';

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

  const initializeCurrentPath = async () => {
    try {
      if (!window.api || !window.api.filesystem) {
        console.warn('API가 로드되지 않았습니다.');
        return;
      }
      
      const path = await window.api.filesystem.getCurrentDirectory();
      setCurrentPath(path);
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
    
    window.addEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as EventListener);
    window.addEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as EventListener);
    window.addEventListener('menu:changeTheme', handleMenuChangeTheme as EventListener);
    
    return () => {
      window.removeEventListener('menu:toggleHideNonTextFiles', handleMenuToggleHideNonTextFiles as EventListener);
      window.removeEventListener('menu:toggleShowHelp', handleMenuToggleShowHelp as EventListener);
      window.removeEventListener('menu:changeTheme', handleMenuChangeTheme as EventListener);
    };
  }, []);

  // n 핫키 처리 (새로 만들기)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있으면 핫키 무시
      if (showNewFileDialog) {
        return;
      }
      
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        if (currentPath) {
          setShowNewFileDialog(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPath, showNewFileDialog]);

  // b 핫키 처리 (디렉토리 탭 토글)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있으면 핫키 무시
      if (showNewFileDialog) {
        return;
      }
      
      if ((e.key === 'b' || e.key === 'B') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        setIsExplorerVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewFileDialog]);


  const handleConfigChange = async (updates: Partial<TextEditorConfig>) => {
    const newConfig = { ...textEditorConfig, ...updates };
    setTextEditorConfig(newConfig);
    await saveTextEditorConfig(newConfig);
  };

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

  const handleUndo = async () => {
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
      alert(errorMessage);
      console.error('Error undoing action:', err);
    }
  };

  // Ctrl+Z 핫키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있으면 핫키 무시
      if (showNewFileDialog) {
        return;
      }
      
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewFileDialog]);

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
          setSelectedFilePath(filePath);
          setNewlyCreatedFilePath(filePath);
        }, 200); // 디렉토리 새로고침 후 파일 선택
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
    setSelectedFilePath(filePath);
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
    
    // 파일이 선택되어 있으면 파일 선택 해제
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

      const selectedPath = await window.api.filesystem.selectStartPath();
      if (selectedPath) {
        // 선택된 경로를 저장하고 현재 경로 업데이트
        await window.api.filesystem.saveStartPath(selectedPath);
        setCurrentPath(selectedPath);
        setSelectedFilePath(null);
        undoService.setCurrentPath(selectedPath);
        // FileExplorer 새로고침
        if (fileExplorerRef.current) {
          fileExplorerRef.current.refresh();
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

  // p 핫키 처리 (경로 선택)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있으면 핫키 무시
      if (showNewFileDialog) {
        return;
      }
      
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleSelectStartPath();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewFileDialog]);

  // o 핫키 처리 (현재 폴더 열기)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그가 열려있으면 핫키 무시
      if (showNewFileDialog) {
        return;
      }
      
      if ((e.key === 'o' || e.key === 'O') && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
        e.preventDefault();
        handleOpenCurrentFolder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewFileDialog, currentPath]);

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex flex-col gap-2 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleExplorer}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 cursor-pointer"
            title={`${isExplorerVisible ? '디렉토리 탭 닫기' : '디렉토리 탭 열기'} (${getHotkeys().toggleExplorer})`}
          >
            {isExplorerVisible ? <BackIcon /> : <ForwardIcon />}
          </button>
          <div className="flex items-center gap-2 flex-1">
            {currentPath && (
              <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                {currentPath}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectStartPath}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              title="시작 경로 선택"
            >
              SelectPath
            </button>
            <button
              onClick={() => setShowNewFileDialog(true)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              title="새 파일/폴더 만들기 (n)"
            >
              NewFile
            </button>
            <button
              onClick={handleOpenCurrentFolder}
              className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1"
              title="현재 폴더 열기 (o)"
            >
              <span>📂</span>
              <span>Open</span>
            </button>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">가로 여백:</label>
              <select
                value={textEditorConfig.horizontalPadding}
                onChange={(e) => handleConfigChange({ horizontalPadding: Number(e.target.value) })}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-gray-200"
              >
                <option value={40}>40px</option>
                <option value={60}>60px</option>
                <option value={80}>80px</option>
                <option value={100}>100px</option>
                <option value={120}>120px</option>
                <option value={140}>140px</option>
                <option value={160}>160px</option>
                <option value={180}>180px</option>
                <option value={200}>200px</option>
                <option value={240}>240px</option>
                <option value={280}>280px</option>
                <option value={320}>320px</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-300">폰트 크기:</label>
              <select
                value={textEditorConfig.fontSize}
                onChange={(e) => handleConfigChange({ fontSize: Number(e.target.value) })}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-gray-200"
              >
                <option value={10}>10px</option>
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
                <option value={20}>20px</option>
                <option value={22}>22px</option>
                <option value={24}>24px</option>
                <option value={26}>26px</option>
                <option value={28}>28px</option>
                <option value={30}>30px</option>
                <option value={32}>32px</option>
                <option value={36}>36px</option>
                <option value={40}>40px</option>
              </select>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {isExplorerVisible && (
          <>
            <div
              className="flex flex-col p-4 overflow-hidden border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              style={{ width: `${explorerWidth}px`, minWidth: `${explorerWidth}px` }}
            >
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
                  isDialogOpen={showNewFileDialog}
                  hideNonTextFiles={systemConfig.hideNonTextFiles}
                />
              </div>
            </div>
            <Resizer
              onResize={setExplorerWidth}
              minWidth={200}
              maxWidth={600}
            />
          </>
        )}
        <div className="flex-1 overflow-hidden">
          <FileContentViewer 
            filePath={selectedFilePath}
            onSelectPreviousFile={handleSelectPreviousFile}
            onSelectNextFile={handleSelectNextFile}
            onDeselectFile={() => {
              setSelectedFilePath(null);
              setNewlyCreatedFilePath(null);
              // 파일 선택 해제 후에는 포커스를 이동시키지 않음 (뒤로가기 버튼을 누를 때만 포커스 이동)
            }}
            textEditorConfig={textEditorConfig}
            autoEdit={newlyCreatedFilePath === selectedFilePath}
            onEditModeEntered={() => setNewlyCreatedFilePath(null)}
            onEditModeChange={(isEditing) => {
              // 편집 모드가 끝나도 포커스를 이동시키지 않음 (뒤로가기 버튼을 누를 때만 포커스 이동)
            }}
            onRenameRequest={(filePath) => {
              if (fileExplorerRef.current && !showNewFileDialog) {
                fileExplorerRef.current.startRenameForPath(filePath);
                setTimeout(() => {
                  fileExplorerRef.current?.focus();
                }, 100);
              }
            }}
            onFileDeleted={() => {
              // 파일 삭제 후 디렉토리 새로고침
              if (fileExplorerRef.current) {
                fileExplorerRef.current.refresh();
              }
            }}
            isDialogOpen={showNewFileDialog}
          />
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
                    <h4 className="font-semibold mb-0.5 text-xs dark:text-gray-200">파일 관리</h4>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700 dark:text-gray-300">새로 만들기</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">n</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700 dark:text-gray-300">경로 선택</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">{getHotkeys().selectPath}</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700 dark:text-gray-300">폴더 열기</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs font-mono dark:text-gray-200">o</kbd>
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
    </div>
  );
}

export default App;

