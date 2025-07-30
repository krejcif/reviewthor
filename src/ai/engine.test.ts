import { AIReviewEngine } from './engine';
import { AnthropicClient } from './anthropic-client';
import { PromptManager } from './prompt-manager';
import { ContextBuilder } from './context-builder';

jest.mock('./anthropic-client');
jest.mock('./prompt-manager');
jest.mock('./context-builder');

describe('AIReviewEngine', () => {
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

  describe('analyzeCode', () => {
    it('should analyze code and return review analysis', async () => {
      // Arrange
      const context = {
        files: [
          {
            path: 'src/index.js',
            content: 'const x = 1;',
            diff: '@@ -1 +1 @@\n-let x = 1;\n+const x = 1;',
          },
        ],
        prDescription: 'Fix variable declaration',
        repository: 'test/repo',
      };

      const expectedAnalysis = {
        issues: [
          {
            file: 'src/index.js',
            line: 1,
            severity: 'info',
            message: 'Good use of const for immutable variable',
            category: 'code-quality',
          },
        ],
        summary: 'Code looks good with minor improvements',
        stats: {
          total: 1,
          byCategory: { 'code-quality': 1 },
          bySeverity: { info: 1 },
        },
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify(expectedAnalysis),
        thinking: 'The code shows proper use of const...',
      });

      // Act
      const result = await engine.analyzeCode(context);

      // Assert
      expect(result).toEqual(expectedAnalysis);
      expect(mockAnthropicClient.createMessage).toHaveBeenCalledWith(
        expect.stringContaining('review the following code'),
        expect.objectContaining({
          maxTokens: expect.any(Number),
          temperature: expect.any(Number),
        })
      );
    });

    it('should handle AI response with thinking process', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test PR',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: JSON.stringify({
          issues: [],
          summary: 'No issues found',
          stats: { total: 0, byCategory: {}, bySeverity: {} },
        }),
        thinking: 'Let me analyze this code step by step...',
      });

      // Act
      const result = await engine.analyzeCode(context);

      // Assert
      expect(result.issues).toHaveLength(0);
    });

    it('should handle malformed AI response gracefully', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test PR',
        repository: 'test/repo',
      };

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: 'This is not valid JSON',
        thinking: '',
      });

      // Act & Assert
      await expect(engine.analyzeCode(context)).rejects.toThrow('Invalid AI response format');
    });
  });

  describe('generateComments', () => {
    it('should generate PR comments from analysis', async () => {
      // Arrange
      const analysis = {
        issues: [
          {
            file: 'src/index.js',
            line: 10,
            severity: 'warning' as const,
            message: 'Consider using const instead of let',
            category: 'code-quality',
            suggestion: 'const userName = getUserName();',
          },
          {
            file: 'src/utils.js',
            line: 5,
            severity: 'error' as const,
            message: 'Potential null reference error',
            category: 'bug',
            suggestion: 'Add null check: if (data) { ... }',
          },
        ],
        summary: 'Found 2 issues',
        stats: {
          total: 2,
          byCategory: { 'code-quality': 1, 'bug': 1 },
          bySeverity: { warning: 1, error: 1 },
        },
      };

      const expectedComments = [
        {
          path: 'src/index.js',
          line: 10,
          body: '⚠️ **Code Quality**: Consider using const instead of let\n\n**Suggestion:**\n```javascript\nconst userName = getUserName();\n```',
        },
        {
          path: 'src/utils.js',
          line: 5,
          body: '❌ **Bug**: Potential null reference error\n\n**Suggestion:**\n```javascript\nAdd null check: if (data) { ... }\n```',
        },
      ];

      mockPromptManager.formatComment.mockImplementation((issue) => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        const categoryLabels: Record<string, string> = {
          'code-quality': 'Code Quality',
          'bug': 'Bug',
        };
        const category = categoryLabels[issue.category] || issue.category;
        let body = `${icon} **${category}**: ${issue.message}`;
        if (issue.suggestion) {
          body += `\n\n**Suggestion:**\n\`\`\`javascript\n${issue.suggestion}\n\`\`\``;
        }
        return body;
      });

      // Act
      const result = await engine.generateComments(analysis);

      // Assert
      expect(result).toEqual(expectedComments);
      expect(mockPromptManager.formatComment).toHaveBeenCalledTimes(2);
    });

    it('should filter out low severity issues based on configuration', async () => {
      // Arrange
      const analysis = {
        issues: [
          {
            file: 'src/index.js',
            line: 1,
            severity: 'info' as const,
            message: 'Consider adding JSDoc',
            category: 'documentation',
          },
          {
            file: 'src/index.js',
            line: 10,
            severity: 'error' as const,
            message: 'Undefined variable',
            category: 'bug',
          },
        ],
        summary: 'Found issues',
        stats: {
          total: 2,
          byCategory: { documentation: 1, bug: 1 },
          bySeverity: { info: 1, error: 1 },
        },
      };

      engine.setMinimumSeverity('warning');
      mockPromptManager.formatComment.mockReturnValue('formatted comment');

      // Act
      const result = await engine.generateComments(analysis);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].line).toBe(10);
    });
  });

  describe('explainReasoning', () => {
    it('should generate detailed explanation for an issue', async () => {
      // Arrange
      const issue = {
        file: 'src/index.js',
        line: 10,
        severity: 'error' as const,
        message: 'Potential memory leak',
        category: 'performance',
      };

      const expectedExplanation = `
This issue was identified because the event listener is added without a corresponding cleanup.
When the component unmounts or the effect re-runs, the old listener remains attached,
causing a memory leak over time. This can lead to performance degradation and unexpected behavior.

To fix this, return a cleanup function from useEffect that removes the event listener.
      `.trim();

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: expectedExplanation,
        thinking: 'The user is asking about a memory leak issue...',
      });

      // Act
      const result = await engine.explainReasoning(issue);

      // Assert
      expect(result).toBe(expectedExplanation);
      expect(mockAnthropicClient.createMessage).toHaveBeenCalledWith(
        expect.stringContaining('explain why this is an issue'),
        expect.any(Object)
      );
    });
  });
});