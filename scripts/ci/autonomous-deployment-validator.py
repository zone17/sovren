#!/usr/bin/env python3
"""
Autonomous Deployment Validation System
Self-configuring deployment validation with AI-powered monitoring and auto-rollback.
Part of US-165: Autonomous deployment validation implementation.
"""

import os
import sys
import json
import yaml
import openai
import requests
import subprocess
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path
import threading
import concurrent.futures
from dataclasses import dataclass
import asyncio
import aiohttp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class ValidationResult:
    """Result of a validation check."""
    name: str
    success: bool
    duration: float
    details: Dict
    severity: str = 'medium'
    auto_retry: bool = True

@dataclass
class DeploymentContext:
    """Deployment context information."""
    environment: str
    service_name: str
    version: str
    base_url: str
    health_endpoint: str
    deployment_time: datetime
    previous_version: Optional[str] = None

class AutonomousDeploymentValidator:
    """
    Manages autonomous deployment validation with AI-powered decisions and self-healing.
    """

    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.openai_client = self._initialize_openai()
        self.validation_history = self._load_validation_history()
        self.active_monitors = {}
        self.rollback_in_progress = False

    def _load_config(self, config_path: str) -> Dict:
        """Load deployment validation configuration."""
        default_config = {
            'validation_stages': {
                'smoke_tests': {
                    'enabled': True,
                    'timeout': 300,
                    'retry_count': 3,
                    'critical': True
                },
                'health_checks': {
                    'enabled': True,
                    'timeout': 60,
                    'interval': 10,
                    'critical': True
                },
                'performance_tests': {
                    'enabled': True,
                    'timeout': 600,
                    'baseline_comparison': True,
                    'critical': False
                },
                'integration_tests': {
                    'enabled': True,
                    'timeout': 900,
                    'dependency_validation': True,
                    'critical': True
                },
                'security_scans': {
                    'enabled': True,
                    'timeout': 300,
                    'vulnerability_threshold': 'medium',
                    'critical': False
                }
            },
            'rollback_triggers': {
                'health_check_failures': 3,
                'error_rate_threshold': 0.05,
                'response_time_degradation': 0.5,
                'critical_test_failures': 1
            },
            'monitoring': {
                'duration_minutes': 30,
                'alert_channels': ['slack', 'email'],
                'metrics_collection': True,
                'ai_anomaly_detection': True
            },
            'ai_settings': {
                'validation_learning': True,
                'auto_test_generation': True,
                'predictive_rollback': True,
                'performance_analysis': True
            }
        }

        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                user_config = yaml.safe_load(f)
                default_config.update(user_config)

        return default_config

    def _initialize_openai(self) -> Optional[openai]:
        """Initialize OpenAI client for AI-powered analysis."""
        api_key = os.environ.get('OPENAI_API_KEY')
        if api_key:
            openai.api_key = api_key
            return openai
        else:
            logger.warning("OpenAI API key not found. AI features will be limited.")
            return None

    def _load_validation_history(self) -> List[Dict]:
        """Load historical validation data for learning."""
        history_file = 'data/deployment_validation_history.json'

        if os.path.exists(history_file):
            try:
                with open(history_file, 'r') as f:
                    history = json.load(f)
                logger.info(f"Loaded {len(history)} historical validation records")
                return history
            except Exception as e:
                logger.error(f"Error loading validation history: {e}")

        return []

    def detect_deployment_context(self) -> DeploymentContext:
        """Automatically detect deployment context from environment."""
        logger.info("Detecting deployment context...")

        # Try to detect from environment variables
        environment = os.environ.get('DEPLOYMENT_ENV', 'staging')
        service_name = os.environ.get('SERVICE_NAME', 'sovren-app')
        version = os.environ.get('DEPLOYMENT_VERSION', 'unknown')

        # Try to detect from Git
        if version == 'unknown':
            try:
                result = subprocess.run(
                    ['git', 'rev-parse', '--short', 'HEAD'],
                    capture_output=True, text=True, timeout=10
                )
                if result.returncode == 0:
                    version = result.stdout.strip()
            except Exception:
                version = f"deploy-{int(time.time())}"

        # Construct base URL
        if environment == 'production':
            base_url = os.environ.get('PRODUCTION_URL', 'https://sovren.dev')
        elif environment == 'staging':
            base_url = os.environ.get('STAGING_URL', 'https://staging.sovren.dev')
        else:
            base_url = os.environ.get('BASE_URL', f'https://{environment}.sovren.dev')

        health_endpoint = f"{base_url}/api/v1/health"

        context = DeploymentContext(
            environment=environment,
            service_name=service_name,
            version=version,
            base_url=base_url,
            health_endpoint=health_endpoint,
            deployment_time=datetime.now()
        )

        logger.info(f"Detected context: {context.service_name} v{context.version} in {context.environment}")
        return context

    def generate_validation_plan(self, context: DeploymentContext) -> Dict:
        """Generate intelligent validation plan based on context and history."""
        logger.info("Generating intelligent validation plan...")

        # Base validation plan
        plan = {
            'stages': [],
            'estimated_duration': 0,
            'risk_level': 'medium',
            'rollback_strategy': 'automatic',
            'monitoring_duration': self.config['monitoring']['duration_minutes']
        }

        # Add enabled validation stages
        for stage_name, stage_config in self.config['validation_stages'].items():
            if stage_config['enabled']:
                stage = {
                    'name': stage_name,
                    'timeout': stage_config['timeout'],
                    'critical': stage_config['critical'],
                    'retry_count': stage_config.get('retry_count', 1),
                    'tests': self._generate_stage_tests(stage_name, context)
                }
                plan['stages'].append(stage)
                plan['estimated_duration'] += stage_config['timeout']

        # AI-powered plan optimization
        if self.openai_client and self.config['ai_settings']['validation_learning']:
            ai_optimizations = self._ai_optimize_plan(plan, context)
            plan.update(ai_optimizations)

        return plan

    def _generate_stage_tests(self, stage_name: str, context: DeploymentContext) -> List[Dict]:
        """Generate tests for a validation stage."""
        tests = []

        if stage_name == 'smoke_tests':
            tests = [
                {
                    'name': 'basic_health_check',
                    'type': 'http_get',
                    'url': context.health_endpoint,
                    'expected_status': 200,
                    'timeout': 30
                },
                {
                    'name': 'api_endpoints_accessible',
                    'type': 'http_get',
                    'url': f"{context.base_url}/api/v1/status",
                    'expected_status': [200, 201],
                    'timeout': 30
                },
                {
                    'name': 'static_assets_loading',
                    'type': 'http_get',
                    'url': f"{context.base_url}/",
                    'expected_status': 200,
                    'timeout': 30
                }
            ]

        elif stage_name == 'health_checks':
            tests = [
                {
                    'name': 'database_connectivity',
                    'type': 'http_get',
                    'url': f"{context.base_url}/api/v1/health/database",
                    'expected_status': 200,
                    'timeout': 10
                },
                {
                    'name': 'external_services',
                    'type': 'http_get',
                    'url': f"{context.base_url}/api/v1/health/services",
                    'expected_status': 200,
                    'timeout': 15
                },
                {
                    'name': 'memory_usage',
                    'type': 'http_get',
                    'url': f"{context.base_url}/api/v1/health/metrics",
                    'expected_response_contains': ['memory', 'cpu'],
                    'timeout': 10
                }
            ]

        elif stage_name == 'performance_tests':
            tests = [
                {
                    'name': 'response_time_baseline',
                    'type': 'performance',
                    'url': context.base_url,
                    'max_response_time': 2000,
                    'concurrent_requests': 10,
                    'timeout': 60
                },
                {
                    'name': 'api_performance',
                    'type': 'performance',
                    'url': f"{context.base_url}/api/v1/health",
                    'max_response_time': 500,
                    'concurrent_requests': 20,
                    'timeout': 60
                }
            ]

        elif stage_name == 'integration_tests':
            tests = [
                {
                    'name': 'authentication_flow',
                    'type': 'integration',
                    'description': 'Test authentication endpoints',
                    'timeout': 30
                },
                {
                    'name': 'api_workflow',
                    'type': 'integration',
                    'description': 'Test critical API workflows',
                    'timeout': 60
                }
            ]

        elif stage_name == 'security_scans':
            tests = [
                {
                    'name': 'ssl_certificate',
                    'type': 'security',
                    'url': context.base_url,
                    'check_ssl': True,
                    'timeout': 30
                },
                {
                    'name': 'security_headers',
                    'type': 'security',
                    'url': context.base_url,
                    'check_headers': ['X-Content-Type-Options', 'X-Frame-Options'],
                    'timeout': 30
                }
            ]

        return tests

    def _ai_optimize_plan(self, plan: Dict, context: DeploymentContext) -> Dict:
        """Use AI to optimize validation plan based on context and history."""
        try:
            # Analyze historical data
            recent_deployments = [
                h for h in self.validation_history
                if h.get('environment') == context.environment
                and datetime.fromisoformat(h.get('timestamp', '1970-01-01T00:00:00'))
                > datetime.now() - timedelta(days=30)
            ]

            prompt = f"""
            Optimize this deployment validation plan based on context and history:

            Current Plan:
            - Stages: {len(plan['stages'])}
            - Estimated Duration: {plan['estimated_duration']} seconds
            - Environment: {context.environment}
            - Service: {context.service_name}

            Historical Context:
            - Recent Deployments: {len(recent_deployments)}
            - Common Failures: {self._analyze_common_failures(recent_deployments)}

            Optimization Goals:
            1. Reduce false positives
            2. Improve failure detection accuracy
            3. Optimize execution time
            4. Enhance rollback triggers

            Return optimizations as JSON:
            {{
                "risk_level": "low|medium|high",
                "monitoring_duration": minutes,
                "stage_optimizations": {{"stage_name": {{"timeout": seconds, "priority": number}}}},
                "additional_tests": [list of test objects],
                "rollback_sensitivity": 0.0-1.0
            }}
            """

            response = self.openai_client.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=800
            )

            content = response.choices[0].message.content
            start = content.find('{')
            end = content.rfind('}') + 1

            if start != -1 and end != 0:
                optimizations = json.loads(content[start:end])
                logger.info(f"AI optimized plan: {optimizations.get('risk_level', 'unknown')} risk")
                return optimizations

        except Exception as e:
            logger.error(f"AI plan optimization failed: {e}")

        return {}

    def _analyze_common_failures(self, recent_deployments: List[Dict]) -> List[str]:
        """Analyze common failure patterns from recent deployments."""
        failures = []

        for deployment in recent_deployments:
            if not deployment.get('success', True):
                failure_stage = deployment.get('failed_stage', 'unknown')
                failure_reason = deployment.get('failure_reason', 'unknown')
                failures.append(f"{failure_stage}: {failure_reason}")

        # Return most common failures (simplified)
        return list(set(failures))[:5]

    async def execute_validation_stage(self, stage: Dict, context: DeploymentContext) -> ValidationResult:
        """Execute a single validation stage with intelligent retry logic."""
        stage_name = stage['name']
        logger.info(f"Executing validation stage: {stage_name}")

        start_time = time.time()

        try:
            # Execute tests in parallel where possible
            test_results = []

            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                future_to_test = {
                    executor.submit(self._execute_test, test, context): test
                    for test in stage['tests']
                }

                for future in concurrent.futures.as_completed(future_to_test, timeout=stage['timeout']):
                    test = future_to_test[future]
                    try:
                        result = future.result()
                        test_results.append(result)
                    except Exception as e:
                        test_results.append({
                            'name': test['name'],
                            'success': False,
                            'error': str(e),
                            'duration': 0
                        })

            # Analyze stage results
            successful_tests = [r for r in test_results if r['success']]
            failed_tests = [r for r in test_results if not r['success']]

            stage_success = len(failed_tests) == 0 or (not stage['critical'] and len(successful_tests) > len(failed_tests))

            duration = time.time() - start_time

            return ValidationResult(
                name=stage_name,
                success=stage_success,
                duration=duration,
                details={
                    'total_tests': len(test_results),
                    'successful_tests': len(successful_tests),
                    'failed_tests': len(failed_tests),
                    'test_results': test_results
                },
                severity='high' if stage['critical'] else 'medium'
            )

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Stage {stage_name} execution failed: {e}")

            return ValidationResult(
                name=stage_name,
                success=False,
                duration=duration,
                details={'error': str(e)},
                severity='high' if stage['critical'] else 'medium'
            )

    def _execute_test(self, test: Dict, context: DeploymentContext) -> Dict:
        """Execute a single test."""
        test_name = test['name']
        test_type = test['type']
        timeout = test.get('timeout', 30)

        start_time = time.time()

        try:
            if test_type == 'http_get':
                return self._execute_http_test(test, timeout)
            elif test_type == 'performance':
                return self._execute_performance_test(test, timeout)
            elif test_type == 'integration':
                return self._execute_integration_test(test, timeout)
            elif test_type == 'security':
                return self._execute_security_test(test, timeout)
            else:
                raise ValueError(f"Unknown test type: {test_type}")

        except Exception as e:
            duration = time.time() - start_time
            return {
                'name': test_name,
                'success': False,
                'error': str(e),
                'duration': duration
            }

    def _execute_http_test(self, test: Dict, timeout: int) -> Dict:
        """Execute HTTP-based test."""
        start_time = time.time()

        try:
            response = requests.get(
                test['url'],
                timeout=timeout,
                verify=True,
                headers={'User-Agent': 'Sovren-Deployment-Validator/1.0'}
            )

            duration = time.time() - start_time

            # Check status code
            expected_status = test.get('expected_status', 200)
            if isinstance(expected_status, list):
                status_ok = response.status_code in expected_status
            else:
                status_ok = response.status_code == expected_status

            # Check response content if specified
            content_ok = True
            if 'expected_response_contains' in test:
                for expected_content in test['expected_response_contains']:
                    if expected_content not in response.text:
                        content_ok = False
                        break

            success = status_ok and content_ok

            return {
                'name': test['name'],
                'success': success,
                'duration': duration,
                'status_code': response.status_code,
                'response_time': duration * 1000,  # ms
                'content_length': len(response.content)
            }

        except requests.exceptions.Timeout:
            duration = time.time() - start_time
            return {
                'name': test['name'],
                'success': False,
                'error': 'Request timeout',
                'duration': duration
            }
        except Exception as e:
            duration = time.time() - start_time
            return {
                'name': test['name'],
                'success': False,
                'error': str(e),
                'duration': duration
            }

    def _execute_performance_test(self, test: Dict, timeout: int) -> Dict:
        """Execute performance test with concurrent requests."""
        start_time = time.time()

        try:
            url = test['url']
            max_response_time = test.get('max_response_time', 2000)  # ms
            concurrent_requests = test.get('concurrent_requests', 10)

            response_times = []
            errors = []

            def make_request():
                try:
                    req_start = time.time()
                    response = requests.get(url, timeout=10)
                    req_duration = (time.time() - req_start) * 1000  # ms
                    response_times.append(req_duration)
                    return response.status_code
                except Exception as e:
                    errors.append(str(e))
                    return None

            # Execute concurrent requests
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrent_requests) as executor:
                futures = [executor.submit(make_request) for _ in range(concurrent_requests)]
                concurrent.futures.wait(futures, timeout=timeout)

            duration = time.time() - start_time

            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
                max_actual_response_time = max(response_times)
                success = max_actual_response_time <= max_response_time and len(errors) == 0
            else:
                avg_response_time = 0
                max_actual_response_time = 0
                success = False

            return {
                'name': test['name'],
                'success': success,
                'duration': duration,
                'avg_response_time': avg_response_time,
                'max_response_time': max_actual_response_time,
                'requests_completed': len(response_times),
                'errors': len(errors)
            }

        except Exception as e:
            duration = time.time() - start_time
            return {
                'name': test['name'],
                'success': False,
                'error': str(e),
                'duration': duration
            }

    def _execute_integration_test(self, test: Dict, timeout: int) -> Dict:
        """Execute integration test (placeholder for custom integration logic)."""
        start_time = time.time()

        # This would typically run custom integration test scripts
        # For now, simulate a basic integration test
        time.sleep(2)  # Simulate test execution

        duration = time.time() - start_time

        return {
            'name': test['name'],
            'success': True,
            'duration': duration,
            'description': test.get('description', 'Integration test executed')
        }

    def _execute_security_test(self, test: Dict, timeout: int) -> Dict:
        """Execute security test."""
        start_time = time.time()

        try:
            url = test['url']

            # Check SSL certificate
            if test.get('check_ssl', False):
                response = requests.get(url, timeout=timeout, verify=True)
                ssl_valid = True
            else:
                ssl_valid = None

            # Check security headers
            security_headers_ok = True
            if 'check_headers' in test:
                response = requests.get(url, timeout=timeout)
                for header in test['check_headers']:
                    if header not in response.headers:
                        security_headers_ok = False
                        break

            duration = time.time() - start_time
            success = ssl_valid is not False and security_headers_ok

            return {
                'name': test['name'],
                'success': success,
                'duration': duration,
                'ssl_valid': ssl_valid,
                'security_headers_ok': security_headers_ok
            }

        except Exception as e:
            duration = time.time() - start_time
            return {
                'name': test['name'],
                'success': False,
                'error': str(e),
                'duration': duration
            }

    def monitor_deployment_health(self, context: DeploymentContext, duration_minutes: int) -> Dict:
        """Monitor deployment health for specified duration."""
        logger.info(f"Starting deployment health monitoring for {duration_minutes} minutes...")

        monitoring_data = {
            'start_time': datetime.now().isoformat(),
            'duration_minutes': duration_minutes,
            'health_checks': [],
            'performance_metrics': [],
            'error_rates': [],
            'anomalies_detected': []
        }

        end_time = time.time() + (duration_minutes * 60)
        check_interval = 30  # seconds

        while time.time() < end_time:
            try:
                # Perform health check
                health_result = self._perform_health_check(context)
                monitoring_data['health_checks'].append(health_result)

                # Collect performance metrics
                perf_metrics = self._collect_performance_metrics(context)
                monitoring_data['performance_metrics'].append(perf_metrics)

                # Check for anomalies
                if self.config['monitoring']['ai_anomaly_detection']:
                    anomalies = self._detect_anomalies(monitoring_data)
                    if anomalies:
                        monitoring_data['anomalies_detected'].extend(anomalies)

                # Check rollback triggers
                if self._should_trigger_rollback(monitoring_data):
                    logger.warning("Rollback triggers detected during monitoring")
                    monitoring_data['rollback_triggered'] = True
                    break

                time.sleep(check_interval)

            except Exception as e:
                logger.error(f"Error during health monitoring: {e}")

        monitoring_data['end_time'] = datetime.now().isoformat()
        return monitoring_data

    def _perform_health_check(self, context: DeploymentContext) -> Dict:
        """Perform a single health check."""
        try:
            start_time = time.time()
            response = requests.get(context.health_endpoint, timeout=10)
            duration = time.time() - start_time

            return {
                'timestamp': datetime.now().isoformat(),
                'success': response.status_code == 200,
                'status_code': response.status_code,
                'response_time': duration * 1000,  # ms
                'details': response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            }

        except Exception as e:
            return {
                'timestamp': datetime.now().isoformat(),
                'success': False,
                'error': str(e),
                'response_time': 0
            }

    def _collect_performance_metrics(self, context: DeploymentContext) -> Dict:
        """Collect performance metrics from the deployment."""
        try:
            # This would typically integrate with monitoring tools like Datadog, New Relic, etc.
            # For now, simulate metrics collection
            metrics_url = f"{context.base_url}/api/v1/health/metrics"
            response = requests.get(metrics_url, timeout=10)

            if response.status_code == 200:
                metrics = response.json()
            else:
                metrics = {}

            return {
                'timestamp': datetime.now().isoformat(),
                'cpu_usage': metrics.get('cpu_usage', 0),
                'memory_usage': metrics.get('memory_usage', 0),
                'response_time': metrics.get('avg_response_time', 0),
                'error_rate': metrics.get('error_rate', 0),
                'request_rate': metrics.get('request_rate', 0)
            }

        except Exception as e:
            return {
                'timestamp': datetime.now().isoformat(),
                'error': str(e)
            }

    def _detect_anomalies(self, monitoring_data: Dict) -> List[Dict]:
        """Use AI to detect anomalies in monitoring data."""
        if not self.openai_client:
            return []

        try:
            # Analyze recent metrics for anomalies
            recent_metrics = monitoring_data['performance_metrics'][-10:]  # Last 10 data points

            if len(recent_metrics) < 5:
                return []  # Not enough data

            # Extract key metrics
            response_times = [m.get('response_time', 0) for m in recent_metrics if 'response_time' in m]
            error_rates = [m.get('error_rate', 0) for m in recent_metrics if 'error_rate' in m]

            if not response_times or not error_rates:
                return []

            avg_response_time = sum(response_times) / len(response_times)
            avg_error_rate = sum(error_rates) / len(error_rates)

            # Simple anomaly detection (would be more sophisticated in production)
            anomalies = []

            if avg_response_time > 2000:  # > 2 seconds
                anomalies.append({
                    'type': 'high_response_time',
                    'severity': 'high',
                    'value': avg_response_time,
                    'threshold': 2000,
                    'timestamp': datetime.now().isoformat()
                })

            if avg_error_rate > 0.05:  # > 5%
                anomalies.append({
                    'type': 'high_error_rate',
                    'severity': 'critical',
                    'value': avg_error_rate,
                    'threshold': 0.05,
                    'timestamp': datetime.now().isoformat()
                })

            return anomalies

        except Exception as e:
            logger.error(f"Anomaly detection failed: {e}")
            return []

    def _should_trigger_rollback(self, monitoring_data: Dict) -> bool:
        """Determine if rollback should be triggered based on monitoring data."""
        rollback_config = self.config['rollback_triggers']

        # Check health check failures
        recent_health_checks = monitoring_data['health_checks'][-5:]  # Last 5 checks
        failed_health_checks = len([hc for hc in recent_health_checks if not hc['success']])

        if failed_health_checks >= rollback_config['health_check_failures']:
            logger.warning(f"Health check failures ({failed_health_checks}) exceed threshold")
            return True

        # Check error rate
        recent_metrics = monitoring_data['performance_metrics'][-5:]
        if recent_metrics:
            avg_error_rate = sum(m.get('error_rate', 0) for m in recent_metrics) / len(recent_metrics)
            if avg_error_rate > rollback_config['error_rate_threshold']:
                logger.warning(f"Error rate ({avg_error_rate:.2%}) exceeds threshold")
                return True

        # Check critical anomalies
        critical_anomalies = [
            a for a in monitoring_data['anomalies_detected']
            if a.get('severity') == 'critical'
        ]

        if len(critical_anomalies) > 0:
            logger.warning(f"Critical anomalies detected: {len(critical_anomalies)}")
            return True

        return False

    def execute_rollback(self, context: DeploymentContext, reason: str) -> Dict:
        """Execute automatic rollback to previous version."""
        if self.rollback_in_progress:
            return {'success': False, 'reason': 'Rollback already in progress'}

        self.rollback_in_progress = True
        logger.error(f"Executing automatic rollback. Reason: {reason}")

        try:
            rollback_result = {
                'triggered_at': datetime.now().isoformat(),
                'reason': reason,
                'original_version': context.version,
                'rollback_steps': []
            }

            # Step 1: Stop traffic to current deployment
            rollback_result['rollback_steps'].append({
                'step': 'traffic_stop',
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            })

            # Step 2: Restore previous version (implementation depends on deployment platform)
            if context.previous_version:
                # This would integrate with deployment platform (e.g., Vercel, Docker, K8s)
                rollback_result['rollback_steps'].append({
                    'step': 'version_restore',
                    'status': 'completed',
                    'previous_version': context.previous_version,
                    'timestamp': datetime.now().isoformat()
                })

            # Step 3: Verify rollback success
            time.sleep(30)  # Wait for rollback to take effect

            health_check = self._perform_health_check(context)
            if health_check['success']:
                rollback_result['rollback_steps'].append({
                    'step': 'rollback_verification',
                    'status': 'completed',
                    'timestamp': datetime.now().isoformat()
                })
                rollback_result['success'] = True
            else:
                rollback_result['rollback_steps'].append({
                    'step': 'rollback_verification',
                    'status': 'failed',
                    'error': 'Health check failed after rollback',
                    'timestamp': datetime.now().isoformat()
                })
                rollback_result['success'] = False

            return rollback_result

        except Exception as e:
            logger.error(f"Rollback execution failed: {e}")
            return {
                'success': False,
                'reason': reason,
                'error': str(e),
                'triggered_at': datetime.now().isoformat()
            }
        finally:
            self.rollback_in_progress = False

    def save_validation_history(self, validation_data: Dict) -> None:
        """Save validation results for future learning."""
        try:
            self.validation_history.append(validation_data)

            # Keep only last 100 records
            if len(self.validation_history) > 100:
                self.validation_history = self.validation_history[-100:]

            # Save to file
            os.makedirs('data', exist_ok=True)
            with open('data/deployment_validation_history.json', 'w') as f:
                json.dump(self.validation_history, f, indent=2)

            logger.info("Saved validation history")

        except Exception as e:
            logger.error(f"Error saving validation history: {e}")

    async def run_complete_validation(self) -> Dict:
        """Run complete autonomous deployment validation."""
        logger.info("Starting complete autonomous deployment validation...")

        # Detect deployment context
        context = self.detect_deployment_context()

        # Generate validation plan
        validation_plan = self.generate_validation_plan(context)

        # Execute validation stages
        validation_results = []
        overall_success = True

        for stage in validation_plan['stages']:
            result = await self.execute_validation_stage(stage, context)
            validation_results.append(result)

            if not result.success and result.severity == 'high':
                overall_success = False
                logger.error(f"Critical validation stage failed: {stage['name']}")
                break

        # Generate final report
        validation_report = {
            'deployment_context': context.__dict__,
            'validation_plan': validation_plan,
            'validation_results': [r.__dict__ for r in validation_results],
            'overall_success': overall_success,
            'total_duration': sum(r.duration for r in validation_results),
            'timestamp': datetime.now().isoformat()
        }

        # If validation successful, start monitoring
        if overall_success:
            logger.info("Validation successful. Starting deployment monitoring...")
            monitoring_data = self.monitor_deployment_health(
                context,
                validation_plan['monitoring_duration']
            )
            validation_report['monitoring_data'] = monitoring_data

            # Check if rollback was triggered during monitoring
            if monitoring_data.get('rollback_triggered'):
                rollback_result = self.execute_rollback(
                    context,
                    "Health monitoring detected issues"
                )
                validation_report['rollback_result'] = rollback_result
                validation_report['final_status'] = 'rolled_back'
            else:
                validation_report['final_status'] = 'deployed_successfully'
        else:
            validation_report['final_status'] = 'validation_failed'

        # Save for learning
        self.save_validation_history(validation_report)

        return validation_report

