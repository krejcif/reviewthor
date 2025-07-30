import { InstructionProcessor } from './instruction-processor';
import { GitHubClient } from '../github/client';

jest.mock('../github/client');

describe('InstructionProcessor - Branch Coverage', () => {
  let processor: InstructionProcessor;
  let mockGitHubClient: jest.Mocked<GitHubClient>;

  beforeEach(() => {
    mockGitHubClient = new GitHubClient({ appId: 123, privateKey: 'test' }) as jest.Mocked<GitHubClient>;
    processor = new InstructionProcessor(mockGitHubClient);
  });

  describe('isValidGlobPattern edge cases', () => {
    it('should handle patterns with unmatched closing brackets', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: ['test]pattern'],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid ignore pattern: test]pattern');
    });

    it('should handle patterns with multiple brackets', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: ['test[a-z][0-9]*.js'],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(true);
    });

    it('should handle patterns with complex bracket combinations', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: ['test[[abc]*.js'], // double opening bracket - invalid
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
    });

    it('should handle patterns with invalid characters', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: ['test@#$%.js'],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid ignore pattern: test@#$%.js');
    });

    it('should handle empty patterns', () => {
      // Arrange
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: [''],
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid ignore pattern: ');
    });

    it('should handle patterns that throw exceptions', () => {
      // This tests the catch block in isValidGlobPattern
      // We'll mock a pattern that causes an exception in the validation logic
      const instructions = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: [null as any], // This will cause an exception
        rawContent: 'content',
      };

      // Act
      const result = processor.validateInstructions(instructions);

      // Assert
      expect(result.isValid).toBe(false);
    });
  });

  describe('parseInstructionFile with various formats', () => {
    it('should handle severity in different cases', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## SEVERITY
ERROR

## Focus Areas
- Testing
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.severity).toBe('error');
    });

    it('should ignore invalid severity values', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Severity
invalid

## Focus Areas
- Testing
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.severity).toBeUndefined();
    });

    it('should handle numbered lists', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
1. Performance
2. Security
3. Testing

## Custom Rules
1. Use const
2. No console.log
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Performance', 'Security', 'Testing']);
      expect(result.customRules).toEqual(['Use const', 'No console.log']);
    });

    it('should handle mixed list styles', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
- Item 1
* Item 2
1. Item 3
2. Item 4
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Item 1', 'Item 2', 'Item 3', 'Item 4']);
    });

    it('should handle sections with no valid items', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
This is not a list item
Neither is this

## Custom Rules
Just some text
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual([]);
      expect(result.customRules).toEqual([]);
    });

    it('should handle empty lines in lists', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

## Focus Areas
- Item 1

- Item 2

- Item 3
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('should handle sections without title', () => {
      // Arrange
      const content = `# ReviewThor Custom Instructions

##
- Item without section

## Focus Areas
- Valid item
`;

      // Act
      const result = processor.parseInstructionFile(content);

      // Assert
      expect(result.focusAreas).toEqual(['Valid item']);
    });
  });

  describe('mergeWithDefaults severity handling', () => {
    it('should use warning severity from custom instructions', () => {
      // Arrange
      const custom = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: [],
        rawContent: 'test',
        severity: 'warning' as const,
      };

      // Act
      const result = processor.mergeWithDefaults(custom);

      // Assert
      expect(result.severity).toBe('warning');
    });

    it('should use info severity from custom instructions', () => {
      // Arrange
      const custom = {
        focusAreas: [],
        customRules: [],
        ignorePatterns: [],
        rawContent: 'test',
        severity: 'info' as const,
      };

      // Act
      const result = processor.mergeWithDefaults(custom);

      // Assert
      expect(result.severity).toBe('info');
    });
  });
});