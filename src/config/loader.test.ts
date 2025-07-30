import { getConfig, clearConfigCache } from './loader';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

jest.mock('@google-cloud/secret-manager');

describe('Config Loader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Clear module cache to reset cached config
    jest.resetModules();
    jest.clearAllMocks();
    
    // Clear the config cache if the function is available
    const loader = require('./loader');
    if (loader.clearConfigCache) {
      loader.clearConfigCache();
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  describe('getConfig', () => {
    it('should load configuration from environment variables', async () => {
      // Arrange
      process.env.GITHUB_APP_ID = '123456';
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.MAX_TOKENS = '8192';
      process.env.AI_TEMPERATURE = '0.5';

      // Act
      const { getConfig } = require('./loader');
      const config = await getConfig();

      // Assert
      expect(config.githubAppId).toBe(123456);
      expect(config.githubPrivateKey).toBe('test-private-key');
      expect(config.githubWebhookSecret).toBe('test-webhook-secret');
      expect(config.anthropicApiKey).toBe('test-api-key');
      expect(config.gcpProjectId).toBe('test-project');
      expect(config.maxTokens).toBe(8192);
      expect(config.aiTemperature).toBe(0.5);
    });

    it('should use default values for optional configuration', async () => {
      // Arrange - only required fields
      process.env.GITHUB_APP_ID = '123456';
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';

      // Act
      const { getConfig } = require('./loader');
      const config = await getConfig();

      // Assert defaults
      expect(config.anthropicModel).toBe('claude-3-opus-20240229');
      expect(config.maxTokens).toBe(4096);
      expect(config.aiTemperature).toBe(0.3);
      expect(config.maxRetries).toBe(3);
      expect(config.aiTimeoutMs).toBe(30000);
      expect(config.nodeEnv).toBe('test'); // Set by Jest
      expect(config.logLevel).toBe('info');
    });

    it('should cache configuration after first load', async () => {
      // Arrange
      process.env.GITHUB_APP_ID = '123456';
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';

      const { getConfig } = require('./loader');

      // Act
      const config1 = await getConfig();
      const config2 = await getConfig();

      // Assert
      expect(config1).toBe(config2); // Same object reference
    });

    it('should throw error for missing required configuration', async () => {
      // Arrange - missing GITHUB_APP_ID
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';

      // Act & Assert
      const { getConfig } = require('./loader');
      await expect(getConfig()).rejects.toThrow('Missing required configuration: githubAppId');
    });

    it('should throw error for invalid GitHub App ID', async () => {
      // Arrange
      process.env.GITHUB_APP_ID = '-1'; // Invalid (negative)
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';

      // Act & Assert
      const { getConfig } = require('./loader');
      await expect(getConfig()).rejects.toThrow('Invalid GitHub App ID');
    });

    it('should throw error for invalid max tokens', async () => {
      // Arrange
      process.env.GITHUB_APP_ID = '123456';
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.MAX_TOKENS = '250000'; // Too high

      // Act & Assert
      const { getConfig } = require('./loader');
      await expect(getConfig()).rejects.toThrow('Invalid max tokens configuration');
    });

    it('should throw error for invalid AI temperature', async () => {
      // Arrange
      process.env.GITHUB_APP_ID = '123456';
      process.env.GITHUB_PRIVATE_KEY = 'test-private-key';
      process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret';
      process.env.ANTHROPIC_API_KEY = 'test-api-key';
      process.env.GCP_PROJECT_ID = 'test-project';
      process.env.AI_TEMPERATURE = '1.5'; // Too high

      // Act & Assert
      const { getConfig } = require('./loader');
      await expect(getConfig()).rejects.toThrow('Invalid AI temperature');
    });

    it('should load secrets from Secret Manager in production', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      process.env.GITHUB_APP_ID = '123456';
      process.env.GCP_PROJECT_ID = 'test-project';
      // Explicitly delete secret env vars to trigger Secret Manager
      delete process.env.GITHUB_PRIVATE_KEY;
      delete process.env.GITHUB_WEBHOOK_SECRET;
      delete process.env.ANTHROPIC_API_KEY;

      // Clear module cache before setting up mocks
      jest.resetModules();

      // Set up the mock after resetting modules
      const mockAccessSecretVersion = jest.fn()
        .mockImplementation((params) => {
          if (params.name.includes('GITHUB_PRIVATE_KEY')) {
            return Promise.resolve([{ payload: { data: Buffer.from('prod-private-key') } }]);
          }
          if (params.name.includes('GITHUB_WEBHOOK_SECRET')) {
            return Promise.resolve([{ payload: { data: Buffer.from('prod-webhook-secret') } }]);
          }
          if (params.name.includes('ANTHROPIC_API_KEY')) {
            return Promise.resolve([{ payload: { data: Buffer.from('prod-api-key') } }]);
          }
          return Promise.reject(new Error('Secret not found'));
        });

      // Import and mock SecretManagerServiceClient
      const { SecretManagerServiceClient: MockedClient } = require('@google-cloud/secret-manager');
      MockedClient.mockImplementation(() => ({
        accessSecretVersion: mockAccessSecretVersion,
      }));

      // Act
      const { getConfig } = require('./loader');
      const config = await getConfig();

      // Assert
      expect(config.githubPrivateKey).toBe('prod-private-key');
      expect(config.githubWebhookSecret).toBe('prod-webhook-secret');
      expect(config.anthropicApiKey).toBe('prod-api-key');
      expect(mockAccessSecretVersion).toHaveBeenCalledTimes(3);
    });

    it('should handle Secret Manager errors gracefully', async () => {
      // Arrange
      process.env.NODE_ENV = 'production';
      process.env.GITHUB_APP_ID = '123456';
      process.env.GCP_PROJECT_ID = 'test-project';

      const mockAccessSecretVersion = jest.fn().mockRejectedValue(new Error('Secret not found'));

      (SecretManagerServiceClient as jest.MockedClass<typeof SecretManagerServiceClient>)
        .mockImplementation(() => ({
          accessSecretVersion: mockAccessSecretVersion,
        } as any));

      // Act & Assert
      const { getConfig } = require('./loader');
      await expect(getConfig()).rejects.toThrow('Missing required configuration');
    });
  });
});