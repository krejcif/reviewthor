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

describe('handlePullRequest', () => {
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

  describe('pull request processing', () => {
    it('should process a valid pull request', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: {
            number: 1,
            draft: false,
            body: 'Test PR description',
          },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      const mockFiles = [
        {
          filename: 'src/index.js',
          status: 'modified',
          changes: 50,
          additions: 30,
          deletions: 20,
          patch: '@@ -1,5 +1,10 @@\n...',
        },
        {
          filename: 'src/utils.ts',
          status: 'added',
          changes: 100,
          additions: 100,
          deletions: 0,
          patch: '@@ -0,0 +1,100 @@\n...',
        },
      ];

      mockGitHubClient.getFiles.mockResolvedValue(mockFiles);
      mockAIEngine.analyzeCode.mockResolvedValue({
        issues: [
          {
            file: 'src/index.js',
            line: 10,
            severity: 'warning',
            message: 'Consider using const',
            category: 'code-quality',
          },
        ],
        summary: 'Found 1 issue',
        stats: {
          total: 1,
          byCategory: { 'code-quality': 1 },
          bySeverity: { warning: 1 },
        },
      });
      mockAIEngine.generateComments.mockResolvedValue([
        {
          path: 'src/index.js',
          line: 10,
          body: '⚠️ Consider using const',
        },
      ]);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(mockGitHubClient.authenticate).toHaveBeenCalledWith(789);
      expect(mockGitHubClient.getFiles).toHaveBeenCalledWith('test-owner', 'test-repo', 1);
      expect(mockAIEngine.analyzeCode).toHaveBeenCalled();
      expect(mockAIEngine.generateComments).toHaveBeenCalled();
      expect(mockGitHubClient.createReview).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        [{ path: 'src/index.js', line: 10, body: '⚠️ Consider using const' }]
      );
    });

    it('should skip draft PRs', async () => {
      // Arrange
      const event: GitHubEvent = {
        type: 'pull_request.opened',
        payload: {
          action: 'opened',
          pull_request: {
            number: 1,
            draft: true,
            body: 'Draft PR',
          },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 789,
      };

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('Skipping draft PR', expect.any(Object));
      expect(mockGitHubClient.authenticate).not.toHaveBeenCalled();
    });

    it('should skip large files', async () => {
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

      const mockFiles = [
        {
          filename: 'src/huge.js',
          status: 'modified',
          changes: 2000000, // 2MB - too large
          additions: 1000000,
          deletions: 1000000,
          patch: 'huge diff',
        },
        {
          filename: 'src/small.js',
          status: 'modified',
          changes: 100,
          additions: 50,
          deletions: 50,
          patch: 'small diff',
        },
      ];

      mockGitHubClient.getFiles.mockResolvedValue(mockFiles);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(mockAIEngine.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'src/small.js' })
          ]),
        })
      );
      expect(mockAIEngine.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.not.arrayContaining([
            expect.objectContaining({ path: 'src/huge.js' })
          ]),
        })
      );
    });

    it('should respect ignore patterns', async () => {
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

      const mockFiles = [
        {
          filename: 'node_modules/package/index.js',
          status: 'modified',
          changes: 50,
          additions: 25,
          deletions: 25,
          patch: 'diff',
        },
        {
          filename: 'dist/bundle.js',
          status: 'modified',
          changes: 50,
          additions: 25,
          deletions: 25,
          patch: 'diff',
        },
        {
          filename: 'src/app.js',
          status: 'modified',
          changes: 50,
          additions: 25,
          deletions: 25,
          patch: 'diff',
        },
      ];

      mockGitHubClient.getFiles.mockResolvedValue(mockFiles);

      // Mock no AI issues
      mockAIEngine.analyzeCode.mockResolvedValue({
        issues: [],
        summary: 'No issues',
        stats: { total: 0, byCategory: {}, bySeverity: {} },
      });

      // Act
      await handlePullRequest(event, correlationId);

      // Assert - check that only src/app.js was analyzed
      expect(mockAIEngine.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({ path: 'src/app.js' })
          ]),
        })
      );
      // Ensure ignored files are not included
      const callArgs = mockAIEngine.analyzeCode.mock.calls[0][0];
      expect(callArgs.files).toHaveLength(1);
      expect(callArgs.files[0].path).toBe('src/app.js');
    });

    it('should apply custom instructions', async () => {
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
          patch: 'diff' 
        },
        { 
          filename: 'test/index.test.js', 
          status: 'modified',
          changes: 50, 
          additions: 25,
          deletions: 25,
          patch: 'diff' 
        },
      ]);

      mockInstructionProcessor.fetchCustomInstructions.mockResolvedValue({
        focusAreas: ['Performance'],
        customRules: ['No console.log'],
        ignorePatterns: ['test/**'],
        rawContent: 'test',
      });

      mockAIEngine.generateComments.mockResolvedValue([
        { path: 'src/index.js', line: 1, body: 'Comment 1' },
        { path: 'test/index.test.js', line: 1, body: 'Comment 2' },
      ]);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(mockGitHubClient.createReview).toHaveBeenCalledWith(
        'test-owner',
        'test-repo',
        1,
        [{ path: 'src/index.js', line: 1, body: 'Comment 1' }] // test file should be filtered out
      );
      
      // Verify custom instructions were fetched
      expect(mockInstructionProcessor.fetchCustomInstructions).toHaveBeenCalledWith(
        'test-owner',
        'test-repo'
      );
    });

    it('should handle no files to review', async () => {
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

      mockGitHubClient.getFiles.mockResolvedValue([]);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.info).toHaveBeenCalledWith('No files to review', { correlationId });
      expect(mockAIEngine.analyzeCode).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
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

      mockGitHubClient.authenticate.mockRejectedValue(new Error('Auth failed'));

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.error).toHaveBeenCalledWith(
        'Error processing pull request',
        expect.objectContaining({
          correlationId,
          error: 'Auth failed',
        })
      );
    });

    it('should limit number of files reviewed', async () => {
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

      // Create 60 files (more than the limit of 50)
      const mockFiles = Array.from({ length: 60 }, (_, i) => ({
        filename: `src/file${i}.js`,
        status: 'modified' as const,
        changes: 50,
        additions: 25,
        deletions: 25,
        patch: `diff ${i}`,
      }));

      mockGitHubClient.getFiles.mockResolvedValue(mockFiles);

      // Act
      await handlePullRequest(event, correlationId);

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'File limit exceeded, reviewing subset',
        expect.objectContaining({
          totalFiles: 60,
          reviewingFiles: 50,
        })
      );
      expect(mockAIEngine.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.any(Object),
          ]),
        })
      );
      const analyzedFiles = (mockAIEngine.analyzeCode.mock.calls[0][0] as any).files;
      expect(analyzedFiles).toHaveLength(50);
    });
  });
});