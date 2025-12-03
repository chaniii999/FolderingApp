import { useState } from 'react';
import type { Folder } from '../types/electron';

interface FolderListProps {
  folders: Folder[];
  loading: boolean;
  onFolderCreate: (name: string) => void;
  onFolderDelete: (id: string) => void;
}

function FolderList({ folders, loading, onFolderCreate, onFolderDelete }: FolderListProps) {
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateClick = () => {
    setIsCreating(true);
  };

  const handleCreateSubmit = () => {
    if (newFolderName.trim()) {
      onFolderCreate(newFolderName.trim());
      setNewFolderName('');
      setIsCreating(false);
    }
  };

  const handleCreateCancel = () => {
    setNewFolderName('');
    setIsCreating(false);
  };

  const handleDeleteClick = (id: string) => {
    if (confirm('이 폴더를 삭제하시겠습니까?')) {
      onFolderDelete(id);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  return (
    <div className="folder-list">
      <div className="folder-list-header">
        <h2>폴더 목록</h2>
        {!isCreating ? (
          <button className="create-button" onClick={handleCreateClick}>
            새 폴더
          </button>
        ) : (
          <div className="create-form">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateSubmit();
                } else if (e.key === 'Escape') {
                  handleCreateCancel();
                }
              }}
              placeholder="폴더 이름"
              autoFocus
            />
            <button onClick={handleCreateSubmit}>생성</button>
            <button onClick={handleCreateCancel}>취소</button>
          </div>
        )}
      </div>
      <div className="folder-items">
        {folders.length === 0 ? (
          <div className="empty-message">폴더가 없습니다. 새 폴더를 만들어보세요.</div>
        ) : (
          folders.map((folder) => (
            <div key={folder.id} className="folder-item">
              <div className="folder-name">{folder.name}</div>
              <div className="folder-actions">
                <button onClick={() => handleDeleteClick(folder.id)}>삭제</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FolderList;

