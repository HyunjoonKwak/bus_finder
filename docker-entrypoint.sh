#!/bin/sh

# Start cron daemon in background
crond -b -l 2

echo "Cron daemon started"
echo "Starting Next.js server..."

# Start Next.js
node server.js
