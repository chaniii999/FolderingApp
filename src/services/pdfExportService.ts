import type { PdfExportOptions } from '../types/electron';
import type { TemplateInstance, CustomTemplate } from '../types/myMemo';
import { toastService } from './toastService';
import { handleError } from '../utils/errorHandler';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';
import remarkBreaks from 'remark-breaks';
import { getDirectoryPath, getFileName } from '../utils/pathUtils';

/**
 * PDF 내보내기 서비스
 * 확장 가능한 구조로 설계
 */
class PdfExportService {
  /**
   * HTML 콘텐츠를 PDF로 내보내기
   * 
   * @param htmlContent HTML 콘텐츠
   * @param defaultFileName 기본 파일명
   * @param options PDF 생성 옵션
   * @returns 성공 여부
   */
  async exportToPDF(
    htmlContent: string,
    defaultFileName: string,
    options?: PdfExportOptions
  ): Promise<boolean> {
    try {
      if (!window.api?.filesystem?.exportToPDF) {
        throw new Error('PDF 내보내기 기능을 사용할 수 없습니다. Electron 앱을 재시작해주세요.');
      }

      if (!htmlContent || htmlContent.trim().length === 0) {
        throw new Error('내보낼 내용이 없습니다.');
      }

      const filePath = await window.api.filesystem.exportToPDF(
        htmlContent,
        defaultFileName,
        options
      );

      if (!filePath) {
        // 사용자가 취소한 경우
        return false;
      }

      const handleOpenFolderClick = async (): Promise<void> => {
        const folderPath = getDirectoryPath(filePath);
        if (!folderPath || !window.api?.filesystem?.openFolder) {
          toastService.error('폴더를 열 수 없습니다.');
          return;
        }
        try {
          await window.api.filesystem.openFolder(folderPath);
        } catch (err) {
          handleError(err, '폴더를 여는 중 오류가 발생했습니다.');
        }
      };

      const handleOpenFileClick = async (): Promise<void> => {
        if (!window.api?.filesystem?.openFile) {
          toastService.error('파일을 열 수 없습니다.');
          return;
        }
        try {
          await window.api.filesystem.openFile(filePath);
        } catch (err) {
          handleError(err, '파일을 여는 중 오류가 발생했습니다.');
        }
      };

      toastService.success('PDF로 저장되었습니다.', {
        duration: 5000,
        actions: [
          { label: '폴더 열기', onClick: handleOpenFolderClick },
          { label: '파일 열기', onClick: handleOpenFileClick },
        ],
      });
      return true;
    } catch (error) {
      const err = error as Error;
      let errorMessage = 'PDF 내보내기 중 오류가 발생했습니다.';
      
      // 구체적인 에러 메시지 처리
      if (err.message) {
        if (err.message.includes('ENOENT') || err.message.includes('존재하지 않습니다')) {
          errorMessage = '저장 경로를 찾을 수 없습니다.';
        } else if (err.message.includes('EACCES') || err.message.includes('권한')) {
          errorMessage = '파일 저장 권한이 없습니다.';
        } else if (err.message.includes('ENOSPC') || err.message.includes('공간')) {
          errorMessage = '디스크 공간이 부족합니다.';
        } else if (err.message.includes('취소')) {
          // 사용자가 취소한 경우는 에러로 표시하지 않음
          return false;
        } else {
          errorMessage = err.message;
        }
      }
      
      const finalErrorMessage = handleError(error, errorMessage);
      toastService.error(finalErrorMessage);
      return false;
    }
  }

  /**
   * 마크다운을 HTML로 변환
   * 
   * @param markdownContent 마크다운 콘텐츠
   * @returns HTML 콘텐츠
   * @throws 마크다운 변환 실패 시 에러
   */
  async convertMarkdownToHtml(markdownContent: string): Promise<string> {
    try {
      if (!markdownContent || markdownContent.trim().length === 0) {
        return '';
      }

      const result = await remark()
        .use(remarkGfm)
        .use(remarkHtml)
        .process(markdownContent);
      
      const html = String(result);
      
      if (!html || html.trim().length === 0) {
        throw new Error('마크다운 변환 결과가 비어있습니다.');
      }
      
      return html;
    } catch (error) {
      console.error('Error converting markdown to HTML:', error);
      const err = error as Error;
      throw new Error(`마크다운 변환 실패: ${err.message || '알 수 없는 오류'}`);
    }
  }

