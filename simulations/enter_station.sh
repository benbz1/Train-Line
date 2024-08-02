#!/bin/bash

# Define the base URL for the API.
BASE_URL="http://localhost:3000"

# Define the station to enter.
STATION="Station1"

# Function to enter the station with a specific card num.
enter_station() {
  CARD_NUMBER=$1
  curl -s -X POST "$BASE_URL/station/$STATION/enter" -H "Content-Type: application/json" -d "{\"card_number\": \"$CARD_NUMBER\"}"
}

# Enter the station with 1000 cards
for i in {1..1000}; do
  enter_station $i &
  echo "Card $i entered station $STATION"
done

# Wait for all background jobs to complete.
wait

echo "All cards entered the station."
