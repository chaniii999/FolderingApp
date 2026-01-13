import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

import type { CustomTemplate, TemplateInstance } from '../../types/myMemo';
import { getFileName } from '../../utils/pathUtils';

interface TemplateViewerProps {
  filePath: string;
  content: string;
  config: { horizontalPadding: number; fontSize: number };
}

/**
 * 템플릿 전용 읽기 뷰어 컴포넌트
 * 템플릿 구조를 읽기 전용으로 표시합니다.
 */
function TemplateViewer({ filePath, content, config }: TemplateViewerProps) {
  const [template, setTemplate] = useState<CustomTemplate | null>(null);
  const [instance, setInstance] = useState<TemplateInstance | null>(null);
  const [templateData, setTemplateData] = useState<CustomTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileName = getFileName(filePath);

  // JSON 파싱 및 템플릿/인스턴스 로드
  useEffect(() => {
    if (!content || content.trim() === '') {
      setError('템플릿 내용이 비어있습니다.');
      setTemplate(null);
      setInstance(null);
      return;
    }

    try {
      const parsed = JSON.parse(content);
      
      // TemplateInstance 형식인지 확인 (templateId, data 필드가 있는지)
      if (typeof parsed.templateId === 'string' && typeof parsed.data === 'object' && parsed.data !== null) {
        const templateInstance: TemplateInstance = {
          id: parsed.id || '',
          templateId: parsed.templateId,
          fileName: parsed.fileName || fileName,
          filePath: parsed.filePath || filePath,
          data: parsed.data,
          createdAt: parsed.createdAt || '',
          updatedAt: parsed.updatedAt || '',
        };
        
        setInstance(templateInstance);
        setTemplate(null);
        setError(null);
        
        // 템플릿 정보 가져오기 (나중에 data를 표시하기 위해)
        if (window.api?.mymemo && window.api?.filesystem) {
          (async () => {
            try {
              const { getTemplatesPath } = await import('../../services/myMemoService');
              const templatesPath = await getTemplatesPath();
              const items = await window.api.filesystem.listDirectory(templatesPath);
              const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));
              
              for (const file of jsonFiles) {
                try {
                  const templateContent = await window.api.filesystem.readFile(file.path);
                  if (templateContent) {
                    const template = JSON.parse(templateContent) as CustomTemplate;
                    if (template.id === templateInstance.templateId) {
                      setTemplateData(template);
                      break;
                    }
                  }
                } catch {
                  // 무시
                }
              }
            } catch {
              // 무시
            }
          })();
        }
        return;
      }
      
      // CustomTemplate 형식인지 확인
      // 필수 필드: id, name, parts
      const hasId = typeof parsed.id === 'string' && parsed.id.trim() !== '';
      const hasName = typeof parsed.name === 'string' && parsed.name.trim() !== '';
      const hasParts = Array.isArray(parsed.parts);
      
      if (hasId && hasName && hasParts) {
        // parts 배열의 각 항목이 TemplatePart 형식인지 확인
        const isValidParts = parsed.parts.every((part: unknown) => {
          if (typeof part !== 'object' || part === null) return false;
          const p = part as Record<string, unknown>;
          return (
            typeof p.id === 'string' &&
            typeof p.title === 'string' &&
            typeof p.type === 'string' &&
            typeof p.order === 'number'
          );
        });

        if (isValidParts) {
          // CustomTemplate 형식으로 변환 (선택 필드 처리)
          const template: CustomTemplate = {
            id: parsed.id,
            name: parsed.name,
            description: typeof parsed.description === 'string' ? parsed.description : undefined,
            parts: parsed.parts.map((part: Record<string, unknown>) => ({
              id: part.id as string,
              title: part.title as string,
              type: part.type as CustomTemplate['parts'][0]['type'],
              default: typeof part.default === 'string' ? part.default : undefined,
              placeholder: typeof part.placeholder === 'string' ? part.placeholder : undefined,
              options: Array.isArray(part.options) ? part.options as string[] : undefined,
              required: typeof part.required === 'boolean' ? part.required : undefined,
              order: part.order as number,
            })),
            htmlTemplate: typeof parsed.htmlTemplate === 'string' ? parsed.htmlTemplate : undefined,
            createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
            updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
          };

          setTemplate(template);
          setInstance(null);
          setError(null);
          return;
        }
      }

      // 둘 다 아니면 일반 JSON을 구조화된 형태로 표시
      setTemplate(null);
      setInstance(null);
      setError(null);
    } catch (err) {
      console.error('TemplateViewer - Error parsing template:', err);
      setError('JSON 파싱 오류가 발생했습니다.');
      setTemplate(null);
      setInstance(null);
    }
  }, [content, filePath, fileName]);

  // 날짜 포맷팅 함수
  const formatDate = (dateString: string): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // 에러가 있고 템플릿/인스턴스도 없으면 에러 표시
  if (error && !template && !instance) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
        }}
      >
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  // 템플릿 로딩 중
  if (!template && !instance && !error) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
        }}
      >
        <div className="text-gray-500 dark:text-gray-400">템플릿을 로드하는 중...</div>
      </div>
    );
  }

  // 템플릿 인스턴스 표시 (data 영역을 블로그 글처럼)
  if (instance) {
    const parts = templateData?.parts || [];
    const sortedParts = [...parts].sort((a, b) => a.order - b.order);
    
    return (
      <div
        className="h-full overflow-y-auto"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
          fontSize: `${config.fontSize}px`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* 헤더: 파일명(좌측) + 날짜(우측) */}
          <div className="flex items-start justify-between mb-8 pb-4 border-b border-gray-300 dark:border-gray-600">
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold text-gray-500 dark:text-gray-400">
                {fileName.replace(/\.json$/i, '')}
              </div>
              {templateData?.name && (
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {templateData.name}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {instance.updatedAt && instance.updatedAt !== instance.createdAt && (
                <div>수정: {formatDate(instance.updatedAt)}</div>
              )}
              {instance.createdAt && (
                <div>작성: {formatDate(instance.createdAt)}</div>
              )}
            </div>
          </div>

          {/* data 영역: 블로그 글처럼 표시 */}
          <div className="space-y-8">
            {sortedParts.length > 0 ? (
              sortedParts.map((part) => {
                const content = instance.data[part.title] || '';
                
                return (
                  <div key={part.id} className="space-y-2">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      {part.title}
                    </h2>
                    {content.trim() ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-gray-400 dark:text-gray-500 italic">
                        (내용 없음)
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // 템플릿 정보가 없으면 data를 그대로 표시
              Object.entries(instance.data).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {key}
                  </h2>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {String(value)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // CustomTemplate 표시 (템플릿 정의)
  if (template) {
    return (
      <div
        className="h-full overflow-y-auto"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
          fontSize: `${config.fontSize}px`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* 헤더: 파일명(좌측) + 날짜(우측) */}
          <div className="flex items-start justify-between mb-8 pb-4 border-b border-gray-300 dark:border-gray-600">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {fileName}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {template.updatedAt && template.updatedAt !== template.createdAt && (
                <div>수정: {formatDate(template.updatedAt)}</div>
              )}
              {template.createdAt && (
                <div>작성: {formatDate(template.createdAt)}</div>
              )}
            </div>
          </div>

          {/* 템플릿 정보 */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {template.name}
              </h1>
              {template.description && (
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {template.description}
                </p>
              )}
            </div>

            {/* 파트 목록 */}
            {template.parts.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  파트 구성
                </h2>
                <div className="space-y-3">
                  {template.parts
                    .sort((a, b) => a.order - b.order)
                    .map((part, index) => (
                      <div
                        key={part.id}
                        className="border-l-4 border-blue-500 pl-4 py-2"
                      >
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {index + 1}. {part.title}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          타입: {part.type}
                          {part.required && (
                            <span className="ml-2 text-red-600 dark:text-red-400">(필수)</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 둘 다 아니면 일반 JSON 표시 (data 필드만 블로그처럼)
  try {
    const parsed = JSON.parse(content);
    const hasData = typeof parsed.data === 'object' && parsed.data !== null;
    const createdAt = parsed.createdAt || '';
    const updatedAt = parsed.updatedAt || '';
    
    return (
      <div
        className="h-full overflow-y-auto"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
          fontSize: `${config.fontSize}px`,
        }}
      >
        <div className="max-w-4xl mx-auto">
          {/* 헤더: 파일명(좌측) + 날짜(우측) */}
          {(createdAt || updatedAt) && (
            <div className="flex items-start justify-between mb-8 pb-4 border-b border-gray-300 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {fileName}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {updatedAt && updatedAt !== createdAt && (
                  <div>수정: {formatDate(updatedAt)}</div>
                )}
                {createdAt && <div>작성: {formatDate(createdAt)}</div>}
              </div>
            </div>
          )}

          {/* data 영역이 있으면 블로그처럼 표시 */}
          {hasData ? (
            <div className="space-y-8">
              {Object.entries(parsed.data).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {key}
                  </h2>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                      {String(value)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              내용이 없습니다.
            </div>
          )}
        </div>
      </div>
    );
  } catch {
    // JSON 파싱 실패 시 원본 텍스트 표시
    return (
      <pre
        className="font-mono whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100 h-full overflow-y-auto"
        style={{
          paddingLeft: `${config.horizontalPadding}px`,
          paddingRight: `${config.horizontalPadding}px`,
          paddingTop: '1rem',
          paddingBottom: '1rem',
          fontSize: `${config.fontSize}px`,
        }}
      >
        {content}
      </pre>
    );
  }
}

export default TemplateViewer;
