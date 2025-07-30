import { AnthropicClient } from './anthropic-client';
import Anthropic from '@anthropic-ai/sdk';

jest.mock('@anthropic-ai/sdk');

describe('AnthropicClient', () => {
  let client: AnthropicClient;
  let mockAnthropicInstance: any;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockCreate = jest.fn();
    mockAnthropicInstance = {
      messages: {
        create: mockCreate,
      },
    };

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => mockAnthropicInstance);

    client = new AnthropicClient({
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const client = new AnthropicClient({
        apiKey: 'test-key',
      });

      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: 'test-key',
        maxRetries: 3,
        timeout: 30000,
      });
    });

    it('should use custom values when provided', () => {
      const client = new AnthropicClient({
        apiKey: 'test-key',
        model: 'claude-3-opus-custom',
        maxRetries: 5,
        timeout: 60000,
      });

      expect(Anthropic).toHaveBeenCalledWith({
        apiKey: 'test-key',
        maxRetries: 5,
        timeout: 60000,
      });
    });
  });

  describe('createMessage', () => {
    it('should send a message to Claude', async () => {
      // Arrange
      const mockResponse = {
        content: [
          { type: 'text', text: 'This is a response' },
        ],
      };
      mockCreate.mockResolvedValue(mockResponse);

      // Act
      const result = await client.createMessage('Test prompt');

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
        stop_sequences: undefined,
      });
      expect(result.content).toBe('This is a response');
      expect(result.thinking).toBe('');
    });

    it('should use custom options', async () => {
      // Arrange
      const mockResponse = {
        content: [
          { type: 'text', text: 'Custom response' },
        ],
      };
      mockCreate.mockResolvedValue(mockResponse);

      // Act
      await client.createMessage('Test prompt', {
        maxTokens: 2048,
        temperature: 0.7,
        stopSequences: ['STOP'],
      });

      // Assert
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 2048,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: 'Test prompt',
          },
        ],
        stop_sequences: ['STOP'],
      });
    });

    it('should handle multiple content blocks', async () => {
      // Arrange
      const mockResponse = {
        content: [
          { type: 'text', text: 'Part 1' },
          { type: 'text', text: 'Part 2' },
        ],
      };
      mockCreate.mockResolvedValue(mockResponse);

      // Act
      const result = await client.createMessage('Test prompt');

      // Assert
      expect(result.content).toBe('Part 1\nPart 2');
    });

    it('should filter non-text content blocks', async () => {
      // Arrange
      const mockResponse = {
        content: [
          { type: 'text', text: 'Text content' },
          { type: 'image', source: 'some-image' }, // Should be filtered
          { type: 'text', text: 'More text' },
        ],
      };
      mockCreate.mockResolvedValue(mockResponse);

      // Act
      const result = await client.createMessage('Test prompt');

      // Assert
      expect(result.content).toBe('Text content\nMore text');
    });

    it('should handle Anthropic API errors', async () => {
      // Arrange
      const apiError = new Error('API Error');
      apiError.name = 'APIError';
      Object.setPrototypeOf(apiError, Anthropic.APIError.prototype);
      mockCreate.mockRejectedValue(apiError);

      // Act & Assert
      await expect(client.createMessage('Test prompt')).rejects.toThrow('Anthropic API error: API Error');
    });

    it('should throw other errors as-is', async () => {
      // Arrange
      const genericError = new Error('Network error');
      mockCreate.mockRejectedValue(genericError);

      // Act & Assert
      await expect(client.createMessage('Test prompt')).rejects.toThrow('Network error');
    });

    it('should use custom model when provided', async () => {
      // Arrange
      const customClient = new AnthropicClient({
        apiKey: 'test-key',
        model: 'claude-2.1',
      });

      const mockResponse = {
        content: [{ type: 'text', text: 'Response' }],
      };
      mockCreate.mockResolvedValue(mockResponse);

      // Act
      await customClient.createMessage('Test');

      // Assert
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-2.1',
        })
      );
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      // Arrange
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello' }],
      });

      // Act
      const isValid = await client.validateApiKey();

      // Assert
      expect(isValid).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10,
        })
      );
    });

    it('should return false for invalid API key', async () => {
      // Arrange
      mockCreate.mockRejectedValue(new Error('Invalid API key'));

      // Act
      const isValid = await client.validateApiKey();

      // Assert
      expect(isValid).toBe(false);
    });
  });
});