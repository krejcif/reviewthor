import { reviewthor } from './index';
import { Request, Response } from '@google-cloud/functions-framework';
import { WebhookHandler } from './handlers/webhook';
import { GitHubClient } from './github/client';
import { AIReviewEngine } from './ai/engine';
import { handlePullRequest } from './handlers/events/pull-request';

// Mock all dependencies
jest.mock('./handlers/webhook');
jest.mock('./github/client');
jest.mock('./ai/engine');
jest.mock('./handlers/events/pull-request');
jest.mock('./utils/logger');
jest.mock('./config/loader', () => ({
  getConfig: jest.fn().mockResolvedValue({
    githubWebhookSecret: 'test-secret',
    githubAppId: 123456,
    githubPrivateKey: 'test-private-key',
    anthropicApiKey: 'test-api-key',
    gcpProjectId: 'test-project',
  }),
}));

describe('reviewthor cloud function', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockWebhookHandler: jest.Mocked<WebhookHandler>;

  beforeEach(() => {
    // Setup mock request
    const requestBody = {
      action: 'opened',
      pull_request: {
        number: 1,
        head: { ref: 'feature-branch' },
        base: { ref: 'main' },
      },
      repository: {
        name: 'test-repo',
        owner: { login: 'test-owner' },
      },
      installation: { id: 123 },
    };

    mockRequest = {
      body: requestBody,
      headers: {
        'x-hub-signature-256': 'sha256=test-signature',
        'x-github-event': 'pull_request',
      },
      rawBody: Buffer.from(JSON.stringify(requestBody)),
    };

    // Setup mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Setup webhook handler mock
    mockWebhookHandler = {
      validateSignature: jest.fn().mockReturnValue(true),
      parseEvent: jest.fn().mockReturnValue({
        type: 'pull_request.opened',
        payload: mockRequest.body,
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 123,
      }),
      routeEvent: jest.fn().mockResolvedValue(undefined),
      setPullRequestHandler: jest.fn(),
    } as any;

    // Mock the WebhookHandler constructor
    (WebhookHandler as jest.MockedClass<typeof WebhookHandler>).mockImplementation(() => mockWebhookHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle valid pull request webhook', async () => {
    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockWebhookHandler.validateSignature).toHaveBeenCalledWith(
      expect.any(String),
      'sha256=test-signature'
    );
    expect(mockWebhookHandler.parseEvent).toHaveBeenCalledWith(mockRequest.body);
    expect(mockWebhookHandler.routeEvent).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.send).toHaveBeenCalledWith('OK');
  });

  it('should reject invalid signature', async () => {
    // Arrange
    mockWebhookHandler.validateSignature.mockReturnValue(false);

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.send).toHaveBeenCalledWith('Invalid signature');
    expect(mockWebhookHandler.routeEvent).not.toHaveBeenCalled();
  });

  it('should handle missing signature header', async () => {
    // Arrange
    mockRequest.headers = { 'x-github-event': 'pull_request' };

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.send).toHaveBeenCalledWith('Invalid signature');
  });

  it('should handle missing event header', async () => {
    // Arrange
    mockRequest.headers = { 'x-hub-signature-256': 'sha256=test' };

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith('Missing event type');
  });

  it('should ignore non-pull request events', async () => {
    // Arrange
    mockRequest.headers!['x-github-event'] = 'push';

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.send).toHaveBeenCalledWith('Event ignored');
    expect(mockWebhookHandler.routeEvent).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    // Arrange
    mockWebhookHandler.parseEvent.mockImplementation(() => {
      throw new Error('Parse error');
    });

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.send).toHaveBeenCalledWith('Internal server error');
  });

  it('should handle missing request body', async () => {
    // Arrange
    mockRequest.body = undefined;
    mockRequest.rawBody = undefined;

    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.send).toHaveBeenCalledWith('Missing request body');
  });

  it('should setup pull request handler correctly', async () => {
    // Act
    await reviewthor(mockRequest as Request, mockResponse as Response);

    // Assert
    expect(mockWebhookHandler.setPullRequestHandler).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });
});