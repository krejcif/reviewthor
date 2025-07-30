import { ContextBuilder } from './context-builder';

describe('ContextBuilder', () => {
  let contextBuilder: ContextBuilder;

  beforeEach(() => {
    contextBuilder = new ContextBuilder();
  });

  describe('buildFileContext', () => {
    it('should build context for JavaScript file', () => {
      // Arrange
      const file = {
        path: 'src/index.js',
        content: 'const x = 1;',
      };
      const diff = '@@ -1 +1 @@\n-let x = 1;\n+const x = 1;';

      // Act
      const context = contextBuilder.buildFileContext(file, diff);

      // Assert
      expect(context).toEqual({
        path: 'src/index.js',
        content: 'const x = 1;',
        diff,
        language: 'javascript',
      });
    });

    it('should detect different file types', () => {
      const testCases = [
        { path: 'app.js', language: 'javascript' },
        { path: 'App.jsx', language: 'javascript' },
        { path: 'types.ts', language: 'typescript' },
        { path: 'Component.tsx', language: 'typescript' },
        { path: 'module.mjs', language: 'javascript' },
        { path: 'common.cjs', language: 'javascript' },
        { path: 'README.md', language: 'unknown' },
      ];

      testCases.forEach(({ path, language }) => {
        const context = contextBuilder.buildFileContext({ path }, '');
        expect(context.language).toBe(language);
      });
    });

    it('should handle missing content', () => {
      // Arrange
      const file = { path: 'test.js' };
      const diff = 'some diff';

      // Act
      const context = contextBuilder.buildFileContext(file, diff);

      // Assert
      expect(context.content).toBe('');
    });
  });

  describe('buildPRContext', () => {
    it('should build PR context from pull request data', () => {
      // Arrange
      const pr = {
        title: 'Fix bug',
        body: 'This fixes the bug',
        user: { login: 'testuser' },
        base: { ref: 'main' },
        head: { ref: 'fix-bug' },
      };

      // Act
      const context = contextBuilder.buildPRContext(pr);

      // Assert
      expect(context).toEqual({
        title: 'Fix bug',
        description: 'This fixes the bug',
        author: 'testuser',
        targetBranch: 'main',
        sourceBranch: 'fix-bug',
      });
    });

    it('should handle missing fields', () => {
      // Arrange
      const pr = {};

      // Act
      const context = contextBuilder.buildPRContext(pr);

      // Assert
      expect(context).toEqual({
        title: '',
        description: '',
        author: 'unknown',
        targetBranch: 'main',
        sourceBranch: 'feature',
      });
    });
  });

  describe('includeRelatedFiles', () => {
    it('should extract ES6 imports', async () => {
      // Arrange
      const file = {
        path: 'src/app.js',
        content: `
import React from 'react';
import { useState } from 'react';
import './styles.css';
import utils from '../utils';
export default function App() {}
`,
      };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.imports).toContain('react');
      expect(related.imports).toContain('./styles.css');
      expect(related.imports).toContain('../utils');
      expect(related.exports).toContain('default');
    });

    it('should extract CommonJS requires', async () => {
      // Arrange
      const file = {
        path: 'server.js',
        content: `
const express = require('express');
const { readFile } = require('fs');
const path = require("path");
module.exports = { server };
`,
      };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.imports).toContain('express');
      expect(related.imports).toContain('fs');
      expect(related.imports).toContain('path');
    });

    it('should extract named exports', async () => {
      // Arrange
      const file = {
        path: 'utils.js',
        content: `
export const helper = () => {};
export function processData() {}
export class DataProcessor {}
export let config = {};
export var deprecated = 1;
`,
      };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.exports).toContain('helper');
      expect(related.exports).toContain('processData');
      expect(related.exports).toContain('DataProcessor');
      expect(related.exports).toContain('config');
      expect(related.exports).toContain('deprecated');
    });

    it('should find test files', async () => {
      // Arrange
      const file = { path: 'src/utils.js' };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.tests).toContain('src/utils.test.js');
      expect(related.tests).toContain('src/utils.test.ts');
      expect(related.tests).toContain('src/utils.spec.js');
      expect(related.tests).toContain('src/utils.spec.ts');
      expect(related.tests).toContain('__tests__/src/utils.js');
      expect(related.tests).toContain('__tests__/src/utils.ts');
    });

    it('should handle empty content', async () => {
      // Arrange
      const file = { path: 'empty.js' };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.imports).toEqual([]);
      expect(related.exports).toEqual([]);
    });

    it('should deduplicate imports', async () => {
      // Arrange
      const file = {
        path: 'app.js',
        content: `
import React from 'react';
import React from 'react'; // duplicate
const React = require('react'); // also duplicate
`,
      };

      // Act
      const related = await contextBuilder.includeRelatedFiles(file);

      // Assert
      expect(related.imports).toEqual(['react']);
    });
  });

  describe('optimizeForTokenLimit', () => {
    it('should return full context if under limit', () => {
      // Arrange
      const context = {
        files: [
          {
            path: 'small.js',
            content: 'const x = 1;',
            diff: 'small diff',
            language: 'javascript',
          },
        ],
        pr: {
          title: 'Test PR',
          description: 'Test',
          author: 'user',
          targetBranch: 'main',
          sourceBranch: 'feature',
        },
        relatedFiles: new Map(),
        totalTokens: 100,
      };

      // Act
      const optimized = contextBuilder.optimizeForTokenLimit(context);

      // Assert
      expect(optimized.truncated).toBe(false);
      expect(optimized.files).toEqual(context.files);
    });

    it('should truncate files if over limit', () => {
      // Arrange
      const largeContent = 'x'.repeat(600000); // ~150k tokens
      const context = {
        files: [
          {
            path: 'huge.js',
            content: largeContent,
            diff: largeContent,
            language: 'javascript',
          },
          {
            path: 'normal.js',
            content: 'const x = 1;',
            diff: 'diff',
            language: 'javascript',
          },
        ],
        pr: {
          title: 'Test',
          description: 'Test',
          author: 'user',
          targetBranch: 'main',
          sourceBranch: 'feature',
        },
        relatedFiles: new Map(),
        totalTokens: 200000,
      };

      // Act
      const optimized = contextBuilder.optimizeForTokenLimit(context);

      // Assert
      expect(optimized.truncated).toBe(true);
      expect(optimized.tokenCount).toBe(150000);
      expect(optimized.files[0].content).toBe(''); // Content removed
      expect(optimized.files[0].diff).toContain('... (truncated)');
    });

    it('should prioritize diff over content when truncating', () => {
      // Arrange
      const largeContent = 'x'.repeat(500000); // ~125k tokens
      const largeDiff = 'x'.repeat(100000); // ~25k tokens
      const context = {
        files: [
          {
            path: 'file.js',
            content: largeContent,
            diff: largeDiff,
            language: 'javascript',
          },
        ],
        pr: {
          title: 'Test',
          description: 'Test',
          author: 'user',
          targetBranch: 'main',
          sourceBranch: 'feature',
        },
        relatedFiles: new Map(),
        totalTokens: 40000, // This field is not used by the method
      };

      // Act
      const optimized = contextBuilder.optimizeForTokenLimit(context);

      // Assert
      expect(optimized.truncated).toBe(true);
      expect(optimized.files[0].content).toBe(''); // Content removed
      expect(optimized.files[0].diff).toContain('x'); // Diff kept but may be truncated
    });
  });
});