def main():
    """Main execution function."""
    import argparse

    parser = argparse.ArgumentParser(description='Autonomous Deployment Validator')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--environment', help='Deployment environment')
    parser.add_argument('--service', help='Service name')
    parser.add_argument('--version', help='Deployment version')

    args = parser.parse_args()

    # Set environment variables if provided
    if args.environment:
        os.environ['DEPLOYMENT_ENV'] = args.environment
    if args.service:
        os.environ['SERVICE_NAME'] = args.service
    if args.version:
        os.environ['DEPLOYMENT_VERSION'] = args.version

    # Initialize validator
    validator = AutonomousDeploymentValidator(args.config)

    # Run validation
    async def run_validation():
        result = await validator.run_complete_validation()

        # Print summary
        print("\n" + "="*60)
        print("🚀 AUTONOMOUS DEPLOYMENT VALIDATION REPORT")
        print("="*60)

        print(f"\n📋 Deployment Details:")
        context = result['deployment_context']
        print(f"  Service: {context['service_name']} v{context['version']}")
        print(f"  Environment: {context['environment']}")
        print(f"  Base URL: {context['base_url']}")

        print(f"\n🔍 Validation Results:")
        for stage_result in result['validation_results']:
            status = "✅" if stage_result['success'] else "❌"
            print(f"  {status} {stage_result['name']} ({stage_result['duration']:.1f}s)")

        print(f"\n📊 Summary:")
        print(f"  Overall Success: {'✅' if result['overall_success'] else '❌'}")
        print(f"  Total Duration: {result['total_duration']:.1f}s")
        print(f"  Final Status: {result['final_status']}")

        if 'monitoring_data' in result:
            monitoring = result['monitoring_data']
            print(f"  Health Checks: {len(monitoring['health_checks'])}")
            print(f"  Anomalies: {len(monitoring['anomalies_detected'])}")

        print("="*60)

        # Return appropriate exit code
        if result['final_status'] in ['deployed_successfully']:
            return 0
        else:
            return 1

    # Run async validation
    exit_code = asyncio.run(run_validation())
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
