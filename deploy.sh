#!/bin/bash
# Deploy Use Case Arms Race to GitHub Pages

set -e

echo "🧠 Evil Brain Labs - Deploying Use Case Arms Race"
echo "=================================================="
echo ""

cd ~/Documents/"Evil Brain Production"/usecasearmsrace.com

# Check git status
echo "📋 Checking repository status..."
git status --short

# Verify Supabase config
echo ""
echo "✓ Supabase configured: aslcrwmbdtvimjrexxzw.supabase.co"

# Instructions
echo ""
echo "🚀 Ready to deploy!"
echo ""
echo "Next steps:"
echo "1. Create GitHub repo at: https://github.com/new"
echo "   Name: usecasearmsrace.com"
echo "   Description: Daily AI comedy from Evil Brain Labs"
echo "   Public repo"
echo ""
echo "2. Push code:"
echo "   git push -u origin main"
echo ""
echo "3. Enable GitHub Pages:"
echo "   Repo → Settings → Pages"
echo "   Source: main branch"
echo "   Save"
echo ""
echo "4. Configure custom domain (if you own usecasearmsrace.com):"
echo "   In GitHub: Settings → Pages → Custom domain: usecasearmsrace.com"
echo "   In DNS: Add A records to GitHub Pages IPs"
echo ""
echo "Site will be live at:"
echo "  https://JBShearer.github.io/usecasearmsrace.com/"
echo "  (or https://usecasearmsrace.com with custom domain)"
echo ""
