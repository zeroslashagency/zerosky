#!/bin/bash
# Test Verification Script - Run after merges complete
# Location: /Users/xoxo/Documents/resreah/billing/zerosky-repo/verify-merge.sh

set -e

echo "🧪 MERGE VERIFICATION STARTED - $(date)"
echo "========================================"
echo ""

# Step 1: Install dependencies
echo "📦 Step 1/4: Installing dependencies..."
pnpm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Generate Prisma client
echo "🗄️ Step 2/4: Generating Prisma client..."
cd packages/database
pnpm prisma generate
cd ../..
echo "✅ Prisma client generated"
echo ""

# Step 3: Run all tests
echo "🧪 Step 3/4: Running all 333 tests..."
pnpm test
echo "✅ All tests passed"
echo ""

# Step 4: Typecheck and build
echo "🔍 Step 4/4: TypeScript check and build..."
pnpm typecheck
pnpm build
echo "✅ Typecheck and build successful"
echo ""

echo "========================================"
echo "✅ MERGE VERIFICATION COMPLETE!"
echo ""
echo "📊 Summary:"
echo "  - All dependencies installed"
echo "  - Prisma client generated"
echo "  - 333 tests passing"
echo "  - TypeScript compilation clean"
echo "  - Build successful"
echo ""
echo "🎯 Next: Push to remote with 'git push origin main'"
