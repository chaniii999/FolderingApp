import React, { useEffect, useRef } from 'react';

interface RecoveryDialogProps {
  fileName: string;
  onRecover: () => void;
  onDiscard: () => void;
}

export default function RecoveryDialog({ fileName, onRecover, onDiscard }: RecoveryDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [selectedOption, setSelectedOption] = React.useState<'recover' | 'discard'>('recover');

  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      onDiscard();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedOption === 'recover') {
        onRecover();
      } else {
        onDiscard();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedOption(prev => prev === 'recover' ? 'discard' : 'recover');
    }
  };

  return (
    <div
      data-recovery-dialog
      className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onDiscard();
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
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-200">저장 실패 - 복구 가능</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          <span className="font-medium">{fileName}</span> 파일 저장에 실패했습니다.
          <br />
          자동 저장된 내용을 복구할 수 있습니다.
        </p>
        <div className="flex flex-col gap-2 mb-6">
          <button
            onClick={onRecover}
            className={`
              px-4 py-2 rounded text-left transition-colors
              ${selectedOption === 'recover'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
          >
            복구 (Enter)
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
            복구하지 않음
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDiscard}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            취소 (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

