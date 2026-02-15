#!/usr/bin/env python3
"""
Create GitHub issues from stories.json file
"""
import json
import subprocess
import sys
import time

def load_stories():
    """Load stories from JSON file"""
    with open('scripts/stories.json', 'r') as f:
        return json.load(f)

def get_epic_number(epic_name):
    """Map epic name to issue number"""
    epic_mapping = {
        'EPIC-IMMEDIATE': 1,
        'EPIC-FRONTEND': 2,
        'EPIC-INTEGRATION': 3,
        'EPIC-PRODUCTION': 4
    }
    return epic_mapping.get(epic_name)

def create_issue(story):
    """Create a GitHub issue for a story"""
    # Build labels
    labels = ','.join(story.get('labels', []))

    # Build body
    body = f"""## User Story: {story['title']}

**ID**: {story['id']}
**Epic**: {story.get('epic', 'N/A')} (Issue #{get_epic_number(story.get('epic'))})
**Priority**: {story.get('priority', 'Medium')}
**Estimated Hours**: {story.get('estimated_hours', 'TBD')}
**Agent**: {story.get('agent', 'TBD')}

### Description
{story.get('description', 'No description provided')}

### Subtasks
{chr(10).join(story.get('subtasks', []))}

### Definition of Done
{chr(10).join(story.get('definition_of_done', []))}

### Dependencies
{', '.join(['#' + str(d) for d in story.get('dependencies', [])]) if story.get('dependencies') else 'None'}
"""

    # Create the issue
    cmd = [
        'gh', 'issue', 'create',
        '--repo', 'zone17/sovren',
        '--title', f"{story['id']}: {story['title']}",
        '--label', labels,
        '--body', body
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        # Extract issue number from output
        output = result.stderr  # gh outputs to stderr
        if 'issues/' in output:
            issue_num = output.split('issues/')[-1].strip()
            print(f"✓ Created issue #{issue_num}: {story['id']} - {story['title']}")
            return issue_num
        return None
    except subprocess.CalledProcessError as e:
        print(f"✗ Failed to create {story['id']}: {e.stderr}")
        return None

def main():
    print("Loading stories from stories.json...")
    stories = load_stories()
    print(f"Found {len(stories)} stories to create\n")

    created_issues = []
    failed_issues = []

    for i, story in enumerate(stories, 1):
        print(f"[{i}/{len(stories)}] Creating {story['id']}...", end=' ')
        issue_num = create_issue(story)

        if issue_num:
            created_issues.append((story['id'], issue_num))
        else:
            failed_issues.append(story['id'])

        # Rate limit: wait a bit between creations
        if i < len(stories):
            time.sleep(1)

    print(f"\n{'='*60}")
    print(f"✓ Successfully created: {len(created_issues)} issues")
    if failed_issues:
        print(f"✗ Failed: {len(failed_issues)} issues")
        print(f"  Failed IDs: {', '.join(failed_issues)}")
    print(f"{'='*60}\n")

    # Save mapping to file
    with open('scripts/issue_mapping.json', 'w') as f:
        json.dump(dict(created_issues), f, indent=2)
    print("Issue mapping saved to scripts/issue_mapping.json")

if __name__ == '__main__':
    main()
