import { useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

export default function ToastComponent({ toast, onClose }: ToastProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        onClose(toast.id);
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.id, toast.duration, onClose]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500 dark:bg-green-600 text-white';
      case 'error':
        return 'bg-red-500 dark:bg-red-600 text-white';
      case 'warning':
        return 'bg-orange-500 dark:bg-orange-600 text-white';
      case 'info':
        return 'bg-blue-500 dark:bg-blue-600 text-white';
      default:
        return 'bg-gray-500 dark:bg-gray-600 text-white';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[300px] max-w-[500px]
        ${getToastStyles()}
        transition-all duration-300 ease-in-out
      `}
      role="alert"
    >
      <span className="text-lg font-bold flex-shrink-0">{getIcon()}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-black hover:bg-opacity-20 transition-colors"
        aria-label="닫기"
      >
        <svg
          className="w-4 h-4"
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
}

