import { logger } from './logger';
import { Logging } from '@google-cloud/logging';

jest.mock('@google-cloud/logging');

describe('Logger', () => {
  let mockConsole: {
    log: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
  };
  let mockLog: any;
  let mockEntry: any;
  let mockLogging: any;

  beforeEach(() => {
    // Mock console methods
    mockConsole = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      warn: jest.spyOn(console, 'warn').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation(),
    };

    // Mock Google Cloud Logging
    mockEntry = { data: {} };
    mockLog = {
      entry: jest.fn().mockReturnValue(mockEntry),
      write: jest.fn().mockResolvedValue(undefined),
    };

    mockLogging = {
      log: jest.fn().mockReturnValue(mockLog),
    };
    
    (Logging as jest.MockedClass<typeof Logging>).mockImplementation(() => mockLogging);

    // Clear module cache to reset logger instance
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('development mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should log info messages to console', () => {
      // Arrange
      const { logger } = require('./logger');

      // Act
      logger.info('Test info message', { foo: 'bar' });

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"severity": "info"')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message": "Test info message"')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"foo": "bar"')
      );
    });

    it('should log warn messages to console', () => {
      // Arrange
      const { logger } = require('./logger');

      // Act
      logger.warn('Test warning', { level: 'high' });

      // Assert
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('"severity": "warning"')
      );
      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('"message": "Test warning"')
      );
    });

    it('should log error messages to console', () => {
      // Arrange
      const { logger } = require('./logger');

      // Act
      logger.error('Test error', { code: 'ERR001' });

      // Assert
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('"severity": "error"')
      );
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('"message": "Test error"')
      );
    });

    it('should log debug messages in development', () => {
      // Arrange
      const { logger } = require('./logger');

      // Act
      logger.debug('Debug info', { detailed: true });

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"severity": "debug"')
      );
    });
  });

  describe('production mode', () => {
    // Production mode tests moved to logger-prod.test.ts to properly handle module initialization
  });

  describe('log formatting', () => {
    it('should include timestamp in all logs', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const { logger } = require('./logger');

      // Act
      logger.info('Test message');

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"timestamp":')
      );
    });

    it('should handle undefined context', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const { logger } = require('./logger');

      // Act
      logger.info('Message without context');

      // Assert
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('"message": "Message without context"')
      );
    });

    it('should merge context with log entry', () => {
      // Arrange
      process.env.NODE_ENV = 'development';
      const { logger } = require('./logger');

      // Act
      logger.info('Test', { 
        userId: '123',
        action: 'test-action',
        nested: { value: 42 }
      });

      // Assert
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('"userId": "123"');
      expect(logCall).toContain('"action": "test-action"');
      expect(logCall).toContain('"value": 42');
    });
  });
});