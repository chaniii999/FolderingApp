import type { PdfExportOptions } from '../types/electron';
import { toastService } from './toastService';
import { handleError } from '../utils/errorHandler';

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
        throw new Error('PDF 내보내기 기능을 사용할 수 없습니다.');
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

      toastService.success('PDF로 저장되었습니다.');
      return true;
    } catch (error) {
      const errorMessage = handleError(error, 'PDF 내보내기 중 오류가 발생했습니다.');
      toastService.error(errorMessage);
      return false;
    }
  }

  /**
   * 텍스트 콘텐츠를 HTML로 변환
   * 확장 가능한 구조로 설계
   * 
   * @param content 텍스트 콘텐츠
   * @param config 텍스트 에디터 설정
   * @param isMarkdown 마크다운 파일 여부
   * @returns HTML 콘텐츠
   */
  convertTextToHtml(
    content: string,
    config: { horizontalPadding: number; fontSize: number },
    isMarkdown: boolean = false
  ): string {
    if (isMarkdown) {
      // 마크다운은 이미 렌더링된 HTML을 받아야 함
      // 이 메서드는 기본 텍스트용
      return this.convertPlainTextToHtml(content, config);
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
  convertMarkdownHtmlToPdfHtml(
    markdownHtml: string,
    config: { horizontalPadding: number; fontSize: number }
  ): string {
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
      font-size: ${config.fontSize}px;
      line-height: 1.6;
      color: #1f2937;
      background-color: #ffffff;
      padding: ${config.horizontalPadding}px;
      margin: 0;
    }
    .prose {
      max-width: none;
    }
    .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    .prose p {
      margin-top: 1em;
      margin-bottom: 1em;
    }
    .prose code {
      background-color: #f3f4f6;
      padding: 0.125em 0.25em;
      border-radius: 0.25em;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.9em;
    }
    .prose pre {
      background-color: #f3f4f6;
      padding: 1em;
      border-radius: 0.5em;
      overflow-x: auto;
    }
    .prose pre code {
      background-color: transparent;
      padding: 0;
    }
    .prose table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    .prose table th,
    .prose table td {
      border: 1px solid #e5e7eb;
      padding: 0.5em;
    }
    .prose table th {
      background-color: #f9fafb;
      font-weight: 600;
    }
    .prose ul, .prose ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    .prose li {
      margin: 0.5em 0;
    }
    .prose blockquote {
      border-left: 4px solid #e5e7eb;
      padding-left: 1em;
      margin: 1em 0;
      color: #6b7280;
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
}

export const pdfExportService = new PdfExportService();

