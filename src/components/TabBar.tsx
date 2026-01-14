import React, { useCallback, useState, useEffect } from 'react';
import type { Tab } from '../types/tabs';
import { isTemplateInstanceFile } from '../utils/fileUtils';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string, e: React.MouseEvent) => void;
}

function TabBar({ tabs, activeTabId, onTabClick, onTabClose }: TabBarProps) {
  const [templateInstanceMap, setTemplateInstanceMap] = useState<Map<string, boolean>>(new Map());

  // 템플릿 인스턴스 확인
  useEffect(() => {
    const checkTemplates = async (): Promise<void> => {
      const map = new Map<string, boolean>();
      for (const tab of tabs) {
        const isInstance = await isTemplateInstanceFile(tab.filePath);
        map.set(tab.id, isInstance);
      }
      setTemplateInstanceMap(map);
    };
    void checkTemplates();
  }, [tabs]);

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
        const isTemplateInstance = templateInstanceMap.get(tab.id) || false;
        const displayName = isTemplateInstance && tab.fileName.toLowerCase().endsWith('.json')
          ? tab.fileName.replace(/\.json$/i, '')
          : tab.fileName;
        
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
              {displayName}
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

export default React.memo(TabBar);

