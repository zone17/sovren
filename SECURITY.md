# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | Yes                |
| < 2.0   | No                 |

## Reporting a Vulnerability

If you discover a security vulnerability in Sovren, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email: security@sovren.dev
2. Include a description of the vulnerability, steps to reproduce, and potential impact.
3. You will receive an acknowledgment within 48 hours.
4. We will work with you to understand and address the issue before any public disclosure.

### What to Expect

- **Acknowledgment**: Within 48 hours of your report.
- **Assessment**: We will assess the severity using CVSS v3.1 scoring.
- **Resolution**: Critical vulnerabilities will be patched within 72 hours. High severity within 7 days.
- **Disclosure**: Coordinated disclosure after the fix is deployed.

## Security Scanning

This project employs automated security scanning:

- **Dependency Scanning**: npm audit, Snyk, OWASP Dependency-Check (daily)
- **SAST**: CodeQL, Snyk Code (on every PR and push to main/develop)
- **Container Scanning**: Trivy, Grype, Docker Scout, Hadolint (on every PR and push)
- **Secret Detection**: GitHub secret scanning, gitleaks (pre-commit and CI)
- **Infrastructure Scanning**: Checkov, CIS Docker Benchmark
- **Credential Rotation**: Automated 90-day rotation via HashiCorp Vault

## Deployment Security Policy

### Severity Levels That Block Deployment

| Severity | CVSS Score | Blocks PR Merge | Blocks Production Deploy |
|----------|-----------|-----------------|--------------------------|
| Critical | 9.0-10.0  | Yes             | Yes                      |
| High     | 7.0-8.9   | Yes             | Yes                      |
| Medium   | 4.0-6.9   | No (warning)    | No (warning)             |
| Low      | 0.1-3.9   | No              | No                       |

### Exceptions

Known vulnerabilities may be temporarily accepted with:
1. A documented risk assessment
2. A mitigation plan with timeline
3. Approval from the security team lead

## Security Best Practices

### For Contributors

- Never commit secrets, API keys, or credentials to the repository.
- Use environment variables for all sensitive configuration.
- Follow the principle of least privilege for all access controls.
- All dependencies must pass npm audit with no high/critical vulnerabilities.
- Docker images must run as non-root users.

### For Maintainers

- Review Dependabot PRs weekly.
- Monitor GitHub Security Advisories.
- Rotate credentials every 90 days (automated).
- Review and update this security policy quarterly.
