import { useState, useEffect, useRef } from 'react';
import FileExplorer, { type FileExplorerRef } from './components/FileExplorer';
import FileContentViewer from './components/FileContentViewer';
import Resizer from './components/Resizer';
import NewFileDialog from './components/NewFileDialog';
import { BackIcon } from './components/icons/BackIcon';
import { ForwardIcon } from './components/icons/ForwardIcon';
import { getHotkeys } from './config/hotkeys';
import { loadTextEditorConfig, saveTextEditorConfig, type TextEditorConfig } from './services/textEditorConfigService';
import { undoService, type UndoAction } from './services/undoService';

function App() {
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState<number>(240);
  const [textEditorConfig, setTextEditorConfig] = useState<TextEditorConfig>({ horizontalPadding: 80, fontSize: 14 });
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newlyCreatedFilePath, setNewlyCreatedFilePath] = useState<string | null>(null);
  const [isExplorerVisible, setIsExplorerVisible] = useState<boolean>(true);
  const [showHelp, setShowHelp] = useState<boolean>(false);
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
    setSelectedFilePath(filePath);
    // 파일 선택 후에도 FileExplorer에 포커스 유지 (편집 모드가 아니고 다이얼로그가 열려있지 않을 때)
    if (!showNewFileDialog) {
      setTimeout(() => {
        fileExplorerRef.current?.focus();
      }, 50);
    }
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

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex flex-col gap-2 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleExplorer}
            className="flex items-center justify-center w-8 h-8 rounded bg-gray-200 hover:bg-gray-300 cursor-pointer"
            title={`${isExplorerVisible ? '디렉토리 탭 닫기' : '디렉토리 탭 열기'} (${getHotkeys().toggleExplorer})`}
          >
            {isExplorerVisible ? <BackIcon /> : <ForwardIcon />}
          </button>
          <div className="flex items-center gap-2 flex-1">
            {currentPath && (
              <span className="text-sm text-gray-500 font-mono">
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
              경로 선택
            </button>
            <button
              onClick={() => setShowNewFileDialog(true)}
              className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600"
              title="새 파일/폴더 만들기 (n)"
            >
              새로 만들기
            </button>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">가로 여백:</label>
              <select
                value={textEditorConfig.horizontalPadding}
                onChange={(e) => handleConfigChange({ horizontalPadding: Number(e.target.value) })}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              >
                <option value={40}>40px</option>
                <option value={60}>60px</option>
                <option value={80}>80px</option>
                <option value={100}>100px</option>
                <option value={120}>120px</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">폰트 크기:</label>
              <select
                value={textEditorConfig.fontSize}
                onChange={(e) => handleConfigChange({ fontSize: Number(e.target.value) })}
                className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              >
                <option value={12}>12px</option>
                <option value={14}>14px</option>
                <option value={16}>16px</option>
                <option value={18}>18px</option>
                <option value={20}>20px</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showHelp}
                onChange={(e) => setShowHelp(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">도움말</span>
            </label>
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
        {isExplorerVisible && (
          <>
            <div
              className="flex flex-col p-4 overflow-hidden border-r border-gray-200"
              style={{ width: `${explorerWidth}px`, minWidth: `${explorerWidth}px` }}
            >
              {error && (
                <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded">
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
              if (!showNewFileDialog) {
                setTimeout(() => {
                  fileExplorerRef.current?.focus();
                }, 100);
              }
            }}
            textEditorConfig={textEditorConfig}
            autoEdit={newlyCreatedFilePath === selectedFilePath}
            onEditModeEntered={() => setNewlyCreatedFilePath(null)}
            onEditModeChange={(isEditing) => {
              // 편집 모드가 끝나면 FileExplorer에 포커스 복귀 (다이얼로그가 열려있지 않을 때만)
              if (!isEditing && fileExplorerRef.current && !showNewFileDialog) {
                setTimeout(() => {
                  fileExplorerRef.current?.focus();
                }, 100);
              }
            }}
            onRenameRequest={(filePath) => {
              if (fileExplorerRef.current && !showNewFileDialog) {
                fileExplorerRef.current.startRenameForPath(filePath);
                setTimeout(() => {
                  fileExplorerRef.current?.focus();
                }, 100);
              }
            }}
          />
        </div>
        {showHelp && (
          <div className="flex flex-col border-l border-gray-200 bg-gray-50" style={{ width: '240px', minWidth: '240px' }}>
              <div className="px-2 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold">사용 가능한 핫키</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <div className="space-y-2">
                  <div>
                    <h4 className="font-semibold mb-0.5 text-xs">파일 탐색</h4>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">위로 이동</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">↑</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">아래로 이동</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">↓</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">선택/확인</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">{getHotkeys().enter} / Enter</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">뒤로가기</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">{getHotkeys().goBack} / Esc</kbd>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5 text-xs">파일 편집</h4>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">편집 모드</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">{getHotkeys().edit}</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">저장</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">{getHotkeys().save}</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">취소</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">{getHotkeys().cancel}</kbd>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5 text-xs">파일 관리</h4>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">새로 만들기</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">n</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">이름 변경</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">e</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">삭제</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Delete</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">되돌리기</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Ctrl+Z</kbd>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-0.5 text-xs">레이아웃</h4>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">디렉토리 탭 토글</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">b</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">이전 파일</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">←</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">다음 파일</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">→</kbd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-gray-700">텍스트 스크롤</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">↑ / ↓</kbd>
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

