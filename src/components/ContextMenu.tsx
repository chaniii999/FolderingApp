import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onNewFile?: () => void;
  canCopy: boolean;
  canPaste: boolean;
  isBlankSpace?: boolean;
}

function ContextMenu({ x, y, onClose, onCut, onCopy, onPaste, onDelete, onNewFile, canCopy, canPaste, isBlankSpace = false }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > windowWidth) {
        adjustedX = windowWidth - rect.width - 10;
      }
      if (y + rect.height > windowHeight) {
        adjustedY = windowHeight - rect.height - 10;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  const handleCutClick = () => {
    onCut();
    onClose();
  };

  const handleCopyClick = () => {
    onCopy();
    onClose();
  };

  const handlePasteClick = () => {
    onPaste();
    onClose();
  };

  const handleDeleteClick = () => {
    onDelete();
    onClose();
  };

  const handleNewFileClick = () => {
    if (onNewFile) {
      onNewFile();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[150px]"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div className="flex flex-col gap-1 p-1">
        {onNewFile && (
          <button
            onClick={handleNewFileClick}
            className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
          >
            새로 만들기
          </button>
        )}
        {onNewFile && (!isBlankSpace || canPaste) && (
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        )}
        {!isBlankSpace && (
          <>
            <button
              onClick={handleCutClick}
              className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
            >
              잘라내기
            </button>
            {canCopy && (
              <button
                onClick={handleCopyClick}
                className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
              >
                복사
              </button>
            )}
            {canPaste && (
              <button
                onClick={handlePasteClick}
                className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
              >
                붙여넣기
              </button>
            )}
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onClick={handleDeleteClick}
              className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-red-600 dark:text-red-400"
            >
              삭제
            </button>
          </>
        )}
        {isBlankSpace && canPaste && (
          <button
            onClick={handlePasteClick}
            className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
          >
            붙여넣기
          </button>
        )}
      </div>
    </div>
  );
}

export default ContextMenu;

