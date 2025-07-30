import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import dotenv from 'dotenv';

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

export interface Config {
  // GitHub App Configuration
  githubAppId: number;
  githubPrivateKey: string;
  githubWebhookSecret: string;

  // Anthropic Configuration
  anthropicApiKey: string;
  anthropicModel: string;
  maxTokens: number;
  aiTemperature: number;
  maxRetries: number;
  aiTimeoutMs: number;

  // Application Configuration
  nodeEnv: string;
  logLevel: string;
  maxFilesPerPR: number;
  maxFileSizeBytes: number;
  rateLimitPerMinute: number;

  // Google Cloud Configuration
  gcpProjectId: string;
}

let cachedConfig: Config | null = null;

/**
 * Clears the cached configuration (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Gets the application configuration
 * @returns Configuration object
 */
export async function getConfig(): Promise<Config> {
  if (cachedConfig) {
    return cachedConfig;
  }

  const config: Config = {
    // GitHub App Configuration
    githubAppId: parseInt(process.env.GITHUB_APP_ID || '0', 10),
    githubPrivateKey: await getSecret('GITHUB_PRIVATE_KEY') || '',
    githubWebhookSecret: await getSecret('GITHUB_WEBHOOK_SECRET') || '',

    // Anthropic Configuration
    anthropicApiKey: await getSecret('ANTHROPIC_API_KEY') || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
    maxTokens: parseInt(process.env.MAX_TOKENS || '4096', 10),
    aiTemperature: parseFloat(process.env.AI_TEMPERATURE || '0.3'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    aiTimeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),

    // Application Configuration
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    maxFilesPerPR: parseInt(process.env.MAX_FILES_PER_PR || '50', 10),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '1048576', 10),
    rateLimitPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '5', 10),

    // Google Cloud Configuration
    gcpProjectId: process.env.GCP_PROJECT_ID || '',
  };

  validateConfig(config);
  cachedConfig = config;

  return config;
}

/**
 * Gets a secret from environment or Google Secret Manager
 * @param name - Secret name
 * @returns Secret value
 */
async function getSecret(name: string): Promise<string | undefined> {
  // First try environment variable
  const envValue = process.env[name];
  if (envValue) {
    return envValue;
  }

  // In production, try Secret Manager
  if (process.env.NODE_ENV === 'production' && process.env.GCP_PROJECT_ID) {
    try {
      const client = new SecretManagerServiceClient();
      const secretName = `projects/${process.env.GCP_PROJECT_ID}/secrets/${name}/versions/latest`;
      const [version] = await client.accessSecretVersion({ name: secretName });
      return version.payload?.data?.toString();
    } catch (error) {
      // Fall through to undefined
    }
  }

  return undefined;
}

/**
 * Validates the configuration
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config: Config): void {
  const requiredFields = [
    'githubAppId',
    'githubPrivateKey',
    'githubWebhookSecret',
    'anthropicApiKey',
    'gcpProjectId',
  ];

  for (const field of requiredFields) {
    if (!config[field as keyof Config]) {
      throw new Error(`Missing required configuration: ${field}`);
    }
  }

  if (config.githubAppId <= 0) {
    throw new Error('Invalid GitHub App ID');
  }

  if (config.maxTokens <= 0 || config.maxTokens > 200000) {
    throw new Error('Invalid max tokens configuration');
  }

  if (config.aiTemperature < 0 || config.aiTemperature > 1) {
    throw new Error('Invalid AI temperature (must be between 0 and 1)');
  }
}