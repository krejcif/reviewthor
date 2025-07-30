import { Issue } from './engine';

export interface PromptTemplate {
  id: string;
  version: string;
  language: string;
  template: string;
  thinkingInstructions: string;
  outputFormat: any;
}

export class PromptManager {
  private templates: Map<string, PromptTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Formats an issue into a comment for GitHub
   * @param issue - The issue to format
   * @returns Formatted comment string
   */
  formatComment(issue: Issue): string {
    const icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const categoryLabels: Record<string, string> = {
      'bug': 'Bug',
      'security': 'Security',
      'performance': 'Performance',
      'code-quality': 'Code Quality',
      'type-safety': 'Type Safety',
      'documentation': 'Documentation',
    };

    const icon = icons[issue.severity];
    const category = categoryLabels[issue.category] || issue.category;
    
    let comment = `${icon} **${category}**: ${issue.message}`;

    if (issue.suggestion) {
      comment += `\n\n**Suggestion:**\n\`\`\`javascript\n${issue.suggestion}\n\`\`\``;
    }

    return comment;
  }

  /**
   * Gets a prompt template by ID
   * @param id - Template ID
   * @returns Prompt template or undefined
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Adds or updates a prompt template
   * @param template - The template to add
   */
  addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Builds a review prompt with custom instructions
   * @param basePrompt - Base prompt text
   * @param customInstructions - Custom instructions from .reviewthor.md
   * @returns Combined prompt
   */
  buildPromptWithInstructions(basePrompt: string, customInstructions?: string): string {
    if (!customInstructions) {
      return basePrompt;
    }

    return `${basePrompt}\n\nAdditional Instructions:\n${customInstructions}`;
  }

  private initializeDefaultTemplates(): void {
    // JavaScript/TypeScript review template
    this.addTemplate({
      id: 'js-review',
      version: '1.0.0',
      language: 'javascript',
      template: `Review this JavaScript/TypeScript code for:
- Syntax errors and type issues
- Common bugs (null/undefined, off-by-one, etc.)
- Security vulnerabilities (XSS, injection, etc.)
- Performance issues
- Best practices and modern patterns`,
      thinkingInstructions: `Think through the code systematically:
1. First understand what the code is trying to do
2. Check for obvious bugs or errors
3. Consider edge cases and error handling
4. Look for security implications
5. Evaluate performance characteristics
6. Suggest improvements where appropriate`,
      outputFormat: {
        issues: [],
        summary: '',
        stats: {},
      },
    });

    // React-specific template
    this.addTemplate({
      id: 'react-review',
      version: '1.0.0',
      language: 'javascript',
      template: `Review this React code for:
- Hooks rules violations
- Performance issues (unnecessary re-renders)
- State management problems
- Component design issues
- Accessibility concerns`,
      thinkingInstructions: `Consider React-specific patterns:
1. Check hooks dependencies and rules
2. Look for performance optimization opportunities
3. Evaluate component composition
4. Check for proper error boundaries
5. Consider accessibility`,
      outputFormat: {
        issues: [],
        summary: '',
        stats: {},
      },
    });

    // Express.js template
    this.addTemplate({
      id: 'express-review',
      version: '1.0.0',
      language: 'javascript',
      template: `Review this Express.js code for:
- Security vulnerabilities (injection, auth issues)
- Middleware order and usage
- Error handling
- Performance considerations
- API design best practices`,
      thinkingInstructions: `Focus on server-side concerns:
1. Check for security vulnerabilities
2. Validate input handling
3. Review error handling and logging
4. Check middleware configuration
5. Look for performance bottlenecks`,
      outputFormat: {
        issues: [],
        summary: '',
        stats: {},
      },
    });
  }
}