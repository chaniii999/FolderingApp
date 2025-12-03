import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface FileContentViewerProps {
  filePath: string | null;
}

function FileContentViewer({ filePath }: FileContentViewerProps) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMarkdownFile = (path: string | null): boolean => {
    if (!path) return false;
    const extension = path.toLowerCase().split('.').pop();
    return extension === 'md' || extension === 'markdown';
  };

  useEffect(() => {
    const loadFile = async () => {
      if (!filePath) {
        setContent('');
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        if (!window.api?.filesystem) {
          throw new Error('API가 로드되지 않았습니다.');
        }

        if (typeof window.api.filesystem.readFile !== 'function') {
          throw new Error('readFile 함수를 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
        }

        const fileContent = await window.api.filesystem.readFile(filePath);
        
        if (fileContent === null) {
          throw new Error('파일을 읽을 수 없습니다.');
        }

        setContent(fileContent);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.';
        setError(errorMessage);
        setContent('');
        console.error('Error loading file:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  if (!filePath) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold">파일 내용</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          파일을 선택하세요
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold truncate" title={filePath}>
          {filePath.split(/[/\\]/).pop() || filePath}
        </h2>
        <div className="text-xs text-gray-500 mt-1 font-mono truncate" title={filePath}>
          {filePath}
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="px-4 py-2 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          </div>
        ) : isMarkdownFile(filePath) ? (
          <div className="p-6 prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}

export default FileContentViewer;

