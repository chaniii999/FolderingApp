import { useState, useRef, useEffect } from 'react';

interface ResizerProps {
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

function Resizer({ onResize, minWidth = 200, maxWidth = 800 }: ResizerProps) {
  const resizerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const frameRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      latestClientXRef.current = e.clientX;
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const clientX = latestClientXRef.current;
        if (clientX === null) {
          return;
        }
        const newWidth = clientX;
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
        onResize(clampedWidth);
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      latestClientXRef.current = null;
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isResizing, onResize, minWidth, maxWidth]);

  const handleMouseDown = () => {
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <div
      ref={resizerRef}
      onMouseDown={handleMouseDown}
      className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-blue-500 dark:hover:bg-blue-600 cursor-col-resize transition-colors"
    />
  );
}

export default Resizer;

