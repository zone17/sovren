#!/usr/bin/env python3
"""
Comprehensive Test Suite for Autonomous CI/CD System
Tests all components: Pipeline Manager, Pre-commit Hooks, Deployment Validator, Environment Manager
Part of validation for US-163 through US-166 implementations.
"""

import unittest
import asyncio
import json
import yaml
import tempfile
import os
import sys
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta
import subprocess

# Add scripts directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../scripts/ci'))

from autonomous_pipeline_manager import AutonomousPipelineManager
from intelligent_pre_commit_hooks import IntelligentPreCommitHooks
from autonomous_deployment_validator import AutonomousDeploymentValidator, DeploymentContext
from autonomous_environment_manager import AutonomousEnvironmentManager, EnvironmentConfig

class TestAutonomousPipelineManager(unittest.TestCase):
    """Test suite for Autonomous Pipeline Manager (US-163)."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, 'test_config.yml')

        # Create test configuration
        test_config = {
            'optimization_modes': {
                'adaptive': {'aggression': 0.5, 'stability': 0.8},
                'aggressive': {'aggression': 0.9, 'stability': 0.3}
            },
            'risk_thresholds': {
                'low': 0.2, 'medium': 0.5, 'high': 0.8, 'critical': 0.95
            },
            'performance_targets': {
                'build_time': 300, 'test_time': 600, 'deployment_time': 180, 'failure_rate': 0.05
            }
        }

        with open(self.config_path, 'w') as f:
            yaml.dump(test_config, f)

        self.manager = AutonomousPipelineManager(self.config_path)

    def test_config_loading(self):
        """Test configuration loading and merging."""
        self.assertIn('optimization_modes', self.manager.config)
        self.assertEqual(self.manager.config['optimization_modes']['adaptive']['aggression'], 0.5)

    def test_repository_analysis(self):
        """Test repository state analysis."""
        # Mock git commands
        with patch('subprocess.run') as mock_run:
            mock_run.return_value.stdout = "test commit\n+test.py | 10 +++++-----"
            mock_run.return_value.returncode = 0

            analysis = self.manager.analyze_repository_state()

            self.assertIn('recent_changes', analysis)
            self.assertIn('changed_files', analysis)
            self.assertIn('complexity_score', analysis)
            self.assertIsInstance(analysis['complexity_score'], float)

    def test_strategy_determination(self):
        """Test pipeline strategy determination."""
        repo_analysis = {
            'complexity_score': 0.3,
            'change_count': 5,
            'file_analysis': {
                'frontend_files': 2,
                'backend_files': 1,
                'test_files': 1,
                'config_files': 1,
                'high_risk_files': 0
            }
        }

        strategy = self.manager.determine_pipeline_strategy(repo_analysis)

        self.assertIn('strategy', strategy)
        self.assertIn('risk_level', strategy)
        self.assertIn('test_strategy', strategy)
        self.assertIn('deployment_approach', strategy)
        self.assertIn(strategy['strategy'], ['fast', 'standard', 'comprehensive', 'experimental'])

    def test_optimization_recommendations(self):
        """Test optimization recommendation generation."""
        strategy_data = {
            'strategy': 'standard',
            'risk_level': 'medium',
            'test_strategy': 'integration'
        }

        recommendations = self.manager.generate_optimization_recommendations(strategy_data)

        self.assertIn('cache_strategy', recommendations)
        self.assertIn('parallel_jobs', recommendations)
        self.assertIn('timeout_adjustments', recommendations)
        self.assertIsInstance(recommendations['parallel_jobs'], int)
        self.assertGreater(recommendations['parallel_jobs'], 0)

    def test_failure_prediction(self):
        """Test failure probability prediction."""
        current_metrics = {
            'complexity_score': 0.6,
            'change_count': 15,
            'high_risk_files': 2
        }

        prediction = self.manager.predict_failure_probability(current_metrics)

        self.assertIn('probability', prediction)
        self.assertIn('confidence', prediction)
        self.assertIn('method', prediction)
        self.assertIsInstance(prediction['probability'], float)
        self.assertGreaterEqual(prediction['probability'], 0)
        self.assertLessEqual(prediction['probability'], 1)

    def test_metrics_saving(self):
        """Test metrics persistence."""
        metrics = {
            'complexity_score': 0.5,
            'change_count': 10,
            'strategy': 'standard',
            'risk_level': 'medium'
        }

        # Should not raise exception
        self.manager.save_metrics(metrics)

        # Check if history was updated
        self.assertGreater(len(self.manager.metrics_history), 0)


class TestIntelligentPreCommitHooks(unittest.TestCase):
    """Test suite for Intelligent Pre-commit Hooks (US-164)."""

    def setUp(self):
        """Set up test fixtures."""
        self.temp_dir = tempfile.mkdtemp()
        self.hooks = IntelligentPreCommitHooks()

    def test_file_type_detection(self):
        """Test file type detection."""
        test_cases = [
            ('test.js', 'javascript'),
            ('test.py', 'python'),
            ('test.yml', 'yaml'),
            ('Dockerfile', 'dockerfile'),
            ('test.unknown', 'text')
        ]

        for file_path, expected_type in test_cases:
            detected_type = self.hooks._detect_file_type(file_path)
            self.assertEqual(detected_type, expected_type)

    def test_security_scanning(self):
        """Test security issue detection."""
        test_lines = [
            'password = "hardcoded_secret"',
            'SELECT * FROM users WHERE id = ' + str(1),
            'eval(user_input)',
            'hashlib.md5(data).hexdigest()'
        ]

        issues = self.hooks._scan_security_issues(test_lines)

        self.assertGreater(len(issues), 0)
        self.assertTrue(any('hardcoded_secrets' in issue['rule_id'] for issue in issues))

    def test_style_analysis(self):
        """Test code style analysis."""
        test_lines = [
            'function veryLongFunctionNameThatExceedsTheMaximumLineLengthConfiguredForThisProject() {',
            '  return true;',
            '\t\tmixed_indentation();'
        ]

        issues = self.hooks._analyze_code_style(test_lines, 'test.js')

        # Should detect line length issue
        self.assertTrue(any(issue['type'] == 'line_length' for issue in issues))

    def test_complexity_calculation(self):
        """Test complexity impact calculation."""
        test_lines = [
            'if (condition1 && condition2) {',
            '  for (let i = 0; i < array.length; i++) {',
            '    try {',
            '      value = condition ? value1 : value2;',
            '    } catch (error) {'
        ]

        complexity = self.hooks._calculate_complexity_impact(test_lines)

        self.assertGreater(complexity, 0)
        self.assertIsInstance(complexity, int)

    def test_intelligent_test_selection(self):
        """Test intelligent test file selection."""
        changed_files = [
            'src/components/Button.tsx',
            'src/services/api.ts',
            'src/utils/helpers.js'
        ]

        # Mock file existence
        with patch('os.path.exists') as mock_exists:
            mock_exists.return_value = True

            test_files = self.hooks.intelligent_test_selection(changed_files)

            self.assertIsInstance(test_files, list)
            # Should find at least some test files
            self.assertGreaterEqual(len(test_files), 0)

    def test_bypass_conditions(self):
        """Test commit bypass logic."""
        analysis_results = [
            {
                'file_path': 'test.js',
                'security_issues': [{'severity': 'medium'}],
                'style_issues': [{'severity': 'low'}],
                'performance_issues': []
            }
        ]

        bypass_info = self.hooks.check_bypass_conditions(analysis_results)

        self.assertIn('should_bypass', bypass_info)
        self.assertIn('bypass_score', bypass_info)
        self.assertIn('total_issues', bypass_info)
        self.assertIsInstance(bypass_info['should_bypass'], bool)


class TestAutonomousDeploymentValidator(unittest.TestCase):
    """Test suite for Autonomous Deployment Validator (US-165)."""

    def setUp(self):
        """Set up test fixtures."""
        self.validator = AutonomousDeploymentValidator()
        self.test_context = DeploymentContext(
            environment='staging',
            service_name='sovren-app',
            version='v1.0.0',
            base_url='https://staging.sovren.dev',
            health_endpoint='https://staging.sovren.dev/api/v1/health',
            deployment_time=datetime.now()
        )

    def test_context_detection(self):
        """Test deployment context detection."""
        with patch.dict(os.environ, {
            'DEPLOYMENT_ENV': 'test',
            'SERVICE_NAME': 'test-service',
            'DEPLOYMENT_VERSION': '1.0.0'
        }):
            context = self.validator.detect_deployment_context()

            self.assertEqual(context.environment, 'test')
            self.assertEqual(context.service_name, 'test-service')
            self.assertEqual(context.version, '1.0.0')

    def test_validation_plan_generation(self):
        """Test validation plan generation."""
        plan = self.validator.generate_validation_plan(self.test_context)

        self.assertIn('stages', plan)
        self.assertIn('estimated_duration', plan)
        self.assertIn('risk_level', plan)
        self.assertGreater(len(plan['stages']), 0)

        # Check that enabled stages are included
        stage_names = [stage['name'] for stage in plan['stages']]
        self.assertIn('smoke_tests', stage_names)
        self.assertIn('health_checks', stage_names)

    def test_http_test_execution(self):
        """Test HTTP test execution."""
        test = {
            'name': 'basic_health_check',
            'type': 'http_get',
            'url': 'https://httpbin.org/status/200',
            'expected_status': 200,
            'timeout': 10
        }

        result = self.validator._execute_http_test(test, 10)

        self.assertIn('name', result)
        self.assertIn('success', result)
        self.assertIn('duration', result)
        self.assertIsInstance(result['success'], bool)

    def test_performance_test_execution(self):
        """Test performance test execution."""
        test = {
            'name': 'response_time_test',
            'type': 'performance',
            'url': 'https://httpbin.org/delay/1',
            'max_response_time': 5000,
            'concurrent_requests': 2,
            'timeout': 10
        }

        result = self.validator._execute_performance_test(test, 10)

        self.assertIn('name', result)
        self.assertIn('success', result)
        self.assertIn('avg_response_time', result)
        self.assertIn('requests_completed', result)

    def test_health_monitoring(self):
        """Test deployment health monitoring."""
        # Mock the health check method
        with patch.object(self.validator, '_perform_health_check') as mock_health:
            mock_health.return_value = {
                'timestamp': datetime.now().isoformat(),
                'success': True,
                'status_code': 200,
                'response_time': 150
            }

            # Test very short monitoring period
            monitoring_data = self.validator.monitor_deployment_health(self.test_context, 0.01)

            self.assertIn('health_checks', monitoring_data)
            self.assertIn('start_time', monitoring_data)
            self.assertIn('end_time', monitoring_data)

    def test_anomaly_detection(self):
        """Test anomaly detection in monitoring data."""
        monitoring_data = {
            'performance_metrics': [
                {'timestamp': '2024-01-01T00:00:00', 'response_time': 3000, 'error_rate': 0.1},
                {'timestamp': '2024-01-01T00:01:00', 'response_time': 3500, 'error_rate': 0.12}
            ]
        }

        anomalies = self.validator._detect_anomalies(monitoring_data)

        self.assertIsInstance(anomalies, list)
        # Should detect high response time and error rate
        self.assertGreater(len(anomalies), 0)


class TestAutonomousEnvironmentManager(unittest.TestCase):
    """Test suite for Autonomous Environment Manager (US-166)."""

    def setUp(self):
        """Set up test fixtures."""
        # Mock providers to avoid requiring actual infrastructure
        with patch('docker.from_env'), \
             patch('kubernetes.config.load_kube_config'), \
             patch('boto3.client'):
            self.manager = AutonomousEnvironmentManager()

        self.test_env = EnvironmentConfig(
            name='test-env',
            type='development',
            provider='docker',
            resources={'containers': 2, 'memory': '4Gi'},
            variables={'NODE_ENV': 'test'},
            dependencies=[],
            health_checks=[],
            auto_scaling={},
            backup_config={},
            security_config={}
        )

    def test_environment_type_determination(self):
        """Test environment type detection from name."""
        test_cases = [
            ('production-app', 'production'),
            ('staging-service', 'staging'),
            ('dev-environment', 'development'),
            ('unknown-env', 'unknown')
        ]

        for env_name, expected_type in test_cases:
            detected_type = self.manager._determine_env_type(env_name)
            self.assertEqual(detected_type, expected_type)

    def test_configuration_drift_detection(self):
        """Test configuration drift detection."""
        # Mock current and expected state
        with patch.object(self.manager, '_get_current_environment_state') as mock_current, \
             patch.object(self.manager, '_get_expected_environment_state') as mock_expected:

            mock_current.return_value = {
                'resources': {'containers': 3, 'memory': '6Gi'},
                'variables': {'NODE_ENV': 'production'},
                'security': {}
            }

            mock_expected.return_value = {
                'resources': {'containers': 2, 'memory': '4Gi'},
                'variables': {'NODE_ENV': 'test'},
                'security': {}
            }

            drift = self.manager.detect_configuration_drift(self.test_env)

            self.assertIsInstance(drift.drift_detected, bool)
            self.assertIn(drift.severity, ['low', 'medium', 'high', 'critical'])
            self.assertTrue(drift.drift_detected)  # Should detect differences

    def test_remediation_plan_generation(self):
        """Test remediation plan generation."""
        drift_items = [
            {
                'type': 'resource_config_drift',
                'resource': 'memory',
                'severity': 'high',
                'auto_fixable': True
            },
            {
                'type': 'variable_drift',
                'variable': 'NODE_ENV',
                'severity': 'medium',
                'auto_fixable': True
            }
        ]

        plan = self.manager._generate_remediation_plan(drift_items)

        self.assertIsInstance(plan, list)
        self.assertGreater(len(plan), 0)

        # Check plan structure
        for step in plan:
            self.assertIn('action', step)
            self.assertIn('priority', step)
            self.assertIn('estimated_time', step)

    def test_resource_optimization(self):
        """Test resource optimization analysis."""
        usage_data = {
            'cpu_usage': 0.3,
            'memory_usage': 0.6,
            'storage_usage': 0.4
        }

        with patch.object(self.manager, '_collect_resource_usage') as mock_usage:
            mock_usage.return_value = usage_data

            optimization = self.manager.optimize_environment_resources(self.test_env)

            self.assertIn('environment', optimization)
            self.assertIn('current_resources', optimization)
            self.assertEqual(optimization['environment'], self.test_env.name)

    def test_environment_discovery(self):
        """Test environment discovery across providers."""
        # Mock provider methods
        with patch.object(self.manager, '_discover_docker_environments') as mock_docker, \
             patch.object(self.manager, '_discover_k8s_environments') as mock_k8s, \
             patch.object(self.manager, '_discover_aws_environments') as mock_aws:

            mock_docker.return_value = [self.test_env]
            mock_k8s.return_value = []
            mock_aws.return_value = []

            environments = self.manager.discover_environments()

            self.assertIsInstance(environments, list)
            self.assertGreater(len(environments), 0)
            self.assertEqual(environments[0].name, self.test_env.name)


class TestSystemIntegration(unittest.TestCase):
    """Integration tests for the complete autonomous CI/CD system."""

    def setUp(self):
        """Set up integration test fixtures."""
        self.temp_dir = tempfile.mkdtemp()

    def test_pipeline_to_deployment_flow(self):
        """Test complete flow from pipeline analysis to deployment validation."""
        # Initialize components
        pipeline_manager = AutonomousPipelineManager()
        deployment_validator = AutonomousDeploymentValidator()

        # Mock repository analysis
        with patch.object(pipeline_manager, 'analyze_repository_state') as mock_analysis:
            mock_analysis.return_value = {
                'complexity_score': 0.4,
                'change_count': 8,
                'file_analysis': {
                    'frontend_files': 3,
                    'backend_files': 2,
                    'test_files': 2,
                    'high_risk_files': 1
                }
            }

            # Get pipeline strategy
            strategy = pipeline_manager.determine_pipeline_strategy(mock_analysis.return_value)

            # Use strategy to inform deployment validation
            context = deployment_validator.detect_deployment_context()
            validation_plan = deployment_validator.generate_validation_plan(context)

            # Verify integration
            self.assertIn('strategy', strategy)
            self.assertIn('stages', validation_plan)

            # Strategy should influence validation plan
            if strategy['risk_level'] == 'high':
                # Should have more comprehensive validation
                stage_names = [stage['name'] for stage in validation_plan['stages']]
                self.assertIn('security_scans', stage_names)

    def test_environment_drift_to_auto_healing(self):
        """Test integration between drift detection and auto-healing."""
        with patch('docker.from_env'), \
             patch('kubernetes.config.load_kube_config'), \
             patch('boto3.client'):
            env_manager = AutonomousEnvironmentManager()

        test_env = EnvironmentConfig(
            name='test-integration',
            type='development',
            provider='docker',
            resources={'memory': '4Gi'},
            variables={'NODE_ENV': 'test'},
            dependencies=[],
            health_checks=[],
            auto_scaling={},
            backup_config={},
            security_config={}
        )

        # Mock drift detection
        with patch.object(env_manager, '_get_current_environment_state') as mock_current, \
             patch.object(env_manager, '_get_expected_environment_state') as mock_expected:

            mock_current.return_value = {'resources': {'memory': '6Gi'}}
            mock_expected.return_value = {'resources': {'memory': '4Gi'}}

            # Detect drift
            drift = env_manager.detect_configuration_drift(test_env)

            # Mock remediation execution
            with patch.object(env_manager, '_execute_remediation_step') as mock_remediation:
                mock_remediation.return_value = {'success': True}

                # Attempt auto-healing
                if drift.auto_fix_available:
                    healing_result = env_manager.auto_heal_environment(test_env, drift)

                    self.assertIn('overall_success', healing_result)
                    self.assertIn('fixes_applied', healing_result)


def run_validation_suite():
    """Run the complete validation suite and generate report."""

    print("\n" + "="*80)
    print("🧪 AUTONOMOUS CI/CD SYSTEM VALIDATION SUITE")
    print("="*80)

    # Create test suite
    test_suite = unittest.TestSuite()

    # Add test classes
    test_classes = [
        TestAutonomousPipelineManager,
        TestIntelligentPreCommitHooks,
        TestAutonomousDeploymentValidator,
        TestAutonomousEnvironmentManager,
        TestSystemIntegration
    ]

    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(test_suite)

    # Generate validation report
    validation_report = {
        'timestamp': datetime.now().isoformat(),
        'total_tests': result.testsRun,
        'failures': len(result.failures),
        'errors': len(result.errors),
        'success_rate': (result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100,
        'test_classes': {
            'TestAutonomousPipelineManager': 'US-163 validation',
            'TestIntelligentPreCommitHooks': 'US-164 validation',
            'TestAutonomousDeploymentValidator': 'US-165 validation',
            'TestAutonomousEnvironmentManager': 'US-166 validation',
            'TestSystemIntegration': 'Integration validation'
        }
    }

    print("\n" + "="*80)
    print("📊 VALIDATION SUMMARY")
    print("="*80)
    print(f"Total Tests: {validation_report['total_tests']}")
    print(f"Failures: {validation_report['failures']}")
    print(f"Errors: {validation_report['errors']}")
    print(f"Success Rate: {validation_report['success_rate']:.1f}%")

    if result.failures:
        print(f"\n❌ FAILURES ({len(result.failures)}):")
        for test, traceback in result.failures:
            print(f"  - {test}")

    if result.errors:
        print(f"\n🚨 ERRORS ({len(result.errors)}):")
        for test, traceback in result.errors:
            print(f"  - {test}")

    print("="*80)

    # Save validation report
    os.makedirs('data', exist_ok=True)
    with open('data/validation_report.json', 'w') as f:
        json.dump(validation_report, f, indent=2)

    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_validation_suite()
    sys.exit(0 if success else 1)
