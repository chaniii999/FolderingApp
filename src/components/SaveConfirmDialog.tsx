import React, { useEffect, useRef } from 'react';
import { handleError } from '../utils/errorHandler';

interface SaveConfirmDialogProps {
  fileName: string;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function SaveConfirmDialog({ fileName, onSave, onDiscard, onCancel }: SaveConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedOption, setSelectedOption] = React.useState<'save' | 'discard'>('save');

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedOption === 'save') {
        handleSave();
      } else {
        onDiscard();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedOption(prev => prev === 'save' ? 'discard' : 'save');
    }
  };

  const handleSave = async () => {
    try {
      await onSave();
      // 저장 성공 시 다이얼로그는 onSave에서 닫힘
    } catch (err) {
      handleError(err, '파일 저장 중 오류가 발생했습니다.');
      // 저장 실패 시 다이얼로그를 닫지 않음
    }
  };

  return (
    <div
      data-save-confirm-dialog
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-200">변경사항 저장</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          <span className="font-medium">{fileName}</span> 파일에 저장되지 않은 변경사항이 있습니다.
        </p>
        <div className="flex flex-col gap-2 mb-6">
          <button
            ref={saveButtonRef}
            onClick={handleSave}
            className={`
              px-4 py-2 rounded text-left transition-colors
              ${selectedOption === 'save'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            저장 (Enter)
          </button>
          <button
            onClick={onDiscard}
            className={`
              px-4 py-2 rounded text-left transition-colors
              ${selectedOption === 'discard'
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            저장하지 않고 닫기
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            취소 (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

