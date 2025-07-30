import { App } from '@octokit/app';

export interface GitHubClientConfig {
  appId: number;
  privateKey: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  head: { sha: string };
  base: { sha: string };
  user: { login: string };
}

export interface File {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface Comment {
  path: string;
  line: number;
  body: string;
}

export class GitHubClient {
  private app: App;
  private octokit?: any; // Using any to avoid complex Octokit type issues

  constructor(config: GitHubClientConfig) {
    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
    });
  }

  /**
   * Authenticates with a specific installation
   * @param installationId - GitHub App installation ID
   */
  async authenticate(installationId: number): Promise<void> {
    try {
      this.octokit = await this.app.getInstallationOctokit(installationId);
    } catch (error) {
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetches pull request details
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pull_number - Pull request number
   * @returns Pull request data
   */
  async getPullRequest(owner: string, repo: string, pull_number: number): Promise<PullRequest> {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number,
    });

    return data as PullRequest;
  }

  /**
   * Fetches files changed in a pull request
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pull_number - Pull request number
   * @returns Array of changed files (JavaScript/TypeScript only)
   */
  async getFiles(owner: string, repo: string, pull_number: number): Promise<File[]> {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    const { data } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page: 100,
    });

    // Filter for JavaScript/TypeScript files
    return data.filter((file: any) => 
      /\.(js|jsx|ts|tsx)$/.test(file.filename)
    ) as File[];
  }

  /**
   * Fetches file content from repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param path - File path
   * @param ref - Git reference (branch, tag, or commit)
   * @returns File content as string or null if not found
   */
  async getFile(owner: string, repo: string, path: string, ref: string): Promise<string | null> {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      // Check if it's a file (not a directory)
      if ('type' in data && data.type === 'file' && 'content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Creates a review with comments on a pull request
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param pull_number - Pull request number
   * @param comments - Array of review comments
   */
  async createReview(owner: string, repo: string, pull_number: number, comments: Comment[]): Promise<void> {
    if (!this.octokit) {
      throw new Error('GitHub client not authenticated');
    }

    if (comments.length === 0) {
      return;
    }

    // GitHub API has a limit of 100 comments per review
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < comments.length; i += BATCH_SIZE) {
      batches.push(comments.slice(i, i + BATCH_SIZE));
    }

    for (const batch of batches) {
      await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number,
        event: 'COMMENT',
        comments: batch.map(comment => ({
          path: comment.path,
          line: comment.line,
          body: comment.body,
          side: 'RIGHT',
        })),
      });
    }
  }
}