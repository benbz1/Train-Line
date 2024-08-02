#!/bin/bash

# Define the base URL for the API.
BASE_URL="http://localhost:3000"

# Function to create a card with a specific number and a fixed balance.
create_card() {
  CARD_NUMBER=$1
  BALANCE=100
  curl -s -X POST "$BASE_URL/card" -H "Content-Type: application/json" -d "{\"number\": \"$CARD_NUMBER\", \"amount\": $BALANCE}"
}

# Create 1000 cards with numbers from 1 to 1000.
for i in {1..2500}; do
  create_card $i &
  echo "Created card $i"
done

# Wait for all background jobs to complete.
wait

echo "All cards created."
