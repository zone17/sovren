#!/usr/bin/env node
/* eslint-disable no-console */

import { Command } from 'commander';
import { featureFlagService } from './featureFlagService';
import { FeatureFlags } from '../../../shared/src/featureFlags';
import chalk from 'chalk';

const program = new Command();

program.name('feature-flags').description('CLI tool for managing feature flags').version('1.0.0');

program
  .command('list')
  .description('List all feature flags and their current values')
  .action(async () => {
    try {
      const flags = await featureFlagService.getFlags();
      console.log('\nCurrent Feature Flags:');
      console.log('=====================');
      Object.entries(flags).forEach(([key, value]) => {
        console.log(`${chalk.blue(key)}: ${chalk.green(value.toString())}`);
      });
    } catch (error) {
      console.error(chalk.red('Error fetching feature flags:'), error);
      process.exit(1);
    }
  });

program
  .command('set')
  .description('Set one or more feature flags')
  .argument('<flags...>', 'Flags to set in format KEY=VALUE')
  .action(async (flags: string[]) => {
    try {
      const updates: Partial<FeatureFlags> = {};
      flags.forEach((flag) => {
        const [key, value] = flag.split('=');
        if (!key || !value) {
          throw new Error(`Invalid flag format: ${flag}. Use KEY=VALUE format.`);
        }
        updates[key as keyof FeatureFlags] = value.toLowerCase() === 'true';
      });
      await featureFlagService.updateFlags(updates, 'cli');
      console.log(chalk.green('\nFeature flags updated successfully:'));
      Object.entries(updates).forEach(([key, value]) => {
        console.log(`${chalk.blue(key)}: ${chalk.green(value.toString())}`);
      });
    } catch (error) {
      console.error(chalk.red('Error updating feature flags:'), error);
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('Clean up old feature flag backups')
  .option('-d, --days <number>', 'Maximum age of backups in days', '7')
  .action(async (options: { days: string }) => {
    try {
      const maxAgeDays = Number(options.days);
      if (isNaN(maxAgeDays) || maxAgeDays < 1) {
        throw new Error('Days must be a positive number');
      }
      await featureFlagService.cleanupOldBackups(maxAgeDays);
      console.log(chalk.green(`\nSuccessfully cleaned up backups older than ${maxAgeDays} days`));
    } catch (error) {
      console.error(chalk.red('Error cleaning up backups:'), error);
      process.exit(1);
    }
  });

program.parse();
