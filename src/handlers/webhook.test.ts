import { WebhookHandler } from './webhook';
import crypto from 'crypto';

describe('WebhookHandler', () => {
  let webhookHandler: WebhookHandler;
  const mockSecret = 'test-webhook-secret';

  beforeEach(() => {
    webhookHandler = new WebhookHandler(mockSecret);
  });

  describe('validateSignature', () => {
    it('should validate a correct signature', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=' + crypto
        .createHmac('sha256', mockSecret)
        .update(payload)
        .digest('hex');

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(true);
    });

    it('should reject an incorrect signature', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=invalid_signature';

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject a signature with wrong algorithm', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha1=' + crypto
        .createHmac('sha1', mockSecret)
        .update(payload)
        .digest('hex');

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });

    it('should reject an empty signature', () => {
      // Arrange
      const payload = JSON.stringify({ test: 'data' });
      const signature = '';

      // Act
      const result = webhookHandler.validateSignature(payload, signature);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('parseEvent', () => {
    it('should parse a pull_request opened event', () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: {
          id: 123,
          number: 1,
          state: 'open',
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'test-owner',
          },
        },
        installation: {
          id: 456,
        },
      };

      // Act
      const event = webhookHandler.parseEvent(payload);

      // Assert
      expect(event.type).toBe('pull_request.opened');
      expect(event.payload).toEqual(payload);
      expect(event.repository.name).toBe('test-repo');
      expect(event.repository.owner).toBe('test-owner');
      expect(event.installationId).toBe(456);
    });

    it('should parse a pull_request synchronize event', () => {
      // Arrange
      const payload = {
        action: 'synchronize',
        pull_request: {
          id: 123,
          number: 1,
          state: 'open',
        },
        repository: {
          name: 'test-repo',
          owner: {
            login: 'test-owner',
          },
        },
        installation: {
          id: 456,
        },
      };

      // Act
      const event = webhookHandler.parseEvent(payload);

      // Assert
      expect(event.type).toBe('pull_request.synchronize');
    });

    it('should throw error for missing installation', () => {
      // Arrange
      const payload = {
        action: 'opened',
        pull_request: {},
        repository: {
          name: 'test-repo',
          owner: {
            login: 'test-owner',
          },
        },
      };

      // Act & Assert
      expect(() => webhookHandler.parseEvent(payload)).toThrow('Missing installation ID');
    });
  });

  describe('routeEvent', () => {
    it('should handle pull_request.opened event', async () => {
      // Arrange
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      webhookHandler.setPullRequestHandler(mockHandler);
      
      const event = {
        type: 'pull_request.opened' as const,
        payload: {
          action: 'opened',
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

    it('should handle pull_request.synchronize event', async () => {
      // Arrange
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      webhookHandler.setPullRequestHandler(mockHandler);
      
      const event = {
        type: 'pull_request.synchronize' as const,
        payload: {
          action: 'synchronize',
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

    it('should ignore unsupported events', async () => {
      // Arrange
      const mockHandler = jest.fn();
      webhookHandler.setPullRequestHandler(mockHandler);
      
      const event = {
        type: 'issues.opened' as const,
        payload: {},
        repository: { name: 'test-repo', owner: 'test-owner' },
        installationId: 456,
      };

      // Act
      await webhookHandler.routeEvent(event as any);

      // Assert
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});