import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { FileSystemItem } from '../types/electron';
import { isHotkey } from '../config/hotkeys';

interface FileExplorerProps {
  currentPath: string;
  onPathChange: (path: string) => void;
  onFileSelect?: (filePath: string) => void;
  selectedFilePath?: string | null;
}

export interface FileExplorerRef {
  focus: () => void;
  refresh: () => void;
}

const FileExplorer = forwardRef<FileExplorerRef, FileExplorerProps>(
  ({ currentPath, onPathChange, onFileSelect, selectedFilePath }, ref) => {
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasParentDirectory, setHasParentDirectory] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const loadDirectory = async (path: string) => {
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
      setItems(directoryItems);
      // ".." 항목이 있으면 -1로 초기화, 없으면 0으로 초기화
      setCursorIndex(hasParent ? -1 : 0);
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (listRef.current) {
        listRef.current.focus();
      }
    },
    refresh: () => {
      loadDirectory(currentPath);
    },
  }));

  useEffect(() => {
    if (!loading && listRef.current) {
      listRef.current.focus();
    }
  }, [loading]);

  useEffect(() => {
    // ".." 항목은 별도 처리 (ref가 없음)
    if (cursorIndex === -1) {
      // ".." 항목으로 스크롤 (첫 번째 요소)
      const firstElement = listRef.current?.querySelector('[data-parent-item]');
      if (firstElement) {
        firstElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
      return;
    }
    
    // 일반 항목 스크롤
    if (itemRefs.current[cursorIndex]) {
      itemRefs.current[cursorIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
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
      handleEnter();
    } else if (isHotkey(e.key, 'goBack')) {
      e.preventDefault();
      handleBack();
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

  const handleItemClick = async (item: FileSystemItem, index: number) => {
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
      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {hasParentDirectory && (
          <div
            data-parent-item
            className={`flex items-center gap-2 px-2 py-1 cursor-pointer ${
              cursorIndex === -1
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100'
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
          <div className="flex items-center justify-center h-full text-gray-500">
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
                    : 'hover:bg-gray-100'
                }`}
                onClick={handleItemClickWrapper(item, index)}
              >
                <div className="w-4 flex items-center justify-center">
                  {cursorIndex === index && <span className="text-sm">▶</span>}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span>{item.isDirectory ? '📁' : '📄'}</span>
                  <span className="truncate">{item.name}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

FileExplorer.displayName = 'FileExplorer';

export default FileExplorer;

