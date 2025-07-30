export interface FileContext {
  path: string;
  content: string;
  diff: string;
  language: string;
}

export interface PRContext {
  title: string;
  description: string;
  author: string;
  targetBranch: string;
  sourceBranch: string;
}

export interface RelatedFiles {
  imports: string[];
  exports: string[];
  tests: string[];
}

export interface FullContext {
  files: FileContext[];
  pr: PRContext;
  relatedFiles: Map<string, RelatedFiles>;
  totalTokens: number;
}

export interface OptimizedContext {
  files: FileContext[];
  pr: PRContext;
  truncated: boolean;
  tokenCount: number;
}

export class ContextBuilder {
  private readonly MAX_TOKENS = 150000; // Claude's context window
  private readonly AVG_CHARS_PER_TOKEN = 4;

  /**
   * Builds file context from a file and its diff
   * @param file - File information
   * @param diff - Git diff string
   * @returns File context
   */
  buildFileContext(file: { path: string; content?: string }, diff: string): FileContext {
    const language = this.detectLanguage(file.path);
    
    return {
      path: file.path,
      content: file.content || '',
      diff,
      language,
    };
  }

  /**
   * Builds PR context from pull request data
   * @param pr - Pull request information
   * @returns PR context
   */
  buildPRContext(pr: any): PRContext {
    return {
      title: pr.title || '',
      description: pr.body || '',
      author: pr.user?.login || 'unknown',
      targetBranch: pr.base?.ref || 'main',
      sourceBranch: pr.head?.ref || 'feature',
    };
  }

  /**
   * Finds related files based on imports/exports
   * @param file - File to analyze
   * @returns Related files information
   */
  async includeRelatedFiles(file: { path: string; content?: string }): Promise<RelatedFiles> {
    const content = file.content || '';
    const imports = this.extractImports(content);
    const exports = this.extractExports(content);
    const tests = this.findTestFiles(file.path);

    return {
      imports,
      exports,
      tests,
    };
  }

  /**
   * Optimizes context to fit within token limits
   * @param context - Full context
   * @returns Optimized context
   */
  optimizeForTokenLimit(context: FullContext): OptimizedContext {
    const estimatedTokens = this.estimateTokens(context);

    if (estimatedTokens <= this.MAX_TOKENS) {
      return {
        files: context.files,
        pr: context.pr,
        truncated: false,
        tokenCount: estimatedTokens,
      };
    }

    // Truncate files if needed
    const optimizedFiles: FileContext[] = [];
    let currentTokens = this.estimateTokens({ ...context, files: [] });

    for (const file of context.files) {
      const fileTokens = this.estimateFileTokens(file);
      
      if (currentTokens + fileTokens <= this.MAX_TOKENS) {
        optimizedFiles.push(file);
        currentTokens += fileTokens;
      } else {
        // Truncate this file to fit
        const remainingTokens = this.MAX_TOKENS - currentTokens;
        const truncatedFile = this.truncateFile(file, remainingTokens);
        optimizedFiles.push(truncatedFile);
        break;
      }
    }

    return {
      files: optimizedFiles,
      pr: context.pr,
      truncated: true,
      tokenCount: this.MAX_TOKENS,
    };
  }

  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'mjs': 'javascript',
      'cjs': 'javascript',
    };

    return languageMap[ext] || 'unknown';
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // ES6 imports with 'from'
    const es6Imports = content.match(/import\s+.*?\s+from\s+['"](.+?)['"]/g) || [];
    imports.push(...es6Imports.map(imp => {
      const match = imp.match(/from\s+['"](.+?)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean));

    // ES6 imports without 'from' (e.g., import './styles.css')
    const es6DirectImports = content.match(/import\s+['"](.+?)['"]/g) || [];
    imports.push(...es6DirectImports.map(imp => {
      const match = imp.match(/import\s+['"](.+?)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean));

    // CommonJS requires
    const cjsRequires = content.match(/require\s*\(['"](.+?)['"]\)/g) || [];
    imports.push(...cjsRequires.map(req => {
      const match = req.match(/require\s*\(['"](.+?)['"]\)/);
      return match ? match[1] : '';
    }).filter(Boolean));

    return [...new Set(imports)];
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const namedExports = content.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/g) || [];
    exports.push(...namedExports.map(exp => {
      const match = exp.match(/export\s+(?:const|let|var|function|class)\s+(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean));

    // Default export
    if (content.includes('export default')) {
      exports.push('default');
    }

    return exports;
  }

  private findTestFiles(filePath: string): string[] {
    const baseName = filePath.replace(/\.(js|jsx|ts|tsx)$/, '');
    
    return [
      `${baseName}.test.js`,
      `${baseName}.test.ts`,
      `${baseName}.spec.js`,
      `${baseName}.spec.ts`,
      `__tests__/${baseName}.js`,
      `__tests__/${baseName}.ts`,
    ];
  }

  private estimateTokens(context: { files: FileContext[]; pr: PRContext }): number {
    let totalChars = 0;

    // PR context
    totalChars += context.pr.title.length;
    totalChars += context.pr.description.length;
    totalChars += 100; // Other PR metadata

    // Files
    for (const file of context.files) {
      totalChars += this.estimateFileChars(file);
    }

    return Math.ceil(totalChars / this.AVG_CHARS_PER_TOKEN);
  }

  private estimateFileTokens(file: FileContext): number {
    return Math.ceil(this.estimateFileChars(file) / this.AVG_CHARS_PER_TOKEN);
  }

  private estimateFileChars(file: FileContext): number {
    return file.path.length + file.content.length + file.diff.length + 50; // metadata
  }

  private truncateFile(file: FileContext, maxTokens: number): FileContext {
    const maxChars = maxTokens * this.AVG_CHARS_PER_TOKEN;
    const pathAndMetadata = file.path.length + 50;
    const availableChars = maxChars - pathAndMetadata;

    // Prioritize diff over full content
    if (file.diff.length <= availableChars) {
      return {
        ...file,
        content: '', // Remove content to save space
      };
    }

    // Truncate diff if needed
    return {
      ...file,
      content: '',
      diff: file.diff.substring(0, availableChars) + '\n... (truncated)',
    };
  }
}