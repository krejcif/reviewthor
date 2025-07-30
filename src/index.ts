import { HttpFunction } from '@google-cloud/functions-framework';
import { Request, Response } from '@google-cloud/functions-framework';
import { WebhookHandler } from './handlers/webhook';
import { handlePullRequest } from './handlers/events/pull-request';
import { logger } from './utils/logger';
import { getConfig } from './config/loader';

/**
 * Main Cloud Function entry point for ReviewThor
 * Handles GitHub webhook events
 */
export const reviewthor: HttpFunction = async (req: Request, res: Response) => {
  const correlationId = req.headers['x-github-delivery'] as string || generateCorrelationId();
  
  logger.info('Webhook received', {
    correlationId,
    event: req.headers['x-github-event'],
    action: req.body?.action,
  });

  try {
    // Validate request has required data
    if (!req.body || !req.rawBody) {
      logger.warn('Missing request body', { correlationId });
      res.status(400).send('Missing request body');
      return;
    }

    // Get signature from headers
    const signature = req.headers['x-hub-signature-256'] as string;
    if (!signature) {
      logger.warn('Missing signature header', { correlationId });
      res.status(401).send('Invalid signature');
      return;
    }

    // Get event type
    const eventType = req.headers['x-github-event'] as string;
    if (!eventType) {
      logger.warn('Missing event type header', { correlationId });
      res.status(400).send('Missing event type');
      return;
    }

    // Only process pull request events
    if (eventType !== 'pull_request' && eventType !== 'pull_request_review') {
      logger.info('Ignoring non-pull request event', { correlationId, eventType });
      res.status(200).send('Event ignored');
      return;
    }

    // Initialize webhook handler
    const config = await getConfig();
    const webhookHandler = new WebhookHandler(config.githubWebhookSecret);

    // Validate signature
    const rawBody = req.rawBody.toString('utf8');
    if (!webhookHandler.validateSignature(rawBody, signature)) {
      logger.warn('Invalid webhook signature', { correlationId });
      res.status(401).send('Invalid signature');
      return;
    }

    // Parse and route event
    const event = webhookHandler.parseEvent(req.body);
    
    // Set up the pull request handler
    webhookHandler.setPullRequestHandler(async (evt) => {
      await handlePullRequest(evt, correlationId);
    });

    // Route the event
    await webhookHandler.routeEvent(event);

    logger.info('Webhook processed successfully', { 
      correlationId,
      eventType: event.type,
      repository: `${event.repository.owner}/${event.repository.name}`,
    });

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error processing webhook', { 
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    res.status(500).send('Internal server error');
  }
};

/**
 * Generates a correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Export the function for Google Cloud Functions
export { reviewthor as http };