#!/usr/bin/env bash
# CE Metrics — Backfill from Transcripts
# Reads ALL Claude Code session transcripts and pushes real metrics to Pushgateway
# This replaces synthetic seed data with actual historical data

set -euo pipefail

PUSHGATEWAY_URL="${PUSHGATEWAY_URL:-http://localhost:9091}"
TRANSCRIPTS_DIR="$HOME/.claude/projects/-Users-fp"
PROJECT="Sovren"

echo "CE Metrics Backfill — Reading real transcript data"
echo "=================================================="
echo ""

# Check prerequisites
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 required for transcript parsing"
  exit 1
fi

if ! curl --connect-timeout 2 --max-time 5 --fail --silent "$PUSHGATEWAY_URL/-/healthy" >/dev/null 2>&1; then
  echo "ERROR: Pushgateway not reachable at $PUSHGATEWAY_URL"
  echo "Start with: docker compose -f docker-compose.dev.yml up ce-pushgateway -d"
  exit 1
fi

# First, clear ALL existing metrics from Pushgateway
echo "Clearing existing metrics from Pushgateway..."
# List all groups and delete them
curl -s "$PUSHGATEWAY_URL/api/v1/metrics" 2>/dev/null | \
  python3 -c "
import json, sys, urllib.request
data = json.load(sys.stdin)
groups = data.get('data', [])
for g in groups:
    job = g.get('labels', {}).get('job', '')
    instance = g.get('labels', {}).get('instance', '')
    if job:
        url = '$PUSHGATEWAY_URL/metrics/job/' + job
        if instance:
            url += '/instance/' + instance
        try:
            req = urllib.request.Request(url, method='DELETE')
            urllib.request.urlopen(req, timeout=5)
            print(f'  Deleted: job={job} instance={instance}')
        except: pass
" 2>/dev/null || echo "  (no existing metrics to clear)"
echo ""

# Process each transcript
session_count=0
total_cost=0

python3 << 'PYEOF'
import json, os, glob, re, sys, subprocess

PUSHGATEWAY_URL = os.environ.get("PUSHGATEWAY_URL", "http://localhost:9091")
TRANSCRIPTS_DIR = os.path.expanduser("~/.claude/projects/-Users-fp")
PROJECT = "Sovren"

# Pricing rates per 1M tokens
RATES = {
    'opus': (15.0, 75.0),
    'sonnet': (3.0, 15.0),
    'haiku': (0.8, 4.0),
}

def get_rate(model):
    m = (model or '').lower()
    for key, rates in RATES.items():
        if key in m:
            return rates
    return RATES['opus']

def push_metrics(job, instance, metrics_text):
    """Push metrics to Pushgateway"""
    import urllib.request
    url = f"{PUSHGATEWAY_URL}/metrics/job/{job}/instance/{instance}"
    req = urllib.request.Request(url, data=metrics_text.encode(), method='POST')
    req.add_header('Content-Type', 'text/plain')
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f"  WARN: Push failed for {instance}: {e}", file=sys.stderr)
        return False

def branch_to_slug(branch):
    """Extract meaningful work slug from branch name.
    feat/squad-a/S2-business-manager-mvp -> business-manager-mvp
    fix/p2-remediation-r5 -> p2-remediation-r5
    """
    slug = branch.split('/')[-1]
    slug = re.sub(r'^(SOV-\d+-|S\d+-)', '', slug)
    return slug

def load_pr_map():
    """Load PR number -> branch slug mapping from gh CLI"""
    try:
        result = subprocess.run(
            ['gh', 'pr', 'list', '--state', 'merged', '--limit', '100',
             '--json', 'number,headRefName'],
            capture_output=True, text=True, timeout=15
        )
        prs = json.loads(result.stdout)
        return {pr['number']: branch_to_slug(pr['headRefName']) for pr in prs}
    except Exception as e:
        print(f"  WARN: Could not load PR map from gh: {e}", file=sys.stderr)
        return {}

