import { useEffect, useRef, useCallback } from 'react';

interface TabContextMenuProps {
  x: number;
  y: number;
  canCloseOthers: boolean;
  canCloseToRight: boolean;
  canCloseSaved: boolean;
  onClose: () => void;
  onCloseTab: () => void;
  onCloseOthers: () => void;
  onCloseToRight: () => void;
  onCloseSaved: () => void;
  onCloseAll: () => void;
}

function TabContextMenu({
  x,
  y,
  canCloseOthers,
  canCloseToRight,
  canCloseSaved,
  onClose,
  onCloseTab,
  onCloseOthers,
  onCloseToRight,
  onCloseSaved,
  onCloseAll,
}: TabContextMenuProps) {
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
    if (!menuRef.current) return;
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
  }, [x, y]);

  const handleCloseClick = useCallback(() => {
    onCloseTab();
    onClose();
  }, [onCloseTab, onClose]);

  const handleCloseOthersClick = useCallback(() => {
    onCloseOthers();
    onClose();
  }, [onCloseOthers, onClose]);

  const handleCloseToRightClick = useCallback(() => {
    onCloseToRight();
    onClose();
  }, [onCloseToRight, onClose]);

  const handleCloseSavedClick = useCallback(() => {
    onCloseSaved();
    onClose();
  }, [onCloseSaved, onClose]);

  const handleCloseAllClick = useCallback(() => {
    onCloseAll();
    onClose();
  }, [onCloseAll, onClose]);

  const closeOthersClassName = `px-3 py-2 text-left text-sm rounded ${
    canCloseOthers
      ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
      : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
  }`;

  const closeToRightClassName = `px-3 py-2 text-left text-sm rounded ${
    canCloseToRight
      ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
      : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
  }`;

  const closeSavedClassName = `px-3 py-2 text-left text-sm rounded ${
    canCloseSaved
      ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
      : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
  }`;

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[160px]"
    >
      <div className="flex flex-col gap-1 p-1">
        <button
          onClick={handleCloseClick}
          className="px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-200"
        >
          Close
        </button>
        <button
          onClick={handleCloseOthersClick}
          className={closeOthersClassName}
          disabled={!canCloseOthers}
        >
          Close Others
        </button>
        <button
          onClick={handleCloseToRightClick}
          className={closeToRightClassName}
          disabled={!canCloseToRight}
        >
          Close to the Right
        </button>
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        <button
          onClick={handleCloseSavedClick}
          className={closeSavedClassName}
          disabled={!canCloseSaved}
        >
          Close Saved
        </button>
        <button
          onClick={handleCloseAllClick}
          className={closeSavedClassName}
          disabled={!canCloseSaved}
        >
          Close All
        </button>
      </div>
    </div>
  );
}

export default TabContextMenu;