  private async convertMarkdownToHtmlWithBreaks(markdownContent: string): Promise<string> {
    try {
      if (!markdownContent || markdownContent.trim().length === 0) {
        return '';
      }

      const result = await remark()
        .use(remarkGfm)
        .use(remarkBreaks)
        .use(remarkHtml)
        .process(markdownContent);

      const html = String(result);

      if (!html || html.trim().length === 0) {
        throw new Error('마크다운 변환 결과가 비어있습니다.');
      }

      return html;
    } catch (error) {
      console.error('Error converting markdown to HTML with breaks:', error);
      const err = error as Error;
      throw new Error(`마크다운 변환 실패: ${err.message || '알 수 없는 오류'}`);
    }
  }

  /**
   * 텍스트 콘텐츠를 HTML로 변환
   * 확장 가능한 구조로 설계
   * 
   * @param content 텍스트 콘텐츠
   * @param config 텍스트 에디터 설정
   * @param isMarkdown 마크다운 파일 여부
   * @param isTemplateInstance 템플릿 인스턴스 파일 여부
   * @param filePath 파일 경로 (템플릿 인스턴스인 경우 필요)
   * @returns HTML 콘텐츠
   */
  async convertTextToHtml(
    content: string,
    config: { horizontalPadding: number; fontSize: number },
    isMarkdown: boolean = false,
    isTemplateInstance: boolean = false,
    filePath?: string
  ): Promise<string> {
    if (isTemplateInstance && filePath) {
      return await this.convertTemplateInstanceToHtml(content, config, filePath);
    }
    if (isMarkdown) {
      const markdownHtml = await this.convertMarkdownToHtml(content);
      return this.convertMarkdownHtmlToPdfHtml(markdownHtml, config);
    }
    return this.convertPlainTextToHtml(content, config);
  }

