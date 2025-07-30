import { AnthropicClient } from './anthropic-client';
import { PromptManager } from './prompt-manager';
import { ContextBuilder } from './context-builder';

export interface CodeContext {
  files: Array<{
    path: string;
    content: string;
    diff: string;
  }>;
  prDescription: string;
  repository: string;
}

export interface Issue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  category: string;
  suggestion?: string;
}

export interface ReviewAnalysis {
  issues: Issue[];
  summary: string;
  stats: {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

export interface Comment {
  path: string;
  line: number;
  body: string;
}

export class AIReviewEngine {
  private minimumSeverity: 'error' | 'warning' | 'info' = 'info';

  constructor(
    private readonly anthropicClient: AnthropicClient,
    private readonly promptManager: PromptManager,
    private readonly _contextBuilder: ContextBuilder // Will be used for context optimization
  ) {}

  /**
   * Analyzes code context and returns review analysis
   * @param context - Code context including files, PR description, etc.
   * @returns Review analysis with issues found
   */
  async analyzeCode(context: CodeContext): Promise<ReviewAnalysis> {
    // Build the review prompt
    const prompt = this.buildReviewPrompt(context);

    // Call AI with thinking instructions
    const response = await this.anthropicClient.createMessage(prompt, {
      maxTokens: 4096,
      temperature: 0.3,
    });

    // Parse and validate the response
    try {
      const analysis = JSON.parse(response.content) as ReviewAnalysis;
      this.validateAnalysis(analysis);
      return analysis;
    } catch (error) {
      throw new Error(`Invalid AI response format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates PR comments from analysis results
   * @param analysis - Review analysis with issues
   * @returns Array of formatted comments
   */
  async generateComments(analysis: ReviewAnalysis): Promise<Comment[]> {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    const minSeverityValue = severityOrder[this.minimumSeverity];

    return analysis.issues
      .filter(issue => severityOrder[issue.severity] <= minSeverityValue)
      .map(issue => ({
        path: issue.file,
        line: issue.line,
        body: this.promptManager.formatComment(issue),
      }));
  }

  /**
   * Generates detailed explanation for a specific issue
   * @param issue - The issue to explain
   * @returns Detailed explanation
   */
  async explainReasoning(issue: Issue): Promise<string> {
    const prompt = `Please explain why this is an issue:

File: ${issue.file}
Line: ${issue.line}
Issue: ${issue.message}
Category: ${issue.category}
Severity: ${issue.severity}

Provide a detailed explanation that helps the developer understand:
1. Why this is a problem
2. What could go wrong
3. How to fix it properly`;

    const response = await this.anthropicClient.createMessage(prompt, {
      maxTokens: 1024,
      temperature: 0.3,
    });

    return response.content.trim();
  }

  /**
   * Sets the minimum severity level for comments
   * @param severity - Minimum severity to include in comments
   */
  setMinimumSeverity(severity: 'error' | 'warning' | 'info'): void {
    this.minimumSeverity = severity;
  }

  private buildReviewPrompt(context: CodeContext): string {
    return `<thinking>
You are reviewing a pull request for a JavaScript/TypeScript project. 
Analyze the code changes carefully for:
- Bugs and potential runtime errors
- Security vulnerabilities
- Performance issues
- Code quality and best practices
- TypeScript type safety issues

Consider the PR description for context about the intended changes.
</thinking>

Please review the following code changes:

Repository: ${context.repository}
PR Description: ${context.prDescription}

Files:
${context.files.map(file => `
File: ${file.path}
Diff:
\`\`\`diff
${file.diff}
\`\`\`
`).join('\n')}

Provide your analysis in the following JSON format:
{
  "issues": [
    {
      "file": "path/to/file.js",
      "line": 10,
      "severity": "error|warning|info",
      "message": "Clear description of the issue",
      "category": "bug|security|performance|code-quality|type-safety",
      "suggestion": "Optional code suggestion to fix the issue"
    }
  ],
  "summary": "Brief summary of the review",
  "stats": {
    "total": 0,
    "byCategory": {},
    "bySeverity": {}
  }
}

Focus on JavaScript/TypeScript specific issues. Be constructive and helpful.`;
  }

  private validateAnalysis(analysis: any): void {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Analysis must be an object');
    }

    if (!Array.isArray(analysis.issues)) {
      throw new Error('Analysis must contain an issues array');
    }

    if (!analysis.summary || typeof analysis.summary !== 'string') {
      throw new Error('Analysis must contain a summary string');
    }

    if (!analysis.stats || typeof analysis.stats !== 'object') {
      throw new Error('Analysis must contain stats object');
    }

    // Validate each issue
    for (const issue of analysis.issues) {
      if (!issue.file || !issue.line || !issue.severity || !issue.message || !issue.category) {
        throw new Error('Each issue must have file, line, severity, message, and category');
      }

      if (!['error', 'warning', 'info'].includes(issue.severity)) {
        throw new Error('Issue severity must be error, warning, or info');
      }
    }
  }
}