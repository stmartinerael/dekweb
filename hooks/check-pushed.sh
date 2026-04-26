#!/bin/bash
# check-pushed.sh: Verifies that fix/feature branches have been pushed to remote.

BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Only check fix/ or feat/ branches
if [[ ! "$BRANCH" =~ ^(fix|feat|feature)/ ]]; then
  exit 0
fi

# Check if branch has an upstream
UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null)
if [ -z "$UPSTREAM" ]; then
  echo "❌ Error: Branch '$BRANCH' has no remote upstream. Always push your changes."
  exit 1
fi

# Check if local is ahead of remote
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" != "$REMOTE" ]; then
    # Check if we are actually ahead (not behind)
    BEHIND=$(git rev-list --count HEAD..@{u})
    AHEAD=$(git rev-list --count @{u}..HEAD)
    
    if [ "$AHEAD" -gt 0 ]; then
        echo "❌ Error: Branch '$BRANCH' has $AHEAD unpushed commit(s)."
        exit 1
    fi
fi

echo "✅ Branch '$BRANCH' is pushed and up to date."
exit 0
