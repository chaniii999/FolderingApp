import { useState, useEffect, useCallback, useRef } from 'react';
import type { CustomTemplate, TemplateInstance, TemplatePart } from '../../types/myMemo';
import { getFileName } from '../../utils/pathUtils';

interface TemplateInstanceEditorProps {
  filePath: string;
  content: string;
  config: { horizontalPadding: number; fontSize: number };
  onContentChange: (newContent: string) => void;
  onSave: () => Promise<void>;
}

/**
 * 템플릿 인스턴스 전용 편집 컴포넌트
 * 템플릿 뷰어와 유사하지만 파트 값 부분을 입력폼으로 표시
 */
function TemplateInstanceEditor({ filePath, content, config, onContentChange, onSave }: TemplateInstanceEditorProps) {
  const [instance, setInstance] = useState<TemplateInstance | null>(null);
  const [templateData, setTemplateData] = useState<CustomTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partValues, setPartValues] = useState<Record<string, string>>({});
  const [partTitles, setPartTitles] = useState<Record<string, string>>({}); // 파트 제목 편집용 상태
  const fileName = getFileName(filePath);
  const inputRefs = useRef<Map<string, HTMLInputElement | HTMLTextAreaElement>>(new Map());
  const isComposingRef = useRef<Map<string, boolean>>(new Map());
  const instanceRef = useRef<TemplateInstance | null>(null);
  const contentRef = useRef<string>('');
  const isUpdatingFromContentRef = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  // JSON 파싱 및 템플릿 인스턴스 로드
  useEffect(() => {
    // 초기 마운트 시에는 항상 실행
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      contentRef.current = content;
    } else {
      // IME 조합 중이거나 사용자가 입력 중일 때는 content 변경을 무시
      const isAnyComposing = Array.from(isComposingRef.current.values()).some(v => v);
      if (isAnyComposing || contentRef.current === content) {
        return;
      }
    }

    if (!content || content.trim() === '') {
      setError('템플릿 내용이 비어있습니다.');
      setInstance(null);
      instanceRef.current = null;
      contentRef.current = content;
      return;
    }

    try {
      const parsed = JSON.parse(content);
      
      // TemplateInstance 형식인지 확인
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
        instanceRef.current = templateInstance;
        isUpdatingFromContentRef.current = true;
        setPartValues(parsed.data || {});
        contentRef.current = content;
        setError(null);
        
        // 템플릿 정보 가져오기
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
                      // 템플릿의 모든 파트에 대해 기본값 설정 (없는 경우) - 파트 제목을 키로 사용
                      const newPartValues: Record<string, string> = { ...parsed.data };
                      const newPartTitles: Record<string, string> = {};
                      template.parts.forEach(part => {
                        // 인스턴스의 data 키 중 part.title과 일치하는 것이 있는지 확인
                        const instanceKey = Object.keys(newPartValues).find(key => key === part.title) || part.title;
                        newPartTitles[part.id] = instanceKey;
                        if (!(instanceKey in newPartValues)) {
                          newPartValues[instanceKey] = part.default || '';
                        }
                      });
                      isUpdatingFromContentRef.current = true;
                      setPartValues(newPartValues);
                      setPartTitles(newPartTitles);
                      isUpdatingFromContentRef.current = false;
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
        isUpdatingFromContentRef.current = false;
        return;
      }

      setError('템플릿 인스턴스 형식이 올바르지 않습니다.');
      setInstance(null);
      instanceRef.current = null;
      contentRef.current = content;
    } catch (err) {
      console.error('TemplateInstanceEditor - Error parsing template:', err);
      setError('JSON 파싱 오류가 발생했습니다.');
      setInstance(null);
      instanceRef.current = null;
      contentRef.current = content;
    }
  }, [content, filePath, fileName]);

  // cleanup: 컴포넌트 언마운트 시 timeout 정리
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // 파트 값 변경 핸들러
  const handlePartValueChange = useCallback((partTitle: string, value: string) => {
    // content에서 업데이트 중일 때는 무시
    if (isUpdatingFromContentRef.current) {
      return;
    }

    setPartValues(prev => {
      const newValues = { ...prev, [partTitle]: value };
      
      // IME 입력 중이 아닐 때만 content 변경 (debounce)
      if (instanceRef.current && !isComposingRef.current.get(partTitle)) {
        // 기존 timeout 취소
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        // debounce: 100ms 후에 업데이트
        updateTimeoutRef.current = setTimeout(() => {
          const updatedInstance: TemplateInstance = {
            ...instanceRef.current!,
            data: newValues,
          };
          const newContent = JSON.stringify(updatedInstance, null, 2);
          contentRef.current = newContent;
          onContentChange(newContent);
        }, 100);
      }
      
      return newValues;
    });
  }, [onContentChange]);

  const handlePartTitleChange = useCallback((partId: string, oldTitle: string, newTitle: string) => {
    // 파트 제목 상태 업데이트 (입력 필드에 즉시 반영)
    setPartTitles(prev => ({
      ...prev,
      [partId]: newTitle,
    }));

    // content에서 업데이트 중일 때는 data 업데이트만 무시
    if (isUpdatingFromContentRef.current) {
      return;
    }

    // 빈 제목이거나 변경사항이 없으면 data는 업데이트하지 않음
    if (!newTitle.trim() || newTitle === oldTitle) {
      return;
    }

    setPartValues(prev => {
      const value = prev[oldTitle] || '';
      const newValues = { ...prev };
      
      // 기존 키 삭제
      delete newValues[oldTitle];
      
      // 새로운 키로 값 이동
      newValues[newTitle] = value;
      
      // IME 입력 중이 아닐 때만 content 변경
      if (instanceRef.current && !isComposingRef.current.get(oldTitle) && !isComposingRef.current.get(newTitle)) {
        const updatedInstance: TemplateInstance = {
          ...instanceRef.current,
          data: newValues,
        };
        const newContent = JSON.stringify(updatedInstance, null, 2);
        contentRef.current = newContent;
        onContentChange(newContent);
      }
      
      return newValues;
    });
  }, [onContentChange]);

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

  // Tab 키로 탭 문자 삽입하는 핸들러
  const handleTabKey = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, element: HTMLInputElement | HTMLTextAreaElement, partTitle: string) => {
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const start = element.selectionStart || 0;
      const end = element.selectionEnd || 0;
      const text = element.value;
      const tabChar = '\t'; // 탭 문자 (4개 공백으로 표시됨)
      
      // 선택된 텍스트가 있으면 탭 문자로 대체, 없으면 삽입
      const newText = text.substring(0, start) + tabChar + text.substring(end);
      const newCursorPos = start + 1; // 탭 문자는 1개 문자
      
      // 값 업데이트
      handlePartValueChange(partTitle, newText);
      
      // 커서 위치 설정 (다음 프레임에서 실행하여 상태 업데이트 후 적용)
      setTimeout(() => {
        element.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
  }, [handlePartValueChange]);

  // 파트 타입에 따른 입력 필드 렌더링
  const renderInputField = (part: TemplatePart, value: string) => {
    const commonProps = {
      value: value,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handlePartValueChange(part.title, e.target.value);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const element = e.currentTarget;
        handleTabKey(e, element, part.title);
      },
      onCompositionStart: () => {
        isComposingRef.current.set(part.title, true);
      },
      onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const finalValue = e.currentTarget.value;
        isComposingRef.current.set(part.title, false);
        // IME 입력 종료 후 최종 값으로 즉시 업데이트 (debounce 없이)
        setPartValues(prev => {
          const newValues = { ...prev, [part.title]: finalValue };
          if (instanceRef.current) {
            const updatedInstance: TemplateInstance = {
              ...instanceRef.current,
              data: newValues,
            };
            const newContent = JSON.stringify(updatedInstance, null, 2);
            contentRef.current = newContent;
            onContentChange(newContent);
          }
          return newValues;
        });
      },
      placeholder: part.placeholder || '',
      className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400',
      style: {
        fontSize: `${config.fontSize}px`,
      },
    };

    switch (part.type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            rows={6}
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
            className={`${commonProps.className} resize-y`}
          />
        );
      case 'text':
        return (
          <input
            {...commonProps}
            type="text"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
          />
        );
      case 'number':
        return (
          <input
            {...commonProps}
            type="number"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
          />
        );
      case 'date':
        return (
          <input
            {...commonProps}
            type="date"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
          />
        );
      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handlePartValueChange(part.title, e.target.value)}
            placeholder={part.placeholder || ''}
            className={commonProps.className}
            style={commonProps.style}
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
          >
            <option value="">선택하세요</option>
            {part.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      default:
        return (
          <input
            {...commonProps}
            type="text"
            ref={(el) => {
              if (el) {
                inputRefs.current.set(part.title, el);
              }
            }}
          />
        );
    }
  };

  // 에러 표시
  if (error && !instance) {
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

  // 로딩 중
  if (!instance || !templateData) {
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

  const parts = templateData.parts || [];
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
        <div className="flex items-start justify-between mb-8 pb-4 border-b-2 border-gray-800 dark:border-gray-200">
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-semibold text-gray-500 dark:text-gray-400">
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

        {/* 편집 폼: 파트별 입력 필드 */}
        <div className="space-y-12">
          {sortedParts.length > 0 ? (
            sortedParts.map((part) => {
              // 인스턴스의 data 키를 찾기 (part.title과 일치하는 키 또는 첫 번째 매칭)
              const instanceKey = Object.keys(partValues).find(key => key === part.title) || part.title;
              const displayTitle = partTitles[part.id] || instanceKey;
              const value = partValues[displayTitle] || partValues[instanceKey] || '';
              
              return (
                <div key={part.id} className="space-y-4">
                  <div className="pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={displayTitle}
                        onChange={(e) => {
                          const newTitle = e.target.value;
                          handlePartTitleChange(part.id, instanceKey, newTitle);
                        }}
                        onBlur={(e) => {
                          // 포커스를 잃을 때 빈 제목이면 원래 제목으로 복원
                          const newTitle = e.target.value.trim();
                          if (!newTitle) {
                            setPartTitles(prev => ({
                              ...prev,
                              [part.id]: instanceKey,
                            }));
                          } else if (newTitle !== instanceKey) {
                            // 제목이 변경되었고 빈 값이 아니면 data 업데이트
                            handlePartTitleChange(part.id, instanceKey, newTitle);
                          }
                        }}
                        onKeyDown={(e) => {
                          // 입력 필드 내부의 화살표 키는 정상 작동하도록 전파 차단
                          if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            e.stopPropagation();
                          }
                        }}
                        className="text-2xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent border-b-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none px-1 py-1"
                        placeholder="파트 제목"
                      />
                      {part.required && (
                        <span className="text-red-600 dark:text-red-400 text-lg">*</span>
                      )}
                    </div>
                  </div>
                  <div className="pl-4">
                    {renderInputField(part, value)}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 dark:text-gray-400">
              템플릿 파트 정보가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TemplateInstanceEditor;
