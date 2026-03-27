#!/bin/bash
# TDEE Calculator - Dev Server Init Script
echo "Starting TDEE Calculator dev server..."
echo "Open http://localhost:8000 in your browser"
python3 -m http.server 8000 2>/dev/null || python -m http.server 8000
