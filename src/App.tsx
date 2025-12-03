import { useState, useEffect } from 'react';
import FileExplorer from './components/FileExplorer';
import FileContentViewer from './components/FileContentViewer';
import Resizer from './components/Resizer';
import { BackIcon } from './components/icons/BackIcon';
import { getHotkeys } from './config/hotkeys';

function App() {
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState<number>(240);

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
    initializeCurrentPath();
  }, []);

  const handlePathChange = (newPath: string) => {
    setCurrentPath(newPath);
    setSelectedFilePath(null);
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFilePath(filePath);
  };

  const handleBackClick = async () => {
    if (!currentPath) return;
    
    try {
      if (!window.api?.filesystem) {
        console.error('API가 로드되지 않았습니다.');
        return;
      }
      
      const parentPath = await window.api.filesystem.getParentDirectory(currentPath);
      if (parentPath) {
        setCurrentPath(parentPath);
      }
    } catch (err) {
      console.error('Error going back:', err);
    }
  };

  const canGoBack = currentPath !== '';

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex flex-col gap-2 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBackClick}
            disabled={!canGoBack}
            className={`flex items-center justify-center w-8 h-8 rounded ${
              canGoBack
                ? 'bg-gray-200 hover:bg-gray-300 cursor-pointer'
                : 'bg-gray-100 cursor-not-allowed opacity-50'
            }`}
            title={`뒤로가기 (${getHotkeys().goBack})`}
          >
            <BackIcon />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">폴더링 앱</h1>
            {currentPath && (
              <span className="text-sm text-gray-500 font-mono">
                {currentPath}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 flex overflow-hidden">
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
              currentPath={currentPath}
              onPathChange={handlePathChange}
              onFileSelect={handleFileSelect}
            />
          </div>
        </div>
        <Resizer
          onResize={setExplorerWidth}
          minWidth={200}
          maxWidth={600}
        />
        <div className="flex-1 overflow-hidden">
          <FileContentViewer filePath={selectedFilePath} />
        </div>
      </main>
    </div>
  );
}

export default App;

