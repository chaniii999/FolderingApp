import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import type { FileSystemItem } from '../types/electron';
import { isHotkey } from '../config/hotkeys';
import { undoService } from '../services/undoService';
import { isTextFile } from '../utils/fileUtils';
import { toastService } from '../services/toastService';
import { usePerformanceMeasure } from '../utils/usePerformanceMeasure';
import ContextMenu from './ContextMenu';

interface FileExplorerProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string | null;
  onFileCreated?: (filePath: string, isDirectory: boolean) => void;
  isDialogOpen?: boolean;
  hideNonTextFiles?: boolean;
  isEditing?: boolean;
}

export interface FileExplorerRef {
  focus: () => void;
  refresh: () => void;
  startRenameForPath: (filePath: string) => void;
}

const FileExplorer = forwardRef<FileExplorerRef, FileExplorerProps>(
  ({ currentPath, onPathChange, onFileSelect, selectedFilePath, onFileCreated, isDialogOpen = false, hideNonTextFiles = false, isEditing = false }, ref) => {
  usePerformanceMeasure('FileExplorer');
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const itemsRef = useRef<FileSystemItem[]>([]); // useImperativeHandle에서 사용하기 위한 ref
  const [cursorIndex, setCursorIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasParentDirectory, setHasParentDirectory] = useState(false);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renamingName, setRenamingName] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState<{ item: FileSystemItem; index: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: FileSystemItem | null; index: number | null; isBlankSpace?: boolean } | null>(null);
  const [clipboard, setClipboard] = useState<{ path: string; isDirectory: boolean; isCut: boolean } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);

  const loadDirectory = useCallback(async (path: string) => {
    try {
      setLoading(true);
      
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return;
      }
      
      // 부모 디렉토리 존재 여부 확인
      const parentPath = await window.api.filesystem.getParentDirectory(path);
      const hasParent = parentPath !== null;
      setHasParentDirectory(hasParent);
      
      const directoryItems = await window.api.filesystem.listDirectory(path);
      
      // 텍스트 파일이 아닌 파일 필터링 (옵션이 켜져있을 때)
      const filteredItems = hideNonTextFiles
        ? directoryItems.filter(item => item.isDirectory || isTextFile(item.path))
        : directoryItems;
      
      setItems(filteredItems);
      itemsRef.current = filteredItems; // ref도 업데이트
      // ".." 항목이 있으면 -1로 초기화, 없으면 0으로 초기화
      setCursorIndex(hasParent ? -1 : 0);
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setLoading(false);
    }
  }, [hideNonTextFiles]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (listRef.current) {
        listRef.current.focus();
      }
    },
    refresh: () => {
      loadDirectory(currentPath);
    },
    startRenameForPath: (filePath: string) => {
      // itemsRef를 사용하여 dependency에서 items 제거
      const currentItems = itemsRef.current;
      const index = currentItems.findIndex(item => item.path === filePath);
      if (index !== -1) {
        setCursorIndex(index);
        setRenamingIndex(index);
        setRenamingName(currentItems[index].name);
      }
    },
  }), [loadDirectory, currentPath]);

  useEffect(() => {
    // 다이얼로그가 열려있지 않고 파일이 선택되어 있지 않을 때만 자동 포커스
    // 파일이 선택되어 있으면 포커스를 이동시키지 않음 (뒤로가기 버튼을 누를 때만 포커스 이동)
    if (!loading && listRef.current && !isDialogOpen && !selectedFilePath) {
      listRef.current.focus();
    }
  }, [loading, isDialogOpen, selectedFilePath]);

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    // ".." 항목은 별도 처리 (ref가 없음)
    if (cursorIndex === -1) {
      // ".." 항목으로 스크롤 (첫 번째 요소)
      const firstElement = listRef.current?.querySelector('[data-parent-item]');
      if (firstElement) {
        const container = scrollContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const elementRect = firstElement.getBoundingClientRect();
        
        // 요소가 보이지 않으면 즉시 스크롤
        if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
          firstElement.scrollIntoView({
            behavior: 'auto',
            block: 'nearest',
          });
        }
      }
      return;
    }
    
    // 일반 항목 스크롤
    const targetElement = itemRefs.current[cursorIndex];
    if (targetElement) {
      const container = scrollContainerRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();
      
      // 요소가 보이지 않으면 즉시 스크롤
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        targetElement.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    }
  }, [cursorIndex]);

  // selectedFilePath가 변경되면 해당 파일의 인덱스를 찾아 cursorIndex 업데이트
  useEffect(() => {
    if (selectedFilePath && items.length > 0) {
      const fileIndex = items.findIndex(item => item.path === selectedFilePath);
      if (fileIndex !== -1) {
        // cursorIndex는 items 배열의 실제 인덱스 사용 (0부터 시작)
        setCursorIndex(fileIndex);
      }
    }
  }, [selectedFilePath, items]);

  const handleBack = async () => {
    if (!window.api?.filesystem) {
      console.error('API가 로드되지 않았습니다.');
      return;
    }
    
    const parentPath = await window.api.filesystem.getParentDirectory(currentPath);
    if (parentPath) {
      onPathChange(parentPath);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (loading) return;
    
    // 다이얼로그가 열려있거나 텍스트 편집 중이거나 이름 변경 중이면 핫키 무시 (기본 탐색 키는 제외)
    if (isDialogOpen || isEditing || renamingIndex !== null) {
      // 이름 변경 중일 때는 Enter, Esc만 허용
      if (renamingIndex !== null) {
        if (e.key !== 'Enter' && e.key !== 'Escape' && e.key !== 'Esc') {
          return;
        }
      } else {
        // 다이얼로그가 열려있거나 편집 중일 때는 모든 핫키 무시
        return;
      }
    }
    
    // 파일이 선택되어 있으면 화살표 키는 FileContentViewer에서 처리하도록 함
    if (selectedFilePath && (isHotkey(e.key, 'moveUp') || isHotkey(e.key, 'moveDown') || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      return;
    }
    
    // 삭제 다이얼로그가 열려있으면 키 이벤트 무시
    if (showDeleteDialog) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (isHotkey(e.key, 'moveUp')) {
      e.preventDefault();
      // ".." 항목이 있으면 -1부터, 없으면 0부터 시작
      const minIndex = hasParentDirectory ? -1 : 0;
      setCursorIndex((prev) => (prev > minIndex ? prev - 1 : prev));
    } else if (isHotkey(e.key, 'moveDown')) {
      e.preventDefault();
      // 최대 인덱스: items.length - 1 (hasParentDirectory와 관계없이)
      const maxIndex = items.length - 1;
      setCursorIndex((prev) => {
        // ".." 항목이 있고 현재가 -1이면 0으로 이동
        if (hasParentDirectory && prev === -1) {
          return 0;
        }
        // 그 외에는 다음 인덱스로 이동
        return prev < maxIndex ? prev + 1 : prev;
      });
    } else if (isHotkey(e.key, 'enter') || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      if (renamingIndex !== null) {
        handleRenameConfirm();
      } else {
        handleEnter();
      }
    } else if (isHotkey(e.key, 'goBack')) {
      e.preventDefault();
      if (renamingIndex !== null) {
        handleRenameCancel();
      } else {
        handleBack();
      }
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      handleStartRename();
    } else if (e.key === 'Delete' || e.key === 'Del') {
      e.preventDefault();
      handleDelete();
    }
  };

  const handleEnter = async () => {
    // ".." 항목 처리 (cursorIndex가 -1이면 ".." 항목)
    if (hasParentDirectory && cursorIndex === -1) {
      handleBack();
      return;
    }
    
    // 다른 항목 처리
    if (items.length === 0 || cursorIndex < 0 || cursorIndex >= items.length) return;
    
    if (!window.api?.filesystem) {
      console.error('API가 로드되지 않았습니다.');
      return;
    }

    const selectedItem = items[cursorIndex];
    
    if (selectedItem.isDirectory) {
      const newPath = await window.api.filesystem.changeDirectory(currentPath, selectedItem.name);
      if (newPath) {
        onPathChange(newPath);
      }
    } else if (onFileSelect) {
      onFileSelect(selectedItem.path);
    }
  };

  const handleStartRename = () => {
    if (cursorIndex < 0 || cursorIndex >= items.length) return;
    const item = items[cursorIndex];
    setRenamingIndex(cursorIndex);
    setRenamingName(item.name);
  };

  const handleRenameConfirm = async () => {
    if (renamingIndex === null || !renamingName.trim()) {
      setRenamingIndex(null);
      setRenamingName('');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const item = items[renamingIndex];
      const oldName = item.name;
      const oldPath = item.path;
      await window.api.filesystem.renameFile(item.path, renamingName.trim());
      
      // 작업 히스토리에 추가
      undoService.addAction({
        type: 'rename',
        path: item.path.replace(oldName, renamingName.trim()),
        oldPath: oldPath,
        newName: renamingName.trim(),
        isDirectory: item.isDirectory,
      });
      
      loadDirectory(currentPath);
      setRenamingIndex(null);
      setRenamingName('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '이름 변경 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error renaming file:', err);
    }
  };

  const handleRenameCancel = () => {
    setRenamingIndex(null);
    setRenamingName('');
  };

  const handleDelete = () => {
    if (cursorIndex < 0 || cursorIndex >= items.length) return;
    const item = items[cursorIndex];
    setShowDeleteDialog({ item, index: cursorIndex });
    // 다이얼로그가 열릴 때 포커스를 다이얼로그로 이동
    setTimeout(() => {
      if (deleteDialogRef.current) {
        deleteDialogRef.current.focus();
      }
    }, 100);
  };

  useEffect(() => {
    // 삭제 다이얼로그가 열릴 때 포커스 설정
    if (showDeleteDialog && deleteDialogRef.current) {
      deleteDialogRef.current.focus();
    }
  }, [showDeleteDialog]);

  const handleDeleteConfirm = async () => {
    if (!showDeleteDialog) return;

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const { item } = showDeleteDialog;
      
      // 삭제 전에 파일 내용 읽기 (되돌리기용)
      let content = '';
      if (!item.isDirectory && window.api?.filesystem?.readFile) {
        try {
          const fileContent = await window.api.filesystem.readFile(item.path);
          content = fileContent || '';
        } catch (err) {
          console.error('Error reading file for undo:', err);
        }
      }
      
      // 작업 히스토리에 추가
      undoService.addAction({
        type: 'delete',
        path: item.path,
        isDirectory: item.isDirectory,
        content: content,
      });
      
      if (item.isDirectory) {
        await window.api.filesystem.deleteDirectory(item.path);
      } else {
        await window.api.filesystem.deleteFile(item.path);
      }

      setShowDeleteDialog(null);
      
      // 삭제된 파일이 선택된 파일이면 선택 해제
      if (onFileSelect && selectedFilePath === item.path) {
        onFileSelect('');
      }
      
      loadDirectory(currentPath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error deleting file:', err);
    }
  };

  useEffect(() => {
    if (renamingIndex !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingIndex]);

  const handleItemClick = async (item: FileSystemItem, index: number) => {
    if (renamingIndex !== null) return; // 이름 변경 중이면 클릭 무시
    setCursorIndex(index);
    
    if (!window.api?.filesystem) {
      console.error('API가 로드되지 않았습니다.');
      return;
    }
    
    if (item.isDirectory) {
      const newPath = await window.api.filesystem.changeDirectory(currentPath, item.name);
      if (newPath) {
        onPathChange(newPath);
      }
    } else if (onFileSelect) {
      onFileSelect(item.path);
    }
  };

  const handleItemRef = (index: number) => (el: HTMLDivElement | null) => {
    // ".." 항목은 -1 인덱스 사용
    if (index === -1) {
      // 별도 ref 배열에 저장하거나 무시
      return;
    }
    itemRefs.current[index] = el;
  };

  const handleItemClickWrapper = (item: FileSystemItem, index: number) => () => {
    handleItemClick(item, index);
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileSystemItem, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item, index, isBlankSpace: false });
  };

  const handleBlankSpaceContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: null, index: null, isBlankSpace: true });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleCut = async () => {
    if (!contextMenu || !contextMenu.item) return;

    const { item } = contextMenu;
    setClipboard({ path: item.path, isDirectory: item.isDirectory, isCut: true });
    setContextMenu(null);
  };

  const handleCopy = async () => {
    if (!contextMenu || !contextMenu.item) return;

    const { item } = contextMenu;
    // 파일만 복사 가능
    if (!item.isDirectory) {
      setClipboard({ path: item.path, isDirectory: false, isCut: false });
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    if (!clipboard || !window.api?.filesystem) return;

    try {
      const sourcePath = clipboard.path;
      // 경로에서 파일명 추출
      const separator = sourcePath.includes('\\') ? '\\' : '/';
      const sourceName = sourcePath.split(separator).pop() || '';
      // 대상 경로 생성
      const pathSeparator = currentPath.includes('\\') ? '\\' : '/';
      const destPath = `${currentPath}${pathSeparator}${sourceName}`;

      // 같은 위치에 붙여넣기 시도 시 에러 처리
      if (sourcePath === destPath) {
        toastService.warning('같은 위치에는 붙여넣을 수 없습니다.');
        return;
      }

      // 대상 위치에 같은 이름의 파일이 있는지 확인
      const items = await window.api.filesystem.listDirectory(currentPath);
      const exists = items.some(item => item.name === sourceName);
      
      if (exists) {
        toastService.warning('같은 이름의 파일 또는 폴더가 이미 존재합니다.');
        return;
      }

      if (clipboard.isCut) {
        // 잘라내기: 이동
        await window.api.filesystem.moveFile(sourcePath, destPath);
        
        // 작업 히스토리에 추가
        undoService.addAction({
          type: 'move',
          path: destPath,
          oldPath: sourcePath,
          isDirectory: clipboard.isDirectory,
        });

        // 잘라낸 파일이 선택된 파일이면 선택 해제
        if (onFileSelect && selectedFilePath === sourcePath) {
          onFileSelect('');
        }
      } else {
        // 복사: 파일만 복사 가능
        if (!clipboard.isDirectory) {
          await window.api.filesystem.copyFile(sourcePath, destPath);
          
          // 작업 히스토리에 추가
          undoService.addAction({
            type: 'copy',
            path: destPath,
            oldPath: sourcePath,
            isDirectory: false,
          });
        }
      }

      // 잘라내기인 경우 클립보드 비우기
      if (clipboard.isCut) {
        setClipboard(null);
      }

      loadDirectory(currentPath);
      toastService.success(clipboard.isCut ? '이동됨' : '복사됨');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '붙여넣기 중 오류가 발생했습니다.';
      toastService.error(errorMessage);
      console.error('Error pasting file:', err);
    }
  };

  const handleContextMenuDelete = () => {
    if (!contextMenu || !contextMenu.item || contextMenu.index === null) return;
    const { item, index } = contextMenu;
    setShowDeleteDialog({ item, index });
    setContextMenu(null);
    setTimeout(() => {
      if (deleteDialogRef.current) {
        deleteDialogRef.current.focus();
      }
    }, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const handleParentClick = () => {
    handleBack();
  };

  return (
    <div
      data-file-explorer
      className="flex flex-col h-full w-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={listRef}
    >
      <div 
        ref={scrollContainerRef}
        className="flex flex-col gap-1 overflow-y-auto flex-1"
        onContextMenu={handleBlankSpaceContextMenu}
      >
        {hasParentDirectory && (
          <div
            data-parent-item
            className={`flex items-center gap-2 px-2 py-1 cursor-pointer ${
              cursorIndex === -1
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            onClick={handleParentClick}
          >
            <div className="w-4 flex items-center justify-center">
              {cursorIndex === -1 && <span className="text-sm">▶</span>}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <span>📁</span>
              <span className="truncate">..</span>
            </div>
          </div>
        )}
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            폴더가 비어있습니다
          </div>
        ) : (
          items.map((item, index) => {
            // cursorIndex는 실제 items 배열의 인덱스를 사용 (0부터 시작)
            return (
              <div
                key={item.path}
                ref={handleItemRef(index)}
                className={`flex items-center gap-2 px-2 py-1 cursor-pointer ${
                  cursorIndex === index
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={handleItemClickWrapper(item, index)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  handleContextMenu(e, item, index);
                }}
              >
                <div className="w-4 flex items-center justify-center">
                  {cursorIndex === index && <span className="text-sm">▶</span>}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span>{item.isDirectory ? '📁' : '📄'}</span>
                  {renamingIndex === index ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renamingName}
                      onChange={(e) => setRenamingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleRenameConfirm();
                        } else if (e.key === 'Escape' || e.key === 'Esc') {
                          e.preventDefault();
                          handleRenameCancel();
                        }
                        e.stopPropagation();
                      }}
                      onBlur={handleRenameConfirm}
                      className="flex-1 px-1 border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate">{item.name}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleContextMenuClose}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDelete={handleContextMenuDelete}
          canCopy={contextMenu.item ? !contextMenu.item.isDirectory : false}
          canPaste={clipboard !== null}
          isBlankSpace={contextMenu.isBlankSpace || false}
        />
      )}
      {showDeleteDialog && (
        <div 
            className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
          onClick={(e) => {
            // 다이얼로그 외부 클릭 시 이벤트 차단
            e.stopPropagation();
          }}
        >
          <div 
            ref={deleteDialogRef}
            className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            onKeyDown={(e) => {
              // 다이얼로그 외부의 키 이벤트 차단
              e.stopPropagation();
              
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleDeleteConfirm();
              } else if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                setShowDeleteDialog(null);
              }
            }}
            tabIndex={0}
          >
            <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">삭제 확인</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {showDeleteDialog.item.name}을(를) 삭제하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteDialog(null)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                취소 (Esc)
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600"
              >
                삭제 (Enter)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';

export default FileExplorer;

