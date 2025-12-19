import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { TextEditorConfig } from '../services/textEditorConfigService';

interface MarkdownViewerProps {
  content: string;
  config: TextEditorConfig;
}

/**
 * 마크다운 파일을 렌더링하는 컴포넌트
 */
export default function MarkdownViewer({ content, config }: MarkdownViewerProps) {
  return (
    <div 
      className="prose prose-sm dark:prose-invert max-w-none"
      style={{
        paddingLeft: `${config.horizontalPadding}px`,
        paddingRight: `${config.horizontalPadding}px`,
        paddingTop: '1.5rem',
        paddingBottom: '1.5rem',
        fontSize: `${config.fontSize}px`,
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

