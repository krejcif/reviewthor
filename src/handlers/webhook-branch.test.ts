import { WebhookHandler } from './webhook';
import crypto from 'crypto';

describe('WebhookHandler - Branch Coverage', () => {
  let webhookHandler: WebhookHandler;
  const mockSecret = 'test-webhook-secret';

  beforeEach(() => {
    webhookHandler = new WebhookHandler(mockSecret);
  });

  describe('validateSignature edge cases', () => {
    it('should reject when signature is undefined', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = undefined as any;

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject when signature is null', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = null as any;

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject when buffers have different lengths', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=short';

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('parseEvent edge cases', () => {
    it('should throw error when repository name is missing', () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: { id: 123 },
        repository: {
          owner: { login: 'test-owner' },
          // missing name
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Missing repository information');
    });

    it('should throw error when repository owner is missing', () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          // missing owner
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Missing repository information');
    });

    it('should throw error when repository owner login is missing', () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          owner: {}, // missing login
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Missing repository information');
    });

    it('should throw error for unsupported event type', () => {
      // Arrange
      const payload = {
        action: 'created',
        issue: { id: 123 }, // not a pull request
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' },
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Unsupported event type');
    });

    it('should throw error for unsupported pull request action', () => {
      // Arrange
      const payload = {
        action: 'locked', // unsupported action
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' },
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Unsupported event type');
    });

    it('should throw error when action is missing', () => {
      // Arrange
      const payload = {
        // missing action
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' },
        },
        installation: { id: 456 },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Unsupported event type');
    });

    it('should parse pull_request_review.submitted event', () => {
      // Arrange
      const payload = {
        action: 'submitted',
        review: { id: 789 },
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' },
        },
        installation: { id: 456 },
      };

      // Act
      const event = webhookHandler.parseEvent(payload);

      // Assert
      expect(event.type).toBe('pull_request_review.submitted');
    });

    it('should parse pull_request.reopened event', () => {
      // Arrange
      const payload = {
        action: 'reopened',
        pull_request: { id: 123 },
        repository: {
          name: 'test-repo',
          owner: { login: 'test-owner' },
        },
        installation: { id: 456 },
      };

      // Act
      const event = webhookHandler.parseEvent(payload);

      // Assert
      expect(event.type).toBe('pull_request.reopened');
    });
  });

  describe('routeEvent edge cases', () => {
    it('should handle pull_request_review.submitted event', async () => {
      // Arrange
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      // Note: pull_request_review events are not handled yet
      webhookHandler.setPullRequestHandler(mockHandler);
      
      const event = {
        type: 'pull_request_review.submitted' as const,
        payload: {
          action: 'submitted',
          review: { id: 789 },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 456,
      };

      // Act
      await webhookHandler.routeEvent(event);

      // Assert
      // Should not call handler for review events (not implemented)
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle when no handler is set', async () => {
      // Arrange - don't set any handler
      const event = {
        type: 'pull_request.opened' as const,
        payload: {
          action: 'opened',
          pull_request: { number: 1 },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 456,
      };

      // Act - should not throw
      await expect(webhookHandler.routeEvent(event)).resolves.toBeUndefined();
    });

    it('should handle pull_request.reopened event', async () => {
      // Arrange
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      webhookHandler.setPullRequestHandler(mockHandler);
      
      const event = {
        type: 'pull_request.reopened' as const,
        payload: {
          action: 'reopened',
          pull_request: { number: 1 },
        },
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 456,
      };

      // Act
      await webhookHandler.routeEvent(event);

      // Assert
      expect(mockHandler).toHaveBeenCalledWith(event);
    });
  });
});