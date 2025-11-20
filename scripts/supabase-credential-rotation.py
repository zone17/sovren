#!/usr/bin/env python3

"""
Supabase Database Credential Rotation Script
Zero-downtime credential rotation using Supabase Management API

Requirements:
    pip install requests python-dotenv boto3

Usage:
    python supabase-credential-rotation.py --project-ref <ref> --access-token <token>
"""

import os
import sys
import json
import time
import argparse
import secrets
import string
from datetime import datetime
from pathlib import Path
import subprocess
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import requests
    from dotenv import load_dotenv, set_key
except ImportError:
    logger.error("Required packages not installed. Run: pip install requests python-dotenv boto3")
    sys.exit(1)

# Load environment variables
load_dotenv()

class SupabaseCredentialRotator:
    """Handles zero-downtime Supabase credential rotation"""

    SUPABASE_API_URL = "https://api.supabase.com"

    def __init__(self, project_ref: str, access_token: str, environment: str = "production"):
        """
        Initialize the credential rotator

        Args:
            project_ref: Supabase project reference ID
            access_token: Supabase management API access token
            environment: Target environment (development/staging/production)
        """
        self.project_ref = project_ref
        self.access_token = access_token
        self.environment = environment
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        # Backup directory
        self.backup_dir = Path(".credentials-backup")
        self.backup_dir.mkdir(exist_ok=True)

        # Backup file with timestamp
        self.backup_file = self.backup_dir / f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

        self.old_credentials = {}
        self.new_credentials = {}

    def generate_secure_password(self, length: int = 32) -> str:
        """Generate a cryptographically secure password"""
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def get_current_database_config(self) -> dict:
        """Fetch current database configuration from Supabase"""
        logger.info("Fetching current database configuration...")

        url = f"{self.SUPABASE_API_URL}/v1/projects/{self.project_ref}/config/database"

        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            config = response.json()

            logger.info("✅ Current database configuration retrieved")
            return config
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to fetch database config: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise

    def backup_current_credentials(self):
        """Backup current credentials from environment"""
        logger.info("Backing up current credentials...")

        # Read from .env file
        env_path = Path("packages/backend/.env")
        if env_path.exists():
            with open(env_path, 'r') as f:
                for line in f:
                    if '=' in line:
                        key, value = line.strip().split('=', 1)
                        if key in ['SUPABASE_URL', 'SUPABASE_ANON_KEY',
                                  'SUPABASE_SERVICE_ROLE_KEY', 'DATABASE_URL', 'DB_PASSWORD']:
                            self.old_credentials[key] = value

        # Save backup
        with open(self.backup_file, 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'environment': self.environment,
                'credentials': self.old_credentials
            }, f, indent=2)

        logger.info(f"✅ Backup saved to: {self.backup_file}")

    def rotate_database_password(self) -> str:
        """Rotate the database password via Supabase API"""
        logger.info("Rotating database password...")

        new_password = self.generate_secure_password()

        url = f"{self.SUPABASE_API_URL}/v1/projects/{self.project_ref}/database/reset-password"

        payload = {
            "password": new_password
        }

        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()

            logger.info("✅ Database password rotated successfully")
            return new_password
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to rotate password: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise

    def update_connection_string(self, new_password: str):
        """Update the database connection string with new password"""
        logger.info("Updating connection strings...")

        # Get current database config
        config = self.get_current_database_config()

        # Build new connection string
        db_host = config.get('host', 'db.supabase.co')
        db_port = config.get('port', 5432)
        db_name = config.get('database', 'postgres')
        db_user = config.get('user', 'postgres')

        # PostgreSQL connection string
        new_db_url = f"postgresql://{db_user}:{new_password}@{db_host}:{db_port}/{db_name}"

        # Store new credentials
        self.new_credentials = {
            'DATABASE_URL': new_db_url,
            'DB_PASSWORD': new_password,
            'SUPABASE_URL': self.old_credentials.get('SUPABASE_URL', ''),
            'SUPABASE_ANON_KEY': self.old_credentials.get('SUPABASE_ANON_KEY', ''),
            'SUPABASE_SERVICE_ROLE_KEY': self.old_credentials.get('SUPABASE_SERVICE_ROLE_KEY', '')
        }

        logger.info("✅ Connection strings updated")

    def update_aws_secrets_manager(self):
        """Update credentials in AWS Secrets Manager"""
        logger.info("Updating AWS Secrets Manager...")

        try:
            import boto3

            client = boto3.client('secretsmanager', region_name=os.getenv('AWS_REGION', 'us-east-1'))

            secret_name = f"sovren/{self.environment}/supabase"

            # Prepare secret value
            secret_value = json.dumps({
                'url': self.new_credentials['SUPABASE_URL'],
                'anon_key': self.new_credentials['SUPABASE_ANON_KEY'],
                'service_role_key': self.new_credentials['SUPABASE_SERVICE_ROLE_KEY'],
                'database_url': self.new_credentials['DATABASE_URL'],
                'db_password': self.new_credentials['DB_PASSWORD']
            })

            # Update the secret
            response = client.update_secret(
                SecretId=secret_name,
                SecretString=secret_value
            )

            logger.info(f"✅ AWS Secrets Manager updated: {response['ARN']}")
            return True

        except ImportError:
            logger.warning("boto3 not installed, skipping AWS Secrets Manager update")
            logger.info("Run: pip install boto3")
            return False
        except Exception as e:
            logger.error(f"Failed to update AWS Secrets Manager: {e}")
            return False

    def update_local_env(self):
        """Update local .env file with new credentials"""
        logger.info("Updating local .env file...")

        env_path = Path("packages/backend/.env")

        if env_path.exists():
            # Backup current env
            backup_env = env_path.with_suffix(f".backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}")
            env_path.rename(backup_env)
            logger.info(f"Current .env backed up to: {backup_env}")

            # Copy backup and update values
            with open(backup_env, 'r') as src, open(env_path, 'w') as dst:
                for line in src:
                    if '=' in line:
                        key = line.split('=', 1)[0].strip()
                        if key in self.new_credentials:
                            dst.write(f"{key}={self.new_credentials[key]}\n")
                        else:
                            dst.write(line)
                    else:
                        dst.write(line)

            logger.info("✅ Local .env file updated")

    def test_new_connection(self) -> bool:
        """Test the new database connection"""
        logger.info("Testing new database connection...")

        try:
            import psycopg2

            # Parse connection URL
            db_url = self.new_credentials['DATABASE_URL']

            # Test connection
            conn = psycopg2.connect(db_url)
            cursor = conn.cursor()
            cursor.execute("SELECT NOW()")
            result = cursor.fetchone()

            cursor.close()
            conn.close()

            logger.info(f"✅ Connection successful: {result[0]}")
            return True

        except ImportError:
            logger.warning("psycopg2 not installed, skipping connection test")
            logger.info("Run: pip install psycopg2-binary")
            return False
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False

    def trigger_application_reload(self):
        """Trigger application to reload secrets"""
        logger.info("Triggering application reload...")

        # Check if application is running
        try:
            response = requests.get("http://localhost:3001/health", timeout=5)
            if response.status_code == 200:
                logger.info("Application is running, attempting graceful reload...")

                # Try to refresh secrets via admin endpoint
                try:
                    refresh_response = requests.post(
                        "http://localhost:3001/admin/refresh-secrets",
                        headers={"Authorization": f"Bearer {os.getenv('ADMIN_TOKEN', '')}"},
                        timeout=5
                    )
                    if refresh_response.status_code == 200:
                        logger.info("✅ Application secrets refreshed")
                    else:
                        logger.warning("Could not refresh secrets, manual restart may be required")
                except:
                    logger.warning("Refresh endpoint not available")
        except:
            logger.info("Application not running locally")

    def wait_for_connection_drain(self, timeout: int = 30):
        """Wait for old connections to drain"""
        logger.info(f"Waiting {timeout}s for old connections to drain...")

        for i in range(timeout, 0, -5):
            sys.stdout.write(f"\rWaiting... {i}s remaining  ")
            sys.stdout.flush()
            time.sleep(5)

        sys.stdout.write("\r" + " " * 50 + "\r")
        logger.info("✅ Connection drain period complete")

    def perform_rotation(self, skip_aws: bool = False, dry_run: bool = False):
        """Execute the complete credential rotation process"""

        logger.info("=" * 60)
        logger.info("STARTING ZERO-DOWNTIME CREDENTIAL ROTATION")
        logger.info(f"Environment: {self.environment}")
        logger.info(f"Project: {self.project_ref}")
        logger.info(f"Dry Run: {dry_run}")
        logger.info("=" * 60)

        try:
            # Step 1: Backup current credentials
            self.backup_current_credentials()

            if dry_run:
                logger.info("DRY RUN: Would rotate credentials but stopping here")
                return

            # Step 2: Rotate database password
            new_password = self.rotate_database_password()

            # Step 3: Update connection strings
            self.update_connection_string(new_password)

            # Step 4: Test new connection
            connection_ok = self.test_new_connection()
            if not connection_ok:
                logger.warning("Could not verify new connection")

            # Step 5: Update secrets storage
            if not skip_aws:
                aws_updated = self.update_aws_secrets_manager()
            else:
                aws_updated = False

            # Step 6: Update local environment
            self.update_local_env()

            # Step 7: Trigger application reload
            self.trigger_application_reload()

            # Step 8: Wait for connection drain
            self.wait_for_connection_drain()

            # Success summary
            logger.info("=" * 60)
            logger.info("✅ CREDENTIAL ROTATION COMPLETED SUCCESSFULLY")
            logger.info("=" * 60)
            logger.info("Summary:")
            logger.info(f"  • Backup saved: {self.backup_file}")
            logger.info(f"  • Password rotated: Yes")
            logger.info(f"  • Connection tested: {'✅' if connection_ok else '⚠️ Manual verification needed'}")
            logger.info(f"  • AWS Secrets Manager: {'✅ Updated' if aws_updated else '❌ Skipped'}")
            logger.info(f"  • Local .env: ✅ Updated")
            logger.info("")
            logger.info("NEXT STEPS:")
            logger.info("1. Monitor application logs for connection errors")
            logger.info("2. Verify all services are functioning")
            logger.info("3. Test API endpoints")
            logger.info("4. After 24 hours, remove backup files")
            logger.info("=" * 60)

        except Exception as e:
            logger.error(f"Rotation failed: {e}")
            logger.error("Rolling back...")
            self.rollback()
            raise

    def rollback(self):
        """Rollback to previous credentials"""
        logger.info("Attempting rollback to previous credentials...")

        if self.old_credentials:
            # Restore .env file
            env_path = Path("packages/backend/.env")

            # Find the most recent backup
            backups = list(env_path.parent.glob(f"{env_path.name}.backup-*"))
            if backups:
                latest_backup = max(backups, key=lambda p: p.stat().st_mtime)

                # Restore from backup
                with open(latest_backup, 'r') as src, open(env_path, 'w') as dst:
                    dst.write(src.read())

                logger.info(f"✅ Restored from backup: {latest_backup}")
            else:
                logger.error("No backup found for rollback")
        else:
            logger.error("No credentials available for rollback")


