import { PromptManager } from './prompt-manager';
import { Issue } from './engine';

describe('PromptManager', () => {
  let promptManager: PromptManager;

  beforeEach(() => {
    promptManager = new PromptManager();
  });

  describe('formatComment', () => {
    it('should format error issue with suggestion', () => {
      // Arrange
      const issue: Issue = {
        file: 'src/index.js',
        line: 10,
        severity: 'error',
        message: 'Undefined variable "x"',
        category: 'bug',
        suggestion: 'const x = getValue();',
      };

      // Act
      const comment = promptManager.formatComment(issue);

      // Assert
      expect(comment).toBe(
        '❌ **Bug**: Undefined variable "x"\n\n' +
        '**Suggestion:**\n```javascript\nconst x = getValue();\n```'
      );
    });

    it('should format warning without suggestion', () => {
      // Arrange
      const issue: Issue = {
        file: 'src/utils.js',
        line: 5,
        severity: 'warning',
        message: 'Function is too complex',
        category: 'code-quality',
      };

      // Act
      const comment = promptManager.formatComment(issue);

      // Assert
      expect(comment).toBe('⚠️ **Code Quality**: Function is too complex');
    });

    it('should format info issue', () => {
      // Arrange
      const issue: Issue = {
        file: 'src/app.js',
        line: 1,
        severity: 'info',
        message: 'Consider adding JSDoc',
        category: 'documentation',
      };

      // Act
      const comment = promptManager.formatComment(issue);

      // Assert
      expect(comment).toBe('ℹ️ **Documentation**: Consider adding JSDoc');
    });

    it('should handle all category types', () => {
      const categories = [
        { category: 'bug', label: 'Bug' },
        { category: 'security', label: 'Security' },
        { category: 'performance', label: 'Performance' },
        { category: 'code-quality', label: 'Code Quality' },
        { category: 'type-safety', label: 'Type Safety' },
        { category: 'documentation', label: 'Documentation' },
        { category: 'unknown-category', label: 'unknown-category' }, // Falls back to raw category
      ];

      categories.forEach(({ category, label }) => {
        const issue: Issue = {
          file: 'test.js',
          line: 1,
          severity: 'info',
          message: 'Test',
          category,
        };

        const comment = promptManager.formatComment(issue);
        expect(comment).toContain(`**${label}**:`);
      });
    });
  });

  describe('template management', () => {
    it('should get template by ID', () => {
      // Act
      const template = promptManager.getTemplate('js-review');

      // Assert
      expect(template).toBeDefined();
      expect(template?.id).toBe('js-review');
      expect(template?.language).toBe('javascript');
      expect(template?.version).toBe('1.0.0');
      expect(template?.template).toContain('JavaScript/TypeScript');
    });

    it('should return undefined for non-existent template', () => {
      // Act
      const template = promptManager.getTemplate('non-existent');

      // Assert
      expect(template).toBeUndefined();
    });

    it('should add custom template', () => {
      // Arrange
      const customTemplate = {
        id: 'custom-review',
        version: '1.0.0',
        language: 'javascript',
        template: 'Custom review template',
        thinkingInstructions: 'Think carefully',
        outputFormat: { custom: true },
      };

      // Act
      promptManager.addTemplate(customTemplate);
      const retrieved = promptManager.getTemplate('custom-review');

      // Assert
      expect(retrieved).toEqual(customTemplate);
    });

    it('should override existing template', () => {
      // Arrange
      const newJsTemplate = {
        id: 'js-review',
        version: '2.0.0',
        language: 'javascript',
        template: 'Updated template',
        thinkingInstructions: 'New thinking',
        outputFormat: {},
      };

      // Act
      promptManager.addTemplate(newJsTemplate);
      const retrieved = promptManager.getTemplate('js-review');

      // Assert
      expect(retrieved?.version).toBe('2.0.0');
      expect(retrieved?.template).toBe('Updated template');
    });
  });

  describe('buildPromptWithInstructions', () => {
    it('should return base prompt when no custom instructions', () => {
      // Arrange
      const basePrompt = 'Review this code';

      // Act
      const result = promptManager.buildPromptWithInstructions(basePrompt);

      // Assert
      expect(result).toBe(basePrompt);
    });

    it('should append custom instructions', () => {
      // Arrange
      const basePrompt = 'Review this code';
      const customInstructions = 'Focus on performance';

      // Act
      const result = promptManager.buildPromptWithInstructions(basePrompt, customInstructions);

      // Assert
      expect(result).toBe('Review this code\n\nAdditional Instructions:\nFocus on performance');
    });

    it('should handle empty custom instructions', () => {
      // Arrange
      const basePrompt = 'Review this code';
      const customInstructions = '';

      // Act
      const result = promptManager.buildPromptWithInstructions(basePrompt, customInstructions);

      // Assert
      expect(result).toBe(basePrompt);
    });
  });

  describe('default templates', () => {
    it('should have JavaScript review template', () => {
      // Act
      const template = promptManager.getTemplate('js-review');

      // Assert
      expect(template).toBeDefined();
      expect(template?.template).toContain('Syntax errors');
      expect(template?.template).toContain('Security vulnerabilities');
      expect(template?.template).toContain('Performance issues');
      expect(template?.thinkingInstructions).toContain('Think through the code systematically');
    });

    it('should have React review template', () => {
      // Act
      const template = promptManager.getTemplate('react-review');

      // Assert
      expect(template).toBeDefined();
      expect(template?.template).toContain('Hooks rules violations');
      expect(template?.template).toContain('Performance issues');
      expect(template?.template).toContain('Component design');
      expect(template?.thinkingInstructions).toContain('React-specific patterns');
    });

    it('should have Express review template', () => {
      // Act
      const template = promptManager.getTemplate('express-review');

      // Assert
      expect(template).toBeDefined();
      expect(template?.template).toContain('Security vulnerabilities');
      expect(template?.template).toContain('Middleware order');
      expect(template?.template).toContain('Error handling');
      expect(template?.thinkingInstructions).toContain('server-side concerns');
    });

    it('all templates should have required fields', () => {
      // Arrange
      const templateIds = ['js-review', 'react-review', 'express-review'];

      // Act & Assert
      templateIds.forEach(id => {
        const template = promptManager.getTemplate(id);
        expect(template).toBeDefined();
        expect(template?.id).toBe(id);
        expect(template?.version).toBeDefined();
        expect(template?.language).toBe('javascript');
        expect(template?.template).toBeDefined();
        expect(template?.thinkingInstructions).toBeDefined();
        expect(template?.outputFormat).toBeDefined();
      });
    });
  });
});