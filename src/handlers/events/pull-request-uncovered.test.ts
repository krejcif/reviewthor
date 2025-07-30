import { handlePullRequest } from './pull-request';
import { GitHubEvent } from '../webhook';
import { GitHubClient } from '../../github/client';
import { AIReviewEngine } from '../../ai/engine';
import { AnthropicClient } from '../../ai/anthropic-client';
import { PromptManager } from '../../ai/prompt-manager';
import { ContextBuilder } from '../../ai/context-builder';
import { InstructionProcessor } from '../../ai/instruction-processor';
import { logger } from '../../utils/logger';
import { getConfig } from '../../config/loader';

// Mock all dependencies
jest.mock('../../github/client');
jest.mock('../../ai/engine');
jest.mock('../../ai/anthropic-client');
jest.mock('../../ai/prompt-manager');
jest.mock('../../ai/context-builder');
jest.mock('../../ai/instruction-processor');
jest.mock('../../utils/logger');
jest.mock('../../config/loader');

describe('handlePullRequest - Uncovered Lines', () => {
  let mockGitHubClient: jest.Mocked<GitHubClient>;
  let mockAIEngine: jest.Mocked<AIReviewEngine>;
  let mockInstructionProcessor: jest.Mocked<InstructionProcessor>;
  const correlationId = 'test-correlation-id';

  beforeEach(() => {
    // Setup mocks
    mockGitHubClient = {
      authenticate: jest.fn().mockResolvedValue(undefined),
      getFiles: jest.fn().mockResolvedValue([]),
      getFile: jest.fn().mockResolvedValue(null),
      createReview: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockAIEngine = {
      analyzeCode: jest.fn().mockResolvedValue({
        issues: [],
        summary: 'No issues found',
        stats: { total: 0, byCategory: {}, bySeverity: {} },
      }),
      generateComments: jest.fn().mockResolvedValue([]),
    } as any;

    mockInstructionProcessor = {
      fetchCustomInstructions: jest.fn().mockResolvedValue(null),
    } as any;

    // Mock constructors
    (GitHubClient as jest.MockedClass<typeof GitHubClient>).mockImplementation(() => mockGitHubClient);
    (AIReviewEngine as jest.MockedClass<typeof AIReviewEngine>).mockImplementation(() => mockAIEngine);
    (InstructionProcessor as jest.MockedClass<typeof InstructionProcessor>).mockImplementation(() => mockInstructionProcessor);

    // Mock config
    (getConfig as jest.Mock).mockResolvedValue({
      githubAppId: 123456,
      githubPrivateKey: 'test-key',
      anthropicApiKey: 'test-api-key',
      anthropicModel: 'claude-3-opus',
      maxRetries: 3,
      aiTimeoutMs: 30000,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('file.patch undefined handling', () => {
    it('should use empty string when file.patch is undefined', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: { number: 1, draft: false },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      mockGitHubClient.getFiles.mockResolvedValue([
        {
          filename: 'src/index.js',
          status: 'modified',
          changes: 50,
          additions: 25,
          deletions: 25,
          // patch is undefined
        },
      ]);

      mockAIEngine.generateComments.mockResolvedValue([]);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(mockAIEngine.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          files: [
            expect.objectContaining({
              path: 'src/index.js',
              content: '',
              diff: '', // Should use empty string when patch is undefined
            }),
          ],
        })
      );
    });
  });

  describe('error handling with non-Error objects', () => {
    it('should handle string errors', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: { number: 1, draft: false },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      // Make authenticate throw a string error
      mockGitHubClient.authenticate.mockRejectedValue('String error');

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing pull request',
        expect.objectContaining({
          correlationId,
          error: 'Unknown error',
          stack: undefined,
        })
      );
    });

    it('should handle object errors', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: { number: 1, draft: false },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      // Make authenticate throw an object error
      mockGitHubClient.authenticate.mockRejectedValue({ code: 'ERROR_CODE', message: 'Custom error' });

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing pull request',
        expect.objectContaining({
          correlationId,
          error: 'Unknown error',
          stack: undefined,
        })
      );
    });

    it('should handle null errors', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: { number: 1, draft: false },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      // Make authenticate throw null
      mockGitHubClient.authenticate.mockRejectedValue(null);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing pull request',
        expect.objectContaining({
          correlationId,
          error: 'Unknown error',
          stack: undefined,
        })
      );
    });

    it('should handle Error instances normally', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: { number: 1, draft: false },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      const testError = new Error('Test error message');
      mockGitHubClient.authenticate.mockRejectedValue(testError);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing pull request',
        expect.objectContaining({
          correlationId,
          error: 'Test error message',
          stack: testError.stack,
        })
      );
    });
  });
});