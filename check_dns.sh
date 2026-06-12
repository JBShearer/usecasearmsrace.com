#!/bin/bash
# Check DNS configuration for usecasearmsrace.com

echo "🌐 Checking DNS for usecasearmsrace.com"
echo "========================================"
echo ""

echo "Current DNS records:"
dig +short usecasearmsrace.com A
echo ""

echo "Expected GitHub Pages IPs:"
echo "  185.199.108.153"
echo "  185.199.109.153"
echo "  185.199.110.153"
echo "  185.199.111.153"
echo ""

echo "Testing HTTPS redirect:"
curl -sI https://usecasearmsrace.com | grep -E "(HTTP|location)" | head -5
echo ""

echo "GitHub Pages direct access:"
echo "  https://jbshearer.github.io/usecasearmsrace.com/"
echo ""

# Test GitHub Pages direct
GITHUB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://jbshearer.github.io/usecasearmsrace.com/)
if [ "$GITHUB_STATUS" = "200" ]; then
    echo "✅ GitHub Pages is live and working!"
    echo "   Issue is just DNS - update domain registrar"
else
    echo "⚠️  GitHub Pages returned: $GITHUB_STATUS"
fi

