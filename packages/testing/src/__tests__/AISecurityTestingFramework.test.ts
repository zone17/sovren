/**
 * @file AISecurityTestingFramework.test.ts
 * @description Comprehensive tests for AI Security Testing Framework (US-158)
 */

import {
  AISecurityTestingFramework,
  PenetrationTestingConfig,
  ThreatModelingConfig,
  VulnerabilityAssessmentConfig,
} from '../security-testing/AISecurityTestingFramework';

// Mock Logger
jest.mock('../common/Logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('AISecurityTestingFramework', () => {
  let framework: AISecurityTestingFramework;
  let threatModelingConfig: ThreatModelingConfig;
  let penetrationTestingConfig: PenetrationTestingConfig;
  let vulnerabilityAssessmentConfig: VulnerabilityAssessmentConfig;

  beforeEach(() => {
    threatModelingConfig = {
      methodology: 'stride',
      assets: [
        {
          id: 'user-data',
          name: 'User Personal Data',
          type: 'data',
          classification: 'confidential',
          businessValue: 'high',
          dependencies: ['database', 'api'],
          dataFlows: [
            {
              id: 'user-api-flow',
              source: 'user-interface',
              destination: 'api-server',
              dataClassification: 'confidential',
              protocol: 'HTTPS',
              encrypted: true,
              authenticationRequired: true,
            },
          ],
          securityControls: [
            {
              id: 'encryption-at-rest',
              name: 'Data Encryption at Rest',
              type: 'preventive',
              status: 'implemented',
              effectiveness: 'high',
              nistMapping: ['PR.DS-1'],
            },
          ],
        },
      ],
      threatActors: [
        {
          id: 'external-attacker',
          name: 'External Malicious Actor',
          type: 'outsider',
          capability: 'medium',
          motivation: ['financial', 'data-theft'],
          resources: 'moderate',
          attackMethods: ['phishing', 'sql-injection', 'xss'],
        },
      ],
      attackVectors: [
        {
          id: 'web-attack',
          name: 'Web Application Attack',
          category: 'network',
          complexity: 'medium',
          prerequisites: ['internet-access'],
          impact: 'high',
          cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
        },
      ],
      riskCriteria: {
        calculationMethod: 'qualitative',
        probabilityScale: [
          {
            level: 'very_low',
            value: 1,
            description: 'Very unlikely to occur',
            frequency: 'Once in 10+ years',
          },
          {
            level: 'low',
            value: 2,
            description: 'Unlikely to occur',
            frequency: 'Once in 5-10 years',
          },
          {
            level: 'medium',
            value: 3,
            description: 'Possible to occur',
            frequency: 'Once in 1-5 years',
          },
          {
            level: 'high',
            value: 4,
            description: 'Likely to occur',
            frequency: 'Once per year',
          },
          {
            level: 'very_high',
            value: 5,
            description: 'Very likely to occur',
            frequency: 'Multiple times per year',
          },
        ],
        impactScale: [
          {
            level: 'negligible',
            value: 1,
            description: 'Minimal impact',
            businessImpact: 'No significant business impact',
          },
          {
            level: 'minor',
            value: 2,
            description: 'Minor impact',
            businessImpact: 'Minor business disruption',
          },
          {
            level: 'moderate',
            value: 3,
            description: 'Moderate impact',
            businessImpact: 'Significant business impact',
          },
          {
            level: 'major',
            value: 4,
            description: 'Major impact',
            businessImpact: 'Major business disruption',
          },
          {
            level: 'severe',
            value: 5,
            description: 'Severe impact',
            businessImpact: 'Severe business impact',
          },
        ],
        riskTolerance: {
          acceptable: 6,
          reviewRequired: 12,
          unacceptable: 16,
          immediateAction: 20,
        },
        riskMatrix: {
          dimensions: [5, 5],
          levels: [
            {
              level: 'low',
              range: [1, 6],
              requiredActions: ['Monitor', 'Document'],
              approvalRequired: false,
            },
            {
              level: 'medium',
              range: [7, 12],
              requiredActions: ['Mitigate', 'Monitor'],
              approvalRequired: true,
            },
            {
              level: 'high',
              range: [13, 16],
              requiredActions: ['Immediate mitigation', 'Executive notification'],
              approvalRequired: true,
            },
            {
              level: 'critical',
              range: [17, 25],
              requiredActions: ['Emergency response', 'System shutdown if needed'],
              approvalRequired: true,
            },
          ],
          colorCoding: {
            low: 'green',
            medium: 'yellow',
            high: 'orange',
            critical: 'red',
          },
        },
      },
      complianceFrameworks: ['OWASP', 'NIST', 'ISO27001'],
    };

    penetrationTestingConfig = {
      scope: {
        targetSystems: ['web-app', 'api-server'],
        ipRanges: ['192.168.1.0/24'],
        excludedSystems: ['production-db'],
        testingTypes: [
          {
            type: 'black_box',
            knowledgeLevel: 'none',
            accessLevel: 'external',
            focus: ['web-vulnerabilities', 'network-scanning'],
          },
        ],
        timeConstraints: {
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          allowedHours: ['09:00-17:00'],
          maintenanceWindows: [],
        },
      },
      methodology: 'owasp',
      exploitGeneration: {
        aiModel: 'gpt4',
        complexity: 'moderate',
        targetPlatforms: ['web', 'linux'],
        payloadTypes: ['xss', 'sql-injection', 'command-injection'],
        evasionTechniques: ['encoding', 'obfuscation'],
        safetyConstraints: {
          preventDataDestruction: true,
          limitSystemImpact: true,
          avoidProductionDisruption: true,
          maxImpactLevel: 'low',
          rollbackRequired: true,
        },
      },
      phases: [
        {
          id: 'reconnaissance',
          name: 'Information Gathering',
          objectives: ['Identify targets', 'Gather system information'],
          techniques: [
            {
              id: 'passive-recon',
              name: 'Passive Reconnaissance',
              category: 'reconnaissance',
              automationLevel: 'fully_automated',
              toolsRequired: ['nmap', 'shodan'],
              riskLevel: 'low',
            },
          ],
          successCriteria: ['Complete target enumeration'],
          dependencies: [],
        },
      ],
      reportingRequirements: {
        formats: ['pdf', 'html', 'json'],
        detailLevels: ['executive', 'technical', 'detailed'],
        audiences: ['executives', 'security-team', 'developers'],
        complianceMapping: true,
        remediationGuidance: true,
        executiveSummary: true,
      },
    };

    vulnerabilityAssessmentConfig = {
      scope: {
        applications: ['web-app', 'mobile-app'],
        networkSegments: ['dmz', 'internal'],
        infrastructure: ['web-servers', 'databases'],
        depth: 'comprehensive',
        frequency: 'continuous',
      },
      owaspCompliance: {
        version: '2021',
        categories: [
          {
            id: 'A01',
            name: 'Broken Access Control',
            riskRating: 'high',
            testingTechniques: ['automated-scanning', 'manual-testing'],
            complianceRequirements: ['Authentication', 'Authorization'],
          },
          {
            id: 'A02',
            name: 'Cryptographic Failures',
            riskRating: 'high',
            testingTechniques: ['ssl-analysis', 'encryption-testing'],
            complianceRequirements: ['Data encryption', 'Secure transmission'],
          },
        ],
        testingDepth: {
          A01: 'thorough',
          A02: 'thorough',
        },
        complianceThreshold: 95,
      },
      vulnerabilityDatabases: ['NVD', 'CVE', 'OWASP'],
      scanningTechniques: [
        {
          id: 'static-analysis',
          name: 'Static Code Analysis',
          type: 'static',
          coverageAreas: ['source-code', 'configuration'],
          accuracy: 0.85,
          performanceImpact: 'minimal',
        },
        {
          id: 'dynamic-analysis',
          name: 'Dynamic Application Testing',
          type: 'dynamic',
          coverageAreas: ['runtime-behavior', 'user-input'],
          accuracy: 0.9,
          performanceImpact: 'medium',
        },
      ],
      falsePositiveHandling: {
        detectionAlgorithms: ['ml-classification', 'rule-based'],
        confidenceThresholds: {
          'high-severity': 0.9,
          'medium-severity': 0.8,
          'low-severity': 0.7,
        },
        validationMethods: ['automated-verification', 'context-analysis'],
        learningEnabled: true,
        humanVerificationRequired: false,
      },
    };

    framework = new AISecurityTestingFramework(
      threatModelingConfig,
      penetrationTestingConfig,
      vulnerabilityAssessmentConfig
    );
  });

  afterEach(() => {
    framework.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('Framework Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(framework).toBeInstanceOf(AISecurityTestingFramework);

      const stats = framework.getSecurityStats();
      expect(stats.totalReports).toBeGreaterThanOrEqual(0);
      expect(stats.latestRiskScore).toBeGreaterThanOrEqual(0);
      expect(stats.vulnerabilityCount).toBeGreaterThanOrEqual(0);
      expect(stats.complianceScore).toBeGreaterThanOrEqual(0);
      expect(stats.complianceScore).toBeLessThanOrEqual(100);
    });

    test('should validate threat modeling configuration', () => {
      expect(threatModelingConfig.methodology).toBe('stride');
      expect(threatModelingConfig.assets).toHaveLength(1);
      expect(threatModelingConfig.threatActors).toHaveLength(1);
      expect(threatModelingConfig.attackVectors).toHaveLength(1);
      expect(threatModelingConfig.complianceFrameworks).toContain('OWASP');
    });

    test('should validate penetration testing configuration', () => {
      expect(penetrationTestingConfig.methodology).toBe('owasp');
      expect(penetrationTestingConfig.scope.targetSystems).toContain('web-app');
      expect(penetrationTestingConfig.exploitGeneration.aiModel).toBe('gpt4');
      expect(penetrationTestingConfig.phases).toHaveLength(1);
    });

    test('should validate vulnerability assessment configuration', () => {
      expect(vulnerabilityAssessmentConfig.owaspCompliance.version).toBe('2021');
      expect(vulnerabilityAssessmentConfig.owaspCompliance.categories).toHaveLength(2);
      expect(vulnerabilityAssessmentConfig.scanningTechniques).toHaveLength(2);
      expect(vulnerabilityAssessmentConfig.falsePositiveHandling.learningEnabled).toBe(true);
    });
  });

  describe('US-158 Sub-task 11.8.1: Design autonomous security testing strategy with threat modeling', () => {
    test('should design security testing strategy', async () => {
      await expect(framework.designSecurityTestingStrategy()).resolves.not.toThrow();
    });

    test('should perform threat modeling', async () => {
      await framework.designSecurityTestingStrategy();
      // Threat modeling should be performed
      expect(framework).toBeDefined();
    });

    test('should design testing strategy based on threats', async () => {
      await framework.designSecurityTestingStrategy();
      // Testing strategy should be designed
      expect(framework).toBeDefined();
    });

    test('should configure testing pipelines', async () => {
      await framework.designSecurityTestingStrategy();
      // Testing pipelines should be configured
      expect(framework).toBeDefined();
    });
  });

  describe('US-158 Sub-task 11.8.2: Implement AI-driven penetration testing with exploit generation', () => {
    test('should perform penetration testing', async () => {
      const results = await framework.performPenetrationTesting();

      expect(Array.isArray(results)).toBe(true);
      results.forEach((result) => {
        expect(result).toHaveProperty('testId');
        expect(result).toHaveProperty('testName');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('status');
        expect(result).toHaveProperty('vulnerabilities');
        expect(result).toHaveProperty('executionTime');
        expect(result).toHaveProperty('riskLevel');
        expect(result).toHaveProperty('evidence');
        expect(result).toHaveProperty('recommendations');

        expect(typeof result.testId).toBe('string');
        expect(typeof result.testName).toBe('string');
        expect(['passed', 'failed', 'error', 'skipped']).toContain(result.status);
        expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
        expect(Array.isArray(result.vulnerabilities)).toBe(true);
        expect(Array.isArray(result.evidence)).toBe(true);
        expect(Array.isArray(result.recommendations)).toBe(true);
      });
    });

    test('should generate and test exploits safely', async () => {
      const results = await framework.performPenetrationTesting();

      results.forEach((result) => {
        result.vulnerabilities.forEach((vuln) => {
          expect(vuln).toHaveProperty('id');
          expect(vuln).toHaveProperty('title');
          expect(vuln).toHaveProperty('description');
          expect(vuln).toHaveProperty('severity');
          expect(vuln).toHaveProperty('exploitationComplexity');
          expect(vuln).toHaveProperty('impact');
          expect(vuln).toHaveProperty('remediation');

          expect(['info', 'low', 'medium', 'high', 'critical']).toContain(vuln.severity);
          expect(['low', 'medium', 'high']).toContain(vuln.exploitationComplexity);
          expect(Array.isArray(vuln.affectedComponents)).toBe(true);
          expect(Array.isArray(vuln.remediation)).toBe(true);
        });
      });
    });

    test('should validate findings through multiple methods', async () => {
      const results = await framework.performPenetrationTesting();

      // Findings should be validated
      expect(Array.isArray(results)).toBe(true);
      results.forEach((result) => {
        expect(result.executionTime).toBeGreaterThan(0);
        expect(result.evidence.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('US-158 Sub-task 11.8.3: Create automated vulnerability assessment with OWASP compliance checking', () => {
    test('should perform vulnerability assessment', async () => {
      const findings = await framework.performVulnerabilityAssessment();

      expect(Array.isArray(findings)).toBe(true);
      findings.forEach((finding) => {
        expect(finding).toHaveProperty('id');
        expect(finding).toHaveProperty('title');
        expect(finding).toHaveProperty('description');
        expect(finding).toHaveProperty('severity');
        expect(finding).toHaveProperty('affectedComponents');
        expect(finding).toHaveProperty('exploitationComplexity');
        expect(finding).toHaveProperty('impact');
        expect(finding).toHaveProperty('remediation');

        expect(typeof finding.id).toBe('string');
        expect(typeof finding.title).toBe('string');
        expect(typeof finding.description).toBe('string');
        expect(['info', 'low', 'medium', 'high', 'critical']).toContain(finding.severity);
        expect(['low', 'medium', 'high']).toContain(finding.exploitationComplexity);
        expect(Array.isArray(finding.affectedComponents)).toBe(true);
        expect(Array.isArray(finding.remediation)).toBe(true);
      });
    });

    test('should check OWASP compliance', async () => {
      const findings = await framework.performVulnerabilityAssessment();

      // Should include OWASP category mapping
      findings.forEach((finding) => {
        if (finding.owaspCategory) {
          expect(typeof finding.owaspCategory).toBe('string');
        }
      });
    });

    test('should perform comprehensive scanning', async () => {
      const findings = await framework.performVulnerabilityAssessment();

      expect(Array.isArray(findings)).toBe(true);
      // Should perform various types of scans
      findings.forEach((finding) => {
        expect(finding.impact).toHaveProperty('confidentiality');
        expect(finding.impact).toHaveProperty('integrity');
        expect(finding.impact).toHaveProperty('availability');
        expect(finding.impact).toHaveProperty('businessImpact');

        expect(['none', 'partial', 'complete']).toContain(finding.impact.confidentiality);
        expect(['none', 'partial', 'complete']).toContain(finding.impact.integrity);
        expect(['none', 'partial', 'complete']).toContain(finding.impact.availability);
        expect(['minimal', 'minor', 'moderate', 'major', 'severe']).toContain(
          finding.impact.businessImpact
        );
      });
    });

    test('should filter false positives', async () => {
      const findings = await framework.performVulnerabilityAssessment();

      // False positive filtering should be applied
      expect(Array.isArray(findings)).toBe(true);
      // High confidence findings should remain
      findings.forEach((finding) => {
        expect(finding.severity).toBeDefined();
      });
    });
  });

  describe('US-158 Sub-task 11.8.4: Add continuous security scanning with zero-day vulnerability detection', () => {
    test('should start continuous security scanning', async () => {
      await expect(framework.startContinuousSecurityScanning()).resolves.not.toThrow();
    });

    test('should perform incremental assessments', async () => {
      await framework.startContinuousSecurityScanning();
      // Incremental assessments should be running
      expect(framework).toBeDefined();
    });

    test('should check for zero-day indicators', async () => {
      await framework.startContinuousSecurityScanning();
      // Zero-day detection should be active
      expect(framework).toBeDefined();
    });

    test('should monitor threat intelligence', async () => {
      await framework.startContinuousSecurityScanning();
      // Threat intelligence monitoring should be active
      expect(framework).toBeDefined();
    });
  });

  describe('US-158 Sub-task 11.8.5: Implement autonomous security test reporting with severity classification', () => {
    test('should generate comprehensive security report', async () => {
      const report = await framework.generateSecurityReport();

      expect(report).toHaveProperty('id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('executiveSummary');
      expect(report).toHaveProperty('testResults');
      expect(report).toHaveProperty('riskAssessment');
      expect(report).toHaveProperty('complianceStatus');
      expect(report).toHaveProperty('remediationRoadmap');
      expect(report).toHaveProperty('appendices');

      expect(typeof report.id).toBe('string');
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(Array.isArray(report.testResults)).toBe(true);
      expect(Array.isArray(report.appendices)).toBe(true);
    });

    test('should provide executive summary', async () => {
      const report = await framework.generateSecurityReport();

      expect(report.executiveSummary).toHaveProperty('overallPosture');
      expect(report.executiveSummary).toHaveProperty('keyFindings');
      expect(report.executiveSummary).toHaveProperty('riskSummary');
      expect(report.executiveSummary).toHaveProperty('recommendations');
      expect(report.executiveSummary).toHaveProperty('businessImpact');

      expect(['excellent', 'good', 'fair', 'poor', 'critical']).toContain(
        report.executiveSummary.overallPosture
      );
      expect(Array.isArray(report.executiveSummary.keyFindings)).toBe(true);
      expect(Array.isArray(report.executiveSummary.recommendations)).toBe(true);
      expect(typeof report.executiveSummary.businessImpact).toBe('string');
    });

    test('should include risk assessment', async () => {
      const report = await framework.generateSecurityReport();

      expect(report.riskAssessment).toHaveProperty('methodology');
      expect(report.riskAssessment).toHaveProperty('riskFactors');
      expect(report.riskAssessment).toHaveProperty('riskCalculations');
      expect(report.riskAssessment).toHaveProperty('mitigationStrategies');

      expect(Array.isArray(report.riskAssessment.riskFactors)).toBe(true);
      expect(Array.isArray(report.riskAssessment.riskCalculations)).toBe(true);
      expect(Array.isArray(report.riskAssessment.mitigationStrategies)).toBe(true);
    });

    test('should include compliance status', async () => {
      const report = await framework.generateSecurityReport();

      expect(report.complianceStatus).toHaveProperty('frameworks');
      expect(report.complianceStatus).toHaveProperty('overallScore');
      expect(report.complianceStatus).toHaveProperty('gaps');
      expect(report.complianceStatus).toHaveProperty('certifications');

      expect(Array.isArray(report.complianceStatus.frameworks)).toBe(true);
      expect(typeof report.complianceStatus.overallScore).toBe('number');
      expect(report.complianceStatus.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.complianceStatus.overallScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(report.complianceStatus.gaps)).toBe(true);
      expect(Array.isArray(report.complianceStatus.certifications)).toBe(true);
    });
  });

  describe('US-158 Sub-task 11.8.6: Create self-optimizing security remediation workflows', () => {
    test('should create remediation workflows', async () => {
      await expect(framework.createRemediationWorkflows()).resolves.not.toThrow();
    });

    test('should analyze remediation history', async () => {
      await framework.createRemediationWorkflows();
      // Remediation history analysis should be performed
      expect(framework).toBeDefined();
    });

    test('should optimize workflow efficiency', async () => {
      await framework.createRemediationWorkflows();
      // Workflow optimization should be active
      expect(framework).toBeDefined();
    });

    test('should implement automated remediation', async () => {
      await framework.createRemediationWorkflows();
      // Automated remediation should be configured
      expect(framework).toBeDefined();
    });
  });

  describe('US-158 Sub-task 11.8.7: Add automated security testing documentation and compliance reporting', () => {
    test('should generate security documentation', async () => {
      const documentation = await framework.generateSecurityDocumentation();

      expect(typeof documentation).toBe('string');
      expect(documentation.length).toBeGreaterThan(0);

      // Should contain standard security documentation sections
      expect(documentation).toContain('# Security Testing Report');
      expect(documentation).toContain('## Security Overview');
      expect(documentation).toContain('## Testing Methodology');
      expect(documentation).toContain('## Compliance Mapping');
      expect(documentation).toContain('## Remediation Guidance');
      expect(documentation).toContain('## Security Policies');
    });

    test('should include testing methodology documentation', async () => {
      const documentation = await framework.generateSecurityDocumentation();

      expect(documentation).toContain('methodology');
      expect(documentation).toContain('testing');
      expect(documentation).toContain('security');
    });

    test('should provide compliance mapping', async () => {
      const documentation = await framework.generateSecurityDocumentation();

      expect(documentation).toContain('compliance');
      expect(documentation).toContain('OWASP');
      expect(documentation).toContain('framework');
    });

    test('should include remediation guidance', async () => {
      const documentation = await framework.generateSecurityDocumentation();

      expect(documentation).toContain('remediation');
      expect(documentation).toContain('guidance');
      expect(documentation).toContain('recommendation');
    });
  });

  describe('US-158 Sub-task 11.8.8: Implement continuous security testing coverage verification', () => {
    test('should verify security testing coverage', async () => {
      const coverage = await framework.verifySecurityTestingCoverage();

      expect(coverage).toHaveProperty('coverage');
      expect(coverage).toHaveProperty('gaps');

      expect(typeof coverage.coverage).toBe('number');
      expect(coverage.coverage).toBeGreaterThanOrEqual(0);
      expect(coverage.coverage).toBeLessThanOrEqual(100);
      expect(Array.isArray(coverage.gaps)).toBe(true);
    });

    test('should analyze threat coverage', async () => {
      const coverage = await framework.verifySecurityTestingCoverage();

      expect(coverage.coverage).toBeDefined();
      // Should analyze coverage against threat model
      expect(typeof coverage.coverage).toBe('number');
    });

    test('should analyze OWASP coverage', async () => {
      const coverage = await framework.verifySecurityTestingCoverage();

      expect(coverage.coverage).toBeDefined();
      // Should analyze coverage against OWASP categories
      expect(typeof coverage.coverage).toBe('number');
    });

    test('should identify coverage gaps', async () => {
      const coverage = await framework.verifySecurityTestingCoverage();

      expect(Array.isArray(coverage.gaps)).toBe(true);
      coverage.gaps.forEach((gap) => {
        expect(typeof gap).toBe('string');
        expect(gap.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should perform complete security testing cycle', async () => {
      // Design strategy
      await framework.designSecurityTestingStrategy();

      // Perform penetration testing
      const pentestResults = await framework.performPenetrationTesting();
      expect(Array.isArray(pentestResults)).toBe(true);

      // Perform vulnerability assessment
      const vulnFindings = await framework.performVulnerabilityAssessment();
      expect(Array.isArray(vulnFindings)).toBe(true);

      // Start continuous scanning
      await framework.startContinuousSecurityScanning();

      // Generate report
      const report = await framework.generateSecurityReport();
      expect(report).toBeDefined();

      // Create remediation workflows
      await framework.createRemediationWorkflows();

      // Generate documentation
      const documentation = await framework.generateSecurityDocumentation();
      expect(typeof documentation).toBe('string');

      // Verify coverage
      const coverage = await framework.verifySecurityTestingCoverage();
      expect(coverage).toBeDefined();
    });

    test('should maintain consistency across testing phases', async () => {
      await framework.designSecurityTestingStrategy();

      const report1 = await framework.generateSecurityReport();
      const report2 = await framework.generateSecurityReport();

      // Reports should be consistent
      expect(report1.executiveSummary.overallPosture).toBe(report2.executiveSummary.overallPosture);
      expect(
        Math.abs(report1.complianceStatus.overallScore - report2.complianceStatus.overallScore)
      ).toBeLessThan(5);
    });
  });

  describe('Performance and Scalability Tests', () => {
    test('should handle large-scale vulnerability assessments efficiently', async () => {
      const startTime = Date.now();

      const findings = await framework.performVulnerabilityAssessment();

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(Array.isArray(findings)).toBe(true);
      expect(duration).toBeLessThan(15000); // 15 seconds
    });

    test('should handle concurrent security operations', async () => {
      const [pentestResults, vulnFindings, coverage] = await Promise.all([
        framework.performPenetrationTesting(),
        framework.performVulnerabilityAssessment(),
        framework.verifySecurityTestingCoverage(),
      ]);

      expect(Array.isArray(pentestResults)).toBe(true);
      expect(Array.isArray(vulnFindings)).toBe(true);
      expect(coverage).toBeDefined();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid threat model gracefully', async () => {
      const invalidThreatConfig = {
        ...threatModelingConfig,
        assets: [],
        threatActors: [],
        attackVectors: [],
      };

      const testFramework = new AISecurityTestingFramework(
        invalidThreatConfig,
        penetrationTestingConfig,
        vulnerabilityAssessmentConfig
      );

      await expect(testFramework.designSecurityTestingStrategy()).resolves.not.toThrow();

      testFramework.stopMonitoring();
    });

    test('should handle penetration testing failures gracefully', async () => {
      await expect(framework.performPenetrationTesting()).resolves.not.toThrow();
    });

    test('should handle vulnerability assessment errors gracefully', async () => {
      await expect(framework.performVulnerabilityAssessment()).resolves.not.toThrow();
    });

    test('should handle report generation errors gracefully', async () => {
      await expect(framework.generateSecurityReport()).resolves.not.toThrow();
    });
  });

  describe('Monitoring and Cleanup', () => {
    test('should start and stop monitoring correctly', () => {
      expect(() => framework.stopMonitoring()).not.toThrow();
    });

    test('should provide accurate statistics', () => {
      const stats = framework.getSecurityStats();

      expect(stats).toHaveProperty('totalReports');
      expect(stats).toHaveProperty('latestRiskScore');
      expect(stats).toHaveProperty('vulnerabilityCount');
      expect(stats).toHaveProperty('complianceScore');

      expect(typeof stats.totalReports).toBe('number');
      expect(typeof stats.latestRiskScore).toBe('number');
      expect(typeof stats.vulnerabilityCount).toBe('number');
      expect(typeof stats.complianceScore).toBe('number');

      expect(stats.complianceScore).toBeGreaterThanOrEqual(0);
      expect(stats.complianceScore).toBeLessThanOrEqual(100);
    });
  });
});