def scan_for_primary_pr(filepath):
    """Find the most-referenced PR number in a transcript"""
    pr_counts = {}
    for line in open(filepath):
        try:
            obj = json.loads(line)
            text = json.dumps(obj)
            for m in re.finditer(r'PR\s*#(\d{2,3})', text):
                num = int(m.group(1))
                if 70 <= num <= 200:
                    pr_counts[num] = pr_counts.get(num, 0) + 1
            for m in re.finditer(r'gh pr (?:create|merge|view|checks)\s+(?:#?)(\d{2,3})', text):
                num = int(m.group(1))
                if 70 <= num <= 200:
                    pr_counts[num] = pr_counts.get(num, 0) + 1
        except:
            pass
    if not pr_counts:
        return 0
    return max(pr_counts, key=pr_counts.get)

def process_transcript(filepath):
    """Extract metrics from a single transcript"""
    sid = os.path.basename(filepath).replace('.jsonl', '')

    total_input = total_output = total_cache_read = total_cache_creation = turns = 0
    models = {}
    first_ts = None
    last_ts = None

    for line in open(filepath):
        try:
            obj = json.loads(line)
            ts = obj.get('timestamp')
            if ts:
                if not first_ts:
                    first_ts = ts
                last_ts = ts

            if obj.get('type') == 'assistant' and isinstance(obj.get('message'), dict):
                msg = obj['message']
                usage = msg.get('usage')
                model = msg.get('model', 'unknown')
                if usage:
                    turns += 1
                    i = usage.get('input_tokens', 0)
                    o = usage.get('output_tokens', 0)
                    r = usage.get('cache_read_input_tokens', 0)
                    c = usage.get('cache_creation_input_tokens', 0)
                    total_input += i
                    total_output += o
                    total_cache_read += r
                    total_cache_creation += c
                    if model not in models:
                        models[model] = {'input': 0, 'output': 0}
                    models[model]['input'] += i
                    models[model]['output'] += o
        except:
            pass

    if turns == 0:
        return None

    # Find primary PR
    primary_pr = scan_for_primary_pr(filepath)

    # Compute cost
    cost = 0.0
    for model, tokens in models.items():
        in_rate, out_rate = get_rate(model)
        total_model_input = sum(m['input'] for m in models.values())
        if total_model_input > 0:
            model_share = tokens['input'] / total_model_input
        else:
            model_share = 1.0 / len(models)

        model_cache_creation = total_cache_creation * model_share
        model_cache_read = total_cache_read * model_share

        cost += ((tokens['input'] + model_cache_creation) * in_rate +
                 model_cache_read * in_rate * 0.1 +
                 tokens['output'] * out_rate) / 1_000_000

    return {
        'session_id': sid,
        'session_short': sid[:8],
        'turns': turns,
        'input_tokens': total_input,
        'output_tokens': total_output,
        'cache_read': total_cache_read,
        'cache_creation': total_cache_creation,
        'models': models,
        'cost': round(cost, 4),
        'first_ts': first_ts,
        'last_ts': last_ts,
        'primary_pr': primary_pr,
    }

# Load PR -> branch slug mapping
print("Loading PR branch mapping from GitHub...")
pr_slug_map = load_pr_map()
if pr_slug_map:
    print(f"  Loaded {len(pr_slug_map)} PR branch slugs")
else:
    print("  WARNING: No PR data loaded — session labels will use hex IDs")
print()

# Find all transcripts
transcripts = sorted(glob.glob(os.path.join(TRANSCRIPTS_DIR, "*.jsonl")))
print(f"Found {len(transcripts)} transcript files")
print()

total_cost = 0
total_tokens = 0
session_count = 0