  /**
   * 일반 텍스트를 HTML로 변환
   * 
   * @param content 텍스트 콘텐츠
   * @param config 텍스트 에디터 설정
   * @returns HTML 콘텐츠
   */
  private convertPlainTextToHtml(
    content: string,
    config: { horizontalPadding: number; fontSize: number }
  ): string {
    // HTML 이스케이프
    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // 줄바꿈을 <br>로 변환
    const htmlContent = escapedContent.replace(/\n/g, '<br>');

    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: ${config.fontSize}px;
      line-height: 1.6;
      color: #1f2937;
      background-color: #ffffff;
      padding: ${config.horizontalPadding}px;
      margin: 0;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <pre>${htmlContent}</pre>
</body>
</html>`;
  }

  /**
   * 마크다운 HTML을 PDF용 HTML로 변환
   * (마크다운 뷰어에서 렌더링된 HTML을 받아서 처리)
   * 
   * @param markdownHtml 마크다운 렌더링된 HTML
   * @param config 텍스트 에디터 설정
   * @returns PDF용 HTML
   */
  private convertMarkdownHtmlToPdfHtml(
    markdownHtml: string,
    config: { horizontalPadding: number; fontSize: number }
  ): string {
    // Tailwind Typography prose-sm 스타일을 기반으로 작성
    // prose-sm은 기본적으로 0.875rem (14px) 기준으로 스케일링됨
    // 하지만 config.fontSize를 기준으로 상대적으로 적용
    const baseFontSize = config.fontSize;
    
    return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.7142857;
      color: #374151;
      background-color: #ffffff;
      padding: ${config.horizontalPadding}px;
      padding-top: 1.5rem;
      padding-bottom: 1.5rem;
      margin: 0;
    }
    .prose {
      color: #374151;
      max-width: none;
    }
    .prose [class~="lead"] {
      color: #4b5563;
      font-size: ${baseFontSize * 1.125}px;
      line-height: 1.6;
      margin-top: 1.2em;
      margin-bottom: 1.2em;
    }
    .prose a {
      color: #111827;
      text-decoration: underline;
      font-weight: 500;
    }
    .prose strong {
      color: #111827;
      font-weight: 600;
    }
    .prose ol[type="A"] {
      --list-counter-style: upper-alpha;
    }
    .prose ol[type="a"] {
      --list-counter-style: lower-alpha;
    }
    .prose ol[type="A" s] {
      --list-counter-style: upper-alpha;
    }
    .prose ol[type="a" s] {
      --list-counter-style: lower-alpha;
    }
    .prose ol[type="I"] {
      --list-counter-style: upper-roman;
    }
    .prose ol[type="i"] {
      --list-counter-style: lower-roman;
    }
    .prose ol[type="I" s] {
      --list-counter-style: upper-roman;
    }
    .prose ol[type="i" s] {
      --list-counter-style: lower-roman;
    }
    .prose ol[type="1"] {
      --list-counter-style: decimal;
    }
    .prose ol > li {
      position: relative;
      padding-left: 1.75em;
    }
    .prose ol > li::marker {
      font-weight: 400;
      color: #6b7280;
    }
    .prose ul > li {
      position: relative;
      padding-left: 1.75em;
    }
    .prose ul > li::marker {
      color: #9ca3af;
    }
    .prose hr {
      border-color: #e5e7eb;
      border-top-width: 1px;
      margin-top: 3em;
      margin-bottom: 3em;
    }
    .prose blockquote {
      font-weight: 500;
      font-style: italic;
      color: #111827;
      border-left-width: 0.25rem;
      border-left-color: #e5e7eb;
      quotes: "\\201C""\\201D""\\2018""\\2019";
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding-left: 1em;
    }
    .prose h1 {
      color: #111827;
      font-weight: 800;
      font-size: ${baseFontSize * 2.25}px;
      margin-top: 0;
      margin-bottom: 0.8888889em;
      line-height: 1.1111111;
    }
    .prose h2 {
      color: #111827;
      font-weight: 700;
      font-size: ${baseFontSize * 1.5}px;
      margin-top: 2em;
      margin-bottom: 1em;
      line-height: 1.3333333;
    }
    .prose h3 {
      color: #111827;
      font-weight: 600;
      font-size: ${baseFontSize * 1.25}px;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      line-height: 1.6;
    }
    .prose h4 {
      color: #111827;
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.5;
    }
    .prose figure {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose img {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose video {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose figure > * {
      margin-top: 0;
      margin-bottom: 0;
    }
    .prose figcaption {
      color: #6b7280;
      font-size: ${baseFontSize * 0.875}px;
      line-height: 1.4285714;
      margin-top: 0.8571429em;
    }
    .prose code {
      color: #111827;
      font-weight: 600;
      font-size: ${baseFontSize * 0.875}px;
    }
    .prose code::before,
    .prose code::after {
      content: "\\u0060";
    }
    .prose a code {
      color: #111827;
    }
    .prose pre {
      color: #e5e7eb;
      background-color: #1f2937;
      overflow-x: auto;
      font-size: ${baseFontSize * 0.875}px;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding-top: 0.8571429em;
      padding-right: 1.1428571em;
      padding-bottom: 0.8571429em;
      padding-left: 1.1428571em;
    }
    .prose pre code {
      background-color: transparent;
      border-width: 0;
      border-radius: 0;
      padding: 0;
      font-weight: 400;
      color: inherit;
      font-size: inherit;
      font-family: inherit;
      line-height: inherit;
    }
    .prose pre code::before,
    .prose pre code::after {
      content: none;
    }
    .prose table {
      width: 100%;
      table-layout: auto;
      text-align: left;
      margin-top: 2em;
      margin-bottom: 2em;
      font-size: ${baseFontSize * 0.875}px;
      line-height: 1.7142857;
    }
    .prose thead {
      color: #111827;
      font-weight: 600;
      border-bottom-width: 1px;
      border-bottom-color: #d1d5db;
    }
    .prose thead th {
      vertical-align: bottom;
      padding-right: 0.5714286em;
      padding-bottom: 0.5714286em;
      padding-left: 0.5714286em;
    }
    .prose tbody tr {
      border-bottom-width: 1px;
      border-bottom-color: #e5e7eb;
    }
    .prose tbody tr:last-child {
      border-bottom-width: 0;
    }
    .prose tbody td {
      vertical-align: baseline;
      padding-top: 0.5714286em;
      padding-right: 0.5714286em;
      padding-bottom: 0.5714286em;
      padding-left: 0.5714286em;
    }
    .prose {
      font-size: ${baseFontSize}px;
      line-height: 1.7142857;
    }
    .prose p {
      margin-top: 1.1428571em;
      margin-bottom: 1.1428571em;
    }
    .prose [class~="lead"] {
      font-size: ${baseFontSize * 1.125}px;
      line-height: 1.6;
      margin-top: 1.2em;
      margin-bottom: 1.2em;
    }
    .prose blockquote {
      margin-top: 1.6em;
      margin-bottom: 1.6em;
      padding-left: 1.0666667em;
    }
    .prose h1 {
      font-size: ${baseFontSize * 2.25}px;
      margin-top: 0;
      margin-bottom: 0.8888889em;
      line-height: 1.1111111;
    }
    .prose h2 {
      font-size: ${baseFontSize * 1.5}px;
      margin-top: 2em;
      margin-bottom: 1em;
      line-height: 1.3333333;
    }
    .prose h3 {
      font-size: ${baseFontSize * 1.25}px;
      margin-top: 1.6em;
      margin-bottom: 0.6em;
      line-height: 1.6;
    }
    .prose h4 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.5;
    }
    .prose img {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose video {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose figure {
      margin-top: 2em;
      margin-bottom: 2em;
    }
    .prose figure > * {
      margin-top: 0;
      margin-bottom: 0;
    }
    .prose figcaption {
      font-size: ${baseFontSize * 0.875}px;
      line-height: 1.4285714;
      margin-top: 0.8571429em;
    }
    .prose code {
      font-size: ${baseFontSize * 0.875}px;
    }
    .prose h2 code {
      font-size: ${baseFontSize * 1.3125}px;
    }
    .prose h3 code {
      font-size: ${baseFontSize * 1.125}px;
    }
    .prose pre {
      font-size: ${baseFontSize * 0.875}px;
      line-height: 1.7142857;
      margin-top: 1.7142857em;
      margin-bottom: 1.7142857em;
      border-radius: 0.375rem;
      padding-top: 0.8571429em;
      padding-right: 1.1428571em;
      padding-bottom: 0.8571429em;
      padding-left: 1.1428571em;
    }
    .prose ol,
    .prose ul {
      margin-top: 1.1428571em;
      margin-bottom: 1.1428571em;
      padding-left: 1.5714286em;
    }
    .prose li {
      margin-top: 0.2857143em;
      margin-bottom: 0.2857143em;
    }
    .prose ol > li {
      padding-left: 0.4285714em;
    }
    .prose ul > li {
      padding-left: 0.4285714em;
    }
    .prose > ul > li p {
      margin-top: 0.5714286em;
      margin-bottom: 0.5714286em;
    }
    .prose > ul > li > *:first-child {
      margin-top: 1.1428571em;
    }
    .prose > ul > li > *:last-child {
      margin-bottom: 1.1428571em;
    }
    .prose > ol > li > *:first-child {
      margin-top: 1.1428571em;
    }
    .prose > ol > li > *:last-child {
      margin-bottom: 1.1428571em;
    }
    .prose ul ul,
    .prose ul ol,
    .prose ol ul,
    .prose ol ol {
      margin-top: 0.5714286em;
      margin-bottom: 0.5714286em;
    }
    .prose hr {
      border-color: #e5e7eb;
      border-top-width: 1px;
      margin-top: 3em;
      margin-bottom: 3em;
    }
    .prose hr + * {
      margin-top: 0;
    }
    .prose h2 + * {
      margin-top: 0;
    }
    .prose h3 + * {
      margin-top: 0;
    }
    .prose h4 + * {
      margin-top: 0;
    }
    .prose thead th:first-child {
      padding-left: 0;
    }
    .prose thead th:last-child {
      padding-right: 0;
    }
    .prose tbody td:first-child {
      padding-left: 0;
    }
    .prose tbody td:last-child {
      padding-right: 0;
    }
    .prose > :first-child {
      margin-top: 0;
    }
    .prose > :last-child {
      margin-bottom: 0;
    }
  </style>
</head>
<body>
  <div class="prose">
    ${markdownHtml}
  </div>
</body>
</html>`;
  }

