import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Testing Library의 matcher를 Vitest에 추가
expect.extend(matchers);

// 각 테스트 후 DOM 정리
afterEach(() => {
  cleanup();
});

// window 객체에 필요한 속성 추가 (Electron 환경 모킹)
Object.defineProperty(window, 'api', {
  value: {
    filesystem: {
      getCurrentDirectory: () => Promise.resolve('/test/path'),
      getHomeDirectory: () => Promise.resolve('/home'),
      listDirectory: () => Promise.resolve([]),
      readFile: () => Promise.resolve(''),
      writeFile: () => Promise.resolve(),
      createFile: () => Promise.resolve(),
      deleteFile: () => Promise.resolve(),
      createDirectory: () => Promise.resolve(),
      getUserDataPath: () => Promise.resolve('/user/data'),
    },
    menu: {
      updateCheckbox: () => Promise.resolve(),
      updateFontMenu: () => Promise.resolve(),
    },
  },
  writable: true,
  configurable: true,
});

