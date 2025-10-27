#!/usr/bin/env node

/**
 * Automated Tana Synchronization System
 *
 * Monitors the Sovren codebase and automatically updates Tana with:
 * - Git commit progress
 * - Test coverage changes
 * - Build status updates
 * - Feature completion tracking
 * - Performance metrics
 *
 * Runs as a daemon process that can be triggered by:
 * - Git hooks
 * - CI/CD pipeline
 * - Manual updates
 * - Scheduled runs
 */

const fs = require('fs');
const { execSync } = require('child_process');
const SovrenProjectManager = require('./tana-sovren-manager.js');

class AutomatedTanaSync {
  constructor(token) {
    this.manager = new SovrenProjectManager(token);
    this.lastSyncFile = 'last-tana-sync.json';
    this.loadLastSync();
  }

  loadLastSync() {
    try {
      if (fs.existsSync(this.lastSyncFile)) {
        this.lastSync = JSON.parse(fs.readFileSync(this.lastSyncFile, 'utf8'));
      } else {
        this.lastSync = {
          lastCommit: null,
          lastTestCoverage: 0,
          lastUpdate: null,
          completedTasks: [],
        };
      }
    } catch (error) {
      console.log('📁 No previous sync data found');
      this.lastSync = {
        lastCommit: null,
        lastTestCoverage: 0,
        lastUpdate: null,
        completedTasks: [],
      };
    }
  }

  saveLastSync() {
    this.lastSync.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.lastSyncFile, JSON.stringify(this.lastSync, null, 2));
  }

  getGitInfo() {
    try {
      const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
      const commitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim();
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
      const commitCount = parseInt(
        execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim()
      );

      return {
        currentCommit,
        commitMessage,
        branch,
        commitCount,
        isNewCommit: currentCommit !== this.lastSync.lastCommit,
      };
    } catch (error) {
      console.log('⚠️ Could not get git info:', error.message);
      return null;
    }
  }

  getTestCoverage() {
    try {
      // Check if coverage files exist
      const frontendCoverage = this.parseCoverageFile(
        'packages/frontend/coverage/coverage-summary.json'
      );
      const backendCoverage = this.parseCoverageFile(
        'packages/backend/coverage/coverage-summary.json'
      );

      if (frontendCoverage || backendCoverage) {
        const avgCoverage = this.calculateAverageCoverage(frontendCoverage, backendCoverage);
        return {
          frontend: frontendCoverage,
          backend: backendCoverage,
          average: avgCoverage,
          improved: avgCoverage > this.lastSync.lastTestCoverage,
        };
      }
    } catch (error) {
      console.log('⚠️ Could not get test coverage:', error.message);
    }
    return null;
  }

  parseCoverageFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const coverage = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return coverage.total ? coverage.total.statements.pct : null;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  calculateAverageCoverage(frontend, backend) {
    const values = [frontend, backend].filter((v) => v !== null);
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  checkFeatureCompletion() {
    const completedFeatures = [];

    // Check for Docker implementation
    if (fs.existsSync('Dockerfile') || fs.existsSync('docker-compose.yml')) {
      completedFeatures.push('Docker containerization setup');
    }

    // Check for CI/CD pipeline
    if (fs.existsSync('.github/workflows') || fs.existsSync('vercel.json')) {
      completedFeatures.push('CI/CD pipeline configuration');
    }

    // Check for comprehensive testing
    const testFiles = this.countTestFiles();
    if (testFiles > 50) {
      completedFeatures.push('Comprehensive testing framework');
    }

    // Check for NOSTR integration
    if (
      this.checkForFileContent('packages/frontend/src', 'nostr') ||
      this.checkForFileContent('packages/backend/src', 'nostr')
    ) {
      completedFeatures.push('NOSTR integration implementation');
    }

    // Check for Lightning Network integration
    if (
      this.checkForFileContent('packages/backend/src', 'lightning') ||
      this.checkForFileContent('packages/frontend/src', 'lightning')
    ) {
      completedFeatures.push('Lightning Network payment integration');
    }

    return completedFeatures.filter((feature) => !this.lastSync.completedTasks.includes(feature));
  }

  countTestFiles() {
    try {
      const result = execSync('find . -name "*.test.*" -o -name "*.spec.*" | wc -l', {
        encoding: 'utf8',
      });
      return parseInt(result.trim());
    } catch (error) {
      return 0;
    }
  }

  checkForFileContent(directory, searchTerm) {
    try {
      if (fs.existsSync(directory)) {
        const result = execSync(
          `grep -r "${searchTerm}" ${directory} --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" | wc -l`,
          { encoding: 'utf8' }
        );
        return parseInt(result.trim()) > 0;
      }
    } catch (error) {
      return false;
    }
    return false;
  }

  async syncToTana() {
    console.log('🔄 Starting automated Tana synchronization...\n');

    const gitInfo = this.getGitInfo();
    const coverage = this.getTestCoverage();
    const newFeatures = this.checkFeatureCompletion();

    let hasUpdates = false;

    // Update based on new commits
    if (gitInfo && gitInfo.isNewCommit) {
      await this.manager.updateProgress(
        `Code commit: ${gitInfo.commitMessage.substring(0, 100)}`,
        true,
        `Branch: ${gitInfo.branch} | Commit: ${gitInfo.currentCommit.substring(0, 8)} | Total commits: ${gitInfo.commitCount}`
      );

      this.lastSync.lastCommit = gitInfo.currentCommit;
      hasUpdates = true;
    }

    // Update based on test coverage changes
    if (coverage && coverage.improved) {
      await this.manager.updateProgress(
        `Test coverage improved to ${coverage.average.toFixed(1)}%`,
        true,
        `Frontend: ${coverage.frontend || 'N/A'}% | Backend: ${coverage.backend || 'N/A'}% | Target: 95%`
      );

      this.lastSync.lastTestCoverage = coverage.average;
      hasUpdates = true;
    }

    // Update based on feature completion
    for (const feature of newFeatures) {
      await this.manager.updateProgress(
        feature,
        true,
        `Feature automatically detected as complete on ${new Date().toLocaleString()}`
      );

      this.lastSync.completedTasks.push(feature);
      hasUpdates = true;
    }

    // Weekly summary update
    const now = new Date();
    const lastUpdate = this.lastSync.lastUpdate ? new Date(this.lastSync.lastUpdate) : null;
    const daysSinceUpdate = lastUpdate ? (now - lastUpdate) / (1000 * 60 * 60 * 24) : 999;

    if (daysSinceUpdate >= 7 || !lastUpdate) {
      const summary = this.generateWeeklySummary(gitInfo, coverage);
      await this.manager.updateProgress('Weekly Progress Summary', true, summary);
      hasUpdates = true;
    }

    if (hasUpdates) {
      this.saveLastSync();
      console.log('✅ Tana synchronization completed successfully');
    } else {
      console.log('ℹ️ No new updates to synchronize');
    }
  }

  generateWeeklySummary(gitInfo, coverage) {
    const lines = [];

    if (gitInfo) {
      lines.push(
        `📊 Development Activity: ${gitInfo.commitCount} total commits on ${gitInfo.branch} branch`
      );
    }

    if (coverage) {
      lines.push(`🧪 Test Coverage: ${coverage.average.toFixed(1)}% average (Target: 95%)`);
    }

    lines.push(`✅ Completed Tasks: ${this.lastSync.completedTasks.length} features implemented`);
    lines.push(
      `📅 Next Review: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}`
    );

    return lines.join(' | ');
  }
}

