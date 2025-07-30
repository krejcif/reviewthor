import { InstructionProcessor } from './instruction-processor';
import { GitHubClient } from '../github/client';

jest.mock('../github/client');

describe('InstructionProcessor', () => {
  let processor: InstructionProcessor;
  let mockGitHubClient: jest.Mocked<GitHubClient>;

  beforeEach(() => {
    mockGitHubClient = new GitHubClient({ appId: 123, privateKey: 'test' }) as jest.Mocked<GitHubClient>;
    processor = new InstructionProcessor(mockGitHubClient);
  });

  describe('fetchCustomInstructions', () => {
    it('should fetch and parse .reviewthor.md from repository', async () => {
      // Arrange
      const owner = 'test-owner';
      const repo = 'test-repo';
      const mockContent = `# ReviewThor Custom Instructions

## Focus Areas
- Performance optimization
- Security vulnerabilities  
- TypeScript best practices

## Custom Rules
- Enforce functional components in React
- Require explicit return types
- Check for proper error handling

## Ignore Patterns
- test/**
- *.spec.js
- build/**
`;

      mockGitHubClient.getFile.mockResolvedValue(mockContent);

      // Act
      const result = await processor.fetchCustomInstructions(owner, repo);

      // Assert
      expect(mockGitHubClient.getFile).toHaveBeenCalledWith(
        owner,
        repo,
        '.reviewthor.md',
        'HEAD'
      );
      expect(result).not.toBeNull();
      expect(result?.focusAreas).toEqual([
        'Performance optimization',
        'Security vulnerabilities',
        'TypeScript best practices',
      ]);
      expect(result?.customRules).toEqual([
        'Enforce functional components in React',
        'Require explicit return types',
        'Check for proper error handling',
      ]);
      expect(result?.ignorePatterns).toEqual(['test/**', '*.spec.js', 'build/**']);
    });

    it('should return null if .reviewthor.md does not exist', async () => {
      // Arrange
      mockGitHubClient.getFile.mockResolvedValue(null);

      // Act
      const result = await processor.fetchCustomInstructions('owner', 'repo');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle malformed .reviewthor.md gracefully', async () => {
      // Arrange
      const mockContent = `This is not a valid format`;
      mockGitHubClient.getFile.mockResolvedValue(mockContent);

      // Act
      const result = await processor.fetchCustomInstructions('owner', 'repo');

      // Assert
      expect(result).toEqual({
        focusAreas: [],
        customRules: [],
        ignorePatterns: [],
        rawContent: mockContent,
      });
    });
  });

  describe('parseInstructionFile', () => {
    it('should parse all sections correctly', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
- Performance
- Security

## Custom Rules
- Use const
- No console.log

## Ignore Patterns
- dist/**
- node_modules/**

## Additional Notes
Some extra information here.
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Performance', 'Security']);
      expect(result.customRules).toEqual(['Use const', 'No console.log']);
      expect(result.ignorePatterns).toEqual(['dist/**', 'node_modules/**']);
      expect(result.rawContent).toBe(content);
    });

    it('should handle missing sections', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
- Testing
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Testing']);
      expect(result.customRules).toEqual([]);
      expect(result.ignorePatterns).toEqual([]);
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge custom instructions with defaults', () => {
      // Arrange
      const custom = {
        focusAreas: ['Performance'],
        customRules: ['No var'],
        ignorePatterns: ['test/**'],
        rawContent: 'test',
      };

      const defaults = processor.getDefaultConfig();

      // Act
      const result = processor.mergeWithDefaults(custom);

      // Assert
      expect(result.focusAreas).toContain('Performance');
      expect(result.focusAreas).toContain('Code quality'); // from defaults
      expect(result.customRules).toContain('No var');
      expect(result.ignorePatterns).toContain('test/**');
      expect(result.severity).toBe('warning'); // default value
    });

    it('should override severity if specified', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Severity
error

## Focus Areas
- Testing
`;

      const custom = processor.parseInstructionFile(content);

      // Act
      const result = processor.mergeWithDefaults(custom);

      // Assert
      expect(result.severity).toBe('error');
    });
  });

  describe('validateInstructions', () => {
    it('should validate correct instructions', () => {
      // Arrange
      const instructions = {
        focusAreas: ['Security', 'Performance'],
        customRules: ['Rule 1', 'Rule 2'],
        ignorePatterns: ['*.test.js'],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid ignore patterns', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: ['[invalid pattern'],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid ignore pattern: [invalid pattern');
    });

    it('should detect excessively long rules', () => {
      // Arrange
      const instructions = {
        focusAreas: ['A'.repeat(300)], // Very long focus area
        customRules: [],
        ignorePatterns: [],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Focus area too long (max 200 characters)');
    });
  });
});