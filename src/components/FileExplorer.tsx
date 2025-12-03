import { useState, useEffect, useRef } from 'react';
import type { FileSystemItem } from '../types/electron';

interface FileExplorerProps {
  currentPath: string;
  onPathChange: (path: string) => void;
}

function FileExplorer({ currentPath, onPathChange }: FileExplorerProps) {
  const [items, setItems] = useState<FileSystemItem[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const loadDirectory = async (path: string) => {
    try {
      setLoading(true);
      const directoryItems = await window.api.filesystem.listDirectory(path);
      setItems(directoryItems);
      setCursorIndex(0);
    } catch (error) {
      console.error('Error loading directory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath]);

  useEffect(() => {
    if (itemRefs.current[cursorIndex]) {
      itemRefs.current[cursorIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [cursorIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (loading) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursorIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursorIndex((prev) => (prev < items.length - 1 ? prev + 1 : items.length - 1));
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      handleEnter();
    }
  };

  const handleEnter = async () => {
    if (items.length === 0 || cursorIndex >= items.length) return;

    const selectedItem = items[cursorIndex];
    
    if (selectedItem.isDirectory) {
      const newPath = await window.api.filesystem.changeDirectory(currentPath, selectedItem.name);
      if (newPath) {
        onPathChange(newPath);
      }
    }
  };

  const handleItemClick = async (item: FileSystemItem, index: number) => {
    setCursorIndex(index);
    if (item.isDirectory) {
      const newPath = await window.api.filesystem.changeDirectory(currentPath, item.name);
      if (newPath) {
        onPathChange(newPath);
      }
    }
  };

  const handleItemRef = (index: number) => (el: HTMLDivElement | null) => {
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

  return (
    <div
      className="flex flex-col h-full w-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={listRef}
    >
      <div className="flex flex-col gap-1 overflow-y-auto flex-1">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            폴더가 비어있습니다
          </div>
        ) : (
          items.map((item, index) => (
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
              {!item.isDirectory && item.size !== undefined && (
                <span className="text-xs text-gray-500">
                  {(item.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FileExplorer;

