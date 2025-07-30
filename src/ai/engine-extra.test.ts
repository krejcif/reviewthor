import { AIReviewEngine } from './engine';
import { AnthropicClient } from './anthropic-client';
import { PromptManager } from './prompt-manager';
import { ContextBuilder } from './context-builder';

jest.mock('./anthropic-client');
jest.mock('./prompt-manager');
jest.mock('./context-builder');

describe('AIReviewEngine - Extra Coverage', () => {
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

  describe('parseResponse non-Error exception handling', () => {
    it('should handle non-Error exceptions in JSON parsing', async () => {
      // Arrange
      const context = {
        files: [{ path: 'test.js', content: 'test', diff: 'diff' }],
        prDescription: 'Test',
        repository: 'test/repo',
      };

      // Mock the JSON.parse to throw a non-Error object
      const originalParse = JSON.parse;
      JSON.parse = jest.fn().mockImplementation(() => {
        throw 'String error'; // Throw a string instead of Error
      });

      mockAnthropicClient.createMessage.mockResolvedValue({
        content: '{"invalid": "json"', // Invalid JSON
        thinking: '',
      });

      // Act & Assert
      try {
        await engine.analyzeCode(context);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid AI response format: Unknown error');
      } finally {
        // Always restore JSON.parse
        JSON.parse = originalParse;
      }
    });
  });
});