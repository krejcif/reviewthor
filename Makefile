# ReviewThor Development Makefile

.PHONY: help install clean build test lint format validate security dev start deploy

# Default target
help:
	@echo "ReviewThor Development Commands:"
	@echo ""
	@echo "Setup & Installation:"
	@echo "  install       Install dependencies and setup git hooks"
	@echo "  clean         Clean build artifacts and coverage"
	@echo ""
	@echo "Development:"
	@echo "  dev           Start development server with hot reload"
	@echo "  start         Start the function locally"
	@echo ""
	@echo "Quality Checks:"
	@echo "  test          Run tests"
	@echo "  test-watch    Run tests in watch mode"
	@echo "  coverage      Run tests with coverage report"
	@echo "  lint          Run ESLint"
	@echo "  lint-fix      Run ESLint with auto-fix"
	@echo "  format        Format code with Prettier"
	@echo "  format-check  Check code formatting"
	@echo "  type-check    Run TypeScript type checking"
	@echo ""
	@echo "Validation:"
	@echo "  validate      Run all quality checks (type-check, lint, format, test)"
	@echo "  security      Run security audit"
	@echo ""
	@echo "Build & Deployment:"
	@echo "  build         Build the project"
	@echo "  deploy        Deploy to production"
	@echo "  deploy-stage  Deploy to staging"

# Setup and installation
install:
	npm ci
	npx husky install
	chmod +x .husky/pre-commit
	@echo "✅ Installation complete! Git hooks are now active."

# Cleaning
clean:
	npm run clean

# Development
dev:
	npm run dev

start:
	npm run start

# Testing
test:
	npm run test

test-watch:
	npm run test:watch

coverage:
	npm run test:coverage
	@echo "📊 Coverage report generated in coverage/"

# Code quality
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

format-check:
	npm run format:check

type-check:
	npm run type-check

# Comprehensive validation
validate:
	@echo "🔍 Running comprehensive validation..."
	npm run validate
	@echo "✅ All checks passed!"

# Security
security:
	npm run audit:security
	npx audit-ci --moderate

# Build
build:
	npm run build
	@echo "📦 Build complete in dist/"

# Deployment
deploy:
	@echo "🚀 Deploying to production..."
	npm run deploy
	@echo "✅ Production deployment complete!"

deploy-stage:
	@echo "🚀 Deploying to staging..."
	npm run deploy:staging
	@echo "✅ Staging deployment complete!"

# Quick CI-like check
ci-check: validate security build
	@echo "✅ All CI checks passed locally!"