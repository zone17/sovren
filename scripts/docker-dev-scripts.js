#!/usr/bin/env node

/**
 * Docker Development Scripts
 * Comprehensive utility for managing Docker development environment
 *
 * Usage: node scripts/docker-dev-scripts.js [command]
 *
 * Commands:
 *   build     - Build development images
 *   start     - Start development environment
 *   stop      - Stop development environment
 *   restart   - Restart development environment
 *   logs      - View logs
 *   status    - Check service status
 *   clean     - Clean up containers and volumes
 *   reset     - Reset entire development environment
 *   test      - Run tests in containerized environment
 *   shell     - Access container shell
 *   db        - Database management commands
 *   monitor   - Monitor container resources
 *   backup    - Backup development data
 *   restore   - Restore development data
 */

import { execSync } from 'child_process';
import fs from 'fs';
import readline from 'readline';

class DockerDevManager {
  constructor() {
    this.composeFile = 'docker-compose.dev.yml';
    this.services = [
      'backend-dev',
      'frontend-dev',
      'postgres-dev',
      'redis-dev',
      'nginx-dev',
      'mailhog-dev',
    ];
    this.profiles = {
      core: ['backend-dev', 'frontend-dev', 'postgres-dev', 'redis-dev'],
      full: this.services,
      testing: ['test-runner'],
      tools: ['dev-tools'],
    };
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m',
    };

