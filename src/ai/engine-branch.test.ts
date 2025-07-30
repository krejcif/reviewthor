import { AIReviewEngine } from './engine';
import { AnthropicClient } from './anthropic-client';
import { PromptManager } from './prompt-manager';
import { ContextBuilder } from './context-builder';

jest.mock('./anthropic-client');
jest.mock('./prompt-manager');
jest.mock('./context-builder');

describe('AIReviewEngine - Branch Coverage', () => {
  let engine: AIReviewEngine;
  let mockAnthropicClient: jest.Mocked<AnthropicClient>;
  let mockPromptManager: jest.Mocked<PromptManager>;
  let mockContextBuilder: jest.Mocked<ContextBuilder>;

  beforeEach(() => {
    mockAnthropicClient = new AnthropicClient({ apiKey: 'test' }) as jest.Mocked<AnthropicClient>;
    mockPromptManager = new PromptManager() as jest.Mocked<PromptManager>;
    mockContextBuilder = new ContextBuilder() as jest.Mocked<ContextBuilder>;

    engine = new AIReviewEngine(
      mockAnthropicClient,
      mockPromptManager,
      mockContextBuilder
    );
  });

  describe('validateAnalysis edge cases', () => {
    it('should throw error when analysis is null', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: 'null',
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must be an object');
    });

    it('should throw error when analysis is not an object', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: '"string value"',
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must be an object');
    });

    it('should throw error when issues is not an array', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: 'not an array',
          summary: 'test',
          stats: {},
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must contain an issues array');
    });

    it('should throw error when summary is missing', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          stats: {},
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must contain a summary string');
    });

    it('should throw error when summary is not a string', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          summary: 123,
          stats: {},
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must contain a summary string');
    });

    it('should throw error when stats is missing', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          summary: 'test',
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must contain stats object');
    });

    it('should throw error when stats is not an object', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          summary: 'test',
          stats: 'not an object',
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Analysis must contain stats object');
    });

    it('should throw error when issue is missing required fields', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [
            {
              file: 'test.js',
              // missing line, severity, message, category
            },
          ],
          summary: 'test',
          stats: {},
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Each issue must have file, line, severity, message, and category');
    });

    it('should throw error when issue has invalid severity', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [
            {
              file: 'test.js',
              line: 1,
              severity: 'critical', // invalid
              message: 'test',
              category: 'bug',
            },
          ],
          summary: 'test',
          stats: {},
        }),
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Issue severity must be error, warning, or info');
    });
  });

  describe('generateComments with different severity filters', () => {
    it('should filter when minimum severity is error', async () => {
      // Arrange
      const analysis = {
        issues: [
          {
            file: 'test.js',
            line: 1,
            severity: 'error' as const,
            message: 'Error',
            category: 'bug',
          },
          {
            file: 'test.js',
            line: 2,
            severity: 'warning' as const,
            message: 'Warning',
            category: 'code-quality',
          },
          {
            file: 'test.js',
            line: 3,
            severity: 'info' as const,
            message: 'Info',
            category: 'documentation',
          },
        ],
        summary: 'Test',
        stats: { total: 3, byCategory: {}, bySeverity: {} },
      };

      engine.setMinimumSeverity('error');
      mockPromptManager.formatComment.mockImplementation((issue) => `${issue.severity}: ${issue.message}`);

      // Act
      const comments = await engine.generateComments(analysis);

      // Assert
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe('error: Error');
    });

    it('should include all when minimum severity is info', async () => {
      // Arrange
      const analysis = {
        issues: [
          {
            file: 'test.js',
            line: 1,
            severity: 'error' as const,
            message: 'Error',
            category: 'bug',
          },
          {
            file: 'test.js',
            line: 2,
            severity: 'warning' as const,
            message: 'Warning',
            category: 'code-quality',
          },
          {
            file: 'test.js',
            line: 3,
            severity: 'info' as const,
            message: 'Info',
            category: 'documentation',
          },
        ],
        summary: 'Test',
        stats: { total: 3, byCategory: {}, bySeverity: {} },
      };

      engine.setMinimumSeverity('info');
      mockPromptManager.formatComment.mockImplementation((issue) => `${issue.severity}: ${issue.message}`);

      // Act
      const comments = await engine.generateComments(analysis);

      // Assert
      expect(comments).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('should wrap non-Error exceptions in Error object', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: '{ invalid json',
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Invalid AI response format');
    });
  });
});