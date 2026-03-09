#!/usr/bin/env python3
"""
Script to update the upload-rob-test.js to run headful (visible browser)
"""

# Read the current test file
with open(
    "/Users/tosku/Sync/Documents/cinema/webapp/test/upload-rob-test.js", "r"
) as f:
    content = f.read()

# Change headless: true to headless: false
content = content.replace("headless: true", "headless: false")

# Write the updated test file
with open(
    "/Users/tosku/Sync/Documents/cinema/webapp/test/upload-rob-test.js", "w"
) as f:
    f.write(content)

print("✓ Updated upload-rob-test.js to run headful (visible browser)")
