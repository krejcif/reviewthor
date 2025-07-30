#!/bin/bash

# ReviewThor Local Quality Checks Script
# This script runs the same checks that are performed in CI/CD

set -e  # Exit on any error

echo "🔍 Running ReviewThor Local Quality Checks..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm ci
fi

echo ""
print_status "1. Running TypeScript type checking..."
if npm run type-check; then
    print_success "TypeScript type checking passed"
else
    print_error "TypeScript type checking failed"
    exit 1
fi

echo ""
print_status "2. Running ESLint..."
if npm run lint; then
    print_success "ESLint checks passed"
else
    print_error "ESLint checks failed"
    exit 1
fi

echo ""
print_status "3. Running Prettier format check..."
if npm run format:check; then
    print_success "Code formatting is correct"
else
    print_error "Code formatting issues found. Run 'npm run format' to fix."
    exit 1
fi

echo ""
print_status "4. Running tests with coverage..."
if npm run test:coverage; then
    print_success "All tests passed with adequate coverage"
else
    print_error "Tests failed or coverage is below threshold"
    exit 1
fi

echo ""
print_status "5. Running security audit..."
if npm run audit:security; then
    print_success "Security audit passed"
else
    print_warning "Security audit found issues. Review them carefully."
fi

echo ""
print_status "6. Building project..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    exit 1
fi

echo ""
echo "=============================================="
print_success "🎉 All local quality checks passed!"
echo "Your code is ready for commit and CI/CD pipeline."
echo ""
echo "To run individual checks:"
echo "  make lint       - Run ESLint"
echo "  make format     - Format code"
echo "  make test       - Run tests"
echo "  make validate   - Run all quality checks"
echo "=============================================="