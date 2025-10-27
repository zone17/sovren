#!/usr/bin/env python3
"""
Intelligent Pre-commit Hooks System
AI-powered code quality enforcement with self-learning capabilities.
Part of US-164: Intelligent pre-commit hooks implementation.
"""

import os
import sys
import json
import yaml
import openai
import subprocess
import logging
import re
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Set
from pathlib import Path
import ast
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IntelligentPreCommitHooks:
    """
    Manages intelligent pre-commit hooks with AI-powered code analysis and enforcement.
    """

    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.openai_client = self._initialize_openai()
        self.style_patterns = self._load_style_patterns()
        self.security_rules = self._load_security_rules()
        self.performance_metrics = self._load_performance_metrics()

    def _load_config(self, config_path: str) -> Dict:
        """Load pre-commit hook configuration."""
        default_config = {
            'hooks': {
                'style_enforcement': {
                    'enabled': True,
                    'ai_learning': True,
                    'auto_fix': True,
                    'strictness': 0.8
                },
                'security_scanning': {
                    'enabled': True,
                    'vulnerability_threshold': 'medium',
                    'auto_fix': False,
                    'ai_analysis': True
                },
                'performance_analysis': {
                    'enabled': True,
                    'complexity_threshold': 10,
                    'performance_budget': True,
                    'ai_optimization': True
                },
                'test_validation': {
                    'enabled': True,
                    'coverage_threshold': 0.8,
                    'intelligent_selection': True,
                    'auto_generation': True
                }
            },
            'bypass_rules': {
                'emergency_bypass': False,
                'admin_override': False,
                'auto_bypass_threshold': 0.95,
                'bypass_tracking': True
            },
            'ai_settings': {
                'style_learning_rate': 0.1,
                'pattern_adaptation': True,
                'team_preference_learning': True,
                'continuous_improvement': True
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

    def _load_style_patterns(self) -> Dict:
        """Load learned style patterns from team history."""
        patterns_file = 'data/learned_style_patterns.json'

        if os.path.exists(patterns_file):
            try:
                with open(patterns_file, 'r') as f:
                    patterns = json.load(f)
                logger.info(f"Loaded {len(patterns)} learned style patterns")
                return patterns
            except Exception as e:
                logger.error(f"Error loading style patterns: {e}")

        # Default patterns
        return {
            'indent_style': 'spaces',
            'indent_size': 2,
            'max_line_length': 100,
            'naming_conventions': {
                'variables': 'camelCase',
                'functions': 'camelCase',
                'classes': 'PascalCase',
                'constants': 'UPPER_SNAKE_CASE'
            },
            'import_order': ['external', 'internal', 'relative'],
            'comment_style': 'descriptive'
        }

    def _load_security_rules(self) -> List[Dict]:
        """Load security scanning rules and patterns."""
        return [
            {
                'id': 'hardcoded_secrets',
                'pattern': r'(password|secret|key|token)\s*=\s*["\'][^"\']+["\']',
                'severity': 'high',
                'description': 'Hardcoded secrets detected'
            },
            {
                'id': 'sql_injection',
                'pattern': r'(SELECT|INSERT|UPDATE|DELETE).*\+.*\$',
                'severity': 'high',
                'description': 'Potential SQL injection vulnerability'
            },
            {
                'id': 'unsafe_eval',
                'pattern': r'eval\s*\(',
                'severity': 'medium',
                'description': 'Unsafe eval() usage'
            },
            {
                'id': 'weak_crypto',
                'pattern': r'md5|sha1',
                'severity': 'medium',
                'description': 'Weak cryptographic algorithm'
            }
        ]

    def _load_performance_metrics(self) -> Dict:
        """Load performance analysis metrics and thresholds."""
        return {
            'complexity_threshold': 10,
            'function_length_threshold': 50,
            'parameter_count_threshold': 5,
            'nesting_depth_threshold': 4,
            'cognitive_complexity_threshold': 15
        }

    def get_staged_files(self) -> List[str]:
        """Get list of staged files for commit."""
        try:
            result = subprocess.run(
                ['git', 'diff', '--cached', '--name-only'],
                capture_output=True, text=True, timeout=10
            )

            if result.returncode == 0:
                files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
                logger.info(f"Found {len(files)} staged files")
                return files
            else:
                logger.error(f"Git diff failed: {result.stderr}")
                return []

        except Exception as e:
            logger.error(f"Error getting staged files: {e}")
            return []

    def analyze_file_changes(self, file_path: str) -> Dict:
        """Analyze changes in a specific file."""
        try:
            # Get the diff for this file
            result = subprocess.run(
                ['git', 'diff', '--cached', file_path],
                capture_output=True, text=True, timeout=10
            )

            if result.returncode != 0:
                return {'error': f'Failed to get diff for {file_path}'}

            diff_content = result.stdout

            # Basic analysis
            analysis = {
                'file_path': file_path,
                'file_type': self._detect_file_type(file_path),
                'lines_added': len([line for line in diff_content.split('\n') if line.startswith('+') and not line.startswith('+++')]),
                'lines_removed': len([line for line in diff_content.split('\n') if line.startswith('-') and not line.startswith('---')]),
                'complexity_impact': 0,
                'security_issues': [],
                'style_issues': [],
                'performance_issues': []
            }

            # File type specific analysis
            if analysis['file_type'] in ['javascript', 'typescript', 'python']:
                analysis.update(self._analyze_code_file(file_path, diff_content))
            elif analysis['file_type'] in ['yaml', 'json']:
                analysis.update(self._analyze_config_file(file_path, diff_content))
            elif analysis['file_type'] == 'dockerfile':
                analysis.update(self._analyze_dockerfile(file_path, diff_content))

            return analysis

        except Exception as e:
            logger.error(f"Error analyzing file {file_path}: {e}")
            return {'error': str(e)}

    def _detect_file_type(self, file_path: str) -> str:
        """Detect file type based on extension and content."""
        path = Path(file_path)
        extension = path.suffix.lower()

        type_map = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.yml': 'yaml',
            '.yaml': 'yaml',
            '.json': 'json',
            '.md': 'markdown',
            '.dockerfile': 'dockerfile',
            '.sql': 'sql'
        }

        if 'dockerfile' in file_path.lower():
            return 'dockerfile'

        return type_map.get(extension, 'text')

    def _analyze_code_file(self, file_path: str, diff_content: str) -> Dict:
        """Analyze code files for style, security, and performance issues."""
        analysis = {
            'complexity_impact': 0,
            'security_issues': [],
            'style_issues': [],
            'performance_issues': []
        }

        # Extract added lines
        added_lines = []
        for line in diff_content.split('\n'):
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:])  # Remove the '+' prefix

        if not added_lines:
            return analysis

        # Security analysis
        analysis['security_issues'] = self._scan_security_issues(added_lines)

        # Style analysis
        analysis['style_issues'] = self._analyze_code_style(added_lines, file_path)

        # Performance analysis
        analysis['performance_issues'] = self._analyze_performance(added_lines, file_path)

        # Complexity analysis
        analysis['complexity_impact'] = self._calculate_complexity_impact(added_lines)

        return analysis

    def _scan_security_issues(self, lines: List[str]) -> List[Dict]:
        """Scan code lines for security vulnerabilities."""
        issues = []

        for i, line in enumerate(lines):
            for rule in self.security_rules:
                if re.search(rule['pattern'], line, re.IGNORECASE):
                    issues.append({
                        'rule_id': rule['id'],
                        'line_number': i + 1,
                        'line_content': line.strip(),
                        'severity': rule['severity'],
                        'description': rule['description']
                    })

        return issues

    def _analyze_code_style(self, lines: List[str], file_path: str) -> List[Dict]:
        """Analyze code style against team patterns."""
        issues = []
        file_type = self._detect_file_type(file_path)

        for i, line in enumerate(lines):
            # Check line length
            if len(line) > self.style_patterns['max_line_length']:
                issues.append({
                    'type': 'line_length',
                    'line_number': i + 1,
                    'message': f'Line exceeds {self.style_patterns["max_line_length"]} characters',
                    'severity': 'warning'
                })

            # Check indentation
            if line.strip() and not self._check_indentation(line):
                issues.append({
                    'type': 'indentation',
                    'line_number': i + 1,
                    'message': 'Inconsistent indentation',
                    'severity': 'warning'
                })

        return issues

    def _check_indentation(self, line: str) -> bool:
        """Check if line follows team indentation patterns."""
        if not line.strip():
            return True

        leading_spaces = len(line) - len(line.lstrip())

        if self.style_patterns['indent_style'] == 'spaces':
            indent_size = self.style_patterns['indent_size']
            return leading_spaces % indent_size == 0
        else:
            # Tab-based indentation
            return '\t' in line[:leading_spaces] or leading_spaces == 0

    def _analyze_performance(self, lines: List[str], file_path: str) -> List[Dict]:
        """Analyze code for performance issues."""
        issues = []

        # Performance patterns to check
        performance_patterns = [
            {
                'pattern': r'for.*in.*range\(len\(',
                'message': 'Consider using enumerate() instead of range(len())',
                'severity': 'info'
            },
            {
                'pattern': r'\.append\(.*\).*for.*in',
                'message': 'Consider using list comprehension',
                'severity': 'info'
            },
            {
                'pattern': r'SELECT \* FROM',
                'message': 'Avoid SELECT * queries',
                'severity': 'warning'
            }
        ]

        for i, line in enumerate(lines):
            for pattern in performance_patterns:
                if re.search(pattern['pattern'], line, re.IGNORECASE):
                    issues.append({
                        'type': 'performance',
                        'line_number': i + 1,
                        'line_content': line.strip(),
                        'message': pattern['message'],
                        'severity': pattern['severity']
                    })

        return issues

    def _calculate_complexity_impact(self, lines: List[str]) -> int:
        """Calculate the complexity impact of added lines."""
        complexity = 0

        # Complexity indicators
        complexity_patterns = [
            (r'\bif\b', 1),
            (r'\bfor\b', 1),
            (r'\bwhile\b', 1),
            (r'\btry\b', 1),
            (r'\bcatch\b', 1),
            (r'\bswitch\b', 1),
            (r'\?\s*.*\s*:', 1),  # Ternary operator
            (r'&&|\|\|', 1),      # Logical operators
        ]

        for line in lines:
            for pattern, weight in complexity_patterns:
                complexity += len(re.findall(pattern, line, re.IGNORECASE)) * weight

        return complexity

    def _analyze_config_file(self, file_path: str, diff_content: str) -> Dict:
        """Analyze configuration files for issues."""
        analysis = {
            'security_issues': [],
            'style_issues': [],
            'validation_issues': []
        }

        # Extract added lines
        added_lines = []
        for line in diff_content.split('\n'):
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:])

        # Check for security issues in config
        for i, line in enumerate(added_lines):
            # Check for exposed secrets
            if re.search(r'(password|secret|key|token).*[:\=].*[a-zA-Z0-9]', line, re.IGNORECASE):
                analysis['security_issues'].append({
                    'type': 'exposed_secret',
                    'line_number': i + 1,
                    'message': 'Potential secret exposed in configuration',
                    'severity': 'high'
                })

        return analysis

    def _analyze_dockerfile(self, file_path: str, diff_content: str) -> Dict:
        """Analyze Dockerfile for security and best practices."""
        analysis = {
            'security_issues': [],
            'best_practice_issues': []
        }

        added_lines = []
        for line in diff_content.split('\n'):
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:])

        for i, line in enumerate(added_lines):
            line_upper = line.upper().strip()

            # Check for security issues
            if line_upper.startswith('USER ROOT'):
                analysis['security_issues'].append({
                    'type': 'root_user',
                    'line_number': i + 1,
                    'message': 'Running as root user is a security risk',
                    'severity': 'high'
                })

            if 'ADD' in line_upper and 'http' in line.lower():
                analysis['security_issues'].append({
                    'type': 'insecure_download',
                    'line_number': i + 1,
                    'message': 'Using ADD with URL can be insecure',
                    'severity': 'medium'
                })

        return analysis

    def ai_style_analysis(self, file_analysis: Dict) -> Dict:
        """Use AI to analyze code style and provide recommendations."""
        if not self.openai_client:
            return {'recommendations': [], 'confidence': 0.0}

        try:
            # Prepare analysis context
            context = {
                'file_type': file_analysis.get('file_type', 'unknown'),
                'style_issues': file_analysis.get('style_issues', []),
                'team_patterns': self.style_patterns,
                'lines_changed': file_analysis.get('lines_added', 0)
            }

            prompt = f"""
            Analyze this code style and provide intelligent recommendations:

            File Analysis:
            - File Type: {context['file_type']}
            - Lines Changed: {context['lines_changed']}
            - Current Style Issues: {context['style_issues'][:5]}  # Limit to first 5

            Team Style Patterns:
            - Indent Style: {context['team_patterns']['indent_style']}
            - Indent Size: {context['team_patterns']['indent_size']}
            - Max Line Length: {context['team_patterns']['max_line_length']}
            - Naming Conventions: {context['team_patterns']['naming_conventions']}

            Provide:
            1. Priority recommendations for fixing style issues
            2. Auto-fix suggestions where safe
            3. Pattern updates for team learning
            4. Confidence score (0.0-1.0)

            Return as JSON with keys: recommendations, auto_fixes, pattern_updates, confidence
            """

            response = self.openai_client.ChatCompletion.create(
                model="gpt-4",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=600
            )

            content = response.choices[0].message.content
            start = content.find('{')
            end = content.rfind('}') + 1

            if start != -1 and end != 0:
                return json.loads(content[start:end])

        except Exception as e:
            logger.error(f"AI style analysis failed: {e}")

        return {'recommendations': [], 'confidence': 0.0}

    def intelligent_test_selection(self, changed_files: List[str]) -> List[str]:
        """Intelligently select tests to run based on changed files."""
        logger.info("Selecting relevant tests for changed files...")

        # Map changed files to potential test files
        test_files = set()

        for file_path in changed_files:
            # Direct test file mapping
            test_candidates = [
                # Same directory test files
                file_path.replace('.js', '.test.js'),
                file_path.replace('.ts', '.test.ts'),
                file_path.replace('.py', '_test.py'),
                file_path.replace('.py', 'test_.py'),

                # Test directory mapping
                file_path.replace('src/', 'tests/').replace('.js', '.test.js'),
                file_path.replace('src/', '__tests__/').replace('.js', '.test.js'),

                # Component test mapping
                file_path.replace('components/', 'components/__tests__/').replace('.tsx', '.test.tsx')
            ]

            for candidate in test_candidates:
                if os.path.exists(candidate):
                    test_files.add(candidate)

        # Add integration tests if core files changed
        core_patterns = ['api/', 'services/', 'utils/', 'lib/']
        if any(pattern in file for file in changed_files for pattern in core_patterns):
            # Add integration test directory
            integration_tests = self._find_integration_tests()
            test_files.update(integration_tests)

        return list(test_files)

    def _find_integration_tests(self) -> List[str]:
        """Find integration test files."""
        integration_patterns = [
            'tests/integration/**/*.test.*',
            'test/integration/**/*.test.*',
            'src/**/*.integration.test.*'
        ]

        integration_tests = []
        for pattern in integration_patterns:
            try:
                result = subprocess.run(
                    ['find', '.', '-name', pattern.split('/')[-1]],
                    capture_output=True, text=True
                )
                if result.returncode == 0:
                    integration_tests.extend(result.stdout.strip().split('\n'))
            except Exception:
                continue

        return [test for test in integration_tests if test and os.path.exists(test)]

    def auto_fix_issues(self, file_analysis: Dict) -> Dict:
        """Automatically fix code issues where safe to do so."""
        fixes_applied = {
            'style_fixes': [],
            'security_fixes': [],
            'performance_fixes': []
        }

        if not self.config['hooks']['style_enforcement']['auto_fix']:
            return fixes_applied

        file_path = file_analysis['file_path']

        try:
            # Read current file content
            with open(file_path, 'r') as f:
                content = f.read()

            # Apply style fixes
            fixed_content = self._apply_style_fixes(content, file_analysis['style_issues'])

            if fixed_content != content:
                # Write fixes back to file
                with open(file_path, 'w') as f:
                    f.write(fixed_content)

                # Stage the fixed file
                subprocess.run(['git', 'add', file_path], check=True)

                fixes_applied['style_fixes'] = ['indentation', 'trailing_whitespace', 'line_endings']
                logger.info(f"Applied auto-fixes to {file_path}")

        except Exception as e:
            logger.error(f"Error applying auto-fixes to {file_path}: {e}")

        return fixes_applied

    def _apply_style_fixes(self, content: str, style_issues: List[Dict]) -> str:
        """Apply automatic style fixes to content."""
        lines = content.split('\n')

        # Fix trailing whitespace
        lines = [line.rstrip() for line in lines]

        # Fix indentation (basic)
        if self.style_patterns['indent_style'] == 'spaces':
            indent_size = self.style_patterns['indent_size']
            for i, line in enumerate(lines):
                if line.strip():  # Skip empty lines
                    # Convert tabs to spaces
                    lines[i] = line.expandtabs(indent_size)

        return '\n'.join(lines)

    def check_bypass_conditions(self, analysis_results: List[Dict]) -> Dict:
        """Check if commit should be bypassed based on intelligent analysis."""
        bypass_config = self.config['bypass_rules']

        # Count severity of issues
        high_severity_count = 0
        medium_severity_count = 0
        total_issues = 0

        for file_analysis in analysis_results:
            for issue_type in ['security_issues', 'style_issues', 'performance_issues']:
                issues = file_analysis.get(issue_type, [])
                total_issues += len(issues)

                for issue in issues:
                    severity = issue.get('severity', 'low')
                    if severity == 'high':
                        high_severity_count += 1
                    elif severity == 'medium':
                        medium_severity_count += 1

        # Calculate bypass score
        bypass_score = 1.0

        if high_severity_count > 0:
            bypass_score -= high_severity_count * 0.3
        if medium_severity_count > 0:
            bypass_score -= medium_severity_count * 0.1

        bypass_score = max(0.0, bypass_score)

        # Check bypass conditions
        should_bypass = False
        bypass_reason = None

        if bypass_config['emergency_bypass']:
            should_bypass = True
            bypass_reason = 'Emergency bypass enabled'
        elif bypass_score >= bypass_config['auto_bypass_threshold']:
            should_bypass = True
            bypass_reason = f'Auto-bypass threshold met (score: {bypass_score:.2f})'
        elif high_severity_count == 0 and total_issues <= 5:
            should_bypass = True
            bypass_reason = 'Low issue count with no high-severity problems'

        return {
            'should_bypass': should_bypass,
            'bypass_reason': bypass_reason,
            'bypass_score': bypass_score,
            'total_issues': total_issues,
            'high_severity_count': high_severity_count,
            'medium_severity_count': medium_severity_count
        }

    def save_analysis_metrics(self, analysis_results: List[Dict], bypass_info: Dict) -> None:
        """Save analysis metrics for continuous learning."""
        try:
            metrics = {
                'timestamp': datetime.now().isoformat(),
                'files_analyzed': len(analysis_results),
                'total_issues': bypass_info['total_issues'],
                'high_severity_issues': bypass_info['high_severity_count'],
                'bypass_decision': bypass_info['should_bypass'],
                'bypass_score': bypass_info['bypass_score'],
                'commit_hash': self._get_current_commit_hash()
            }

            # Append to metrics file
            os.makedirs('data', exist_ok=True)
            metrics_file = 'data/pre_commit_metrics.jsonl'

            with open(metrics_file, 'a') as f:
                f.write(json.dumps(metrics) + '\n')

            logger.info("Saved pre-commit analysis metrics")

        except Exception as e:
            logger.error(f"Error saving metrics: {e}")

    def _get_current_commit_hash(self) -> str:
        """Get current commit hash."""
        try:
            result = subprocess.run(
                ['git', 'rev-parse', 'HEAD'],
                capture_output=True, text=True, timeout=5
            )
            return result.stdout.strip() if result.returncode == 0 else 'unknown'
        except Exception:
            return 'unknown'

    def update_style_patterns(self, new_patterns: Dict) -> None:
        """Update learned style patterns."""
        try:
            # Merge with existing patterns
            self.style_patterns.update(new_patterns)

            # Save updated patterns
            os.makedirs('data', exist_ok=True)
            with open('data/learned_style_patterns.json', 'w') as f:
                json.dump(self.style_patterns, f, indent=2)

            logger.info("Updated style patterns")

        except Exception as e:
            logger.error(f"Error updating style patterns: {e}")

    def run_pre_commit_analysis(self) -> int:
        """Run complete pre-commit analysis and return exit code."""
        logger.info("Starting intelligent pre-commit analysis...")

        # Get staged files
        staged_files = self.get_staged_files()

        if not staged_files:
            logger.info("No staged files found. Skipping analysis.")
            return 0

        # Analyze each file
        analysis_results = []
        for file_path in staged_files:
            logger.info(f"Analyzing {file_path}...")
            file_analysis = self.analyze_file_changes(file_path)

            if 'error' not in file_analysis:
                # Apply AI analysis if enabled
                if self.config['hooks']['style_enforcement']['ai_learning']:
                    ai_recommendations = self.ai_style_analysis(file_analysis)
                    file_analysis['ai_recommendations'] = ai_recommendations

                # Apply auto-fixes if enabled
                if self.config['hooks']['style_enforcement']['auto_fix']:
                    fixes = self.auto_fix_issues(file_analysis)
                    file_analysis['auto_fixes'] = fixes

                analysis_results.append(file_analysis)
            else:
                logger.error(f"Analysis failed for {file_path}: {file_analysis['error']}")

        # Check bypass conditions
        bypass_info = self.check_bypass_conditions(analysis_results)

        # Save metrics for learning
        self.save_analysis_metrics(analysis_results, bypass_info)

        # Generate report
        self._generate_analysis_report(analysis_results, bypass_info)

        # Determine exit code
        if bypass_info['should_bypass']:
            logger.info(f"Commit allowed: {bypass_info['bypass_reason']}")
            return 0
        else:
            logger.error("Commit blocked due to code quality issues")
            return 1

    def _generate_analysis_report(self, analysis_results: List[Dict], bypass_info: Dict) -> None:
        """Generate detailed analysis report."""
        print("\n" + "="*60)
        print("🔍 INTELLIGENT PRE-COMMIT ANALYSIS REPORT")
        print("="*60)

        print(f"\n📊 Summary:")
        print(f"  Files Analyzed: {len(analysis_results)}")
        print(f"  Total Issues: {bypass_info['total_issues']}")
        print(f"  High Severity: {bypass_info['high_severity_count']}")
        print(f"  Bypass Score: {bypass_info['bypass_score']:.2f}")

        # Detailed file analysis
        for file_analysis in analysis_results:
            file_path = file_analysis['file_path']
            print(f"\n📁 {file_path}")

            # Security issues
            security_issues = file_analysis.get('security_issues', [])
            if security_issues:
                print(f"  🔒 Security Issues ({len(security_issues)}):")
                for issue in security_issues[:3]:  # Show first 3
                    print(f"    - Line {issue['line_number']}: {issue['description']} ({issue['severity']})")

            # Style issues
            style_issues = file_analysis.get('style_issues', [])
            if style_issues:
                print(f"  🎨 Style Issues ({len(style_issues)}):")
                for issue in style_issues[:3]:  # Show first 3
                    print(f"    - Line {issue['line_number']}: {issue['message']} ({issue['severity']})")

            # Auto-fixes applied
            auto_fixes = file_analysis.get('auto_fixes', {})
            if any(auto_fixes.values()):
                print(f"  ✅ Auto-fixes Applied: {', '.join([k for k, v in auto_fixes.items() if v])}")

        # Bypass decision
        print(f"\n🚦 Decision: {'✅ COMMIT ALLOWED' if bypass_info['should_bypass'] else '❌ COMMIT BLOCKED'}")
        if bypass_info['bypass_reason']:
            print(f"   Reason: {bypass_info['bypass_reason']}")

        print("="*60)

def main():
    """Main execution function for pre-commit hook."""
    import argparse

    parser = argparse.ArgumentParser(description='Intelligent Pre-commit Hooks')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--bypass', action='store_true', help='Force bypass (admin only)')

    args = parser.parse_args()

    # Initialize hooks system
    hooks = IntelligentPreCommitHooks(args.config)

    # Override bypass if specified
    if args.bypass:
        hooks.config['bypass_rules']['admin_override'] = True

    # Run analysis
    exit_code = hooks.run_pre_commit_analysis()

    sys.exit(exit_code)

if __name__ == '__main__':
    main()
