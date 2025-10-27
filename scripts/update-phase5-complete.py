#!/usr/bin/env python3
"""Update Epic 004 Phase 5 stories to completed status"""

import json
from datetime import datetime

# Load the tasks file
with open('/Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json', 'r') as f:
    data = json.load(f)

# Track what we're updating
updates_made = []
completed_at = datetime.now().isoformat() + "Z"

# Update Phase 5 stories (US-E4-023, US-E4-024, US-E4-025)
phase5_stories = ['US-E4-023', 'US-E4-024', 'US-E4-025']

for phase_name, phase_data in data['phases'].items():
    if 'tasks' in phase_data:
        for task in phase_data['tasks']:
            # Update Phase 5 stories
            if task.get('story_id') in phase5_stories:
                old_status = task.get('status', 'unknown')
                old_progress = task.get('progress_percent', 0)

                task['status'] = 'completed'
                task['progress_percent'] = 100
                task['completed_at'] = completed_at

                # Add files created based on story
                if task['story_id'] == 'US-E4-025':
                    task['files_created'] = [
                        'docs/architecture/decisions/ADR-004-state-management-boundaries.md'
                    ]
                    task['description'] = 'Architecture Decision Record documenting state management boundaries'
                elif task['story_id'] == 'US-E4-023':
                    task['files_created'] = [
                        'docs/development/guidelines/STATE-MANAGEMENT-GUIDELINES.md',
                        'docs/development/guidelines/STATE-MANAGEMENT-QUICK-REFERENCE.md'
                    ]
                    task['description'] = 'Comprehensive developer guidelines and quick reference for state management'
                elif task['story_id'] == 'US-E4-024':
                    task['files_created'] = [
                        'docs/training/workshop/STATE-MANAGEMENT-WORKSHOP.md',
                        'docs/training/workshop/exercises/README.md',
                        'docs/training/workshop/slides/workshop-presentation.md'
                    ]
                    task['description'] = 'Complete training workshop materials with exercises and slides'

                # Mark all subtasks as completed
                if 'subtasks' in task:
                    for subtask in task['subtasks']:
                        subtask['status'] = 'completed'

                updates_made.append(f"{task['story_id']}: {old_status}({old_progress}%) -> completed(100%)")

            # Update Epic 004 parent task
            elif task.get('id') == 'epic-004-parent':
                task['name'] = 'Epic 004: State Management - 25/25 COMPLETE! 🎉'
                task['status'] = 'completed'
                task['progress_percent'] = 100
                task['completed_at'] = completed_at
                updates_made.append("Epic 004 marked as COMPLETE!")

# Save the updated file
with open('/Users/fp/Desktop/Sovren/monitoring/dashboard/data/tasks.json', 'w') as f:
    json.dump(data, f, indent=2)

print("✅ Phase 5 Documentation Complete!")
print("\nUpdates made:")
for update in updates_made:
    print(f"  - {update}")

print(f"\n🎉 EPIC 004 COMPLETE! All 25 stories delivered!")
print(f"   Phase 1: 5/5 stories ✅")
print(f"   Phase 2: 7/7 stories ✅")
print(f"   Phase 3: 5/5 stories ✅")
print(f"   Phase 4: 5/5 stories ✅")
print(f"   Phase 5: 3/3 stories ✅")
print(f"   TOTAL:   25/25 stories (100%) 🚀")