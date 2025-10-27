#!/usr/bin/env node

/**
 * Automatic Epic and Story Discovery System
 *
 * This module automatically discovers and tracks:
 * - User stories from docs/user-stories/ and docs/refactoring/
 * - Epic definitions from markdown files
 * - Active work from Claude Code agent activity
 * - Tasks from various tracking files
 *
 * NO MANUAL EPIC ADDITION REQUIRED - Everything is discovered automatically
 */

const fs = require('fs').promises;
const path = require('path');
const glob = require('glob');

class AutoDiscovery {
  constructor(projectRoot, dataDir) {
    this.projectRoot = projectRoot;
    this.dataDir = dataDir;
    this.tasksFile = path.join(dataDir, 'tasks.json');

    // Discovery patterns
    this.patterns = {
      epics: [
        '**/epic-*/README.md',
        '**/epic-*/INDEX.md',
        '**/EPIC-*.md',
        '**/epic-*.md'
      ],
      stories: [
        '**/US-*.md',
        '**/user-stories/*.md',
        '**/epic-*/stories/*.md',
        '**/refactoring/epic-*/STORY_BREAKDOWN.md'
      ],
      tasks: [
        '**/.claude/tasks.json',
        '**/monitoring/**/tasks.json',
        '**/project-status.json'
      ]
    };

    // Story ID patterns by epic
    this.epicPatterns = {
      'Epic 003': /US-3\d{2}/g,  // US-301 to US-399
      'Epic 004': /US-4\d{2}/g,  // US-401 to US-499
      'Epic 005': /US-5\d{2}/g,  // US-501 to US-599
      'Epic 006': /US-6\d{2}/g,  // US-601 to US-699
      'Epic 007': /US-7\d{2}/g,  // US-701 to US-799
      'Epic 008': /US-8\d{2}/g,  // US-801 to US-899
      'Epic 009': /US-9\d{2}/g   // US-901 to US-999
    };
  }

  /**
   * Main discovery method - finds all epics and stories automatically
   */
  async discover() {
    console.log('🔍 Starting automatic epic and story discovery...\n');

    const discovered = {
      epics: [],
      stories: new Map(),
      tasks: []
    };

    // 1. Discover epics from documentation
    const epicDirs = await this.discoverEpics();
    console.log(`✅ Found ${epicDirs.length} epic directories\n`);

    // 2. For each epic, discover its stories
    for (const epicInfo of epicDirs) {
      console.log(`📖 Discovering stories for ${epicInfo.name}...`);
      const stories = await this.discoverStoriesForEpic(epicInfo);
      discovered.stories.set(epicInfo.name, stories);
      console.log(`   Found ${stories.length} stories\n`);
    }

    // 3. Scan for story IDs in all markdown files
    const scannedStories = await this.scanForStoryIds();
    console.log(`✅ Scanned ${scannedStories.length} story IDs from codebase\n`);

    // 4. Merge with existing tasks.json (preserve status, progress, etc.)
    const mergedData = await this.mergeWithExisting(discovered, scannedStories);

    // 5. Save updated tasks.json
    await this.saveTasks(mergedData);

    return mergedData;
  }

