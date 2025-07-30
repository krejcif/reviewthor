import { ContextBuilder } from './context-builder';

describe('ContextBuilder - Extra Coverage', () => {
  let contextBuilder: ContextBuilder;

  beforeEach(() => {
    contextBuilder = new ContextBuilder();
  });

  describe('optimizeForTokenLimit branch coverage', () => {
    it('should add multiple files that fit within token limit', () => {
      // Create files that together fit within the limit
      const file1 = {
        path: 'file1.js',
        content: 'const a = 1;',
        diff: 'diff1',
        language: 'javascript',
      };
      const file2 = {
        path: 'file2.js',
        content: 'const b = 2;',
        diff: 'diff2',
        language: 'javascript',
      };

      const context = {
        files: [file1, file2],
        pr: {
          title: 'Test',
          description: 'Test',
          author: 'user',
          targetBranch: 'main',
          sourceBranch: 'feature',
        },
        relatedFiles: new Map(),
        totalTokens: 100,
      };

      const optimized = contextBuilder.optimizeForTokenLimit(context);
      
      expect(optimized.truncated).toBe(false);
      expect(optimized.files).toHaveLength(2);
      expect(optimized.files[0]).toEqual(file1);
      expect(optimized.files[1]).toEqual(file2);
    });

    it('should add files until token limit is reached', () => {
      // Create a file that fits and another that exceeds limit
      const file1 = {
        path: 'file1.js',
        content: 'x'.repeat(100000), // ~25k tokens
        diff: 'diff1',
        language: 'javascript',
      };
      const file2 = {
        path: 'file2.js',
        content: 'x'.repeat(500000), // ~125k tokens - will cause truncation
        diff: 'diff2',
        language: 'javascript',
      };

      const context = {
        files: [file1, file2],
        pr: {
          title: 'Test',
          description: 'Test',
          author: 'user',
          targetBranch: 'main',
          sourceBranch: 'feature',
        },
        relatedFiles: new Map(),
        totalTokens: 150000,
      };

      const optimized = contextBuilder.optimizeForTokenLimit(context);
      
      expect(optimized.truncated).toBe(true);
      expect(optimized.files).toHaveLength(2);
      // First file should be unchanged
      expect(optimized.files[0]).toEqual(file1);
      // Second file should be truncated
      expect(optimized.files[1].content).toBe('');
    });
  });
});