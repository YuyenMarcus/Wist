#!/bin/bash

# Price Tracking Deployment Test Script
# Run this after deploying to verify everything works

set -e  # Exit on error

echo "🧪 Testing Price Tracking Deployment"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
read -p "Enter your Vercel app URL (e.g., https://wist.vercel.app): " APP_URL
read -p "Enter your Railway scraper URL (e.g., https://scraper.railway.app): " SCRAPER_URL
read -sp "Enter your CRON_SECRET: " CRON_SECRET
echo ""
echo ""

# Test 1: Check Scraper Health
echo "Test 1: Checking scraper health..."
if curl -s "${SCRAPER_URL}/health" | grep -q "ok\|healthy"; then
    echo -e "${GREEN}✅ Scraper is healthy${NC}"
else
    echo -e "${RED}❌ Scraper is not responding${NC}"
    echo "   Check: railway logs"
    exit 1
fi
echo ""

# Test 2: Test Scraper with Real URL
echo "Test 2: Testing scraper with Amazon URL..."
SCRAPER_RESPONSE=$(curl -s -X POST "${SCRAPER_URL}/api/scrape/sync" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://www.amazon.com/dp/B08N5WRWNW"}')

if echo "$SCRAPER_RESPONSE" | grep -q '"success"'; then
    echo -e "${GREEN}✅ Scraper can fetch product data${NC}"
    if command -v jq &> /dev/null; then
        echo "   Price: $(echo $SCRAPER_RESPONSE | jq -r '.result.price // "N/A"')"
    fi
else
    echo -e "${YELLOW}⚠️  Scraper returned error (this might be normal for blocked sites)${NC}"
    echo "   Response: $SCRAPER_RESPONSE"
fi
echo ""

# Test 3: Test Cron Endpoint
echo "Test 3: Testing cron endpoint..."
CRON_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    "${APP_URL}/api/cron/check-prices" \
    -H "Authorization: Bearer ${CRON_SECRET}")

HTTP_CODE=$(echo "$CRON_RESPONSE" | grep -o "HTTP_CODE:[0-9]*" | cut -d: -f2)
RESPONSE_BODY=$(echo "$CRON_RESPONSE" | sed 's/HTTP_CODE:[0-9]*$//')

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Cron endpoint is accessible${NC}"
    if command -v jq &> /dev/null; then
        echo "   Response: $(echo $RESPONSE_BODY | jq -c '{checked, updates, message}')"
    else
        echo "   Response: $RESPONSE_BODY"
    fi
    
    # Check if it actually processed items
    if echo "$RESPONSE_BODY" | grep -q "checked"; then
        echo -e "${GREEN}✅ Cron successfully checked items${NC}"
    else
        echo -e "${YELLOW}⚠️  Cron ran but might not have checked items${NC}"
    fi
elif [ "$HTTP_CODE" = "401" ]; then
    echo -e "${RED}❌ Authentication failed - check CRON_SECRET${NC}"
    exit 1
else
    echo -e "${RED}❌ Cron endpoint returned error (HTTP $HTTP_CODE)${NC}"
    echo "   Response: $RESPONSE_BODY"
    exit 1
fi
echo ""

# Test 4: Check Vercel Cron Configuration
echo "Test 4: Verifying Vercel cron configuration..."
echo -e "${YELLOW}⏩ Manual check required:${NC}"
echo "   1. Go to: https://vercel.com/your-project/settings/crons"
echo "   2. Verify you see: /api/cron/check-prices"
echo "   3. Schedule should be: 0 */6 * * *"
echo ""
read -p "Press Enter after verifying cron is configured..."
echo ""

# Test 5: Database Check Instructions
echo "Test 5: Verifying database..."
echo -e "${YELLOW}⏩ Manual check required:${NC}"
echo "   1. Go to Supabase Dashboard → Table Editor"
echo "   2. Open 'items' table"
echo "   3. Verify columns exist: last_price_check, price_check_failures"
echo "   4. Open 'price_history' table"
echo "   5. Check for recent entries (created_at within last hour)"
echo ""
read -p "Press Enter after verifying database..."
echo ""

# Test 6: Manual Price Check
echo "Test 6: Testing manual price check..."
echo -e "${YELLOW}⏩ Manual test required:${NC}"
echo "   1. Go to: ${APP_URL}/dashboard"
echo "   2. Click any item"
echo "   3. Click 'Check Price Now' button"
echo "   4. Verify loading state appears"
echo "   5. Verify success message appears"
echo "   6. Refresh page and check price history chart"
echo ""
read -p "Press Enter after testing manual check..."
echo ""

# Summary
echo "======================================"
echo "🎉 Deployment Test Summary"
echo "======================================"
echo ""
echo -e "${GREEN}✅ Scraper service is running${NC}"
echo -e "${GREEN}✅ Cron endpoint is functional${NC}"
echo -e "${YELLOW}⏩ Verify Vercel cron is scheduled${NC}"
echo -e "${YELLOW}⏩ Verify database has new price history${NC}"
echo -e "${YELLOW}⏩ Verify manual price check works${NC}"
echo ""
echo "Next steps:"
echo "1. Wait 6 hours for first automatic cron run"
echo "2. Monitor logs: vercel logs --follow"
echo "3. Check price_history table for new entries"
echo "4. Monitor Railway logs: railway logs"
echo ""
echo "Monitoring commands:"
echo "  vercel logs | grep check-prices"
echo "  railway logs --tail 100"
echo ""
echo "Happy tracking! 📊"