  /**
   * Discover epic directories and metadata
   */
  async discoverEpics() {
    const epics = [];
    const docsDir = path.join(this.projectRoot, 'docs');

    // Find epic directories
    const epicDirs = await new Promise((resolve, reject) => {
      glob('**/epic-*/', { cwd: docsDir }, (err, matches) => {
        if (err) reject(err);
        else resolve(matches);
      });
    });

    for (const epicDir of epicDirs) {
      const epicPath = path.join(docsDir, epicDir);

      // Try to find epic metadata
      const readmePath = path.join(epicPath, 'README.md');
      const indexPath = path.join(epicPath, 'INDEX.md');

      let epicInfo = null;

      // Try README.md first
      try {
        const content = await fs.readFile(readmePath, 'utf8');
        epicInfo = this.parseEpicMetadata(content, epicDir);
      } catch (err) {
        // Try INDEX.md
        try {
          const content = await fs.readFile(indexPath, 'utf8');
          epicInfo = this.parseEpicMetadata(content, epicDir);
        } catch (err2) {
          // Use directory name as fallback
          epicInfo = this.extractEpicFromDir(epicDir);
        }
      }

      if (epicInfo) {
        epics.push({
          ...epicInfo,
          path: epicPath
        });
      }
    }

    // Also scan for EPIC-*.md files in refactoring/
    const refactoringDir = path.join(docsDir, 'refactoring');
    try {
      const files = await fs.readdir(refactoringDir);
      for (const file of files) {
        if (file.match(/^EPIC-\d+-.*\.md$/i)) {
          const filePath = path.join(refactoringDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const epicInfo = this.parseEpicMetadata(content, file);
          if (epicInfo) {
            epics.push({
              ...epicInfo,
              path: filePath
            });
          }
        }
      }
    } catch (err) {
      // Directory doesn't exist, skip
    }

    return epics;
  }

  /**
   * Parse epic metadata from markdown content
   */
  parseEpicMetadata(content, source) {
    // Extract epic number and name
    const epicMatch = content.match(/Epic\s+(\d+)[:\s]+([^\n]+)/i);
    if (!epicMatch) {
      return this.extractEpicFromDir(source);
    }

    const epicNumber = epicMatch[1].padStart(3, '0');
    const epicName = epicMatch[2].trim().replace(/[\-#*]/g, '').trim();

    // Extract total stories
    const storyMatch = content.match(/(?:Total Stories?|Story Count)[:\s]+(\d+)/i);
    const totalStories = storyMatch ? parseInt(storyMatch[1]) : 0;

    // Extract story point total
    const pointsMatch = content.match(/(?:Total (?:Story )?Points?)[:\s]+(\d+)/i);
    const totalPoints = pointsMatch ? parseInt(pointsMatch[1]) : totalStories;

    return {
      number: epicNumber,
      name: `Epic ${epicNumber}: ${epicName}`,
      shortName: epicName,
      totalStories: totalStories,
      totalPoints: totalPoints
    };
  }

  /**
   * Extract epic info from directory or file name
   */
  extractEpicFromDir(dirOrFile) {
    const epicMatch = dirOrFile.match(/epic[-_]?(\d+)(?:[-_](.+?))?/i);
    if (!epicMatch) return null;

    const epicNumber = epicMatch[1].padStart(3, '0');
    const epicName = epicMatch[2]
      ? epicMatch[2].replace(/[-_]/g, ' ').replace(/\//g, '').trim()
      : 'Unknown Epic';

    return {
      number: epicNumber,
      name: `Epic ${epicNumber}: ${epicName}`,
      shortName: epicName,
      totalStories: 0,
      totalPoints: 0
    };
  }

  /**
   * Discover stories for a specific epic
   */
  async discoverStoriesForEpic(epicInfo) {
    const stories = [];
    const epicPath = epicInfo.path;

    // Check for STORY_BREAKDOWN.md
    const breakdownPath = path.join(epicPath, 'STORY_BREAKDOWN.md');
    try {
      const content = await fs.readFile(breakdownPath, 'utf8');
      const storyIds = content.match(/US-\d{3}/g) || [];
      const uniqueIds = [...new Set(storyIds)];

      for (const storyId of uniqueIds) {
        const storyInfo = this.extractStoryInfo(content, storyId);
        if (storyInfo) {
          stories.push({
            story_id: storyId,
            epic_label: epicInfo.name,
            ...storyInfo
          });
        }
      }
    } catch (err) {
      // No STORY_BREAKDOWN.md, try individual story files
      try {
        const storiesDir = path.join(epicPath, 'stories');
        const files = await fs.readdir(storiesDir);

        for (const file of files) {
          if (file.match(/US-\d{3}.*\.md$/)) {
            const storyPath = path.join(storiesDir, file);
            const content = await fs.readFile(storyPath, 'utf8');
            const storyId = file.match(/US-\d{3}/)[0];
            const storyInfo = this.extractStoryInfo(content, storyId);

            if (storyInfo) {
              stories.push({
                story_id: storyId,
                epic_label: epicInfo.name,
                ...storyInfo
              });
            }
          }
        }
      } catch (err2) {
        // No stories directory
      }
    }

    return stories;
  }

  /**
   * Extract story information from markdown content
   */
  extractStoryInfo(content, storyId) {
    // Find the story section
    const storyRegex = new RegExp(`###?\\s+Story\\s+#?\\d+[:\\s]+${storyId}[:\\s]+([^\\n]+)`, 'i');
    const titleMatch = content.match(storyRegex);

    if (!titleMatch) {
      // Fallback: try simpler pattern
      const fallbackRegex = new RegExp(`${storyId}[:\\s]+([^\\n]+)`, 'i');
      const fallbackMatch = content.match(fallbackRegex);

      if (!fallbackMatch) return null;

      return {
        name: `${storyId}: ${fallbackMatch[1].trim()}`,
        description: 'Auto-discovered story',
        agent_type: this.inferAgentType(fallbackMatch[1]),
        priority: 'P1'
      };
    }

    const title = titleMatch[1].trim();

    // Extract "As a..." user story
    const userStoryRegex = /\*\*As a?\*\*\s+(.+?)\s+\*\*I want\*\*\s+(.+?)(?:\s+\*\*So that\*\*\s+(.+?))?(?:\n|$)/is;
    const userStoryMatch = content.match(userStoryRegex);

    let description = 'Auto-discovered story';
    if (userStoryMatch) {
      description = `As a ${userStoryMatch[1].trim()}, I want ${userStoryMatch[2].trim()}`;
      if (userStoryMatch[3]) {
        description += ` so that ${userStoryMatch[3].trim()}`;
      }
    }

    // Infer agent type from title and content
    const agentType = this.inferAgentType(title + ' ' + description);

    // Infer priority
    const priority = this.inferPriority(content);

    return {
      name: `${storyId}: ${title}`,
      description: description,
      agent_type: agentType,
      priority: priority
    };
  }

  /**
   * Scan entire codebase for story IDs
   */
  async scanForStoryIds() {
    const stories = new Set();
    const docsDir = path.join(this.projectRoot, 'docs');

    // Find all markdown files
    const mdFiles = await new Promise((resolve, reject) => {
      glob('**/*.md', { cwd: docsDir }, (err, matches) => {
        if (err) reject(err);
        else resolve(matches);
      });
    });

    for (const mdFile of mdFiles) {
      const filePath = path.join(docsDir, mdFile);
      try {
        const content = await fs.readFile(filePath, 'utf8');

        // Find all story IDs
        const matches = content.match(/US-\d{3}/g);
        if (matches) {
          matches.forEach(id => stories.add(id));
        }
      } catch (err) {
        // Skip files that can't be read
      }
    }

    return Array.from(stories).sort();
  }

  /**
   * Infer agent type from story title/description
   */
  inferAgentType(text) {
    const lower = text.toLowerCase();

    if (lower.match(/\b(api|service|backend|database|migration|repository)\b/)) return 'backend';
    if (lower.match(/\b(ui|component|react|frontend|interface|page)\b/)) return 'frontend';
    if (lower.match(/\b(test|testing|e2e|integration|unit)\b/)) return 'testing';
    if (lower.match(/\b(doc|documentation|diagram|guide|adr)\b/)) return 'documentation';
    if (lower.match(/\b(monitor|observability|metric|alert|log)\b/)) return 'monitoring';
    if (lower.match(/\b(ci|cd|pipeline|deploy|build)\b/)) return 'cicd';
    if (lower.match(/\b(architect|design|pattern|refactor|structure)\b/)) return 'tech-architecture';

    return 'backend'; // Default
  }

  /**
   * Infer priority from content
   */
  inferPriority(content) {
    const lower = content.toLowerCase();

    if (lower.match(/\b(critical|p0|blocking|must|required)\b/)) return 'P0';
    if (lower.match(/\b(p2|nice[- ]to[- ]have|optional|future)\b/)) return 'P2';

    return 'P1'; // Default
  }

  /**
   * Merge discovered stories with existing tasks.json
   */
  async mergeWithExisting(discovered, scannedIds) {
    let existingData;

    try {
      const content = await fs.readFile(this.tasksFile, 'utf8');
      existingData = JSON.parse(content);
    } catch (err) {
      // No existing file, create new structure
      existingData = {
        project_id: 'sovren-development',
        started_at: new Date().toISOString(),
        current_phase: 'active-development',
        phases: {
          'active-development': {
            status: 'in_progress',
            started_at: new Date().toISOString(),
            tasks: []
          }
        },
        summary: {
          total_tasks: 0,
          completed: 0,
          in_progress: 0,
          blocked: 0,
          queued: 0,
          completion_percent: 0
        }
      };
    }

    const tasks = existingData.phases['active-development'].tasks;
    const existingIds = new Set(tasks.filter(t => t.story_id).map(t => t.story_id));

    // Add discovered stories that don't exist yet
    let addedCount = 0;
    const timestamp = Date.now();

    for (const [epicName, stories] of discovered.stories) {
      // Ensure epic parent exists
      const epicParentId = `epic-${epicName.match(/\d+/)[0]}-parent`;
      const epicExists = tasks.some(t => t.id === epicParentId);

      if (!epicExists) {
        tasks.unshift({
          id: epicParentId,
          type: 'epic',
          name: `${epicName} - 0/${stories.length} complete`,
          agent: 'project-orchestrator',
          status: 'pending',
          progress_percent: 0,
          started_at: null,
          completed_at: null
        });
      }

      // Add stories
      for (const story of stories) {
        if (!existingIds.has(story.story_id)) {
          tasks.push({
            id: `story-${story.story_id.toLowerCase()}-${timestamp + addedCount}`,
            type: 'story',
            story_id: story.story_id,
            name: story.name,
            description: story.description,
            agent: 'unassigned',
            agent_type: story.agent_type,
            status: 'pending',
            progress_percent: 0,
            started_at: null,
            completed_at: null,
            epic_label: story.epic_label,
            priority: story.priority,
            files_modified: [],
            test_coverage: null
          });
          addedCount++;
          existingIds.add(story.story_id);
        }
      }
    }

    // Update summary
    existingData.summary = {
      total_tasks: tasks.length,
      completed: tasks.filter(t => t.status === 'completed' || t.status === 'done').length,
      in_progress: tasks.filter(t => t.status === 'in_progress' || t.status === 'active').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
      queued: tasks.filter(t => t.status === 'pending' || t.status === 'queued').length,
      completion_percent: 0
    };

    if (existingData.summary.total_tasks > 0) {
      existingData.summary.completion_percent = Math.round(
        (existingData.summary.completed / existingData.summary.total_tasks) * 100
      );
    }

    console.log(`\n✅ Merged data: Added ${addedCount} new stories`);
    console.log(`📊 Total tasks: ${existingData.summary.total_tasks}`);

    return existingData;
  }

  /**
   * Save tasks to tasks.json
   */
  async saveTasks(data) {
    await fs.writeFile(this.tasksFile, JSON.stringify(data, null, 2));
    console.log(`\n💾 Saved to ${this.tasksFile}\n`);
  }
}

// CLI usage
if (require.main === module) {
  const projectRoot = path.resolve(__dirname, '../..');
  const dataDir = path.join(__dirname, 'data');

  const discovery = new AutoDiscovery(projectRoot, dataDir);

  discovery.discover()
    .then(() => {
      console.log('✅ Auto-discovery complete!\n');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Discovery error:', err);
      process.exit(1);
    });
}

module.exports = AutoDiscovery;
