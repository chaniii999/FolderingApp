import { BrowserWindow, dialog } from 'electron';
import path from 'path';

/**
 * PDF 생성 옵션 (확장 가능한 구조)
 */
export interface PdfExportOptions {
  pageSize?: 'A4' | 'Letter' | 'Legal';
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
  printBackground?: boolean;
  landscape?: boolean;
}

/**
 * PDF 생성 서비스
 * 확장 가능한 구조로 설계
 */
class PdfService {
  /**
   * HTML 콘텐츠를 PDF로 변환
   * 
   * @param htmlContent HTML 콘텐츠
   * @param defaultFileName 기본 파일명
   * @param options PDF 생성 옵션
   * @returns 저장된 파일 경로 또는 null (취소 시)
   */
  async exportHtmlToPdf(
    htmlContent: string,
    defaultFileName: string,
    options: PdfExportOptions = {}
  ): Promise<string | null> {
    // 저장 경로 선택 다이얼로그
    const result = await dialog.showSaveDialog({
      title: 'PDF로 저장',
      defaultPath: defaultFileName,
      filters: [
        { name: 'PDF Files', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    const filePath = result.filePath;

    // 임시 BrowserWindow 생성 (PDF 생성용)
    const pdfWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    try {
      // HTML 콘텐츠를 data URL로 변환하여 로드
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;
      await pdfWindow.loadURL(dataUrl);

      // 콘텐츠 로드 대기
      await pdfWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (document.readyState === 'complete') {
            resolve();
          } else {
            window.addEventListener('load', resolve);
          }
        });
      `);

      // 약간의 추가 대기 (렌더링 완료 보장)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // PDF 생성 옵션 설정
      const pdfOptions = {
        pageSize: options.pageSize || 'A4',
        margins: {
          top: options.margins?.top ?? 0.5,
          right: options.margins?.right ?? 0.5,
          bottom: options.margins?.bottom ?? 0.5,
          left: options.margins?.left ?? 0.5,
        },
        printBackground: options.printBackground ?? true,
        landscape: options.landscape ?? false,
      };

      // PDF 생성
      const pdfBuffer = await pdfWindow.webContents.printToPDF(pdfOptions);

      // 파일로 저장
      const fs = await import('fs');
      fs.writeFileSync(filePath, pdfBuffer);

      return filePath;
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    } finally {
      // 임시 윈도우 닫기
      pdfWindow.close();
    }
  }
}

export const pdfService = new PdfService();

