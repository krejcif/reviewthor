import { GitHubClient } from './client';
import { App } from '@octokit/app';

jest.mock('@octokit/app');

describe('GitHubClient', () => {
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('authenticate', () => {
    it('should authenticate with installation ID', async () => {
      // Arrange
      const installationId = 789;

      // Act
      await githubClient.authenticate(installationId);

      // Assert
      expect(mockApp.getInstallationOctokit).toHaveBeenCalledWith(installationId);
    });

    it('should throw error if authentication fails', async () => {
      // Arrange
      const installationId = 789;
      mockApp.getInstallationOctokit.mockRejectedValue(new Error('Authentication failed'));

      // Act & Assert
      await expect(githubClient.authenticate(installationId)).rejects.toThrow('Authentication failed');
    });
  });

  describe('getPullRequest', () => {
    it('should fetch pull request details', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const mockPR = {
        data: {
          number: 1,
          title: 'Test PR',
          state: 'open',
          head: { sha: 'abc123' },
          base: { sha: 'def456' },
          user: { login: 'test-user' },
        },
      };

      mockOctokit.pulls.get.mockResolvedValue(mockPR as any);
      await githubClient.authenticate(789);

      // Act
      const result = await githubClient.getPullRequest(owner, repo, pull_number);

      // Assert
      expect(mockOctokit.pulls.get).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number,
      });
      expect(result).toEqual(mockPR.data);
    });

    it('should throw error if not authenticated', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;

      // Act & Assert
      await expect(githubClient.getPullRequest(owner, repo, pull_number))
        .rejects.toThrow('GitHub client not authenticated');
    });
  });

  describe('getFiles', () => {
    it('should fetch files changed in PR', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const mockFiles = {
        data: [
          {
            filename: 'src/index.js',
            status: 'modified',
            additions: 10,
            deletions: 5,
            changes: 15,
            patch: '@@ -1,5 +1,10 @@\n...',
          },
          {
            filename: 'src/utils.js',
            status: 'added',
            additions: 20,
            deletions: 0,
            changes: 20,
            patch: '@@ -0,0 +1,20 @@\n...',
          },
        ],
      };

      mockOctokit.pulls.listFiles.mockResolvedValue(mockFiles as any);
      await githubClient.authenticate(789);

      // Act
      const result = await githubClient.getFiles(owner, repo, pull_number);

      // Assert
      expect(mockOctokit.pulls.listFiles).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number,
        per_page: 100,
      });
      expect(result).toEqual(mockFiles.data);
    });

    it('should filter only JavaScript/TypeScript files', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const mockFiles = {
        data: [
          { filename: 'src/index.js', status: 'modified' },
          { filename: 'src/app.tsx', status: 'modified' },
          { filename: 'src/utils.ts', status: 'added' },
          { filename: 'README.md', status: 'modified' },
          { filename: 'package.json', status: 'modified' },
          { filename: 'src/test.jsx', status: 'added' },
        ],
      };

      mockOctokit.pulls.listFiles.mockResolvedValue(mockFiles as any);
      await githubClient.authenticate(789);

      // Act
      const result = await githubClient.getFiles(owner, repo, pull_number);

      // Assert
      const filteredFiles = result.filter(f => 
        /\.(js|jsx|ts|tsx)$/.test(f.filename)
      );
      expect(filteredFiles).toHaveLength(4);
      expect(filteredFiles.map(f => f.filename)).toEqual([
        'src/index.js',
        'src/app.tsx',
        'src/utils.ts',
        'src/test.jsx',
      ]);
    });
  });

  describe('getFile', () => {
    it('should fetch file content', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const path = '.reviewthor.md';
      const ref = 'main';
      const mockContent = {
        data: {
          type: 'file',
          content: Buffer.from('# ReviewThor Instructions\n\nFocus on performance').toString('base64'),
          encoding: 'base64',
        },
      };

      mockOctokit.repos.getContent.mockResolvedValue(mockContent as any);
      await githubClient.authenticate(789);

      // Act
      const result = await githubClient.getFile(owner, repo, path, ref);

      // Assert
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner,
        repo,
        path,
        ref,
      });
      expect(result).toBe('# ReviewThor Instructions\n\nFocus on performance');
    });

    it('should return null for non-existent file', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const path = '.reviewthor.md';
      const ref = 'main';

      mockOctokit.repos.getContent.mockRejectedValue({ status: 404 });
      await githubClient.authenticate(789);

      // Act
      const result = await githubClient.getFile(owner, repo, path, ref);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('createReview', () => {
    it('should create a PR review with comments', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const comments = [
        {
          path: 'src/index.js',
          line: 10,
          body: 'Consider using const instead of let',
        },
        {
          path: 'src/utils.js',
          line: 5,
          body: 'This function could be simplified',
        },
      ];

      mockOctokit.pulls.createReview.mockResolvedValue({ data: { id: 123 } } as any);
      await githubClient.authenticate(789);

      // Act
      await githubClient.createReview(owner, repo, pull_number, comments);

      // Assert
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith({
        owner,
        repo,
        pull_number,
        event: 'COMMENT',
        comments: comments.map(c => ({
          path: c.path,
          line: c.line,
          body: c.body,
          side: 'RIGHT',
        })),
      });
    });

    it('should handle empty comments array', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const comments: any[] = [];

      await githubClient.authenticate(789);

      // Act
      await githubClient.createReview(owner, repo, pull_number, comments);

      // Assert
      expect(mockOctokit.pulls.createReview).not.toHaveBeenCalled();
    });

    it('should batch large number of comments', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const pull_number = 1;
      const comments = Array.from({ length: 150 }, (_, i) => ({
        path: 'src/index.js',
        line: i + 1,
        body: `Comment ${i + 1}`,
      }));

      mockOctokit.pulls.createReview.mockResolvedValue({ data: { id: 123 } } as any);
      await githubClient.authenticate(789);

      // Act
      await githubClient.createReview(owner, repo, pull_number, comments);

      // Assert
      // Should be called twice (100 + 50 comments)
      expect(mockOctokit.pulls.createReview).toHaveBeenCalledTimes(2);
      expect(mockOctokit.pulls.createReview).toHaveBeenNthCalledWith(1, {
        owner,
        repo,
        pull_number,
        event: 'COMMENT',
        comments: expect.arrayContaining([
          expect.objectContaining({ body: 'Comment 1' }),
        ]),
      });
    });
  });
});