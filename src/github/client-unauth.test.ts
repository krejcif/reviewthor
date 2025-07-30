import { GitHubClient } from './client';
import { App } from '@octokit/app';

jest.mock('@octokit/app');

describe('GitHubClient - Unauthenticated Operations', () => {
  let githubClient: GitHubClient;
  let mockApp: jest.Mocked<App>;

  beforeEach(() => {
    // Setup mock App that will throw during authentication
    mockApp = {
      getInstallationOctokit: jest.fn().mockRejectedValue(new Error('Auth failed')),
    } as any;

    // Mock the App constructor
    (App as jest.MockedClass<typeof App>).mockImplementation(() => mockApp);

    githubClient = new GitHubClient({
      appId: 123456,
      privateKey: 'fake-private-key',
    });
  });

  describe('operations without authentication', () => {
    it('should throw error when calling getFiles without authentication', async () => {
      // Act & Assert
      await expect(githubClient.getFiles('owner', 'repo', 1))
        .rejects.toThrow('GitHub client not authenticated');
    });

    it('should throw error when calling getFile without authentication', async () => {
      // Act & Assert
      await expect(githubClient.getFile('owner', 'repo', 'path/to/file', 'main'))
        .rejects.toThrow('GitHub client not authenticated');
    });

    it('should throw error when calling createReview without authentication', async () => {
      // Act & Assert
      await expect(githubClient.createReview('owner', 'repo', 1, [
        { path: 'file.js', line: 1, body: 'Comment' }
      ])).rejects.toThrow('GitHub client not authenticated');
    });
  });
});