#!/usr/bin/env python3
"""
Extract all stories from EPIC_STORY_DECOMPOSITION.md

This script parses the decomposition markdown file and extracts:
- Story ID
- Title
- Priority
- Estimated hours
- Agent
- Dependencies
- Description
- Subtasks
- Definition of Done
- Epic assignment

Output: JSON file with all story data
"""

import re
import json
from pathlib import Path

def extract_stories_from_markdown(md_path: str) -> list:
    """Extract all stories from the markdown file"""

    with open(md_path, 'r') as f:
        content = f.read()

    stories = []

    # Find all story sections
    # Pattern: ### Story STORY-ID: Title
    story_pattern = r'### Story ([A-Z]+-\d+): (.+?)\n\n\*\*Priority\*\*: (.+?)\n\*\*Estimated Time\*\*: (.+?) hours?\n\*\*Agent\*\*: (.+?)\n\*\*Dependencies\*\*: (.+?)\n\*\*Can Start\*\*: (.+?)\n\n\*\*Description\*\*:\n(.+?)\n\n\*\*Subtasks\*\*:\n((?:- \[ \] .+?\n)+)\n\*\*Definition of Done\*\*:\n((?:- \[ \] .+?\n)+)'

    matches = re.finditer(story_pattern, content, re.MULTILINE | re.DOTALL)

    current_epic = None

    for match in matches:
        story_id = match.group(1)
        title = match.group(2)
        priority = match.group(3)
        estimated_hours = float(match.group(4).split()[0])  # Extract just the number
        agent = match.group(5)
        dependencies_str = match.group(6)
        description = match.group(8).strip()
        subtasks = [line.strip() for line in match.group(9).strip().split('\n')]
        dod = [line.strip() for line in match.group(10).strip().split('\n')]

        # Parse dependencies
        if dependencies_str.lower() in ['none', 'none (can run in parallel)']:
            dependencies = []
        else:
            # Extract story IDs from dependencies string
            dep_matches = re.findall(r'([A-Z]+-\d+)', dependencies_str)
            dependencies = dep_matches

        # Determine epic based on story ID prefix
        if story_id.startswith('IMMED'):
            epic = 'EPIC-IMMEDIATE'
            epic_label = 'epic:immediate'
        elif story_id.startswith('FE'):
            epic = 'EPIC-FRONTEND'
            epic_label = 'epic:frontend'
        elif story_id.startswith('INT'):
            epic = 'EPIC-INTEGRATION'
            epic_label = 'epic:integration'
        elif story_id.startswith('PROD'):
            epic = 'EPIC-PRODUCTION'
            epic_label = 'epic:production'
        else:
            epic = 'UNKNOWN'
            epic_label = 'unknown'

        # Determine labels
        labels = ['user-story', epic_label]

        if priority.upper() == 'CRITICAL':
            labels.append('priority:critical')
        elif priority.upper() == 'HIGH':
            labels.append('priority:high')
        elif priority.upper() == 'MEDIUM':
            labels.append('priority:medium')
        else:
            labels.append('priority:low')

        # Add category labels based on content
        title_lower = title.lower()
        if 'design' in title_lower or 'wireframe' in title_lower or 'mockup' in title_lower:
            labels.append('design')
        if 'test' in title_lower:
            labels.append('testing')
        if 'security' in title_lower or 'audit' in title_lower:
            labels.append('security')
        if 'frontend' in title_lower or story_id.startswith('FE'):
            labels.append('frontend')
        if 'backend' in title_lower or 'database' in title_lower:
            labels.append('backend')
        if 'deploy' in title_lower:
            labels.append('deployment')
        if 'document' in title_lower or 'doc' in title_lower:
            labels.append('documentation')

        story_data = {
            'id': story_id,
            'title': title,
            'priority': priority,
            'estimated_hours': estimated_hours,
            'agent': agent,
            'dependencies': dependencies,
            'description': description,
            'subtasks': subtasks,
            'definition_of_done': dod,
            'epic': epic,
            'labels': labels
        }

        stories.append(story_data)

    return stories

def main():
    # Find the decomposition file
    base_dir = Path(__file__).parent.parent
    md_file = base_dir / 'EPIC_STORY_DECOMPOSITION.md'

    if not md_file.exists():
        print(f"Error: {md_file} not found")
        return

    print(f"Extracting stories from: {md_file}")
    stories = extract_stories_from_markdown(str(md_file))

    print(f"Extracted {len(stories)} stories")

    # Group by epic
    epic_counts = {}
    for story in stories:
        epic = story['epic']
        epic_counts[epic] = epic_counts.get(epic, 0) + 1

    print("\nStories by Epic:")
    for epic, count in epic_counts.items():
        print(f"  {epic}: {count} stories")

    # Save to JSON
    output_file = base_dir / 'scripts' / 'stories.json'
    with open(output_file, 'w') as f:
        json.dump(stories, f, indent=2)

    print(f"\nSaved to: {output_file}")

    # Print sample
    if stories:
        print("\nSample story:")
        print(json.dumps(stories[0], indent=2))

if __name__ == '__main__':
    main()
