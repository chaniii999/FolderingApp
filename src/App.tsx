import { useState, useEffect } from 'react';
import FolderList from './components/FolderList';
import FileExplorer from './components/FileExplorer';
import type { Folder } from './types/electron';

function App() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');

  const loadFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await window.api.folder.list();
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '폴더를 불러오는 중 오류가 발생했습니다.');
      console.error('Error loading folders:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeCurrentPath = async () => {
    try {
      const path = await window.api.filesystem.getCurrentDirectory();
      setCurrentPath(path);
    } catch (err) {
      console.error('Error getting current directory:', err);
      const homePath = await window.api.filesystem.getHomeDirectory();
      setCurrentPath(homePath);
    }
  };

  useEffect(() => {
    loadFolders();
    initializeCurrentPath();
  }, []);

  const handleFolderCreate = async (name: string) => {
    try {
      await window.api.folder.create(name);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : '폴더 생성 중 오류가 발생했습니다.');
      console.error('Error creating folder:', err);
    }
  };

  const handleFolderDelete = async (id: string) => {
    try {
      await window.api.folder.delete(id);
      await loadFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : '폴더 삭제 중 오류가 발생했습니다.');
      console.error('Error deleting folder:', err);
    }
  };

  const handlePathChange = (newPath: string) => {
    setCurrentPath(newPath);
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      <header className="flex flex-col gap-2 px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h1 className="text-2xl font-bold">폴더링 앱</h1>
        {currentPath && (
          <div className="text-sm text-gray-600 font-mono">
            {currentPath}
          </div>
        )}
      </header>
      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {error && (
            <div className="mb-4 px-4 py-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <FileExplorer
              currentPath={currentPath}
              onPathChange={handlePathChange}
            />
          </div>
        </div>
        <div className="w-80 border-l border-gray-200 p-4 overflow-y-auto">
          <FolderList
            folders={folders}
            loading={loading}
            onFolderCreate={handleFolderCreate}
            onFolderDelete={handleFolderDelete}
          />
        </div>
      </main>
    </div>
  );
}

export default App;

