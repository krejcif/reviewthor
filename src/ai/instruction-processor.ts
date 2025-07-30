import { GitHubClient } from '../github/client';

export interface CustomInstructions {
  focusAreas: string[];
  customRules: string[];
  ignorePatterns: string[];
  rawContent: string;
  severity?: 'error' | 'warning' | 'info';
}

export interface ReviewConfig {
  focusAreas: string[];
  customRules: string[];
  ignorePatterns: string[];
  severity: 'error' | 'warning' | 'info';
  maxCommentsPerPR: number;
  enabledChecks: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class InstructionProcessor {
  private static readonly MAX_RULE_LENGTH = 200;
  private static readonly DEFAULT_BRANCH = 'HEAD';

  constructor(private readonly githubClient: GitHubClient) {}

  /**
   * Fetches custom instructions from .reviewthor.md in the repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @returns Custom instructions or null if file doesn't exist
   */
  async fetchCustomInstructions(owner: string, repo: string): Promise<CustomInstructions | null> {
    const content = await this.githubClient.getFile(
      owner,
      repo,
      '.reviewthor.md',
      InstructionProcessor.DEFAULT_BRANCH
    );

    if (!content) {
      return null;
    }

    return this.parseInstructionFile(content);
  }

  /**
   * Parses the instruction file content
   * @param content - Raw markdown content
   * @returns Parsed instructions
   */
  parseInstructionFile(content: string): CustomInstructions {
    const instructions: CustomInstructions = {
      focusAreas: [],
      customRules: [],
      ignorePatterns: [],
      rawContent: content,
    };

    // Split content into sections
    const sections = content.split(/^##\s+/m);

    for (const section of sections) {
      const lines = section.trim().split('\n');
      const sectionTitle = lines[0]?.toLowerCase() || '';

      if (sectionTitle.includes('focus areas')) {
        instructions.focusAreas = this.parseListSection(lines.slice(1));
      } else if (sectionTitle.includes('custom rules')) {
        instructions.customRules = this.parseListSection(lines.slice(1));
      } else if (sectionTitle.includes('ignore patterns')) {
        instructions.ignorePatterns = this.parseListSection(lines.slice(1));
      } else if (sectionTitle.includes('severity')) {
        const severity = lines[1]?.trim().toLowerCase();
        if (severity === 'error' || severity === 'warning' || severity === 'info') {
          instructions.severity = severity;
        }
      }
    }

    return instructions;
  }

  /**
   * Merges custom instructions with default configuration
   * @param custom - Custom instructions
   * @returns Complete review configuration
   */
  mergeWithDefaults(custom: CustomInstructions): ReviewConfig {
    const defaults = this.getDefaultConfig();

    return {
      focusAreas: [...new Set([...defaults.focusAreas, ...custom.focusAreas])],
      customRules: [...defaults.customRules, ...custom.customRules],
      ignorePatterns: [...defaults.ignorePatterns, ...custom.ignorePatterns],
      severity: custom.severity || defaults.severity,
      maxCommentsPerPR: defaults.maxCommentsPerPR,
      enabledChecks: defaults.enabledChecks,
    };
  }

  /**
   * Validates custom instructions
   * @param instructions - Instructions to validate
   * @returns Validation result
   */
  validateInstructions(instructions: CustomInstructions): ValidationResult {
    const errors: string[] = [];

    // Validate focus areas length
    for (const area of instructions.focusAreas) {
      if (area.length > InstructionProcessor.MAX_RULE_LENGTH) {
        errors.push('Focus area too long (max 200 characters)');
      }
    }

    // Validate custom rules length
    for (const rule of instructions.customRules) {
      if (rule.length > InstructionProcessor.MAX_RULE_LENGTH) {
        errors.push('Custom rule too long (max 200 characters)');
      }
    }

    // Validate ignore patterns
    for (const pattern of instructions.ignorePatterns) {
      if (!this.isValidGlobPattern(pattern)) {
        errors.push(`Invalid ignore pattern: ${pattern}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets the default configuration
   * @returns Default review configuration
   */
  getDefaultConfig(): ReviewConfig {
    return {
      focusAreas: [
        'Code quality',
        'Bug detection',
        'Security issues',
        'Performance',
        'Best practices',
      ],
      customRules: [
        'Use const/let instead of var',
        'Handle errors properly',
        'Add appropriate TypeScript types',
        'Follow consistent naming conventions',
      ],
      ignorePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '*.min.js',
        '*.bundle.js',
      ],
      severity: 'warning',
      maxCommentsPerPR: 20,
      enabledChecks: [
        'syntax',
        'security',
        'performance',
        'best-practices',
        'type-safety',
      ],
    };
  }

  private parseListSection(lines: string[]): string[] {
    const items: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Match lines starting with -, *, or numbered lists
      const match = trimmed.match(/^[-*]\s+(.+)$|^\d+\.\s+(.+)$/);
      if (match) {
        const item = match[1] || match[2];
        if (item) {
          items.push(item.trim());
        }
      }
    }

    return items;
  }

  private isValidGlobPattern(pattern: string): boolean {
    // Basic validation for glob patterns
    try {
      // Check for unclosed brackets
      let bracketCount = 0;
      for (const char of pattern) {
        if (char === '[') bracketCount++;
        if (char === ']') bracketCount--;
        if (bracketCount < 0) return false;
      }
      if (bracketCount !== 0) return false;

      // Check for valid characters
      const validPattern = /^[a-zA-Z0-9\-_.*/?[\]!{}]+$/;
      return validPattern.test(pattern);
    } catch {
      return false;
    }
  }
}