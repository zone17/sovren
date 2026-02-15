#!/usr/bin/env python3
"""
Create GitHub Project Board for Sovren Production Launch

This script creates:
1. GitHub Project (Projects v2)
2. 4 Epic issues
3. 67 User story issues
4. Milestones
5. Labels
6. Links everything together

Requirements:
- GitHub CLI (gh) installed and authenticated
- Python 3.7+

Usage:
    python scripts/create-github-project.py [--dry-run]
"""

import subprocess
import json
import sys
import argparse
from typing import Dict, List, Optional
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Story:
    """User story data structure"""
    id: str
    title: str
    priority: str
    estimated_hours: float
    agent: str
    dependencies: List[str]
    description: str
    subtasks: List[str]
    definition_of_done: List[str]
    epic: str
    labels: List[str]

class GitHubProjectCreator:
    """Creates GitHub project board and issues"""

    def __init__(self, repo: str = "zone17/sovren", dry_run: bool = False):
        self.repo = repo
        self.dry_run = dry_run
        self.created_issues = {}  # story_id -> issue_number
        self.project_id = None

    def run_gh_command(self, cmd: List[str], capture_output: bool = True) -> Optional[str]:
        """Run GitHub CLI command"""
        if self.dry_run:
            print(f"[DRY RUN] Would run: {' '.join(cmd)}")
            return None

        try:
            result = subprocess.run(
                cmd,
                capture_output=capture_output,
                text=True,
                check=True
            )
            return result.stdout.strip() if capture_output else None
        except subprocess.CalledProcessError as e:
            print(f"Error running command: {' '.join(cmd)}")
            print(f"Error: {e.stderr}")
            return None

    def create_labels(self):
        """Create standard labels for the project"""
        labels = [
            ("epic", "7F00FF", "Epic-level issues spanning multiple stories"),
            ("user-story", "0E8A16", "Individual user story"),
            ("priority:critical", "D73A49", "Critical priority - must fix immediately"),
            ("priority:high", "FF6B6B", "High priority"),
            ("priority:medium", "FFA500", "Medium priority"),
            ("priority:low", "FBCA04", "Low priority"),
            ("epic:immediate", "B60205", "Epic 1: Immediate Blockers"),
            ("epic:frontend", "0052CC", "Epic 2: Frontend Implementation"),
            ("epic:integration", "5319E7", "Epic 3: Integration & Testing"),
            ("epic:production", "006B75", "Epic 4: Production Readiness"),
            ("frontend", "1D76DB", "Frontend work"),
            ("backend", "5B4FE0", "Backend work"),
            ("security", "D73A49", "Security-related"),
            ("testing", "BFD4F2", "Testing work"),
            ("documentation", "D4C5F9", "Documentation"),
            ("deployment", "0E8A16", "Deployment-related"),
        ]

        print("\n=== Creating Labels ===")
        for name, color, description in labels:
            cmd = [
                "gh", "label", "create", name,
                "--color", color,
                "--description", description,
                "--repo", self.repo,
                "--force"  # Update if exists
            ]
            self.run_gh_command(cmd, capture_output=False)
            print(f"✓ Created label: {name}")

    def create_milestones(self):
        """Create milestones for each week"""
        milestones = [
            ("Week 1: Immediate Blockers", "2025-11-08", "Complete all immediate blockers"),
            ("Week 2: Frontend Start", "2025-11-15", "Begin frontend implementation"),
            ("Week 3: Frontend Progress", "2025-11-22", "Continue frontend work"),
            ("Week 4: Frontend Complete", "2025-11-29", "Complete frontend stories"),
            ("Week 5: Integration & Testing", "2025-12-06", "Integration testing complete"),
            ("Week 6: Production Ready", "2025-12-13", "Final production readiness - LAUNCH"),
        ]

        print("\n=== Creating Milestones ===")
        for title, due_date, description in milestones:
            cmd = [
                "gh", "api",
                f"/repos/{self.repo}/milestones",
                "-X", "POST",
                "-f", f"title={title}",
                "-f", f"due_on={due_date}T23:59:59Z",
                "-f", f"description={description}",
            ]
            result = self.run_gh_command(cmd)
            if result:
                print(f"✓ Created milestone: {title}")

    def create_project(self) -> Optional[str]:
        """Create GitHub Project (Projects v2)"""
        print("\n=== Creating GitHub Project ===")

        # Get repository owner and name
        owner = self.repo.split('/')[0]

        # Create project
        cmd = [
            "gh", "project", "create",
            "--owner", owner,
            "--title", "Sovren Production Launch",
            "--format", "json"
        ]

        result = self.run_gh_command(cmd)
        if result:
            project_data = json.loads(result)
            self.project_id = project_data.get('id') or project_data.get('number')
            print(f"✓ Created project: Sovren Production Launch (ID: {self.project_id})")
            return self.project_id
        return None

    def create_epic_issue(self, epic_data: Dict) -> Optional[int]:
        """Create an epic issue"""
        title = epic_data['title']
        body = epic_data['body']
        labels = epic_data['labels']

        # Create issue
        cmd = [
            "gh", "issue", "create",
            "--repo", self.repo,
            "--title", title,
            "--body", body,
            "--label", ','.join(labels),
        ]

        result = self.run_gh_command(cmd)
        if result:
            # Extract issue number from URL
            issue_number = result.split('/')[-1]
            print(f"✓ Created epic: {title} (#{issue_number})")
            return int(issue_number)
        return None

    def create_story_issue(self, story: Story, epic_number: Optional[int] = None) -> Optional[int]:
        """Create a user story issue"""
        # Build title
        title = f"[{story.id}] {story.title}"

        # Build body
        body = f"""## {story.title}

**Epic**: {story.epic}""" + (f" (#{epic_number})" if epic_number else "") + f"""
**Priority**: {story.priority}
**Estimated Time**: {story.estimated_hours} hours
**Agent**: {story.agent}
**Dependencies**: {', '.join(story.dependencies) if story.dependencies else 'None'}

### Description
{story.description}

### Subtasks
{chr(10).join(story.subtasks)}

### Definition of Done
{chr(10).join(story.definition_of_done)}

---
*Part of Epic: {story.epic}*
*Created by automated GitHub Project setup*
"""

        # Create issue
        cmd = [
            "gh", "issue", "create",
            "--repo", self.repo,
            "--title", title,
            "--body", body,
            "--label", ','.join(story.labels),
        ]

        result = self.run_gh_command(cmd)
        if result:
            issue_number = result.split('/')[-1]
            self.created_issues[story.id] = int(issue_number)
            return int(issue_number)
        return None

    def add_issue_to_project(self, issue_url: str):
        """Add issue to project board"""
        if not self.project_id:
            return

        cmd = [
            "gh", "project", "item-add", str(self.project_id),
            "--owner", self.repo.split('/')[0],
            "--url", issue_url,
        ]
        self.run_gh_command(cmd, capture_output=False)

    def create_all_epics(self) -> Dict[str, int]:
        """Create all 4 epic issues"""
        epics = {
            'EPIC-IMMEDIATE': {
                'title': 'EPIC-IMMEDIATE: Fix Immediate Blockers',
                'labels': ['epic', 'priority:critical', 'epic:immediate'],
                'body': """## Epic: Immediate Blockers (Week 1)

**Goal**: Unblock testing, commit staged work, secure platform
**Duration**: 1 week (Nov 4-8, 2025)
**Total Stories**: 7
**Estimated Hours**: 13

### User Stories
This epic includes 7 critical stories that must be completed before any other work can proceed:
1. Fix Jest Configuration Collision
2. Fix pool.test.ts Syntax Error
3. Rotate Exposed GitHub Token (SECURITY)
4. Rotate Supabase Database Credentials (SECURITY)
5. Update npm Dependencies (Security Vulnerabilities)
6. Code Review US-007 Staged Changes
7. Merge US-007 to Main Branch

### Success Criteria
- ✅ All tests passing (85%+ coverage)
- ✅ Security score 90+/100
- ✅ US-007 merged to main
- ✅ Zero blocking issues

### Milestone
Week 1 Complete (Nov 8, 2025)
"""
            },
            'EPIC-FRONTEND': {
                'title': 'EPIC-FRONTEND: Critical Frontend User Stories',
                'labels': ['epic', 'priority:critical', 'epic:frontend', 'frontend'],
                'body': """## Epic: Critical Frontend Implementation (Weeks 2-4)

**Goal**: Implement US-001, US-002, US-003, US-007 frontend
**Duration**: 3 weeks (Nov 11 - Dec 1, 2025)
**Total Stories**: 41
**Estimated Hours**: 235

### User Stories by Feature

#### US-001: NOSTR Authentication (12 stories)
Design and implement complete NOSTR authentication flow with browser extension support and manual key fallback.

#### US-002: Content Creation & Publishing (12 stories)
Rich text editor with media upload, premium content gating, and NOSTR event publishing.

#### US-007: Lightning Network Payments (12 stories)
Complete Lightning Network integration for subscriptions, tips, and content purchases.

#### US-003: Subscription Tier Management (5 stories)
Creator dashboard for managing subscription tiers and pricing.

### Success Criteria
- ✅ All UIs functional and tested
- ✅ 95%+ test coverage (100% for payments)
- ✅ All code reviews approved
- ✅ Zero ESLint/TypeScript errors

### Milestone
Week 4 Complete (Nov 29, 2025)
"""
            },
            'EPIC-INTEGRATION': {
                'title': 'EPIC-INTEGRATION: Integration & Testing',
                'labels': ['epic', 'priority:high', 'epic:integration', 'testing'],
                'body': """## Epic: Integration & Testing (Week 5)

**Goal**: E2E testing, NOSTR validation, accessibility audit
**Duration**: 1 week (Dec 2-6, 2025)
**Total Stories**: 10
**Estimated Hours**: 56

### User Stories

#### E2E Testing (6 stories)
1. Set up Playwright infrastructure
2. Creator onboarding flow test
3. Supporter subscription flow test
4. Content creation flow test
5. Lightning payment flow test
6. Error recovery flow test

#### NOSTR Protocol Validation (1 story)
Validate compliance with NIP-01, NIP-23, NIP-57

#### Accessibility Audit (3 stories)
1. Automated testing (Lighthouse, axe-core)
2. Manual testing (screen readers, keyboard)
3. Fix critical accessibility issues

### Success Criteria
- ✅ E2E tests passing (5 critical flows)
- ✅ NOSTR protocol compliant
- ✅ WCAG AA compliant (90+ Lighthouse score)
- ✅ Zero critical accessibility issues

### Milestone
Week 5 Complete (Dec 6, 2025)
"""
            },
            'EPIC-PRODUCTION': {
                'title': 'EPIC-PRODUCTION: Production Readiness',
                'labels': ['epic', 'priority:high', 'epic:production', 'deployment'],
                'body': """## Epic: Production Readiness (Week 6)

**Goal**: Final security, performance, monitoring, docs
**Duration**: 1 week (Dec 9-13, 2025)
**Total Stories**: 9
**Estimated Hours**: 57

### User Stories

#### Security Audits (3 stories)
1. Frontend security audit
2. Backend security audit
3. NOSTR & Lightning security audit

#### Performance Optimization (3 stories)
1. Bundle size optimization (<250KB per chunk)
2. Core Web Vitals optimization
3. React performance optimization

#### Production Infrastructure (3 stories)
1. Production monitoring (Sentry, analytics)
2. API documentation updates
3. Final production readiness review

### Success Criteria
- ✅ Security score 95/100
- ✅ Core Web Vitals met (LCP <2.5s, FID <100ms, CLS <0.1)
- ✅ Bundle sizes optimized
- ✅ Monitoring live and tested
- ✅ Documentation complete
- ✅ Production certified - LAUNCH READY

### Milestone
Week 6 Complete (Dec 13, 2025) - **PRODUCTION LAUNCH** 🚀
"""
            }
        }

        print("\n=== Creating Epic Issues ===")
        epic_numbers = {}

        for epic_key, epic_data in epics.items():
            issue_number = self.create_epic_issue(epic_data)
            if issue_number:
                epic_numbers[epic_key] = issue_number

                # Add to project
                issue_url = f"https://github.com/{self.repo}/issues/{issue_number}"
                self.add_issue_to_project(issue_url)

        return epic_numbers

    def get_all_stories(self) -> List[Story]:
        """Get all story data from JSON file"""
        # Load stories from JSON
        script_dir = Path(__file__).parent
        stories_file = script_dir / 'stories.json'

        if not stories_file.exists():
            print(f"Error: {stories_file} not found")
            print("Run extract-stories.py first to generate stories.json")
            return []

        with open(stories_file, 'r') as f:
            stories_data = json.load(f)

        stories = []
        for data in stories_data:
            story = Story(
                id=data['id'],
                title=data['title'],
                priority=data['priority'],
                estimated_hours=data['estimated_hours'],
                agent=data['agent'],
                dependencies=data['dependencies'],
                epic=data['epic'],
                labels=data['labels'],
                description=data['description'],
                subtasks=data['subtasks'],
                definition_of_done=data['definition_of_done']
            )
            stories.append(story)

        return stories

        return stories

    def create_all_stories(self, epic_numbers: Dict[str, int]):
        """Create all user story issues"""
        print("\n=== Creating User Story Issues ===")
        print("This will create 67 user story issues...")

        stories = self.get_all_stories()
        created_count = 0

        for story in stories:
            # Get epic number for linking
            epic_number = epic_numbers.get(story.epic)

            # Create issue
            issue_number = self.create_story_issue(story, epic_number)

            if issue_number:
                created_count += 1
                print(f"✓ [{created_count}/67] Created: {story.id} - {story.title} (#{issue_number})")

                # Add to project
                issue_url = f"https://github.com/{self.repo}/issues/{issue_number}"
                self.add_issue_to_project(issue_url)
            else:
                print(f"✗ Failed to create: {story.id}")

        print(f"\nCreated {created_count}/67 user story issues")
        return created_count

    def generate_summary(self, epic_numbers: Dict[str, int]):
        """Generate summary report"""
        print("\n" + "="*80)
        print("GITHUB PROJECT CREATION SUMMARY")
        print("="*80)

        print(f"\n📋 Project: Sovren Production Launch")
        if self.project_id:
            print(f"   Project ID: {self.project_id}")
            owner = self.repo.split('/')[0]
            print(f"   URL: https://github.com/users/{owner}/projects/{self.project_id}")

        print(f"\n📦 Epic Issues Created:")
        for epic_name, issue_num in epic_numbers.items():
            print(f"   {epic_name}: #{issue_num}")
            print(f"   URL: https://github.com/{self.repo}/issues/{issue_num}")

        print(f"\n📝 User Story Issues: {len(self.created_issues)} created")

        print(f"\n🏁 Milestones Created:")
        print("   Week 1: Nov 8, 2025 - Immediate Blockers")
        print("   Week 2: Nov 15, 2025 - Frontend Start")
        print("   Week 3: Nov 22, 2025 - Frontend Progress")
        print("   Week 4: Nov 29, 2025 - Frontend Complete")
        print("   Week 5: Dec 6, 2025 - Integration & Testing")
        print("   Week 6: Dec 13, 2025 - PRODUCTION LAUNCH 🚀")

        print(f"\n🎯 Next Actions:")
        print("   1. Start with IMMED-001: Fix Jest Configuration")
        print("   2. Parallel: IMMED-003, IMMED-004 (security)")
        print("   3. View project board and organize stories")
        print("   4. Assign Week 1 stories to milestones")

        print("\n" + "="*80)

    def run(self):
        """Main execution flow"""
        print("="*80)
        print("SOVREN PRODUCTION LAUNCH - GITHUB PROJECT SETUP")
        print("="*80)
        print(f"Repository: {self.repo}")
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")

        if not self.dry_run:
            confirm = input("\nThis will create 4 epics + 67 issues. Continue? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Aborted.")
                return

        # Step 1: Create labels
        self.create_labels()

        # Step 2: Create milestones
        self.create_milestones()

        # Step 3: Create project
        self.create_project()

        # Step 4: Create epic issues
        epic_numbers = self.create_all_epics()

        # Step 5: Create story issues
        self.create_all_stories(epic_numbers)

        # Step 6: Generate summary
        self.generate_summary(epic_numbers)

        print("\n✅ GitHub Project setup complete!")

def main():
    parser = argparse.ArgumentParser(description='Create GitHub Project for Sovren')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be created without creating')
    parser.add_argument('--repo', default='zone17/sovren', help='GitHub repository (owner/repo)')

    args = parser.parse_args()

    creator = GitHubProjectCreator(repo=args.repo, dry_run=args.dry_run)
    creator.run()

if __name__ == '__main__':
    main()