def main():
    """Main CLI interface"""

    parser = argparse.ArgumentParser(
        description="Rotate Supabase database credentials with zero downtime"
    )

    parser.add_argument(
        "--project-ref",
        help="Supabase project reference ID",
        default=os.getenv("SUPABASE_PROJECT_REF")
    )

    parser.add_argument(
        "--access-token",
        help="Supabase management API access token",
        default=os.getenv("SUPABASE_ACCESS_TOKEN")
    )

    parser.add_argument(
        "--environment",
        choices=["development", "staging", "production"],
        default=os.getenv("NODE_ENV", "production"),
        help="Target environment"
    )

    parser.add_argument(
        "--skip-aws",
        action="store_true",
        help="Skip AWS Secrets Manager update"
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate rotation without making changes"
    )

    args = parser.parse_args()

    # Validate required arguments
    if not args.project_ref:
        logger.error("Project reference is required. Use --project-ref or set SUPABASE_PROJECT_REF")
        sys.exit(1)

    if not args.access_token:
        logger.error("Access token is required. Use --access-token or set SUPABASE_ACCESS_TOKEN")
        logger.info("")
        logger.info("To get your access token:")
        logger.info("1. Go to https://app.supabase.com/account/tokens")
        logger.info("2. Create a new personal access token")
        logger.info("3. Use it with --access-token flag")
        sys.exit(1)

    # Create rotator and perform rotation
    rotator = SupabaseCredentialRotator(
        project_ref=args.project_ref,
        access_token=args.access_token,
        environment=args.environment
    )

    try:
        rotator.perform_rotation(
            skip_aws=args.skip_aws,
            dry_run=args.dry_run
        )
        sys.exit(0)
    except Exception as e:
        logger.error(f"Rotation failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()