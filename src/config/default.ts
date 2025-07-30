export const defaultConfig = {
  // Review behavior
  enabledFileTypes: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  ignoredPaths: [
    'node_modules/**',
    'dist/**',
    'build/**',
    'coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
    'vendor/**',
  ],
  
  // AI behavior
  reviewPromptVersion: '1.0.0',
  minimumSeverity: 'info' as const,
  maxCommentsPerFile: 10,
  maxCommentsPerPR: 20,
  
  // Review categories
  enabledCategories: [
    'bug',
    'security',
    'performance',
    'code-quality',
    'type-safety',
    'best-practices',
  ],
  
  // Severity thresholds
  severityThresholds: {
    error: 0.8,    // High confidence issues
    warning: 0.6,  // Medium confidence
    info: 0.4,     // Low confidence suggestions
  },
  
  // Framework-specific settings
  reactSettings: {
    enforceHooksRules: true,
    preferFunctionalComponents: true,
    checkAccessibility: true,
  },
  
  expressSettings: {
    checkSecurityHeaders: true,
    enforceErrorHandling: true,
    validateInputSanitization: true,
  },
  
  // Performance limits
  maxFileSize: 1024 * 1024, // 1MB
  maxDiffSize: 500 * 1024,  // 500KB
  maxFilesPerReview: 50,
  maxExecutionTime: 300000, // 5 minutes
  
  // Rate limiting
  rateLimits: {
    perMinute: 5,
    perHour: 100,
    perDay: 1000,
  },
};