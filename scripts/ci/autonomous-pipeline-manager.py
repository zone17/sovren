#!/usr/bin/env python3
"""
Autonomous Pipeline Manager
Handles self-optimizing CI/CD processes with ML-based decisions and continuous improvement.
Part of US-163: Autonomous CI/CD pipelines implementation.
"""

import os
import json
import yaml
import openai
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import requests
import subprocess
import logging
import argparse
from typing import Dict, List, Optional, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import pickle

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AutonomousPipelineManager:
    """
    Manages autonomous CI/CD pipeline operations with ML-based decision making.
    """

    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.openai_client = self._initialize_openai()
        self.ml_models = self._load_ml_models()
        self.metrics_history = self._load_metrics_history()

    def _load_config(self, config_path: str) -> Dict:
        """Load pipeline configuration."""
        default_config = {
            'optimization_modes': {
                'adaptive': {'aggression': 0.5, 'stability': 0.8},
                'aggressive': {'aggression': 0.9, 'stability': 0.3},
                'conservative': {'aggression': 0.2, 'stability': 0.95},
                'experimental': {'aggression': 1.0, 'stability': 0.1}
            },
            'risk_thresholds': {
                'low': 0.2,
                'medium': 0.5,
                'high': 0.8,
                'critical': 0.95
            },
            'performance_targets': {
                'build_time': 300,  # 5 minutes
                'test_time': 600,   # 10 minutes
                'deployment_time': 180,  # 3 minutes
                'failure_rate': 0.05  # 5%
            }
        }

        if config_path and os.path.exists(config_path):
            with open(config_path, 'r') as f:
                user_config = yaml.safe_load(f)
                default_config.update(user_config)

        return default_config

    def _initialize_openai(self) -> Optional[openai]:
        """Initialize OpenAI client."""
        api_key = os.environ.get('OPENAI_API_KEY')
        if api_key:
            openai.api_key = api_key
            return openai
        else:
            logger.warning("OpenAI API key not found. AI features will be limited.")
            return None

    def _load_ml_models(self) -> Dict:
        """Load or initialize ML models for pipeline optimization."""
        models = {}

        # Try to load existing models
        model_files = {
            'failure_predictor': 'models/failure_predictor.pkl',
            'performance_optimizer': 'models/performance_optimizer.pkl',
            'resource_allocator': 'models/resource_allocator.pkl'
        }

        for model_name, model_path in model_files.items():
            try:
                if os.path.exists(model_path):
                    with open(model_path, 'rb') as f:
                        models[model_name] = pickle.load(f)
                    logger.info(f"Loaded {model_name} model from {model_path}")
                else:
                    # Initialize new model
                    models[model_name] = self._initialize_model(model_name)
                    logger.info(f"Initialized new {model_name} model")
            except Exception as e:
                logger.error(f"Error loading {model_name}: {e}")
                models[model_name] = self._initialize_model(model_name)

        return models

    def _initialize_model(self, model_name: str):
        """Initialize a new ML model."""
        if model_name in ['failure_predictor', 'performance_optimizer']:
            return RandomForestClassifier(n_estimators=100, random_state=42)
        elif model_name == 'resource_allocator':
            return RandomForestClassifier(n_estimators=50, random_state=42)
        else:
            return None

    def _load_metrics_history(self) -> pd.DataFrame:
        """Load historical pipeline metrics."""
        history_file = 'data/pipeline_metrics_history.csv'

        if os.path.exists(history_file):
            try:
                df = pd.read_csv(history_file)
                logger.info(f"Loaded {len(df)} historical metrics records")
                return df
            except Exception as e:
                logger.error(f"Error loading metrics history: {e}")

        # Return empty DataFrame with expected columns
        return pd.DataFrame(columns=[
            'timestamp', 'build_time', 'test_time', 'failure_rate',
            'resource_usage', 'optimization_level', 'success'
        ])

    def analyze_repository_state(self) -> Dict:
        """Analyze current repository state for optimization decisions."""
        logger.info("Analyzing repository state...")

        try:
            # Get recent commits
            result = subprocess.run(
                ['git', 'log', '--oneline', '-20', '--stat'],
                capture_output=True, text=True, timeout=30
            )
            recent_changes = result.stdout

            # Get changed files
            result = subprocess.run(
                ['git', 'diff', '--name-only', 'HEAD~10'],
                capture_output=True, text=True, timeout=30
            )
            changed_files = result.stdout.strip().split('\n') if result.stdout.strip() else []

            # Analyze file types and complexity
            file_analysis = self._analyze_changed_files(changed_files)

            # Calculate change complexity score
            complexity_score = self._calculate_complexity_score(recent_changes, file_analysis)

            return {
                'recent_changes': recent_changes[:1000],  # Truncate for API
                'changed_files': changed_files[:20],  # Limit for processing
                'file_analysis': file_analysis,
                'complexity_score': complexity_score,
                'change_count': len(changed_files)
            }

        except subprocess.TimeoutExpired:
            logger.error("Git analysis timed out")
            return self._get_fallback_repo_state()
        except Exception as e:
            logger.error(f"Error analyzing repository: {e}")
            return self._get_fallback_repo_state()

    def _analyze_changed_files(self, changed_files: List[str]) -> Dict:
        """Analyze the types and complexity of changed files."""
        analysis = {
            'frontend_files': 0,
            'backend_files': 0,
            'test_files': 0,
            'config_files': 0,
            'documentation_files': 0,
            'high_risk_files': 0
        }

        high_risk_patterns = [
            'package.json', 'package-lock.json', '.yml', '.yaml',
            'Dockerfile', 'docker-compose', '.env'
        ]

        for file_path in changed_files:
            if not file_path:
                continue

            # Categorize files
            if any(pattern in file_path for pattern in ['src/', 'components/', '.tsx', '.jsx']):
                analysis['frontend_files'] += 1
            elif any(pattern in file_path for pattern in ['api/', 'server/', '.py', '.js']):
                analysis['backend_files'] += 1
            elif any(pattern in file_path for pattern in ['test/', 'spec/', '.test.', '.spec.']):
                analysis['test_files'] += 1
            elif any(pattern in file_path for pattern in ['.md', '.txt', 'README']):
                analysis['documentation_files'] += 1
            else:
                analysis['config_files'] += 1

            # Check for high-risk files
            if any(pattern in file_path for pattern in high_risk_patterns):
                analysis['high_risk_files'] += 1

        return analysis

    def _calculate_complexity_score(self, recent_changes: str, file_analysis: Dict) -> float:
        """Calculate a complexity score for the changes."""
        score = 0.0

        # Base score from change volume
        change_lines = len(recent_changes.split('\n'))
        score += min(change_lines / 100, 1.0) * 0.3

        # Risk from file types
        score += file_analysis['high_risk_files'] * 0.2
        score += file_analysis['backend_files'] * 0.15
        score += file_analysis['frontend_files'] * 0.1

        # Reduce score for test files (good changes)
        if file_analysis['test_files'] > 0:
            score *= 0.8

        return min(score, 1.0)

    def _get_fallback_repo_state(self) -> Dict:
        """Get fallback repository state when analysis fails."""
        return {
            'recent_changes': 'Analysis unavailable',
            'changed_files': [],
            'file_analysis': {
                'frontend_files': 1,
                'backend_files': 1,
                'test_files': 0,
                'config_files': 0,
                'documentation_files': 0,
                'high_risk_files': 1
            },
            'complexity_score': 0.5,
            'change_count': 3
        }

    def determine_pipeline_strategy(self, repo_analysis: Dict) -> Dict:
        """Determine optimal pipeline strategy using AI and ML."""
        logger.info("Determining pipeline strategy...")

        # Try AI-powered analysis first
        if self.openai_client:
            ai_strategy = self._ai_strategy_analysis(repo_analysis)
            if ai_strategy:
                return ai_strategy

        # Fallback to ML-based analysis
        return self._ml_strategy_analysis(repo_analysis)

    def _ai_strategy_analysis(self, repo_analysis: Dict) -> Optional[Dict]:
        """Use AI to determine pipeline strategy."""
        try:
            prompt = f"""
            Analyze this repository state and determine the optimal CI/CD strategy:

            Repository Analysis:
            - Recent changes: {repo_analysis['recent_changes'][:500]}
            - Changed files: {repo_analysis['changed_files'][:10]}
            - Complexity score: {repo_analysis['complexity_score']:.2f}
            - File analysis: {repo_analysis['file_analysis']}

            Historical Performance (if available):
            - Recent builds: {len(self.metrics_history)} records
            - Average build time: {self.metrics_history['build_time'].mean():.1f}s if available

            Determine the optimal strategy considering:
            1. Risk level (low/medium/high/critical)
            2. Test strategy (unit-only/integration/full-suite/selective)
            3. Deployment approach (direct/canary/blue-green/rolling)
            4. Build optimization level (fast/standard/thorough)
            5. Monitoring intensity (minimal/standard/enhanced/comprehensive)

            Return as JSON with these exact keys:
            {{
                "strategy": "fast|standard|comprehensive|experimental",
                "risk_level": "low|medium|high|critical",
                "test_strategy": "unit-only|integration|full-suite|selective",
                "deployment_approach": "direct|canary|blue-green|rolling",
                "build_optimization": "fast|standard|thorough",
                "monitoring_intensity": "minimal|standard|enhanced|comprehensive",
                "reasoning": "explanation of decisions",
                "confidence": 0.0-1.0
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
                strategy_data = json.loads(content[start:end])
                logger.info(f"AI strategy determined: {strategy_data['strategy']} (confidence: {strategy_data.get('confidence', 'N/A')})")
                return strategy_data

        except Exception as e:
            logger.error(f"AI strategy analysis failed: {e}")

        return None

    def _ml_strategy_analysis(self, repo_analysis: Dict) -> Dict:
        """Use ML models to determine pipeline strategy."""
        logger.info("Using ML-based strategy analysis")

        # Feature extraction for ML models
        features = [
            repo_analysis['complexity_score'],
            repo_analysis['change_count'],
            repo_analysis['file_analysis']['high_risk_files'],
            repo_analysis['file_analysis']['backend_files'],
            repo_analysis['file_analysis']['frontend_files'],
            repo_analysis['file_analysis']['test_files'],
            len(self.metrics_history) / 100,  # Normalized history length
            self.metrics_history['failure_rate'].mean() if len(self.metrics_history) > 0 else 0.1
        ]

        # Determine risk level
        risk_score = (
            repo_analysis['complexity_score'] * 0.4 +
            min(repo_analysis['file_analysis']['high_risk_files'] / 5, 1.0) * 0.3 +
            min(repo_analysis['change_count'] / 20, 1.0) * 0.3
        )

        if risk_score <= self.config['risk_thresholds']['low']:
            risk_level = 'low'
            strategy = 'fast'
            test_strategy = 'unit-only'
            deployment_approach = 'direct'
        elif risk_score <= self.config['risk_thresholds']['medium']:
            risk_level = 'medium'
            strategy = 'standard'
            test_strategy = 'integration'
            deployment_approach = 'canary'
        elif risk_score <= self.config['risk_thresholds']['high']:
            risk_level = 'high'
            strategy = 'comprehensive'
            test_strategy = 'full-suite'
            deployment_approach = 'blue-green'
        else:
            risk_level = 'critical'
            strategy = 'comprehensive'
            test_strategy = 'full-suite'
            deployment_approach = 'rolling'

        return {
            'strategy': strategy,
            'risk_level': risk_level,
            'test_strategy': test_strategy,
            'deployment_approach': deployment_approach,
            'build_optimization': 'standard' if risk_level in ['low', 'medium'] else 'thorough',
            'monitoring_intensity': 'standard' if risk_level in ['low', 'medium'] else 'enhanced',
            'reasoning': f'ML-based analysis with risk score: {risk_score:.2f}',
            'confidence': 0.8
        }

    def generate_optimization_recommendations(self, strategy_data: Dict) -> Dict:
        """Generate pipeline optimization recommendations."""
        logger.info("Generating optimization recommendations...")

        optimization_mode = os.environ.get('OPTIMIZATION_MODE', 'adaptive')
        mode_config = self.config['optimization_modes'][optimization_mode]

        recommendations = {
            'cache_strategy': self._determine_cache_strategy(strategy_data, mode_config),
            'parallel_jobs': self._calculate_parallel_jobs(strategy_data, mode_config),
            'timeout_adjustments': self._calculate_timeouts(strategy_data),
            'resource_allocation': self._determine_resource_allocation(strategy_data),
            'optimization_flags': self._get_optimization_flags(strategy_data, mode_config)
        }

        return recommendations

    def _determine_cache_strategy(self, strategy_data: Dict, mode_config: Dict) -> str:
        """Determine optimal caching strategy."""
        if strategy_data['risk_level'] == 'low' and mode_config['aggression'] > 0.6:
            return 'aggressive'
        elif strategy_data['risk_level'] == 'high' or mode_config['stability'] > 0.8:
            return 'conservative'
        else:
            return 'adaptive'

    def _calculate_parallel_jobs(self, strategy_data: Dict, mode_config: Dict) -> int:
        """Calculate optimal number of parallel jobs."""
        base_jobs = 4

        # Adjust based on risk level
        if strategy_data['risk_level'] == 'low':
            base_jobs += 2
        elif strategy_data['risk_level'] == 'high':
            base_jobs -= 1

        # Adjust based on optimization mode
        aggression_factor = mode_config['aggression']
        adjusted_jobs = int(base_jobs * (0.5 + aggression_factor * 0.5))

        return max(1, min(adjusted_jobs, 8))  # Clamp between 1 and 8

    def _calculate_timeouts(self, strategy_data: Dict) -> Dict:
        """Calculate timeout adjustments."""
        base_timeouts = {
            'build': 1200,  # 20 minutes
            'test': 1800,   # 30 minutes
            'deploy': 600   # 10 minutes
        }

        multiplier = 1.0
        if strategy_data['risk_level'] == 'high':
            multiplier = 1.5
        elif strategy_data['risk_level'] == 'critical':
            multiplier = 2.0
        elif strategy_data['risk_level'] == 'low':
            multiplier = 0.8

        return {
            timeout_type: int(timeout * multiplier)
            for timeout_type, timeout in base_timeouts.items()
        }

    def _determine_resource_allocation(self, strategy_data: Dict) -> str:
        """Determine optimal resource allocation."""
        if strategy_data['strategy'] == 'fast':
            return 'minimal'
        elif strategy_data['strategy'] == 'comprehensive':
            return 'enhanced'
        else:
            return 'standard'

    def _get_optimization_flags(self, strategy_data: Dict, mode_config: Dict) -> List[str]:
        """Get optimization flags based on strategy."""
        flags = []

        if mode_config['aggression'] > 0.7:
            flags.extend(['--parallel', '--aggressive-caching'])

        if strategy_data['risk_level'] == 'low':
            flags.extend(['--skip-optional-checks', '--fast-build'])

        if mode_config['stability'] > 0.8:
            flags.extend(['--thorough-validation', '--extra-checks'])

        return flags

    def predict_failure_probability(self, current_metrics: Dict) -> Dict:
        """Predict failure probability using ML and historical data."""
        logger.info("Predicting failure probability...")

        if len(self.metrics_history) < 10:
            # Not enough historical data
            return self._fallback_failure_prediction(current_metrics)

        try:
            # Use ML model if available and trained
            if 'failure_predictor' in self.ml_models:
                prediction = self._ml_failure_prediction(current_metrics)
                if prediction:
                    return prediction

        except Exception as e:
            logger.error(f"ML failure prediction failed: {e}")

        # Fallback to statistical analysis
        return self._statistical_failure_prediction(current_metrics)

    def _ml_failure_prediction(self, current_metrics: Dict) -> Optional[Dict]:
        """Use ML model for failure prediction."""
        try:
            # Prepare features
            features = [
                current_metrics.get('complexity_score', 0.5),
                current_metrics.get('change_count', 5),
                current_metrics.get('high_risk_files', 1),
                self.metrics_history['build_time'].mean(),
                self.metrics_history['failure_rate'].mean(),
                len(self.metrics_history)
            ]

            # Predict using trained model
            model = self.ml_models['failure_predictor']
            probability = model.predict_proba([features])[0][1]  # Probability of failure

            return {
                'probability': float(probability),
                'confidence': 0.9,
                'method': 'ml_model',
                'features_used': len(features)
            }

        except Exception as e:
            logger.error(f"ML prediction error: {e}")
            return None

    def _statistical_failure_prediction(self, current_metrics: Dict) -> Dict:
        """Statistical failure prediction based on historical patterns."""
        # Calculate base failure rate from history
        base_failure_rate = self.metrics_history['failure_rate'].mean() if len(self.metrics_history) > 0 else 0.1

        # Adjust based on current metrics
        complexity_factor = current_metrics.get('complexity_score', 0.5)
        change_factor = min(current_metrics.get('change_count', 5) / 10, 1.0)
        risk_factor = current_metrics.get('high_risk_files', 1) / 5

        # Weighted probability calculation
        probability = (
            base_failure_rate * 0.4 +
            complexity_factor * 0.3 +
            change_factor * 0.2 +
            risk_factor * 0.1
        )

        return {
            'probability': min(probability, 1.0),
            'confidence': 0.7,
            'method': 'statistical',
            'base_failure_rate': base_failure_rate
        }

    def _fallback_failure_prediction(self, current_metrics: Dict) -> Dict:
        """Fallback prediction when insufficient data."""
        # Conservative prediction based on current state
        base_probability = 0.15  # 15% base assumption

        complexity_adjustment = current_metrics.get('complexity_score', 0.5) * 0.2
        change_adjustment = min(current_metrics.get('change_count', 5) / 20, 0.1)

        probability = base_probability + complexity_adjustment + change_adjustment

        return {
            'probability': min(probability, 0.8),  # Cap at 80%
            'confidence': 0.5,
            'method': 'fallback',
            'note': 'Insufficient historical data'
        }

    def save_metrics(self, metrics: Dict) -> None:
        """Save pipeline metrics for future analysis."""
        try:
            # Prepare metrics record
            record = {
                'timestamp': datetime.now().isoformat(),
                **metrics
            }

            # Append to history
            new_record = pd.DataFrame([record])
            self.metrics_history = pd.concat([self.metrics_history, new_record], ignore_index=True)

            # Save to file
            os.makedirs('data', exist_ok=True)
            self.metrics_history.to_csv('data/pipeline_metrics_history.csv', index=False)

            # Keep only last 1000 records
            if len(self.metrics_history) > 1000:
                self.metrics_history = self.metrics_history.tail(1000)

            logger.info(f"Saved metrics record. Total history: {len(self.metrics_history)} records")

        except Exception as e:
            logger.error(f"Error saving metrics: {e}")

    def update_ml_models(self) -> bool:
        """Update ML models with new data."""
        if len(self.metrics_history) < 50:
            logger.info("Insufficient data for model training")
            return False

        try:
            # Prepare training data
            X, y = self._prepare_training_data()

            # Train failure predictor
            if len(X) > 0:
                self.ml_models['failure_predictor'].fit(X, y)

                # Save updated model
                os.makedirs('models', exist_ok=True)
                with open('models/failure_predictor.pkl', 'wb') as f:
                    pickle.dump(self.ml_models['failure_predictor'], f)

                logger.info("ML models updated successfully")
                return True

        except Exception as e:
            logger.error(f"Error updating ML models: {e}")

        return False

    def _prepare_training_data(self) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare training data for ML models."""
        features = []
        labels = []

        for _, row in self.metrics_history.iterrows():
            # Feature vector
            feature_vector = [
                row.get('build_time', 300) / 600,  # Normalized build time
                row.get('test_time', 600) / 1200,  # Normalized test time
                row.get('failure_rate', 0.1),     # Historical failure rate
                row.get('resource_usage', 0.5),   # Resource usage
                row.get('optimization_level', 0.5) # Optimization level
            ]

            # Label (failure or success)
            label = 1 if row.get('success', True) == False else 0

            features.append(feature_vector)
            labels.append(label)

        return np.array(features), np.array(labels)

