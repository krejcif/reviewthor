# ReviewThor Development Guide

This guide covers the local development setup, CI/CD pipeline, and quality checks for the ReviewThor project.

## Quick Start

1. **Install dependencies and setup git hooks:**
   ```bash
   make install
   # or
   npm ci && npx husky install
   ```

2. **Run all quality checks:**
   ```bash
   make validate
   # or
   ./scripts/local-checks.sh
   ```

3. **Start development:**
   ```bash
   make dev
   # or
   npm run dev
   ```

## Local Development

### Available Commands

#### Setup & Installation
- `make install` - Install dependencies and setup git hooks
- `make clean` - Clean build artifacts and coverage reports

#### Development
- `make dev` - Start development server with hot reload
- `make start` - Start the Google Cloud Function locally

#### Quality Checks
- `make lint` - Run ESLint
- `make lint-fix` - Run ESLint with auto-fix
- `make format` - Format code with Prettier
- `make format-check` - Check code formatting
- `make type-check` - Run TypeScript type checking
- `make test` - Run tests
- `make test-watch` - Run tests in watch mode
- `make coverage` - Run tests with coverage report

#### Validation
- `make validate` - Run all quality checks (recommended before commits)
- `make security` - Run security audit
- `make ci-check` - Run the same checks as CI pipeline locally

#### Build & Deployment
- `make build` - Build the project
- `make deploy` - Deploy to production
- `make deploy-stage` - Deploy to staging

### Pre-commit Hooks

Git hooks are automatically installed when you run `make install`. Before each commit, the following checks run automatically:

1. **ESLint** - Lints and auto-fixes JavaScript/TypeScript files
2. **Prettier** - Formats code according to project style
3. **TypeScript** - Performs type checking
4. **Tests** - Runs the full test suite with coverage

If any check fails, the commit is blocked until issues are resolved.

### Manual Quality Checks

Run the comprehensive local quality check script:

```bash
./scripts/local-checks.sh
```

This script runs the same checks as the CI pipeline and provides colored output for easy identification of issues.

## CI/CD Pipeline

### GitHub Actions Workflows

The project uses GitHub Actions for automated CI/CD with the following workflows:

#### Main CI/CD Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

1. **Test and Quality Checks:**
   - TypeScript type checking
   - ESLint linting
   - Prettier formatting check
   - Jest tests with coverage reporting
   - Build verification
   - Coverage upload to Codecov

2. **Security Audit:**
   - npm security audit
   - Dependency vulnerability scanning with audit-ci

3. **Deploy to Staging:** *(Currently Disabled)*
   - Ready to trigger on push to `develop` branch
   - Will deploy to Google Cloud Functions staging environment
   - Requires `GCP_SA_KEY_STAGING` secret

4. **Deploy to Production:** *(Currently Disabled)*
   - Ready to trigger on push to `main` branch
   - Will deploy to Google Cloud Functions production environment
   - Requires `GCP_SA_KEY_PRODUCTION` secret

### GitHub Secrets (For Future Deployment)

When you're ready to enable deployment, configure these secrets in your GitHub repository:

- `GCP_SA_KEY_STAGING` - Google Cloud service account key for staging deployment
- `GCP_SA_KEY_PRODUCTION` - Google Cloud service account key for production deployment  
- `CODECOV_TOKEN` - (Optional) Token for coverage reporting

### Enabling Deployment

To enable automatic deployment when you're ready:

1. **Uncomment the deployment jobs** in `.github/workflows/ci.yml`:
   - Remove the `#` comment symbols from the `deploy-staging` and `deploy-production` job sections
   - Remove the `# TODO: Enable these deployment jobs when ready to deploy` comment

2. **Set up Google Cloud credentials:**
   - Create service accounts for staging and production environments
   - Generate JSON key files for each service account
   - Add the JSON content as GitHub repository secrets

3. **Configure GitHub environments** (optional but recommended):
   - Go to your repository Settings > Environments
   - Create `staging` and `production` environments
   - Add protection rules if desired (e.g., required reviewers for production)

### Branch Strategy

- **`main`** - Production branch, *will* auto-deploy to production (when enabled)
- **`develop`** - Development branch, *will* auto-deploy to staging (when enabled)
- **Feature branches** - Create from `develop`, merge back via PR

> **Note:** Deployment is currently disabled. The pipeline will run all quality checks, security audits, and build verification, but won't deploy until you enable the deployment jobs.

## Code Quality Standards

### TypeScript
- Strict mode enabled
- No implicit any
- Explicit return types required for functions
- Unused variables/parameters must be prefixed with `_`

### Testing
- Minimum 90% coverage required (branches, functions, lines, statements)
- Tests should be in `tests/` directory or co-located with `*.test.ts` suffix
- Use Jest for unit and integration tests

### Linting & Formatting
- ESLint with TypeScript-specific rules
- Prettier for consistent code formatting
- No console.log statements in production code

### Security
- Regular dependency audits
- Automated security scanning in CI
- Moderate and above vulnerabilities block deployment

## Local Development Tips

### IDE Setup
1. Install ESLint and Prettier extensions
2. Enable format on save
3. Configure TypeScript strict mode

### Debugging
- Use `npm run dev` for development with hot reload
- Use `npm run start` to test the Cloud Function locally
- Check logs in the terminal and Google Cloud Console

### Testing
- Run `make test-watch` during development for immediate feedback
- Use `make coverage` to check coverage reports
- Integration tests should use the actual function entry point

### Performance
- Build artifacts are cached in CI for faster runs
- Dependencies are cached using npm ci
- Use `make clean` to remove build artifacts locally

## Troubleshooting

### Common Issues

1. **Git hooks not working:**
   ```bash
   npx husky install
   chmod +x .husky/pre-commit
   ```

2. **TypeScript errors:**
   ```bash
   make type-check
   ```

3. **Linting errors:**
   ```bash
   make lint-fix
   ```

4. **Formatting issues:**
   ```bash
   make format
   ```

5. **Test failures:**
   ```bash
   make test
   # or for watch mode
   make test-watch
   ```

### Getting Help

- Check the Makefile for all available commands: `make help`
- Run the comprehensive check script: `./scripts/local-checks.sh`
- Review GitHub Actions logs for CI/CD issues
- Check Google Cloud Function logs for deployment issues

## Contributing

1. Create a feature branch from `develop`
2. Make your changes
3. Run `make validate` to ensure all checks pass
4. Commit your changes (pre-commit hooks will run automatically)
5. Push and create a PR to `develop`
6. Ensure CI checks pass
7. Get code review and merge

The CI/CD pipeline will automatically handle testing, security scanning, and build verification. Deployment can be enabled later when you're ready.