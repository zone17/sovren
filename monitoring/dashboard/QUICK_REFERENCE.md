# Dashboard Enhancement Quick Reference

## File Locations

```
/monitoring/dashboard/
├── public/
│   ├── index.html         # Main HTML with modal structure
│   ├── styles.css         # Enhanced responsive CSS (1617 lines)
│   └── app.js            # Dashboard logic with modal features (1021 lines)
├── DASHBOARD_ENHANCEMENTS.md  # Complete implementation guide
├── TEST_GUIDE.md         # Testing checklist
└── QUICK_REFERENCE.md    # This file
```

## CSS Classes Reference

### Interactive Elements
```css
.stat-card              /* Interactive status box */
.stat-card[data-status] /* Clickable card with status filter */
.modal-overlay          /* Modal backdrop */
.modal-container        /* Modal content wrapper */
.modal-task-card        /* Individual task in modal */
```

### States
```css
.active                 /* Modal is visible */
.completed              /* Completed state color */
.in_progress           /* Active state color */
.blocked               /* Blocked state color */
```

### Responsive
```css
@media (max-width: 479px)   /* Extra small mobile */
@media (max-width: 767px)   /* Mobile */
@media (max-width: 1023px)  /* Tablet */
@media (min-width: 1024px)  /* Desktop */
@media (min-width: 1440px)  /* Large desktop */
```

## JavaScript API

### Public Functions

#### Modal Management
```javascript
showStatusModal(status)  // Open modal with filtered tasks
// status: 'completed' | 'active' | 'blocked' | 'total'

closeModal()             // Close modal and cleanup

initializeModal()        // Setup modal event listeners
initializeStatusBoxes()  // Setup stat card click handlers
```

#### Task Data
```javascript
getTasksByStatus(status)    // Returns filtered task array
renderModalTasks(tasks)     // Renders tasks in modal
createDetailedTaskCard(task) // Generates task HTML
```

#### Utilities
```javascript
generateTaskHistory(task)        // Creates timeline events
calculateDuration(start, end)    // Formats time span
formatTimestamp(ts, offset)      // Formats time display
formatFullTimestamp(ts)          // Full date+time format
exportTaskData()                 // Downloads JSON file
```

### Data Structures

#### Task Object
```javascript
{
  name: string,              // Task name
  agent: string,             // Agent assigned
  status: string,            // 'completed' | 'in_progress' | 'blocked'
  progress_percent: number,  // 0-100
  current_step: string,      // Current action
  description: string,       // Task description
  started_at: string,        // ISO timestamp
  completed_at: string,      // ISO timestamp or null
  pr_url: string            // Pull request URL (optional)
}
```

#### History Event
```javascript
{
  time: string,      // Formatted timestamp
  event: string,     // Event description
  completed: boolean // Is this a completion event?
}
```

## CSS Variables

### Colors
```css
--bg-primary: #1e1e1e        /* Main background */
--bg-secondary: #252526      /* Card background */
--bg-tertiary: #2d2d30       /* Elevated surfaces */
--text-primary: #d4d4d4      /* Main text */
--text-secondary: #858585    /* Secondary text */
--accent-primary: #4fc3f7    /* Primary accent */
--status-completed: #4caf50  /* Success green */
--status-active: #4fc3f7     /* Active blue */
--status-blocked: #f44336    /* Error red */
```

### Spacing
```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-5: 1.25rem   /* 20px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
```

### Typography
```css
--font-size-h1: clamp(1.5rem, 4vw, 2.5rem)
--font-size-h2: clamp(1.25rem, 3vw, 1.75rem)
--font-size-body: clamp(0.875rem, 2vw, 1rem)
--font-size-small: clamp(0.75rem, 1.5vw, 0.875rem)
```

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| xs | 320-479px | Single column, stacked |
| sm | 480-767px | 2-column stats, mobile |
| md | 768-1023px | Tablet, 2-column stats |
| lg | 1024-1439px | Desktop, 4-column stats |
| xl | 1440px+ | Large desktop, max-width |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Enter/Space | Open modal (when stat card focused) |
| ESC | Close modal |
| Tab | Navigate interactive elements |
| Ctrl/Cmd+R | Refresh dashboard |

