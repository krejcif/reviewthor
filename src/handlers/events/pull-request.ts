import { GitHubEvent } from '../webhook';
import { GitHubClient } from '../../github/client';
import { AIReviewEngine } from '../../ai/engine';
import { AnthropicClient } from '../../ai/anthropic-client';
import { PromptManager } from '../../ai/prompt-manager';
import { ContextBuilder } from '../../ai/context-builder';
import { InstructionProcessor } from '../../ai/instruction-processor';
import { logger } from '../../utils/logger';
import { getConfig } from '../../config/loader';
import { defaultConfig } from '../../config/default';

/**
 * Handles pull request events
 * @param event - GitHub webhook event
 * @param correlationId - Request correlation ID for tracking
 */
export async function handlePullRequest(event: GitHubEvent, correlationId: string): Promise<void> {
  const startTime = Date.now();
  const { repository, installationId, payload } = event;
  const pullRequest = payload.pull_request;

  logger.info('Processing pull request', {
    correlationId,
    event: event.type,
    repository: `${repository.owner}/${repository.name}`,
    pr: pullRequest.number,
    action: payload.action,
  });

  try {
    // Skip draft PRs unless configured otherwise
    if (pullRequest.draft) {
      logger.info('Skipping draft PR', { correlationId, pr: pullRequest.number });
      return;
    }

    // Initialize services
    const config = await getConfig();
    const githubClient = new GitHubClient({
      appId: config.githubAppId,
      privateKey: config.githubPrivateKey,
    });

    // Authenticate with GitHub
    await githubClient.authenticate(installationId);

    // Get PR files
    const files = await githubClient.getFiles(repository.owner, repository.name, pullRequest.number);
    
    // Filter files based on configuration
    const filesToReview = files.filter(file => {
      // Check file size
      if (file.changes > defaultConfig.maxFileSize) {
        logger.info('Skipping large file', { 
          correlationId, 
          file: file.filename,
          size: file.changes,
        });
        return false;
      }

      // Check if file should be ignored
      const shouldIgnore = defaultConfig.ignoredPaths.some(pattern => 
        matchesPattern(file.filename, pattern)
      );
      
      if (shouldIgnore) {
        logger.debug('Ignoring file based on pattern', { 
          correlationId, 
          file: file.filename,
        });
        return false;
      }

      return true;
    });

    if (filesToReview.length === 0) {
      logger.info('No files to review', { correlationId });
      return;
    }

    // Limit number of files
    const limitedFiles = filesToReview.slice(0, defaultConfig.maxFilesPerReview);
    if (limitedFiles.length < filesToReview.length) {
      logger.warn('File limit exceeded, reviewing subset', {
        correlationId,
        totalFiles: filesToReview.length,
        reviewingFiles: limitedFiles.length,
      });
    }

    // Initialize AI components
    const anthropicClient = new AnthropicClient({
      apiKey: config.anthropicApiKey,
      model: config.anthropicModel,
      maxRetries: config.maxRetries,
      timeout: config.aiTimeoutMs,
    });

    const promptManager = new PromptManager();
    const contextBuilder = new ContextBuilder();
    const instructionProcessor = new InstructionProcessor(githubClient);

    const aiEngine = new AIReviewEngine(
      anthropicClient,
      promptManager,
      contextBuilder
    );

    // Fetch custom instructions if available
    const customInstructions = await instructionProcessor.fetchCustomInstructions(
      repository.owner,
      repository.name
    );

    if (customInstructions) {
      logger.info('Found custom instructions', { 
        correlationId,
        focusAreas: customInstructions.focusAreas.length,
        customRules: customInstructions.customRules.length,
      });
    }

    // Prepare context for AI review
    const reviewContext = {
      files: limitedFiles.map(file => ({
        path: file.filename,
        content: '', // We'll use diff only for now
        diff: file.patch || '',
      })),
      prDescription: pullRequest.body || '',
      repository: `${repository.owner}/${repository.name}`,
    };

    // Perform AI analysis
    logger.info('Starting AI analysis', { 
      correlationId,
      filesCount: limitedFiles.length,
    });

    const analysis = await aiEngine.analyzeCode(reviewContext);

    logger.info('AI analysis complete', {
      correlationId,
      issuesFound: analysis.issues.length,
      stats: analysis.stats,
    });

    // Generate comments
    const comments = await aiEngine.generateComments(analysis);

    // Apply custom instruction filters if available
    let filteredComments = comments;
    if (customInstructions?.ignorePatterns) {
      filteredComments = comments.filter(comment => {
        const shouldIgnore = customInstructions.ignorePatterns.some(pattern =>
          matchesPattern(comment.path, pattern)
        );
        return !shouldIgnore;
      });
    }

    // Limit number of comments
    const finalComments = filteredComments.slice(0, defaultConfig.maxCommentsPerPR);

    if (finalComments.length > 0) {
      logger.info('Posting review comments', {
        correlationId,
        commentsCount: finalComments.length,
      });

      // Post review comments
      await githubClient.createReview(
        repository.owner,
        repository.name,
        pullRequest.number,
        finalComments
      );
    } else {
      logger.info('No comments to post', { correlationId });
    }

    const duration = Date.now() - startTime;
    logger.info('Pull request processing complete', {
      correlationId,
      duration,
      commentsPosted: finalComments.length,
    });

  } catch (error) {
    logger.error('Error processing pull request', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    // Don't throw - we've logged the error and don't want to retry
  }
}

/**
 * Simple glob pattern matching
 * @param path - File path to test
 * @param pattern - Glob pattern
 * @returns true if path matches pattern
 */
function matchesPattern(path: string, pattern: string): boolean {
  // Handle ** at the end specially
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3); // Remove /**
    return path.startsWith(base + '/') || path === base;
  }
  
  // Convert glob pattern to regex
  let regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*\*/g, '___DOUBLE_STAR___') // Temporarily replace **
    .replace(/\*/g, '[^/]*') // * matches any characters except /
    .replace(/___DOUBLE_STAR___/g, '.*') // ** matches any number of directories
    .replace(/\?/g, '.'); // ? matches single character
  
  return new RegExp(`^${regex}$`).test(path);
}