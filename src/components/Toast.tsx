import React, { useEffect, useRef } from 'react';

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

function ToastComponent({ toast, onClose }: ToastProps) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const duration = toast.duration ?? 1000;
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
        flex items-center gap-2 px-3 py-2 rounded-md shadow-lg text-xs
        ${getToastStyles()}
        transition-all duration-300 ease-in-out
      `}
      role="alert"
    >
      <span className="text-sm flex-shrink-0">{getIcon()}</span>
      <p className="flex-1 font-medium whitespace-nowrap">{toast.message}</p>
    </div>
  );
}

export default React.memo(ToastComponent);

