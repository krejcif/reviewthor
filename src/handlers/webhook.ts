import crypto from 'crypto';

export interface GitHubEvent {
  type: 'pull_request.opened' | 'pull_request.synchronize' | 'pull_request.reopened' | 'pull_request_review.submitted';
  payload: any;
  repository: {
    name: string;
    owner: string;
  };
  installationId: number;
}

type EventHandler = (event: GitHubEvent) => Promise<void>;

export class WebhookHandler {
  private pullRequestHandler?: EventHandler;

  constructor(private readonly webhookSecret: string) {}

  /**
   * Validates GitHub webhook signature using constant-time comparison
   * @param payload - Raw request body as string
   * @param signature - GitHub signature header value
   * @returns true if signature is valid
   */
  validateSignature(payload: string, signature: string): boolean {
    if (!signature || !signature.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    // Check length first to avoid timing attack on length comparison
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  /**
   * Parses webhook payload into structured event
   * @param payload - Parsed JSON payload from GitHub
   * @returns Structured GitHub event
   * @throws Error if required fields are missing
   */
  parseEvent(payload: any): GitHubEvent {
    if (!payload.installation?.id) {
      throw new Error('Missing installation ID');
    }

    if (!payload.repository?.name || !payload.repository?.owner?.login) {
      throw new Error('Missing repository information');
    }

    const eventType = this.determineEventType(payload);
    
    return {
      type: eventType,
      payload,
      repository: {
        name: payload.repository.name,
        owner: payload.repository.owner.login,
      },
      installationId: payload.installation.id,
    };
  }

  /**
   * Routes event to appropriate handler
   * @param event - Parsed GitHub event
   */
  async routeEvent(event: GitHubEvent): Promise<void> {
    switch (event.type) {
      case 'pull_request.opened':
      case 'pull_request.synchronize':
      case 'pull_request.reopened':
        if (this.pullRequestHandler) {
          await this.pullRequestHandler(event);
        }
        break;
      // Other event types can be added here
      default:
        // Ignore unsupported events
        break;
    }
  }

  /**
   * Sets the handler for pull request events
   * @param handler - Function to handle pull request events
   */
  setPullRequestHandler(handler: EventHandler): void {
    this.pullRequestHandler = handler;
  }

  private determineEventType(payload: any): GitHubEvent['type'] {
    if (payload.pull_request && payload.action) {
      const action = payload.action as string;
      if (['opened', 'synchronize', 'reopened'].includes(action)) {
        return `pull_request.${action}` as GitHubEvent['type'];
      }
    }
    
    if (payload.review && payload.action === 'submitted') {
      return 'pull_request_review.submitted';
    }

    throw new Error(`Unsupported event type: ${payload.action || 'unknown'}`);
  }
}