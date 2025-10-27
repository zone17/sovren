# Sovren Tana Source of Truth - Quick Start Guide

## 🎯 Overview

This system makes Tana your **single source of truth** for the Sovren project. Every code change, test result, milestone progress, and team activity automatically syncs with Tana, giving you real-time project visibility without manual effort.

## 🚀 Quick Setup (5 minutes)

### 1. Get Your Tana Token

1. Go to Tana and open Settings
2. Navigate to API section
3. Generate a new API token
4. Copy the token (it expires in ~1 hour, so use it quickly)

### 2. Set Up Your Environment

```bash
# Export your token (add to ~/.zshrc for persistence)
export TANA_TOKEN="your_token_here"

# Verify token works
echo $TANA_TOKEN
```

### 3. Create the Project Structure

```bash
# Navigate to your Sovren directory
cd /path/to/Sovren

# Create the complete project in Tana (under Projects folder)
TANA_TOKEN=your_token node scripts/tana-sovren-manager.js setup
```

### 4. Install Complete Workflow Integration

```bash
# Set up git hooks, CI/CD, templates, and monitoring
TANA_TOKEN=your_token node scripts/workflow-integration.js setup
```

## ✅ What Just Happened

You now have:

- **📁 Clean Organization**: Sovren project under `Projects` folder in Tana
- **🔗 Git Integration**: Every commit automatically updates Tana
- **📊 Auto-Sync**: Test coverage, build status, feature progress tracked
- **📋 Smart Reports**: Weekly reports and milestone tracking
- **👥 Team Coordination**: Task assignments and progress visibility
- **🤖 CI/CD Integration**: GitHub Actions and Vercel automation

## 🎮 Daily Usage Commands

### Project Status

```bash
# Get current project overview
TANA_TOKEN=your_token node scripts/tana-project-controller.js status

# Sync current development state
TANA_TOKEN=your_token node scripts/tana-project-controller.js sync
```

### Task Management

```bash
# Mark a task complete
TANA_TOKEN=your_token node scripts/tana-project-controller.js update "Docker setup complete" "All containers working"

# Update phase progress
TANA_TOKEN=your_token node scripts/tana-project-controller.js phase "Phase 1" 85 "Almost done with infrastructure"

# Assign task to team member
TANA_TOKEN=your_token node scripts/tana-project-controller.js assign "Mobile optimization" "Frontend Engineer" "Jan 20"
```

### Reports & Documentation

```bash
# Generate weekly report
TANA_TOKEN=your_token node scripts/tana-project-controller.js report weekly

# Update documentation
TANA_TOKEN=your_token node scripts/tana-project-controller.js docs "API" "Updated authentication endpoints"
```

### Development Workflows

```bash
# Start new feature (creates branch + updates Tana)
./workflows/start-feature.sh "payment-integration"

# Start bug fix
./workflows/start-bugfix.sh "login-error-handling"

# Prepare release
./workflows/prepare-release.sh "v1.2.0"
```

## 🔄 Automatic Updates

The system automatically updates Tana when you:

- **Make git commits** → Progress tracking
- **Push code** → Build and test status
- **Merge branches** → Development sync
- **Improve test coverage** → Quality metrics
- **Complete features** → Milestone progress
- **Weekly** → Comprehensive reports

## 📱 Mobile Access

Since everything is in Tana, you can:

- Check project status on your phone
- Update task completion from anywhere
- Review team progress on the go
- Get notifications for important milestones

## 🛠️ Customization

### Add Custom Tracking

Edit `tana-project-controller.js` to track specific metrics for your workflow.

### Team Notifications

Set up Slack/Discord webhooks to get notified of Tana updates.

### Custom Reports

Modify the report generation to include your specific KPIs.

## 🚨 Troubleshooting

### "No Sovren project found"

```bash
# Re-run setup
TANA_TOKEN=your_token node scripts/tana-sovren-manager.js setup
```

### Token expired

```bash
# Get new token from Tana and re-export
export TANA_TOKEN="new_token_here"
```

### Git hooks not working

```bash
# Check hooks exist
ls -la .git/hooks/

# Reinstall if needed
TANA_TOKEN=your_token node scripts/workflow-integration.js hooks
```

### Find your project in Tana

1. Open Tana
2. Go to Library
3. Look for "Projects" folder
4. Find "Sovren: AI-Powered Creator Economy Platform"

## 🎯 Benefits You'll See Immediately

- **Zero Manual Updates**: Project status stays current automatically
- **Real Accountability**: See actual progress based on code changes
- **Team Alignment**: Everyone sees the same current state
- **Data-Driven Decisions**: Metrics guide your development priorities
- **Effortless Reporting**: Stakeholder updates generate automatically
- **Mobile Visibility**: Check status anywhere, anytime

## 🔮 Advanced Features

Once you're comfortable with the basics:

- Set up automated cron jobs for daily reporting
- Integrate with your team chat for notifications
- Create custom dashboards for different stakeholder views
- Add performance monitoring and alerting
- Build predictive analytics for milestone completion

## 🆘 Support

If something isn't working:

1. Check your TANA_TOKEN is valid and exported
2. Verify you're in the Sovren git repository
3. Look for the project under Projects → Sovren in Tana
4. Try re-running the setup commands

**Remember**: This system is designed to be maintenance-free once configured. Your development work automatically becomes project management data!
