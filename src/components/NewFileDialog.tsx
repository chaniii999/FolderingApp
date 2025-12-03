import { useState, useEffect, useRef } from 'react';

export type FileType = 'folder' | 'file' | 'markdown';

interface NewFileDialogProps {
  currentPath: string;
  onClose: () => void;
  onCreated: (filePath?: string) => void;
}

const fileTypes: { type: FileType; label: string; extension: string }[] = [
  { type: 'folder', label: '폴더', extension: '' },
  { type: 'file', label: '파일', extension: '' },
  { type: 'markdown', label: 'Markdown 파일', extension: '.md' },
];

function NewFileDialog({ currentPath, onClose, onCreated }: NewFileDialogProps) {
  const [fileName, setFileName] = useState('');
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 다이얼로그가 열리면 입력 필드에 포커스
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter로 확인 처리
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
      return;
    }

    // Esc로 취소 처리
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      onClose();
      return;
    }

    // 위/아래 화살표로 파일 타입 선택
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedTypeIndex((prev) => (prev > 0 ? prev - 1 : prev));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedTypeIndex((prev) => (prev < fileTypes.length - 1 ? prev + 1 : prev));
      return;
    }
  };

  const handleCreate = async () => {
    if (!fileName.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }

    try {
      if (!window.api?.filesystem) {
        throw new Error('API가 로드되지 않았습니다.');
      }

      const selectedType = fileTypes[selectedTypeIndex];
      // Windows 경로 구분자 처리
      const separator = currentPath.includes('\\') ? '\\' : '/';
      const fullPath = `${currentPath}${separator}${fileName.trim()}${selectedType.extension}`;

      if (selectedType.type === 'folder') {
        await window.api.filesystem.createDirectory(fullPath);
        onCreated(); // 폴더는 경로 전달 안 함
      } else {
        const initialContent = selectedType.type === 'markdown' ? '# ' : '';
        await window.api.filesystem.createFile(fullPath, initialContent);
        onCreated(fullPath); // 파일은 경로 전달
      }

      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '생성 중 오류가 발생했습니다.';
      setError(errorMessage);
      console.error('Error creating file/directory:', err);
    }
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold mb-4">새로 만들기</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            이름
          </label>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => {
              setFileName(e.target.value);
              setError(null);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="이름을 입력하세요"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            타입 (위/아래 화살표로 선택)
          </label>
          <div className="space-y-1">
            {fileTypes.map((type, index) => (
              <div
                key={type.type}
                className={`px-3 py-2 rounded cursor-pointer ${
                  selectedTypeIndex === index
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedTypeIndex(index)}
              >
                {type.label}
                {type.extension && <span className="text-xs ml-2">({type.extension})</span>}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-100 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300"
          >
            <span>취소</span>
            <span className="text-xs bg-gray-600 text-white px-1.5 py-0.5 rounded">
              Esc
            </span>
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded flex items-center gap-2 bg-blue-500 text-white hover:bg-blue-600"
          >
            <span>생성</span>
            <span className="text-xs bg-blue-700 text-white px-1.5 py-0.5 rounded">
              Enter
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewFileDialog;

