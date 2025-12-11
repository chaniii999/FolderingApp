import { useCallback } from 'react';
import type { Tab } from '../types/tabs';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
}

export default function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  const handleTabClick = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTabClick(tabId);
  }, [onTabClick]);

  const handleTabClose = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTabClose(tabId, e);
  }, [onTabClose]);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-900 border-b border-gray-300 dark:border-gray-700 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={(e) => handleTabClick(tab.id, e)}
            className={`
              group flex items-center gap-2 px-3 py-1.5 cursor-pointer border-b-2 transition-colors min-w-0
              ${isActive 
                ? 'bg-white dark:bg-gray-800 border-blue-500 dark:border-blue-400' 
                : 'bg-gray-100 dark:bg-gray-900 border-transparent hover:bg-gray-200 dark:hover:bg-gray-800'
              }
            `}
          >
            <span className={`
              text-sm whitespace-nowrap truncate max-w-[200px]
              ${isActive 
                ? 'text-gray-900 dark:text-gray-100 font-medium' 
                : 'text-gray-600 dark:text-gray-400'
              }
            `} title={tab.fileName}>
              {tab.fileName}
            </span>
            {tab.hasChanges && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 flex-shrink-0" />
            )}
            <button
              onClick={(e) => handleTabClose(tab.id, e)}
              className={`
                ml-1 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex-shrink-0
                ${isActive ? 'opacity-100' : 'opacity-0'}
              `}
              onMouseEnter={(e) => {
                e.currentTarget.classList.add('opacity-100');
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.classList.remove('opacity-100');
                }
              }}
            >
              <svg
                className="w-3 h-3 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}