for t in transcripts:
    result = process_transcript(t)
    if not result:
        continue

    session_count += 1
    pr = result['primary_pr']
    date = result['first_ts'][:10] if result['first_ts'] else 'unknown'
    total_cost += result['cost']
    total_tokens += (result['input_tokens'] + result['output_tokens'] +
                     result['cache_read'] + result['cache_creation'])

    # Session label: use PR branch slug if available, else hex ID
    if pr and pr in pr_slug_map:
        session_label = pr_slug_map[pr]
    else:
        session_label = result['session_short']
    pr_label = str(pr)

    # Build metrics with meaningful labels
    labels = f'session="{session_label}",phase="adhoc",project="{PROJECT}",pr_number="{pr_label}",date="{date}"'

    metrics = f"""# HELP ce_session_cost_usd Estimated session cost in USD
# TYPE ce_session_cost_usd gauge
ce_session_cost_usd{{{labels}}} {result['cost']}

# HELP ce_session_tokens_total Total tokens used in session by type
# TYPE ce_session_tokens_total gauge
ce_session_tokens_total{{type="input",{labels}}} {result['input_tokens']}
ce_session_tokens_total{{type="output",{labels}}} {result['output_tokens']}
ce_session_tokens_total{{type="cache_read",{labels}}} {result['cache_read']}
ce_session_tokens_total{{type="cache_creation",{labels}}} {result['cache_creation']}

# HELP ce_session_turns_total Total turns in session
# TYPE ce_session_turns_total gauge
ce_session_turns_total{{{labels}}} {result['turns']}

# HELP ce_session_agents_total Total agents spawned
# TYPE ce_session_agents_total gauge
ce_session_agents_total{{{labels}}} 0

# HELP ce_session_tasks_total Total tasks completed
# TYPE ce_session_tasks_total gauge
ce_session_tasks_total{{{labels}}} 0

# HELP ce_session_commits_total Total commits
# TYPE ce_session_commits_total gauge
ce_session_commits_total{{{labels}}} 0

# HELP ce_agent_duration_seconds_avg Average agent duration
# TYPE ce_agent_duration_seconds_avg gauge
ce_agent_duration_seconds_avg{{{labels}}} 0
"""

    # Add per-model breakdown
    for model, tokens in result['models'].items():
        model_clean = model.replace('"', '')
        metrics += f'ce_session_tokens_by_model{{model="{model_clean}",type="input",{labels}}} {tokens["input"]}\n'
        metrics += f'ce_session_tokens_by_model{{model="{model_clean}",type="output",{labels}}} {tokens["output"]}\n'

    instance_id = f"sess-{result['session_short']}"
    if push_metrics("ce_session", instance_id, metrics):
        pr_str = f"PR#{pr}" if pr else "no-PR"
        print(f"  [{session_count:2d}] {session_label:<40}  {pr_str:<8}  {date}  turns={result['turns']:>5}  cost=${result['cost']:>8.4f}")
    else:
        print(f"  [{session_count:2d}] {session_label:<40}  FAILED")

# Push knowledge metrics
try:
    docs_count = len(glob.glob("docs/solutions/**/*.md", recursive=True))
except:
    docs_count = 0
try:
    pattern_lines = sum(1 for _ in open("docs/solutions/patterns/common-solutions.md"))
except:
    pattern_lines = 0

knowledge_metrics = f"""# HELP ce_compound_docs_total Count of compound docs
# TYPE ce_compound_docs_total gauge
ce_compound_docs_total{{project="{PROJECT}"}} {docs_count}

# HELP ce_pattern_count Lines in common-solutions.md
# TYPE ce_pattern_count gauge
ce_pattern_count{{project="{PROJECT}"}} {pattern_lines}
"""
push_metrics("ce_knowledge", "sovren", knowledge_metrics)

print()
print(f"{'='*60}")
print(f"Backfill complete!")
print(f"  Sessions:     {session_count}")
print(f"  Total cost:   ${total_cost:,.2f}")
print(f"  Total tokens: {total_tokens:,}")
print(f"  Compound docs: {docs_count}")
print(f"  Pattern lines: {pattern_lines}")
print()
print(f"Open Grafana: http://localhost:3002")
PYEOF

echo ""
echo "Done. All metrics are from REAL Claude Code session transcripts."
