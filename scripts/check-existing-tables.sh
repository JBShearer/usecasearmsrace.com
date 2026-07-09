#!/bin/bash

# Check what tables currently exist in the Supabase database

echo "Checking existing tables in database..."
echo ""

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzbGNyd21iZHR2aW1qcmV4eHp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNDA0NjgsImV4cCI6MjA5NjcxNjQ2OH0.XYG0LrgA_92h7dGjw0aamX53WIrwQaqPHNHQLe8p9ls"
BASE_URL="https://aslcrwmbdtvimjrexxzw.supabase.co/rest/v1"

tables=(
  "cases"
  "entities"
  "actions"
  "reputation"
  "triple_submissions"
  "user_cards"
  "use_cases"
  "user_profiles"
  "semantic_modifiers"
  "rate_limits"
)

for table in "${tables[@]}"; do
  response=$(curl -s -H "apikey: $ANON_KEY" "$BASE_URL/$table?limit=0" 2>&1)

  if echo "$response" | grep -q "Could not find the table"; then
    echo "❌ $table - does not exist"
  elif echo "$response" | grep -q "\[\]"; then
    echo "✅ $table - exists (empty)"
  else
    echo "✅ $table - exists (has data)"
  fi
done

echo ""
echo "Summary:"
echo "- Tables marked ✅ already exist in database"
echo "- Tables marked ❌ need to be created"
echo ""
echo "Decision:"
echo "- If 'cases', 'entities', 'actions' exist → Use existing schema, skip 001/002"
echo "- If they don't exist → Need to create proper schema for deployed functions"