def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(description='Autonomous Pipeline Manager')
    parser.add_argument('command', choices=['analyze', 'optimize', 'predict', 'update-models'])
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--output', help='Output file path')

    args = parser.parse_args()

    # Initialize manager
    manager = AutonomousPipelineManager(args.config)

    if args.command == 'analyze':
        # Analyze repository and generate strategy
        repo_analysis = manager.analyze_repository_state()
        strategy = manager.determine_pipeline_strategy(repo_analysis)
        recommendations = manager.generate_optimization_recommendations(strategy)

        result = {
            'repository_analysis': repo_analysis,
            'strategy': strategy,
            'recommendations': recommendations,
            'timestamp': datetime.now().isoformat()
        }

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
        else:
            print(json.dumps(result, indent=2))

    elif args.command == 'predict':
        # Predict failure probability
        repo_analysis = manager.analyze_repository_state()
        prediction = manager.predict_failure_probability(repo_analysis)

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(prediction, f, indent=2)
        else:
            print(json.dumps(prediction, indent=2))

    elif args.command == 'update-models':
        # Update ML models
        success = manager.update_ml_models()
        result = {'success': success, 'timestamp': datetime.now().isoformat()}

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
        else:
            print(json.dumps(result, indent=2))

    elif args.command == 'optimize':
        # Full optimization cycle
        repo_analysis = manager.analyze_repository_state()
        strategy = manager.determine_pipeline_strategy(repo_analysis)
        recommendations = manager.generate_optimization_recommendations(strategy)
        prediction = manager.predict_failure_probability(repo_analysis)

        # Save metrics
        metrics = {
            'complexity_score': repo_analysis['complexity_score'],
            'change_count': repo_analysis['change_count'],
            'strategy': strategy['strategy'],
            'risk_level': strategy['risk_level'],
            'failure_probability': prediction['probability']
        }
        manager.save_metrics(metrics)

        result = {
            'analysis': repo_analysis,
            'strategy': strategy,
            'recommendations': recommendations,
            'prediction': prediction,
            'metrics_saved': True,
            'timestamp': datetime.now().isoformat()
        }

        if args.output:
            with open(args.output, 'w') as f:
                json.dump(result, f, indent=2)
        else:
            print(json.dumps(result, indent=2))

if __name__ == '__main__':
    main()
