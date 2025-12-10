import { useState, useEffect, useRef } from 'react';
import type { SearchResult } from '../types/electron';

interface SearchDialogProps {
  currentPath: string;
  onClose: () => void;
  onFileSelect: (filePath: string) => void;
  onPathChange: (path: string) => void;
}

function SearchDialog({ currentPath, onClose, onFileSelect, onPathChange }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [recursive, setRecursive] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        const searchResults = await window.api.filesystem.searchFiles(currentPath, query.trim(), recursive);
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Error searching files:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [query, recursive, currentPath]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'auto',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 모든 키 이벤트를 다이얼로그 내부에서만 처리하도록 전파 차단
    e.stopPropagation();
    
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
      return;
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 입력 필드에서 특정 키만 처리하고 나머지는 부모로 전달
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      handleKeyDown(e);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (results.length > 0 && results[selectedIndex]) {
        handleSelectResult(results[selectedIndex]);
      }
      return;
    }

    // 입력 관련 키는 허용하되 전파는 차단
    e.stopPropagation();
  };

  useEffect(() => {
    // 다이얼로그가 열려있을 때 전역 핫키 차단
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 다이얼로그 내부 요소에서 발생한 이벤트는 허용
      const target = e.target as HTMLElement;
      const dialogElement = document.querySelector('[data-search-dialog]');
      if (dialogElement && dialogElement.contains(target)) {
        return; // 다이얼로그 내부 이벤트는 허용
      }

      // 다이얼로그 외부에서 발생한 핫키만 차단
      // Ctrl+F, /, Ctrl+Z 등 핫키 차단
      if ((e.ctrlKey && (e.key === 'f' || e.key === 'F' || e.key === 'z' || e.key === 'Z')) || 
          e.key === '/' ||
          (e.ctrlKey && (e.key === '+' || e.key === '=' || e.key === '-')) ||
          e.key === 'n' || e.key === 'N' ||
          e.key === 'e' || e.key === 'E' ||
          e.key === 'p' || e.key === 'P' ||
          e.key === 'o' || e.key === 'O' ||
          e.key === 'b' || e.key === 'B' ||
          e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    if (result.isDirectory) {
      onPathChange(result.path);
    } else {
      onFileSelect(result.path);
    }
    onClose();
  };

  const handleItemRef = (index: number) => (el: HTMLDivElement | null) => {
    itemRefs.current[index] = el;
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      data-search-dialog
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onKeyDown={(e) => {
        // 다이얼로그 외부로 키 이벤트 전파 차단
        e.stopPropagation();
        handleKeyDown(e);
      }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onKeyDown={(e) => {
          e.stopPropagation();
          handleKeyDown(e);
        }}
        tabIndex={0}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="파일명 검색..."
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={onClose}
              className="px-3 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              취소 (Esc)
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={recursive}
                onChange={(e) => setRecursive(e.target.checked)}
                className="w-4 h-4"
              />
              <span>하위 폴더까지 검색</span>
            </label>
            {loading && (
              <span className="text-sm text-gray-500 dark:text-gray-400">검색 중...</span>
            )}
            {!loading && query.trim() && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {results.length}개 결과
              </span>
            )}
          </div>
        </div>
        <div
          ref={resultsRef}
          className="flex-1 overflow-y-auto p-2"
        >
          {results.length === 0 && query.trim() && !loading && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              검색 결과가 없습니다
            </div>
          )}
          {results.length === 0 && !query.trim() && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              검색어를 입력하세요
            </div>
          )}
          {results.map((result, index) => (
            <div
              key={result.path}
              ref={handleItemRef(index)}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer ${
                selectedIndex === index
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              onClick={() => handleSelectResult(result)}
            >
              <span>{result.isDirectory ? '📁' : '📄'}</span>
              <div className="flex-1 min-w-0">
                <div className="truncate">
                  {highlightText(result.name, query)}
                </div>
                {recursive && result.relativePath !== result.name && (
                  <div className={`text-xs truncate ${
                    selectedIndex === index
                      ? 'text-blue-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {result.relativePath}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SearchDialog;