## Event Handlers

### Stat Cards
```javascript
// Click handler
card.addEventListener('click', () => {
  showStatusModal(card.dataset.status);
});

// Keyboard handler
card.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    showStatusModal(card.dataset.status);
  }
});
```

### Modal
```javascript
// Close handlers
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// Keyboard handler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Export handler
exportBtn.addEventListener('click', exportTaskData);
```

## Animation Timings

```css
--transition-fast: 150ms    /* Micro-interactions */
--transition-normal: 300ms  /* Standard transitions */
--transition-slow: 500ms    /* Complex animations */
```

## Common Customizations

### Change Modal Size
```css
.modal-container {
  max-width: 900px; /* Adjust width */
  max-height: 85vh; /* Adjust height */
}
```

### Adjust Breakpoints
```css
@media (max-width: 767px) {
  /* Mobile styles */
}
```

### Modify Colors
```css
:root {
  --status-completed: #4caf50; /* Change success color */
  --accent-primary: #4fc3f7;   /* Change primary color */
}
```

### Add Custom Badge
```html
<span class="badge badge-custom">Custom</span>
```
```css
.badge-custom {
  background: rgba(255, 152, 0, 0.15);
  color: #ff9800;
}
```

## Debugging Tips

### Enable Debug Mode
```javascript
// In browser console
localStorage.setItem('debug', 'true');
location.reload();
```

### Check Modal State
```javascript
// Is modal open?
elements.modal.classList.contains('active');

// Current status filter
elements.modal.dataset.currentStatus;

// Task count
getTasksByStatus('total').length;
```

### Inspect Task Data
```javascript
// View current data
console.log(state.currentData);

// View tasks for specific status
console.log(getTasksByStatus('completed'));

// View specific task
const tasks = getTasksByStatus('total');
console.log(tasks[0]);
```

## Performance Tips

1. **Limit Task Cards:** Render max 100 tasks in modal
2. **Virtual Scrolling:** For 100+ tasks, implement virtual scrolling
3. **Debounce Resize:** Use debounce for resize handlers
4. **Lazy Load:** Load task details on demand
5. **Memoize:** Cache filtered task arrays

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full support |
| Firefox | 88+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 90+ | ✅ Full support |
| IE 11 | - | ❌ Not supported |

## Common Issues

### Modal Won't Open
- Check: `state.currentData` is populated
- Check: Socket.IO connection is active
- Check: No JavaScript errors in console

### Export Fails
- Check: Browser allows downloads
- Check: No popup blocker
- Check: Sufficient disk space

### Animations Janky
- Check: Hardware acceleration enabled
- Check: No heavy processes running
- Enable: `will-change` CSS property

### Layout Breaks
- Check: Viewport meta tag present
- Check: No fixed widths in pixels
- Verify: CSS Grid support

## Testing Commands

```bash
# Start dashboard
npm start

# View in browser
open http://localhost:3000

# Check for errors
npm run lint

# Test responsiveness
# Use browser DevTools device toolbar
```

## File Sizes

| File | Size | Lines |
|------|------|-------|
| index.html | 12 KB | 234 |
| styles.css | 32 KB | 1617 |
| app.js | 28 KB | 1021 |
| **Total** | **72 KB** | **2872** |

## Quick Links

- [Full Enhancement Guide](./DASHBOARD_ENHANCEMENTS.md)
- [Testing Guide](./TEST_GUIDE.md)
- [Sovren Documentation](../../docs/README.md)

---

**Last Updated:** 2025-10-24
**Version:** 2.0.0
**Status:** Production Ready