  /**
   * 템플릿 인스턴스를 HTML로 변환
   * 템플릿 뷰어와 동일한 스타일로 PDF 생성
   * 
   * @param content 템플릿 인스턴스 JSON 콘텐츠
   * @param config 텍스트 에디터 설정
   * @param filePath 파일 경로
   * @returns HTML 콘텐츠
   */
  async convertTemplateInstanceToHtml(
    content: string,
    config: { horizontalPadding: number; fontSize: number },
    filePath: string
  ): Promise<string> {
    try {
      const parsed = JSON.parse(content) as TemplateInstance;
      const fileName = getFileName(filePath);
      const displayFileName = fileName.replace(/\.json$/i, '');
      
      // 날짜 포맷팅
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

      // 템플릿 정보 가져오기
      let templateData: CustomTemplate | null = null;
      if (window.api?.mymemo && window.api?.filesystem) {
        try {
          const { getTemplatesPath } = await import('./myMemoService');
          const templatesPath = await getTemplatesPath();
          const items = await window.api.filesystem.listDirectory(templatesPath);
          const jsonFiles = items.filter(item => !item.isDirectory && item.name.endsWith('.json'));
          
          for (const file of jsonFiles) {
            try {
              const templateContent = await window.api.filesystem.readFile(file.path);
              if (templateContent) {
                const template = JSON.parse(templateContent) as CustomTemplate;
                if (template.id === parsed.templateId) {
                  templateData = template;
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
      }

      const parts = templateData?.parts || [];
      const sortedParts = [...parts].sort((a, b) => a.order - b.order);

      let sectionsHtml = '';

      if (sortedParts.length > 0) {
        for (const part of sortedParts) {
          const partContent = String(parsed.data?.[part.title] ?? '');
          const markdownHtml = partContent.trim()
            ? await this.convertMarkdownToHtmlWithBreaks(partContent)
            : '';

          sectionsHtml += `
            <section class="template-section">
              <div class="template-section-header">
                <div class="template-section-title">${this.escapeHtml(part.title)}</div>
              </div>
              ${partContent.trim()
                ? `<div class="template-section-content markdown-content">${markdownHtml}</div>`
                : `<div class="template-section-empty">(내용 없음)</div>`}
            </section>`;
        }
      } else {
        for (const [key, value] of Object.entries(parsed.data || {})) {
          const valueText = String(value ?? '');
          const markdownHtml = valueText.trim()
            ? await this.convertMarkdownToHtmlWithBreaks(valueText)
            : '';

          sectionsHtml += `
            <section class="template-section">
              <div class="template-section-header">
                <div class="template-section-title">${this.escapeHtml(key)}</div>
              </div>
              ${valueText.trim()
                ? `<div class="template-section-content markdown-content">${markdownHtml}</div>`
                : `<div class="template-section-empty">(내용 없음)</div>`}
            </section>`;
        }
      }

      const headerDates = `
        ${parsed.updatedAt && parsed.updatedAt !== parsed.createdAt ? `<div>수정: ${formatDate(parsed.updatedAt)}</div>` : ''}
        ${parsed.createdAt ? `<div>작성: ${formatDate(parsed.createdAt)}</div>` : ''}
      `;

      const templateNameHtml = templateData?.name
        ? `<div class="template-subtitle">${this.escapeHtml(templateData.name)}</div>`
        : '';

      const bodyContent = `
        <div class="template-page">
          <div class="template-header">
            <div class="template-header-left">
              <div class="template-title">${this.escapeHtml(displayFileName)}</div>
              ${templateNameHtml}
            </div>
            <div class="template-header-right">
              ${headerDates}
            </div>
          </div>
          <div class="template-sections">
            ${sectionsHtml}
          </div>
        </div>`;

      const baseFontSize = config.fontSize || 14;
      const horizontalPadding = config.horizontalPadding || 80;

      return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(displayFileName)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      font-size: ${baseFontSize}px;
      line-height: 1.75;
      color: #111827;
      background-color: #ffffff;
      margin: 0;
    }
    .template-page {
      padding: 24px ${horizontalPadding}px;
      max-width: 56rem;
      margin: 0 auto;
    }
    .template-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px;
      border-bottom: 2px solid #1f2937;
    }
    .template-header-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .template-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #6b7280;
    }
    .template-subtitle {
      font-size: 0.75rem;
      color: #9ca3af;
    }
    .template-header-right {
      font-size: 0.75rem;
      color: #6b7280;
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .template-sections {
      display: flex;
      flex-direction: column;
      gap: 48px;
      padding-top: 32px;
    }
    .template-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .template-section-header {
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .template-section-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #111827;
    }
    .template-section-content {
      padding-left: 16px;
      color: #374151;
    }
    .template-section-empty {
      padding-left: 16px;
      font-size: 0.875rem;
      color: #9ca3af;
      font-style: italic;
    }
    .markdown-content p {
      margin: 0 0 8px 0;
    }
    .markdown-content ul,
    .markdown-content ol {
      margin: 0 0 8px 0;
      padding-left: 20px;
    }
    .markdown-content li {
      margin: 0 0 4px 0;
    }
    .markdown-content blockquote {
      margin: 0 0 8px 0;
      padding-left: 12px;
      border-left: 3px solid #d1d5db;
      color: #4b5563;
    }
    .markdown-content code {
      font-family: 'Courier New', Courier, monospace;
      background-color: #f3f4f6;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 0.875em;
    }
    .markdown-content pre {
      margin: 0 0 12px 0;
      padding: 12px;
      background-color: #f3f4f6;
      border-radius: 6px;
      overflow-wrap: break-word;
      white-space: pre-wrap;
    }
    .markdown-content pre code {
      padding: 0;
      background-color: transparent;
    }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
    } catch (error) {
      console.error('Error converting template instance to HTML:', error);
      throw new Error('템플릿 인스턴스 변환 실패');
    }
  }

  /**
   * HTML 이스케이프
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const pdfExportService = new PdfExportService();

