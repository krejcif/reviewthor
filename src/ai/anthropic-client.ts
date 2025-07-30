import Anthropic from '@anthropic-ai/sdk';

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface MessageOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
}

export interface AIResponse {
  content: string;
  thinking: string;
}

export class AnthropicClient {
  private client: Anthropic;
  private model: string;

  constructor(config: AnthropicConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries || 3,
      timeout: config.timeout || 30000,
    });
    
    this.model = config.model || 'claude-3-opus-20240229';
  }

  /**
   * Creates a message with Claude
   * @param prompt - The prompt to send
   * @param options - Message options
   * @returns AI response with content and thinking
   */
  async createMessage(prompt: string, options: MessageOptions = {}): Promise<AIResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stop_sequences: options.stopSequences,
      });

      // Extract content from the response
      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      // Extract thinking if present (this would be in a real implementation)
      // For now, we'll just return empty thinking
      const thinking = '';

      return {
        content,
        thinking,
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validates the API key by making a test request
   * @returns true if the API key is valid
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.createMessage('Hello', { maxTokens: 10 });
      return true;
    } catch (error) {
      return false;
    }
  }
}