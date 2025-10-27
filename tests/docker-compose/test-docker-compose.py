#!/usr/bin/env python3
"""
Comprehensive Docker Compose Configuration Tests
US-205: Docker Compose Configuration Validation

This test suite validates all aspects of the Docker Compose configuration
including service dependencies, network connectivity, health checks,
resource constraints, and profile functionality.
"""

import os
import sys
import subprocess
import time
import json
import yaml
import requests
import psycopg2
import redis
import unittest
from typing import Dict, List, Optional
from dataclasses import dataclass

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

@dataclass
class ServiceConfig:
    """Service configuration for testing"""
    name: str
    port: int
    health_endpoint: Optional[str] = None
    expected_status: int = 200
    dependencies: List[str] = None
    profiles: List[str] = None

class DockerComposeTestSuite(unittest.TestCase):
    """Comprehensive test suite for Docker Compose configuration"""

    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.project_root = os.path.join(os.path.dirname(__file__), '..', '..')
        cls.compose_file = os.path.join(cls.project_root, 'docker-compose.yml')
        cls.env_file = os.path.join(cls.project_root, 'docker-compose.env')
        cls.manager_script = os.path.join(cls.project_root, 'scripts', 'docker-compose-manager.sh')

        # Ensure environment file exists
        if not os.path.exists(cls.env_file):
            cls._create_test_env_file()

        # Define service configurations
        cls.services = {
            'backend': ServiceConfig(
                name='backend',
                port=3001,
                health_endpoint='/health',
                dependencies=['postgres', 'redis', 'mcp-gateway'],
                profiles=['development', 'testing', 'production']
            ),
            'frontend': ServiceConfig(
                name='frontend',
                port=5173,
                health_endpoint='/',
                dependencies=['backend'],
                profiles=['development', 'testing', 'production']
            ),
            'postgres': ServiceConfig(
                name='postgres',
                port=5432,
                dependencies=[],
                profiles=['development', 'testing', 'minimal']
            ),
            'redis': ServiceConfig(
                name='redis',
                port=6379,
                dependencies=[],
                profiles=['development', 'testing', 'minimal']
            ),
            'nginx': ServiceConfig(
                name='nginx',
                port=80,
                health_endpoint='/health',
                dependencies=['frontend', 'backend'],
                profiles=['development', 'testing', 'production']
            ),
            'mcp-gateway': ServiceConfig(
                name='mcp-gateway',
                port=3000,
                health_endpoint='/health',
                dependencies=[],
                profiles=['development', 'testing', 'production']
            ),
            'prometheus': ServiceConfig(
                name='prometheus',
                port=9090,
                health_endpoint='/',
                dependencies=['backend', 'mcp-gateway'],
                profiles=['development', 'testing', 'monitoring']
            ),
            'grafana': ServiceConfig(
                name='grafana',
                port=3000,
                health_endpoint='/api/health',
                dependencies=['prometheus'],
                profiles=['development', 'testing', 'monitoring']
            ),
            'mailhog': ServiceConfig(
                name='mailhog',
                port=8025,
                health_endpoint='/',
                dependencies=[],
                profiles=['development', 'testing']
            ),
            'postgres-test': ServiceConfig(
                name='postgres-test',
                port=5433,
                dependencies=[],
                profiles=['testing']
            ),
            'redis-test': ServiceConfig(
                name='redis-test',
                port=6380,
                dependencies=[],
                profiles=['testing']
            )
        }

        # Define network configurations
        cls.networks = {
            'sovren-network': {'subnet': '172.20.0.0/16'},
            'database-network': {'subnet': '172.21.0.0/16'},
            'cache-network': {'subnet': '172.22.0.0/16'},
            'gateway-network': {'subnet': '172.23.0.0/16'},
            'mcp-network': {'subnet': '172.24.0.0/16'},
            'monitoring-network': {'subnet': '172.25.0.0/16'},
            'test-network': {'subnet': '172.26.0.0/16'}
        }

        # Define volume configurations
        cls.volumes = [
            'backend_node_modules',
            'frontend_node_modules',
            'backend_dist',
            'frontend_dist',
            'postgres_data',
            'postgres_test_data',
            'redis_data',
            'redis_test_data',
            'prometheus_data',
            'grafana_data',
            'fluent_bit_data'
        ]

    @classmethod
    def _create_test_env_file(cls):
        """Create test environment file"""
        test_env_content = """
# Test environment variables
NODE_ENV=test
LOG_LEVEL=debug
TZ=UTC

# Database configuration
POSTGRES_DB=sovren_test
POSTGRES_USER=sovren_test
POSTGRES_PASSWORD=test_password
DATABASE_URL=postgresql://sovren_test:test_password@postgres:5432/sovren_test

# Redis configuration
REDIS_URL=redis://redis:6379

# External services (test values)
SUPABASE_URL=https://test-project.supabase.co
SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key

# JWT configuration
JWT_SECRET=test-jwt-secret-key

# MCP configuration
MCP_ADMIN_PASSWORD=test123
MCP_JWT_SECRET=test-mcp-jwt-secret

# Lightning configuration
LNBITS_API_URL=https://test-lnbits.com
LNBITS_ADMIN_KEY=test-admin-key
LNBITS_INVOICE_READ_KEY=test-invoice-key

# NOSTR configuration
NOSTR_RELAYS=wss://relay.test.com

# Monitoring configuration
GF_SECURITY_ADMIN_PASSWORD=test123
""".strip()

        with open(cls.env_file, 'w') as f:
            f.write(test_env_content)

    def setUp(self):
        """Set up each test"""
        # Ensure Docker is running
        self.assertTrue(self._is_docker_running(), "Docker must be running for tests")

        # Ensure we start with a clean state
        self._stop_all_services()

    def tearDown(self):
        """Clean up after each test"""
        # Stop services after each test
        self._stop_all_services()

    def test_01_compose_file_validation(self):
        """Test that docker-compose.yml is valid"""
        result = subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'config'
        ], capture_output=True, text=True)

        self.assertEqual(result.returncode, 0,
                        f"Docker Compose file validation failed: {result.stderr}")

        # Parse the configuration
        config = yaml.safe_load(result.stdout)

        # Validate basic structure
        self.assertIn('services', config)
        self.assertIn('networks', config)
        self.assertIn('volumes', config)
        self.assertIn('secrets', config)

    def test_02_service_definitions(self):
        """Test that all required services are defined"""
        config = self._get_compose_config()

        for service_name in self.services.keys():
            self.assertIn(service_name, config['services'],
                         f"Service {service_name} not found in configuration")

            service = config['services'][service_name]

            # Check basic service structure
            self.assertIn('container_name', service)
            self.assertIn('hostname', service)
            self.assertIn('restart', service)
            self.assertEqual(service['restart'], 'unless-stopped')

    def test_03_network_definitions(self):
        """Test that all networks are properly defined"""
        config = self._get_compose_config()

        for network_name, network_config in self.networks.items():
            self.assertIn(network_name, config['networks'],
                         f"Network {network_name} not found")

            network = config['networks'][network_name]

            # Check network configuration
            self.assertIn('driver', network)
            self.assertEqual(network['driver'], 'bridge')
            self.assertIn('ipam', network)
            self.assertIn('driver_opts', network)

    def test_04_volume_definitions(self):
        """Test that all volumes are properly defined"""
        config = self._get_compose_config()

        for volume_name in self.volumes:
            self.assertIn(volume_name, config['volumes'],
                         f"Volume {volume_name} not found")

            volume = config['volumes'][volume_name]

            # Check volume configuration
            self.assertIn('driver', volume)
            self.assertEqual(volume['driver'], 'local')

    def test_05_health_checks(self):
        """Test that services have proper health checks"""
        config = self._get_compose_config()

        for service_name, service_config in self.services.items():
            if service_config.health_endpoint:
                service = config['services'][service_name]
                self.assertIn('healthcheck', service,
                             f"Service {service_name} missing health check")

                healthcheck = service['healthcheck']
                self.assertIn('test', healthcheck)
                self.assertIn('interval', healthcheck)
                self.assertIn('timeout', healthcheck)
                self.assertIn('retries', healthcheck)

    def test_06_resource_constraints(self):
        """Test that services have proper resource constraints"""
        config = self._get_compose_config()

        for service_name in self.services.keys():
            service = config['services'][service_name]

            if 'deploy' in service:
                deploy = service['deploy']
                self.assertIn('resources', deploy,
                             f"Service {service_name} missing resources")

                resources = deploy['resources']
                self.assertIn('limits', resources)
                self.assertIn('reservations', resources)

                # Check resource limits
                limits = resources['limits']
                self.assertIn('cpus', limits)
                self.assertIn('memory', limits)

    def test_07_service_dependencies(self):
        """Test that service dependencies are properly configured"""
        config = self._get_compose_config()

        for service_name, service_config in self.services.items():
            if service_config.dependencies:
                service = config['services'][service_name]
                self.assertIn('depends_on', service,
                             f"Service {service_name} missing dependencies")

                depends_on = service['depends_on']

                for dependency in service_config.dependencies:
                    self.assertIn(dependency, depends_on,
                                 f"Service {service_name} missing dependency {dependency}")

    def test_08_profile_configuration(self):
        """Test that profiles are properly configured"""
        config = self._get_compose_config()

        for service_name, service_config in self.services.items():
            if service_config.profiles:
                service = config['services'][service_name]
                self.assertIn('profiles', service,
                             f"Service {service_name} missing profiles")

                profiles = service['profiles']

                for profile in service_config.profiles:
                    self.assertIn(profile, profiles,
                                 f"Service {service_name} missing profile {profile}")

    def test_09_minimal_profile_startup(self):
        """Test minimal profile startup"""
        self._test_profile_startup('minimal', ['postgres', 'redis'])

    def test_10_development_profile_startup(self):
        """Test development profile startup"""
        self._test_profile_startup('development', [
            'backend', 'frontend', 'postgres', 'redis',
            'nginx', 'mcp-gateway', 'prometheus', 'grafana', 'mailhog'
        ])

    def test_11_testing_profile_startup(self):
        """Test testing profile startup"""
        self._test_profile_startup('testing', [
            'backend', 'frontend', 'postgres', 'redis',
            'nginx', 'mcp-gateway', 'prometheus', 'grafana',
            'mailhog', 'postgres-test', 'redis-test'
        ])

    def test_12_monitoring_profile_startup(self):
        """Test monitoring profile startup"""
        self._test_profile_startup('monitoring', [
            'prometheus', 'grafana', 'fluent-bit'
        ])

    def test_13_service_connectivity(self):
        """Test connectivity between services"""
        # Start development profile
        self._start_profile('development')
        self._wait_for_services_healthy(['backend', 'frontend', 'postgres', 'redis'])

        # Test database connectivity
        self._test_database_connectivity()

        # Test cache connectivity
        self._test_cache_connectivity()

        # Test HTTP service connectivity
        self._test_http_service_connectivity()

    def test_14_data_persistence(self):
        """Test data persistence across container restarts"""
        # Start minimal profile
        self._start_profile('minimal')
        self._wait_for_services_healthy(['postgres', 'redis'])

        # Create test data
        self._create_test_data()

        # Restart services
        self._restart_profile('minimal')
        self._wait_for_services_healthy(['postgres', 'redis'])

        # Verify data persistence
        self._verify_test_data()

    def test_15_backup_and_restore(self):
        """Test backup and restore functionality"""
        # Start minimal profile
        self._start_profile('minimal')
        self._wait_for_services_healthy(['postgres', 'redis'])

        # Create test data
        self._create_test_data()

        # Create backup
        backup_result = subprocess.run([
            self.manager_script, 'backup'
        ], capture_output=True, text=True)

        self.assertEqual(backup_result.returncode, 0,
                        f"Backup failed: {backup_result.stderr}")

        # Verify backup file exists
        backup_dir = os.path.join(self.project_root, 'backups')
        self.assertTrue(os.path.exists(backup_dir))

        backup_files = [f for f in os.listdir(backup_dir) if f.startswith('sovren_backup_')]
        self.assertTrue(len(backup_files) > 0, "No backup files found")

    def test_16_manager_script_functionality(self):
        """Test Docker Compose manager script functionality"""
        # Test help command
        result = subprocess.run([
            self.manager_script, 'help'
        ], capture_output=True, text=True)

        self.assertEqual(result.returncode, 0)
        self.assertIn('Usage:', result.stdout)

        # Test validate command
        result = subprocess.run([
            self.manager_script, 'validate'
        ], capture_output=True, text=True)

        self.assertEqual(result.returncode, 0)
        self.assertIn('configuration is valid', result.stdout)

    def test_17_environment_variable_validation(self):
        """Test environment variable validation"""
        # Check required environment variables
        required_vars = [
            'NODE_ENV', 'LOG_LEVEL', 'DATABASE_URL', 'REDIS_URL',
            'SUPABASE_URL', 'JWT_SECRET', 'MCP_ADMIN_PASSWORD'
        ]

        with open(self.env_file, 'r') as f:
            env_content = f.read()

        for var in required_vars:
            self.assertIn(var, env_content,
                         f"Required environment variable {var} not found")

    def test_18_security_configuration(self):
        """Test security configuration"""
        config = self._get_compose_config()

        # Check secrets configuration
        self.assertIn('secrets', config)
        self.assertIn('mcp_jwt_secret', config['secrets'])

        # Check that sensitive data is not in plain text
        for service_name in self.services.keys():
            service = config['services'][service_name]

            # Check that passwords are not hardcoded
            if 'environment' in service:
                for env_var in service['environment']:
                    if isinstance(env_var, str) and 'PASSWORD' in env_var:
                        self.assertNotIn('password123', env_var.lower())
                        self.assertNotIn('admin', env_var.lower())

    def test_19_performance_constraints(self):
        """Test performance and resource constraints"""
        config = self._get_compose_config()

        total_cpu_limits = 0
        total_memory_limits = 0

        for service_name in self.services.keys():
            service = config['services'][service_name]

            if 'deploy' in service and 'resources' in service['deploy']:
                resources = service['deploy']['resources']

                if 'limits' in resources:
                    limits = resources['limits']

                    if 'cpus' in limits:
                        total_cpu_limits += float(limits['cpus'])

                    if 'memory' in limits:
                        memory_str = limits['memory']
                        if memory_str.endswith('M'):
                            total_memory_limits += int(memory_str[:-1])

        # Check that total resources are reasonable
        self.assertLess(total_cpu_limits, 16, "Total CPU limits too high")
        self.assertLess(total_memory_limits, 8192, "Total memory limits too high")

    def test_20_cleanup_and_reset(self):
        """Test cleanup and reset functionality"""
        # Start development profile
        self._start_profile('development')

        # Clean up
        result = subprocess.run([
            self.manager_script, 'clean'
        ], capture_output=True, text=True)

        self.assertEqual(result.returncode, 0,
                        f"Clean up failed: {result.stderr}")

        # Verify services are stopped
        result = subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'ps', '-q'
        ], capture_output=True, text=True)

        self.assertEqual(result.stdout.strip(), '',
                        "Services still running after cleanup")

    # Helper methods
    def _is_docker_running(self) -> bool:
        """Check if Docker is running"""
        try:
            result = subprocess.run(['docker', 'info'],
                                  capture_output=True, text=True)
            return result.returncode == 0
        except FileNotFoundError:
            return False

    def _get_compose_config(self) -> Dict:
        """Get parsed Docker Compose configuration"""
        result = subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'config'
        ], capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to get compose config: {result.stderr}")

        return yaml.safe_load(result.stdout)

    def _start_profile(self, profile: str):
        """Start services with specific profile"""
        result = subprocess.run([
            self.manager_script, 'start', profile
        ], capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to start profile {profile}: {result.stderr}")

    def _stop_all_services(self):
        """Stop all services"""
        subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'down'
        ], capture_output=True, text=True)

    def _restart_profile(self, profile: str):
        """Restart services with specific profile"""
        result = subprocess.run([
            self.manager_script, 'restart', profile
        ], capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Failed to restart profile {profile}: {result.stderr}")

    def _wait_for_services_healthy(self, services: List[str], timeout: int = 120):
        """Wait for services to be healthy"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            all_healthy = True

            for service in services:
                if not self._is_service_healthy(service):
                    all_healthy = False
                    break

            if all_healthy:
                return

            time.sleep(5)

        raise TimeoutError(f"Services {services} not healthy after {timeout}s")

    def _is_service_healthy(self, service: str) -> bool:
        """Check if service is healthy"""
        result = subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'ps', service
        ], capture_output=True, text=True)

        return 'Up' in result.stdout and 'healthy' in result.stdout

    def _test_profile_startup(self, profile: str, expected_services: List[str]):
        """Test profile startup with expected services"""
        self._start_profile(profile)

        # Wait for services to be healthy
        time.sleep(30)

        # Check that expected services are running
        result = subprocess.run([
            'docker-compose', '-f', self.compose_file,
            '--env-file', self.env_file, 'ps'
        ], capture_output=True, text=True)

        for service in expected_services:
            self.assertIn(service, result.stdout,
                         f"Service {service} not running in profile {profile}")

    def _test_database_connectivity(self):
        """Test database connectivity"""
        try:
            conn = psycopg2.connect(
                host='localhost',
                port=5432,
                database='sovren_dev',
                user='sovren',
                password='dev_password_change_in_production'
            )
            cursor = conn.cursor()
            cursor.execute('SELECT 1')
            result = cursor.fetchone()
            self.assertEqual(result[0], 1)
            conn.close()
        except Exception as e:
            self.fail(f"Database connectivity test failed: {e}")

    def _test_cache_connectivity(self):
        """Test cache connectivity"""
        try:
            r = redis.Redis(host='localhost', port=6379, db=0)
            r.ping()
            r.set('test_key', 'test_value')
            result = r.get('test_key')
            self.assertEqual(result.decode(), 'test_value')
        except Exception as e:
            self.fail(f"Cache connectivity test failed: {e}")

    def _test_http_service_connectivity(self):
        """Test HTTP service connectivity"""
        services_to_test = [
            ('backend', 3001, '/health'),
            ('frontend', 5173, '/'),
            ('mcp-gateway', 3000, '/health'),
            ('mailhog', 8025, '/')
        ]

        for service_name, port, endpoint in services_to_test:
            try:
                response = requests.get(f'http://localhost:{port}{endpoint}', timeout=10)
                self.assertTrue(response.status_code < 500,
                               f"Service {service_name} returned {response.status_code}")
            except Exception as e:
                self.fail(f"HTTP connectivity test failed for {service_name}: {e}")

    def _create_test_data(self):
        """Create test data for persistence testing"""
        # Create database test data
        try:
            conn = psycopg2.connect(
                host='localhost',
                port=5432,
                database='sovren_dev',
                user='sovren',
                password='dev_password_change_in_production'
            )
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS test_table (
                    id SERIAL PRIMARY KEY,
                    data TEXT
                )
            ''')
            cursor.execute("INSERT INTO test_table (data) VALUES ('test_data')")
            conn.commit()
            conn.close()
        except Exception as e:
            self.fail(f"Failed to create test data: {e}")

        # Create cache test data
        try:
            r = redis.Redis(host='localhost', port=6379, db=0)
            r.set('test_persistence', 'persistent_value')
        except Exception as e:
            self.fail(f"Failed to create cache test data: {e}")

    def _verify_test_data(self):
        """Verify test data persistence"""
        # Verify database test data
        try:
            conn = psycopg2.connect(
                host='localhost',
                port=5432,
                database='sovren_dev',
                user='sovren',
                password='dev_password_change_in_production'
            )
            cursor = conn.cursor()
            cursor.execute("SELECT data FROM test_table WHERE data = 'test_data'")
            result = cursor.fetchone()
            self.assertIsNotNone(result, "Database test data not persisted")
            conn.close()
        except Exception as e:
            self.fail(f"Failed to verify database test data: {e}")

        # Verify cache test data
        try:
            r = redis.Redis(host='localhost', port=6379, db=0)
            result = r.get('test_persistence')
            self.assertEqual(result.decode(), 'persistent_value',
                           "Cache test data not persisted")
        except Exception as e:
            self.fail(f"Failed to verify cache test data: {e}")


if __name__ == '__main__':
    # Run tests
    unittest.main(verbosity=2)
