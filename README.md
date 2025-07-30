# 🤖 ReviewThor - AI-Powered JavaScript Code Review Bot

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![Claude AI](https://img.shields.io/badge/Claude_AI-FF6B35?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Jest](https://img.shields.io/badge/Jest-323330?style=for-the-badge&logo=Jest&logoColor=white)](https://jestjs.io/)
[![Coverage](https://img.shields.io/badge/Coverage-97%25-brightgreen?style=for-the-badge)](https://github.com/your-org/reviewthor)

An intelligent GitHub App that provides AI-powered code reviews for JavaScript and TypeScript projects using Claude Opus. ReviewThor analyzes pull requests and provides insightful, context-aware feedback to improve code quality and catch potential issues.

## 🌟 Features

- **🎯 JavaScript/TypeScript Focused**: Specialized analysis for modern JS/TS codebases
- **🧠 Claude Opus Integration**: Leverages Anthropic's most capable AI model with advanced reasoning
- **⚙️ Custom Instructions**: Repository-specific review rules via `.reviewthor.md` files
- **🔒 Enterprise Security**: Webhook signature validation and secure secret management
- **⚡ Serverless Architecture**: Runs on Google Cloud Functions with automatic scaling
- **📊 Comprehensive Testing**: 97% test coverage with TDD methodology
- **🎨 Smart Context Building**: Optimizes code context for AI analysis
- **📈 Production Ready**: Full monitoring, logging, and error handling

## 🏗️ Architecture

ReviewThor follows a hexagonal architecture pattern with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   GitHub App    │───▶│  Cloud Function  │───▶│   Claude API    │
│   (Webhooks)    │    │   (Node.js 20)   │    │  (Anthropic)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Secret Manager  │
                       │   (GCP Secrets)  │
                       └──────────────────┘
```

### Core Components

- **WebhookHandler**: Validates and routes GitHub webhook events
- **GitHubClient**: Manages GitHub API interactions and authentication
- **AIReviewEngine**: Orchestrates code analysis using Claude Opus
- **InstructionProcessor**: Handles custom `.reviewthor.md` configuration files
- **ContextBuilder**: Optimizes code context for AI analysis
- **PromptManager**: Manages AI prompts and response formatting

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x LTS
- Google Cloud Account with billing enabled
- GitHub App credentials
- Anthropic API key

### 1. Clone and Install

```bash
git clone https://github.com/your-org/reviewthor.git
cd reviewthor
npm install
```

### 2. Configure Environment

Create a `.env` file for local development:

```env
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# Anthropic Configuration  
ANTHROPIC_API_KEY=sk-ant-api03-xxx
ANTHROPIC_MODEL=claude-3-opus-20240229

# Application Configuration
NODE_ENV=development
LOG_LEVEL=info
MAX_FILES_PER_PR=50
MAX_FILE_SIZE_BYTES=1048576
RATE_LIMIT_PER_MINUTE=5

# Google Cloud Configuration
GCP_PROJECT_ID=your-project-id
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

### 4. Local Development

```bash
# Start the function locally
npm run start

# In another terminal, use ngrok for webhook testing
npx ngrok http 8080
```

## 📋 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_APP_ID` | GitHub App ID | - | ✅ |
| `GITHUB_PRIVATE_KEY` | GitHub App Private Key (Secret Manager) | - | ✅ |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret (Secret Manager) | - | ✅ |
| `ANTHROPIC_API_KEY` | Anthropic API key (Secret Manager) | - | ✅ |
| `ANTHROPIC_MODEL` | Claude model to use | `claude-3-opus-20240229` | ❌ |
| `MAX_TOKENS` | Maximum tokens per request | `4096` | ❌ |
| `AI_TEMPERATURE` | AI response randomness | `0.3` | ❌ |
| `MAX_RETRIES` | API retry attempts | `3` | ❌ |
| `AI_TIMEOUT_MS` | AI request timeout | `30000` | ❌ |
| `NODE_ENV` | Environment mode | `development` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |
| `MAX_FILES_PER_PR` | Max files to analyze per PR | `50` | ❌ |
| `MAX_FILE_SIZE_BYTES` | Max file size to analyze | `1048576` | ❌ |
| `RATE_LIMIT_PER_MINUTE` | API rate limit | `5` | ❌ |
| `GCP_PROJECT_ID` | Google Cloud Project ID | - | ✅ |

### Custom Review Instructions

Create a `.reviewthor.md` file in your repository root to customize review behavior:

```markdown
# ReviewThor Configuration

## Focus Areas
- performance
- security
- accessibility
- testing

## Custom Rules
- Prefer functional components over class components
- Use TypeScript strict mode
- Ensure proper error handling in async functions
- Follow React Hooks best practices

## Ignore Patterns
- **/*.test.ts
- **/dist/**
- **/node_modules/**

## Severity
warning
```

### Supported Focus Areas

- `performance` - Memory usage, algorithms, optimization
- `security` - Vulnerabilities, input validation, authentication
- `accessibility` - WCAG compliance, semantic HTML
- `testing` - Test coverage, test quality
- `code-quality` - Best practices, maintainability
- `type-safety` - TypeScript usage, type definitions

## 🔧 GitHub App Setup

### 1. Create GitHub App

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Configure the app:

```yaml
# Basic Information
Name: ReviewThor
Description: AI-powered JavaScript code review bot
Homepage URL: https://github.com/your-org/reviewthor

# Webhook
Webhook URL: https://your-region-your-project.cloudfunctions.net/reviewthor
Webhook Secret: [Generate a secure secret]

# Permissions
Repository permissions:
  - Contents: Read
  - Issues: Write  
  - Pull requests: Read & Write
  - Checks: Write
  - Metadata: Read

# Events
Subscribe to events:
  - Pull request
  - Pull request review
```

### 2. Install App

After creating the app:
1. Generate and download the private key
2. Install the app on your target repositories
3. Note the Installation ID from the URL

## 🚀 Deployment

### Google Cloud Functions Deployment

1. **Set up Google Cloud CLI**:
```bash
gcloud auth login
gcloud config set project your-project-id
```

2. **Store secrets in Secret Manager**:
```bash
# GitHub Private Key
gcloud secrets create GITHUB_PRIVATE_KEY --data-file=path/to/private-key.pem

# Webhook Secret
echo "your_webhook_secret" | gcloud secrets create GITHUB_WEBHOOK_SECRET --data-file=-

# Anthropic API Key
echo "sk-ant-api03-xxx" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
```

3. **Deploy the function**:
```bash
npm run build
npm run deploy
```

### Manual Deployment

```bash
gcloud functions deploy reviewthor \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=. \
  --entry-point=reviewthor \
  --trigger-http \
  --allow-unauthenticated \
  --memory=2GB \
  --timeout=540 \
  --min-instances=1 \
  --max-instances=100 \
  --set-env-vars="GITHUB_APP_ID=123456,GCP_PROJECT_ID=your-project-id"
```

## 🎯 Usage

### Basic Usage

1. Install ReviewThor on your repository
2. Create a pull request with JavaScript/TypeScript changes
3. ReviewThor automatically analyzes the code
4. Receive AI-powered feedback as PR comments

### Example Review Comment

```markdown
## 🤖 ReviewThor Analysis

**File**: `src/components/UserProfile.tsx`
**Line**: 45
**Severity**: warning
**Category**: Performance

### Issue
The `useEffect` hook is missing dependencies, which could lead to stale closures and unexpected behavior.

### Suggestion
Add `userId` to the dependency array:

```tsx
useEffect(() => {
  fetchUserData(userId);
}, [userId]); // Add userId here
```

This ensures the effect runs when `userId` changes and prevents stale closure issues.
```

### Advanced Configuration

For complex projects, create detailed `.reviewthor.md` configurations:

```markdown
# Advanced ReviewThor Configuration

## Focus Areas
- performance
- security  
- accessibility
- testing
- type-safety

## Custom Rules
- Always use `const` assertions for readonly arrays
- Prefer `unknown` over `any` for type safety
- Use proper React key props in lists
- Implement proper error boundaries
- Follow the repository's naming conventions

## Ignore Patterns
- **/*.min.js
- **/*.bundle.js
- **/coverage/**
- **/__tests__/**
- **/stories/**

## Severity
error

## Max Comments Per PR
10
```

## 🧪 Development

### Project Structure

```
reviewthor/
├── src/
│   ├── ai/                 # AI engine and prompt management
│   │   ├── engine.ts       # Main AI review engine
│   │   ├── anthropic-client.ts
│   │   ├── prompt-manager.ts
│   │   ├── context-builder.ts
│   │   └── instruction-processor.ts
│   ├── github/             # GitHub API integration
│   │   ├── client.ts       # GitHub API client
│   │   └── types.ts        # GitHub-related types
│   ├── handlers/           # Event handlers
│   │   ├── webhook.ts      # Webhook validation and routing
│   │   └── events/         # Event-specific handlers
│   ├── config/             # Configuration management
│   │   ├── loader.ts       # Config loading and validation
│   │   └── default.ts      # Default configuration values
│   ├── utils/              # Utilities
│   │   └── logger.ts       # Structured logging
│   └── index.ts            # Cloud Function entry point
├── tests/                  # Test setup and fixtures
└── coverage/               # Test coverage reports
```

### Testing Strategy

ReviewThor uses Test-Driven Development (TDD) with comprehensive coverage:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test component interactions
- **Mock Strategy**: Mock external dependencies (GitHub API, Anthropic API)
- **Coverage Target**: 90% minimum across all metrics

### Running Tests

```bash
# All tests
npm test

# Coverage report
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test file
npm test -- --testPathPattern=engine.test.ts

# Debug mode
npm test -- --verbose --detectOpenHandles
```

### Code Quality

```bash
# Linting
npm run lint

# Formatting
npm run format

# Type checking
npm run build
```

## 📊 Monitoring

### Google Cloud Monitoring

ReviewThor integrates with Google Cloud's monitoring stack:

- **Cloud Logging**: Structured logs with correlation IDs
- **Error Reporting**: Automatic error tracking and alerting
- **Cloud Monitoring**: Function metrics and performance

### Key Metrics to Monitor

- Function invocation count
- Function execution duration
- Error rate
- Memory usage
- Anthropic API usage and costs
- GitHub API rate limits

### Logging Example

```json
{
  "severity": "INFO",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "message": "Webhook processed successfully",
  "correlationId": "rev-1705315800000-abc123def",
  "eventType": "pull_request",
  "repository": "owner/repo",
  "prNumber": 42,
  "filesAnalyzed": 5,
  "issuesFound": 3,
  "processingTimeMs": 2500
}
```

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow TDD: Write tests first, then implementation
4. Ensure all tests pass: `npm test`
5. Run linting: `npm run lint`
6. Commit changes: `git commit -m 'Add amazing feature'`
7. Push to branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Standards

- **TypeScript**: Strict mode enabled, prefer type inference
- **Testing**: Minimum 90% coverage, TDD approach
- **Linting**: ESLint + Prettier configuration
- **Documentation**: JSDoc comments for public APIs
- **Commits**: Conventional commit format

### Pull Request Guidelines

- Include comprehensive test coverage
- Update documentation if needed
- Follow existing code patterns
- Include performance considerations
- Test with real GitHub webhooks when possible

## 📚 API Reference

### WebhookHandler

```typescript
class WebhookHandler {
  validateSignature(payload: string, signature: string): boolean
  parseEvent(payload: any): GitHubEvent
  routeEvent(event: GitHubEvent): Promise<void>
  setPullRequestHandler(handler: PullRequestHandler): void
}
```

### AIReviewEngine

```typescript
class AIReviewEngine {
  analyzeCode(context: CodeContext, instructions?: CustomInstructions): Promise<ReviewAnalysis>
  generateComments(analysis: ReviewAnalysis): Comment[]
  setMinimumSeverity(severity: 'error' | 'warning' | 'info'): void
}
```

### GitHubClient

```typescript
class GitHubClient {
  authenticate(installationId: number): Promise<void>
  getPullRequest(owner: string, repo: string, number: number): Promise<PullRequest>
  getFiles(owner: string, repo: string, number: number): Promise<File[]>
  getFile(owner: string, repo: string, path: string, ref: string): Promise<string | null>
  createReviewComments(owner: string, repo: string, number: number, comments: Comment[]): Promise<void>
}
```

## 🔒 Security

### Security Features

- **Webhook Signature Validation**: Cryptographic verification of GitHub webhooks
- **Secret Management**: Google Secret Manager for sensitive credentials
- **Input Validation**: Comprehensive payload validation
- **Rate Limiting**: Configurable API rate limits
- **Error Handling**: No sensitive information in error responses

### Security Best Practices

1. **Rotate Secrets Regularly**: Update webhook secrets and API keys
2. **Monitor API Usage**: Watch for unusual patterns
3. **Review Permissions**: Minimize GitHub App permissions
4. **Update Dependencies**: Keep all packages up to date
5. **Audit Logs**: Review Cloud Function logs regularly

## 📈 Performance

### Optimization Strategies

- **Configuration Caching**: Cache loaded configuration
- **File Filtering**: Only analyze relevant JavaScript/TypeScript files
- **Context Optimization**: Smart truncation of large files
- **Cold Start Mitigation**: Minimum instance configuration
- **Token Management**: Efficient use of Anthropic API tokens

### Performance Metrics

- **Function Duration**: Typically 2-5 seconds per PR
- **Memory Usage**: 512MB-2GB depending on PR size
- **Token Usage**: ~1000-4000 tokens per analysis
- **Cost Optimization**: Smart batching and filtering

## 🐛 Troubleshooting

### Common Issues

#### Webhook Validation Fails
```
Error: Invalid webhook signature
```
**Solution**: Ensure webhook secret matches between GitHub App and Secret Manager

#### AI Analysis Timeout
```
Error: Anthropic API error: timeout
```
**Solution**: Increase `AI_TIMEOUT_MS` or reduce file size limits

#### GitHub API Rate Limit
```
Error: API rate limit exceeded
```
**Solution**: Implement exponential backoff or reduce analysis frequency

#### Memory Issues
```
Error: Function exceeded memory limit
```
**Solution**: Increase Cloud Function memory or reduce `MAX_FILES_PER_PR`

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Checks

Test function health:

```bash
curl -X POST https://your-function-url \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: ping" \
  -d '{"zen": "Design for failure."}'
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for the Claude AI API
- **Google Cloud** for the serverless infrastructure
- **GitHub** for the comprehensive webhook system
- **Jest** community for excellent testing tools
- **TypeScript** team for type safety

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/reviewthor/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/reviewthor/discussions)
- **Documentation**: [Wiki](https://github.com/your-org/reviewthor/wiki)
- **Security**: security@your-org.com

---

<div align="center">

**Made with ❤️ for the JavaScript community**

[🌟 Star this repo](https://github.com/your-org/reviewthor) • [🐛 Report Bug](https://github.com/your-org/reviewthor/issues) • [✨ Request Feature](https://github.com/your-org/reviewthor/issues)

</div>