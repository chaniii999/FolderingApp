import { useState, useEffect, useRef } from 'react';
import { toastService } from '../services/toastService';
import { handleError } from '../utils/errorHandler';

interface PdfViewerProps {
  filePath: string;
}

function PdfViewer({ filePath }: PdfViewerProps) {
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const loadPdf = async (): Promise<void> => {
      if (!filePath) {
        setPdfDataUrl(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        if (typeof window.api.filesystem.readFileAsBase64 !== 'function') {
          throw new Error('readFileAsBase64 함수를 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
        }

        const base64 = await window.api.filesystem.readFileAsBase64(filePath);
        
        if (base64 === null) {
          throw new Error('PDF 파일을 읽을 수 없습니다.');
        }

        const dataUrl = `data:application/pdf;base64,${base64}`;
        setPdfDataUrl(dataUrl);
      } catch (err) {
        const errorMessage = handleError(err, 'PDF 파일을 로드하는 중 오류가 발생했습니다.');
        setError(errorMessage);
        setPdfDataUrl(null);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [filePath]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <div className="text-gray-500 dark:text-gray-400 text-sm font-medium">PDF를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="px-4 py-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      </div>
    );
  }

  if (!pdfDataUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">PDF를 표시할 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-100 dark:bg-gray-900">
      <iframe
        ref={iframeRef}
        src={pdfDataUrl}
        className="w-full h-full border-none"
        title="PDF Viewer"
      />
    </div>
  );
}

export default PdfViewer;

