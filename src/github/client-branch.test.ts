import { GitHubClient } from './client';
import { App } from '@octokit/app';

jest.mock('@octokit/app');

describe('GitHubClient - Branch Coverage', () => {
  let githubClient: GitHubClient;
  let mockApp: jest.Mocked<App>;
  let mockOctokit: any;

  beforeEach(() => {
    // Setup mock Octokit instance
    mockOctokit = {
      pulls: {
        get: jest.fn(),
        listFiles: jest.fn(),
        createReview: jest.fn(),
      },
      repos: {
        getContent: jest.fn(),
      },
    };

    // Setup mock App
    mockApp = {
      getInstallationOctokit: jest.fn().mockResolvedValue(mockOctokit),
    } as any;

    // Mock the App constructor
    (App as jest.MockedClass<typeof App>).mockImplementation(() => mockApp);

    githubClient = new GitHubClient({
      appId: 123456,
      privateKey: 'fake-private-key',
    });
  });

  describe('authenticate error handling', () => {
    it('should throw error with message when error is an Error instance', async () => {
      // Arrange
      const testError = new Error('Test authentication error');
      mockApp.getInstallationOctokit.mockRejectedValue(testError);

      // Act & Assert
      await expect(githubClient.authenticate(789)).rejects.toThrow('Authentication failed: Test authentication error');
    });

    it('should throw error with unknown message when error is not an Error instance', async () => {
      // Arrange
      mockApp.getInstallationOctokit.mockRejectedValue('String error');

      // Act & Assert
      await expect(githubClient.authenticate(789)).rejects.toThrow('Authentication failed: Unknown error');
    });
  });

  describe('getFile edge cases', () => {
    it('should return null when data is a directory', async () => {
      // Arrange
      await githubClient.authenticate(789);
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'dir', // directory, not file
          name: 'src',
        },
      });

      // Act
      const result = await githubClient.getFile('owner', 'repo', 'src', 'main');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when type is not file', async () => {
      // Arrange
      await githubClient.authenticate(789);
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'symlink',
          target: 'other-file',
        },
      });

      // Act
      const result = await githubClient.getFile('owner', 'repo', 'link', 'main');

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when content is missing', async () => {
      // Arrange
      await githubClient.authenticate(789);
      mockOctokit.repos.getContent.mockResolvedValue({
        data: {
          type: 'file',
          // missing content field
        },
      });

      // Act
      const result = await githubClient.getFile('owner', 'repo', 'file.txt', 'main');

      // Assert
      expect(result).toBeNull();
    });

    it('should throw error for non-404 errors', async () => {
      // Arrange
      await githubClient.authenticate(789);
      const error = new Error('API Error');
      (error as any).status = 500;
      mockOctokit.repos.getContent.mockRejectedValue(error);

      // Act & Assert
      await expect(githubClient.getFile('owner', 'repo', 'file.txt', 'main'))
        .rejects.toThrow('API Error');
    });

    it('should return null for any error without status', async () => {
      // Arrange
      await githubClient.authenticate(789);
      mockOctokit.repos.getContent.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(githubClient.getFile('owner', 'repo', 'file.txt', 'main'))
        .rejects.toThrow('Network error');
    });
  });

  describe('getFiles with non-JS/TS files', () => {
    it('should filter out all non-JS/TS files', async () => {
      // Arrange
      await githubClient.authenticate(789);
      const mockFiles = {
        data: [
          { filename: 'README.md', status: 'modified' },
          { filename: 'package.json', status: 'modified' },
          { filename: 'Dockerfile', status: 'added' },
          { filename: '.gitignore', status: 'modified' },
          { filename: 'styles.css', status: 'modified' },
          { filename: 'index.html', status: 'modified' },
        ],
      };

      mockOctokit.pulls.listFiles.mockResolvedValue(mockFiles);

      // Act
      const result = await githubClient.getFiles('owner', 'repo', 1);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle file extensions case-sensitively', async () => {
      // Arrange
      await githubClient.authenticate(789);
      const mockFiles = {
        data: [
          { filename: 'file.JS', status: 'modified' }, // uppercase
          { filename: 'file.Ts', status: 'modified' }, // mixed case
          { filename: 'file.JSX', status: 'modified' }, // uppercase
          { filename: 'file.TSX', status: 'modified' }, // uppercase
        ],
      };

      mockOctokit.pulls.listFiles.mockResolvedValue(mockFiles);

      // Act
      const result = await githubClient.getFiles('owner', 'repo', 1);

      // Assert
      expect(result).toEqual([]); // None should match due to case sensitivity
    });
  });

  describe('createReview with single batch', () => {
    it('should handle exactly 100 comments', async () => {
      // Arrange
      await githubClient.authenticate(789);
      const comments = Array.from({ length: 100 }, (_, i) => ({
        path: 'file.js',
        line: i + 1,
        body: `Comment ${i + 1}`,
      }));

      mockOctokit.pulls.createReview.mockResolvedValue({ data: { id: 123 } });

      // Act
      await githubClient.createReview('owner', 'repo', 1, comments);

      // Assert
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledTimes(1);
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 1,
        event: 'COMMENT',
        comments: expect.arrayContaining([
          expect.objectContaining({
            path: 'file.js',
            line: 1,
            body: 'Comment 1',
            side: 'RIGHT',
          }),
        ]),
      });
    });
  });
});