    console.log(`${colors[level]}[${timestamp}] ${message}${colors.reset}`);
  }

  exec(command, options = {}) {
    this.log(`Executing: ${command}`);
    try {
      const result = execSync(command, {
        stdio: 'inherit',
        encoding: 'utf8',
        ...options,
      });
      return result;
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  async promptUser(question) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }

  checkPrerequisites() {
    this.log('Checking prerequisites...');

    // Check Docker
    try {
      this.exec('docker --version', { stdio: 'pipe' });
      this.log('Docker is installed', 'success');
    } catch (error) {
      this.log('Docker is not installed or not in PATH', 'error');
      process.exit(1);
    }

    // Check Docker Compose
    try {
      this.exec('docker-compose --version', { stdio: 'pipe' });
      this.log('Docker Compose is installed', 'success');
    } catch (error) {
      this.log('Docker Compose is not installed or not in PATH', 'error');
      process.exit(1);
    }

    // Check compose file
    if (!fs.existsSync(this.composeFile)) {
      this.log(`Compose file ${this.composeFile} not found`, 'error');
      process.exit(1);
    }

    this.log('Prerequisites check passed', 'success');
  }

  ensureDirectories() {
    const directories = [
      'volumes/backend_node_modules',
      'volumes/frontend_node_modules',
      'volumes/postgres_dev_data',
      'volumes/redis_dev_data',
      'logs/backend',
      'logs/frontend',
      'logs/postgres',
      'logs/redis',
      'logs/nginx',
      'logs/mailhog',
      'docker/ssl',
    ];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${dir}`, 'success');
      }
    });
  }

  buildImages() {
    this.log('Building development images...');
    this.exec(`docker-compose -f ${this.composeFile} build --no-cache`);
    this.log('Images built successfully', 'success');
  }

  startServices(profile = 'core') {
    this.log(`Starting ${profile} services...`);

    if (profile === 'core') {
      this.exec(`docker-compose -f ${this.composeFile} up -d ${this.profiles.core.join(' ')}`);
    } else if (profile === 'full') {
      this.exec(`docker-compose -f ${this.composeFile} up -d`);
    } else if (profile === 'testing') {
      this.exec(`docker-compose -f ${this.composeFile} --profile testing up -d`);
    } else if (profile === 'tools') {
      this.exec(`docker-compose -f ${this.composeFile} --profile tools up -d`);
    }

    this.log(`${profile} services started successfully`, 'success');
    this.showStatus();
  }

  stopServices() {
    this.log('Stopping services...');
    this.exec(`docker-compose -f ${this.composeFile} down`);
    this.log('Services stopped successfully', 'success');
  }

  restartServices() {
    this.log('Restarting services...');
    this.stopServices();
    this.startServices();
  }

  showLogs(service = '', follow = false) {
    if (service) {
      const command = follow
        ? `docker-compose -f ${this.composeFile} logs -f ${service}`
        : `docker-compose -f ${this.composeFile} logs ${service}`;
      this.exec(command);
    } else {
      const command = follow
        ? `docker-compose -f ${this.composeFile} logs -f`
        : `docker-compose -f ${this.composeFile} logs`;
      this.exec(command);
    }
  }

  showStatus() {
    this.log('Service status:');
    this.exec(`docker-compose -f ${this.composeFile} ps`);

    this.log('\nContainer health:');
    this.services.forEach((service) => {
      try {
        const result = execSync(
          `docker inspect sovren-${service.replace('-dev', '')}-dev --format='{{.State.Health.Status}}'`,
          {
            stdio: 'pipe',
            encoding: 'utf8',
          }
        ).trim();
        this.log(`${service}: ${result}`, result === 'healthy' ? 'success' : 'warning');
      } catch (error) {
        this.log(`${service}: container not found`, 'error');
      }
    });
  }

  cleanContainers() {
    this.log('Cleaning up containers...');
    this.exec(`docker-compose -f ${this.composeFile} down -v --remove-orphans`);
    this.exec('docker system prune -f');
    this.log('Containers cleaned successfully', 'success');
  }

  async resetEnvironment() {
    const answer = await this.promptUser(
      'This will delete all containers, volumes, and data. Continue? (y/N): '
    );
    if (answer.toLowerCase() !== 'y') {
      this.log('Operation cancelled');
      return;
    }

    this.log('Resetting development environment...');
    this.exec(`docker-compose -f ${this.composeFile} down -v --remove-orphans`);
    this.exec('docker system prune -af');
    this.exec('docker volume prune -f');

    // Clean up volumes directory
    if (fs.existsSync('volumes')) {
      fs.rmSync('volumes', { recursive: true, force: true });
      this.log('Volumes directory cleaned', 'success');
    }

    this.ensureDirectories();
    this.log('Environment reset complete', 'success');
  }

  runTests() {
    this.log('Running tests in containerized environment...');
    this.exec(
      `docker-compose -f ${this.composeFile} --profile testing run --rm test-runner npm test`
    );
  }

  accessShell(service = 'backend-dev') {
    this.log(`Accessing shell for ${service}...`);
    this.exec(`docker-compose -f ${this.composeFile} exec ${service} /bin/sh`);
  }

  databaseCommand(command) {
    switch (command) {
      case 'shell':
        this.log('Accessing PostgreSQL shell...');
        this.exec(
          `docker-compose -f ${this.composeFile} exec postgres-dev psql -U sovren_dev -d sovren_development`
        );
        break;
      case 'backup':
        this.log('Creating database backup...');
        const backupFile = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`;
        this.exec(
          `docker-compose -f ${this.composeFile} exec postgres-dev pg_dump -U sovren_dev sovren_development > ${backupFile}`
        );
        this.log(`Database backup created: ${backupFile}`, 'success');
        break;
      case 'restore':
        this.log('Available backup files:');
        const backupFiles = fs.readdirSync('.').filter((file) => file.endsWith('.sql'));
        backupFiles.forEach((file, index) => {
          console.log(`${index + 1}. ${file}`);
        });
        // Implementation for restore would go here
        break;
      case 'migrate':
        this.log('Running database migrations...');
        this.exec(`docker-compose -f ${this.composeFile} exec backend-dev npm run db:migrate`);
        break;
      case 'seed':
        this.log('Seeding database...');
        this.exec(`docker-compose -f ${this.composeFile} exec backend-dev npm run db:seed`);
        break;
      default:
        this.log('Available database commands: shell, backup, restore, migrate, seed', 'info');
    }
  }

  monitorResources() {
    this.log('Monitoring container resources...');
    this.exec(
      `docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`
    );
  }

  backupData() {
    this.log('Creating development data backup...');
    const backupDir = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    fs.mkdirSync(backupDir, { recursive: true });

    // Backup database
    this.exec(
      `docker-compose -f ${this.composeFile} exec postgres-dev pg_dump -U sovren_dev sovren_development > ${backupDir}/database.sql`
    );

    // Backup Redis data
    this.exec(`docker-compose -f ${this.composeFile} exec redis-dev redis-cli BGSAVE`);

    // Copy volumes
    this.exec(`cp -r volumes ${backupDir}/`);
    this.exec(`cp -r logs ${backupDir}/`);

    this.log(`Backup created: ${backupDir}`, 'success');
  }

  showHelp() {
    console.log(`
Docker Development Environment Manager

Usage: node scripts/docker-dev-scripts.js [command] [options]

Commands:
  build                 Build development images
  start [profile]       Start services (profiles: core, full, testing, tools)
  stop                  Stop all services
  restart               Restart all services
  logs [service] [-f]   View logs (use -f to follow)
  status               Show service status and health
  clean                Clean up containers and volumes
  reset                Reset entire environment (destructive)
  test                 Run tests in container
  shell [service]      Access container shell
  db [command]         Database operations (shell, backup, restore, migrate, seed)
  monitor              Monitor container resources
  backup               Backup development data
  help                 Show this help message

Examples:
  node scripts/docker-dev-scripts.js start core
  node scripts/docker-dev-scripts.js logs backend-dev -f
  node scripts/docker-dev-scripts.js shell frontend-dev
  node scripts/docker-dev-scripts.js db migrate
`);
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0];
    const options = args.slice(1);

    if (!command || command === 'help') {
      this.showHelp();
      return;
    }

    this.checkPrerequisites();
    this.ensureDirectories();

    switch (command) {
      case 'build':
        this.buildImages();
        break;
      case 'start':
        this.startServices(options[0] || 'core');
        break;
      case 'stop':
        this.stopServices();
        break;
      case 'restart':
        this.restartServices();
        break;
      case 'logs':
        this.showLogs(options[0], options.includes('-f'));
        break;
      case 'status':
        this.showStatus();
        break;
      case 'clean':
        this.cleanContainers();
        break;
      case 'reset':
        await this.resetEnvironment();
        break;
      case 'test':
        this.runTests();
        break;
      case 'shell':
        this.accessShell(options[0] || 'backend-dev');
        break;
      case 'db':
        this.databaseCommand(options[0] || 'help');
        break;
      case 'monitor':
        this.monitorResources();
        break;
      case 'backup':
        this.backupData();
        break;
      default:
        this.log(`Unknown command: ${command}`, 'error');
        this.showHelp();
        process.exit(1);
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  const manager = new DockerDevManager();
  manager.run().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export default DockerDevManager;