// Git hook integration
function setupGitHooks() {
  const postCommitHook = `#!/bin/sh
# Automatically sync with Tana after each commit
if [ -n "$TANA_TOKEN" ]; then
  node scripts/automated-tana-sync.js
fi
`;

  const hookPath = '.git/hooks/post-commit';

  try {
    fs.writeFileSync(hookPath, postCommitHook, { mode: 0o755 });
    console.log('✅ Git post-commit hook installed');
  } catch (error) {
    console.log('⚠️ Could not install git hook:', error.message);
  }
}

// Main execution
async function main() {
  const token = process.env.TANA_TOKEN;
  const command = process.argv[2] || 'sync';

  if (!token) {
    console.error('❌ TANA_TOKEN environment variable is required');
    console.error('Usage: TANA_TOKEN=your_token node scripts/automated-tana-sync.js [command]');
    console.error('\nCommands:');
    console.error('  sync     - Synchronize current state (default)');
    console.error('  setup    - Install git hooks for automatic sync');
    console.error('  status   - Show sync status');
    process.exit(1);
  }

  const sync = new AutomatedTanaSync(token);

  try {
    switch (command) {
      case 'sync':
        await sync.syncToTana();
        break;
      case 'setup':
        setupGitHooks();
        await sync.manager.setupProject();
        console.log('🎯 Automated Tana sync is now configured!');
        break;
      case 'status':
        console.log('📊 Sync Status:');
        console.log('Last sync:', sync.lastSync.lastUpdate || 'Never');
        console.log('Completed tasks:', sync.lastSync.completedTasks.length);
        console.log('Last commit:', sync.lastSync.lastCommit?.substring(0, 8) || 'None');
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = AutomatedTanaSync;
