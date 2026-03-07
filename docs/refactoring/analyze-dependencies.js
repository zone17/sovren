#!/usr/bin/env node

/**
 * Service Dependency Analyzer
 * Analyzes backend service dependencies and generates reports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const servicesDir = path.join(__dirname, '../../packages/backend/src/services');
const outputFile = path.join(__dirname, 'dependency-matrix.json');

// Service categories for classification
const serviceCategories = {
  payment: ['lightning', 'payment', 'subscription', 'payout', 'transaction'],
  content: ['content', 'creator', 'recommendation'],
  auth: ['auth', 'session', 'nostr'],
  analytics: ['analytics', 'metrics', 'monitoring'],
  communication: ['email', 'notification', 'websocket'],
  integration: ['social', 'supabase', 'realtime'],
};

function categorizeService(serviceName) {
  const lower = serviceName.toLowerCase();
  for (const [category, keywords] of Object.entries(serviceCategories)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return 'other';
}

function analyzeServiceFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath, '.ts');

  const dependencies = {
    services: [],
    external: [],
    repositories: [],
    config: [],
  };

  // Extract imports
  const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];

    if (importPath.includes('Service')) {
      // Service dependency
      const serviceName = importPath.split('/').pop().replace('.js', '');
      dependencies.services.push(serviceName);
    } else if (importPath.includes('Repository')) {
      // Repository dependency
      dependencies.repositories.push(importPath);
    } else if (importPath.includes('../config/')) {
      // Config dependency
      dependencies.config.push(importPath);
    } else if (!importPath.startsWith('.')) {
      // External dependency
      dependencies.external.push(importPath);
    }
  }

  // Count lines of code (rough estimate)
  const lines = content.split('\n').length;

  // Check for specific patterns
  const hasSupabase = content.includes('supabase');
  const hasRedis = content.includes('redis') || content.includes('Redis');
  const hasEventEmitter = content.includes('EventEmitter');
  const hasAsync = content.includes('async');

  return {
    name: fileName,
    category: categorizeService(fileName),
    path: filePath,
    lines,
    dependencies,
    patterns: {
      usesSupabase: hasSupabase,
      usesRedis: hasRedis,
      usesEvents: hasEventEmitter,
      isAsync: hasAsync,
    },
  };
}

function generateDependencyMatrix() {
  const files = fs
    .readdirSync(servicesDir)
    .filter((file) => file.endsWith('.ts') && !file.includes('.test.'))
    .map((file) => path.join(servicesDir, file));

  const services = files.map(analyzeServiceFile);

  // Build dependency matrix
  const matrix = {};
  const serviceNames = services.map((s) => s.name);

  serviceNames.forEach((name) => {
    matrix[name] = {};
    serviceNames.forEach((other) => {
      matrix[name][other] = 0;
    });
  });

  // Populate matrix
  services.forEach((service) => {
    service.dependencies.services.forEach((dep) => {
      const depName = dep.replace('-service', '').replace('Service', '');

      // Find matching service
      serviceNames.forEach((name) => {
        if (
          name.toLowerCase().includes(depName.toLowerCase()) ||
          depName.toLowerCase().includes(name.toLowerCase())
        ) {
          matrix[service.name][name] = 1;
        }
      });
    });
  });

  // Calculate coupling metrics
  const couplingMetrics = services.map((service) => {
    const outgoing = Object.values(matrix[service.name]).reduce((a, b) => a + b, 0);
    const incoming = serviceNames.reduce((count, name) => count + matrix[name][service.name], 0);

    return {
      name: service.name,
      category: service.category,
      lines: service.lines,
      outgoingDependencies: outgoing,
      incomingDependencies: incoming,
      totalDependencies: outgoing + incoming,
      couplingScore: (outgoing + incoming) / serviceNames.length,
      serviceDependencies: service.dependencies.services,
      externalDependencies: service.dependencies.external.length,
      patterns: service.patterns,
    };
  });

  // Sort by coupling score
  couplingMetrics.sort((a, b) => b.totalDependencies - a.totalDependencies);

  // Identify circular dependencies
  const circularDependencies = [];
  serviceNames.forEach((service1, i) => {
    serviceNames.slice(i + 1).forEach((service2) => {
      if (matrix[service1][service2] === 1 && matrix[service2][service1] === 1) {
        circularDependencies.push([service1, service2]);
      }
    });
  });

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalServices: services.length,
      categories: Object.keys(serviceCategories).reduce((acc, cat) => {
        acc[cat] = services.filter((s) => s.category === cat).length;
        return acc;
      }, {}),
      totalLines: services.reduce((sum, s) => sum + s.lines, 0),
      averageLines: Math.round(services.reduce((sum, s) => sum + s.lines, 0) / services.length),
    },
    services: couplingMetrics,
    matrix,
    circularDependencies,
    missingServices: findMissingServices(services),
    recommendations: generateRecommendations(couplingMetrics, circularDependencies),
  };
}

function findMissingServices(services) {
  const allServiceRefs = new Set();
  services.forEach((service) => {
    service.dependencies.services.forEach((dep) => {
      allServiceRefs.add(dep.toLowerCase());
    });
  });

  const existingServices = new Set(services.map((s) => s.name.toLowerCase()));
  const missing = [];

  allServiceRefs.forEach((ref) => {
    let found = false;
    existingServices.forEach((existing) => {
      if (
        existing.includes(ref.replace('service', '').replace('-', '')) ||
        ref.includes(existing.replace('service', '').replace('-', ''))
      ) {
        found = true;
      }
    });
    if (!found && !ref.includes('test')) {
      missing.push(ref);
    }
  });

  return [...new Set(missing)];
}

function generateRecommendations(metrics, circularDeps) {
  const recommendations = [];

  // High coupling services
  const highCoupling = metrics.filter((m) => m.couplingScore > 0.3);
  if (highCoupling.length > 0) {
    recommendations.push({
      type: 'HIGH_COUPLING',
      severity: 'critical',
      services: highCoupling.map((s) => s.name),
      recommendation: 'These services have high coupling and should be refactored first',
    });
  }

  // Circular dependencies
  if (circularDeps.length > 0) {
    recommendations.push({
      type: 'CIRCULAR_DEPENDENCIES',
      severity: 'critical',
      pairs: circularDeps,
      recommendation:
        'Break circular dependencies by introducing interfaces or event-driven communication',
    });
  }

  // Large services
  const largeServices = metrics.filter((m) => m.lines > 500);
  if (largeServices.length > 0) {
    recommendations.push({
      type: 'LARGE_SERVICES',
      severity: 'medium',
      services: largeServices.map((s) => ({ name: s.name, lines: s.lines })),
      recommendation: 'Consider breaking down large services into smaller, focused services',
    });
  }

  // Services with many external dependencies
  const externalHeavy = metrics.filter((m) => m.externalDependencies > 10);
  if (externalHeavy.length > 0) {
    recommendations.push({
      type: 'EXTERNAL_DEPENDENCIES',
      severity: 'low',
      services: externalHeavy.map((s) => ({ name: s.name, count: s.externalDependencies })),
      recommendation: 'Consider creating facade services to manage external dependencies',
    });
  }

  return recommendations;
}

// Generate report
const analysis = generateDependencyMatrix();

// Save JSON report
fs.writeFileSync(outputFile, JSON.stringify(analysis, null, 2));

// Generate markdown summary
const markdownReport = `
# Dependency Matrix Analysis Report

Generated: ${analysis.timestamp}

## Summary
- **Total Services**: ${analysis.summary.totalServices}
- **Total Lines**: ${analysis.summary.totalLines}
- **Average Lines/Service**: ${analysis.summary.averageLines}

## Services by Category
${Object.entries(analysis.summary.categories)
  .map(([cat, count]) => `- **${cat}**: ${count} services`)
  .join('\n')}

## Top 10 Most Coupled Services
${analysis.services
  .slice(0, 10)
  .map(
    (s, i) => `${i + 1}. **${s.name}** (${s.category})
   - Outgoing: ${s.outgoingDependencies}
   - Incoming: ${s.incomingDependencies}
   - Lines: ${s.lines}`
  )
  .join('\n')}

## Circular Dependencies
${
  analysis.circularDependencies.length > 0
    ? analysis.circularDependencies.map((pair) => `- ${pair[0]} ↔️ ${pair[1]}`).join('\n')
    : 'None detected'
}

## Missing Services
${
  analysis.missingServices.length > 0
    ? analysis.missingServices.map((s) => `- ${s}`).join('\n')
    : 'None detected'
}

## Recommendations
${analysis.recommendations
  .map(
    (r) => `### ${r.type} (${r.severity})
${r.recommendation}
${r.services ? `Services: ${JSON.stringify(r.services)}` : ''}
${r.pairs ? `Pairs: ${JSON.stringify(r.pairs)}` : ''}`
  )
  .join('\n\n')}
`;

fs.writeFileSync(path.join(__dirname, 'dependency-matrix-report.md'), markdownReport);

console.log('✅ Dependency analysis complete!');
console.log(`📊 JSON report: ${outputFile}`);
console.log(`📄 Markdown report: ${path.join(__dirname, 'dependency-matrix-report.md')}`);
console.log('\nKey Findings:');
console.log(`- ${analysis.summary.totalServices} services analyzed`);
console.log(`- ${analysis.circularDependencies.length} circular dependencies found`);
console.log(`- ${analysis.missingServices.length} missing services referenced`);
console.log(`- ${analysis.recommendations.length} recommendations generated`);
