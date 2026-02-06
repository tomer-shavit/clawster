# Clawster Design System

Aligned with OpenClaw's visual identity. Clawster is the management layer — its UI should feel like a natural extension of the OpenClaw ecosystem.

## Direction: Precision & Density (Dark Tech)

## Colors

### Backgrounds
- `--bg-deep`: #050810 (page background)
- `--bg-surface`: #0a0f1a (cards, panels)
- `--bg-elevated`: #111827 (modals, dropdowns, hover states)
- `--bg-input`: #1a2035 (form inputs)

### Accents
- `--accent-coral`: #ff4d4d (primary actions, destructive, alerts)
- `--accent-coral-mid`: #e63946 (hover state)
- `--accent-coral-dark`: #991b1b (pressed state)
- `--accent-cyan`: #00e5cc (success, active, online indicators)
- `--accent-cyan-mid`: #14b8a6 (hover state)
- `--accent-cyan-glow`: rgba(0, 229, 204, 0.4) (glow/focus rings)

### Text
- `--text-primary`: #f0f4ff (headings, primary content)
- `--text-secondary`: #8892b0 (descriptions, labels)
- `--text-muted`: #5a6480 (placeholders, disabled)

### Borders
- `--border-subtle`: rgba(136, 146, 176, 0.15)
- `--border-accent`: rgba(255, 77, 77, 0.3)
- `--border-focus`: rgba(0, 229, 204, 0.5)

### Status
- `--status-online`: #00e5cc
- `--status-offline`: #5a6480
- `--status-error`: #ff4d4d
- `--status-warning`: #f59e0b
- `--status-provisioning`: #8892b0

## Typography

### Font Stack
- Display: "Clash Display", system-ui, sans-serif
- Body: "Satoshi", system-ui, sans-serif
- Mono: "JetBrains Mono", "Fira Code", "SF Mono", monospace

### Scale
- `--text-xs`: 0.75rem / 1rem (labels, badges)
- `--text-sm`: 0.875rem / 1.25rem (secondary text, table cells)
- `--text-base`: 1rem / 1.5rem (body text)
- `--text-lg`: 1.125rem / 1.75rem (card titles)
- `--text-xl`: 1.25rem / 1.75rem (section headers)
- `--text-2xl`: 1.5rem / 2rem (page titles)
- `--text-3xl`: 2rem / 2.5rem (hero/display)

### Weight
- Regular: 400 (body text)
- Medium: 500 (labels, table headers)
- Semibold: 600 (card titles, buttons)
- Bold: 700 (page titles, display only)

## Spacing

### Base Unit: 4px
- `--space-1`: 4px
- `--space-2`: 8px
- `--space-3`: 12px
- `--space-4`: 16px
- `--space-5`: 20px
- `--space-6`: 24px
- `--space-8`: 32px
- `--space-10`: 40px
- `--space-12`: 48px
- `--space-16`: 64px

### Component Spacing
- Card padding: 20px (--space-5)
- Section gap: 32px (--space-8)
- Form field gap: 16px (--space-4)
- Button padding: 8px 16px (--space-2 --space-4)
- Table cell padding: 12px 16px (--space-3 --space-4)

## Depth & Elevation

### Shadows (subtle, blue-tinted)
- `--shadow-sm`: 0 1px 2px rgba(0, 0, 0, 0.3)
- `--shadow-md`: 0 4px 6px rgba(0, 0, 0, 0.4)
- `--shadow-lg`: 0 10px 15px rgba(0, 0, 0, 0.5)
- `--shadow-glow-cyan`: 0 0 20px rgba(0, 229, 204, 0.15)
- `--shadow-glow-coral`: 0 0 20px rgba(255, 77, 77, 0.15)

### Border Radius
- `--radius-sm`: 6px (badges, chips)
- `--radius-md`: 8px (buttons, inputs)
- `--radius-lg`: 12px (cards, panels)
- `--radius-xl`: 16px (modals, large containers)

## Components

### Buttons
- Primary: bg coral, text white, rounded-md, font-semibold, 36px height
- Secondary: bg transparent, border subtle, text secondary, hover bg elevated
- Ghost: bg transparent, text secondary, hover text primary
- Danger: bg coral-dark, text white
- All buttons: 36px height, 8px 16px padding, transition 150ms ease

### Cards
- bg surface, border subtle, rounded-lg, padding 20px
- Hover: border accent (cyan glow for interactive cards)
- Bot cards: status dot (online/offline), bot name in semibold, description in text-secondary

### Tables
- Header: bg elevated, text-sm font-medium text-secondary, uppercase tracking-wider
- Rows: bg surface, border-b subtle, hover bg elevated
- Cell: text-sm text-primary

### Inputs
- bg input, border subtle, rounded-md, text-primary
- Focus: border-focus (cyan), shadow-glow-cyan
- Placeholder: text-muted
- Height: 36px (matching buttons)

### Navigation
- Sidebar: bg deep, border-r subtle, width 240px
- Active item: bg elevated, border-l-2 accent-cyan, text-primary
- Inactive item: text-secondary, hover text-primary
- Section labels: text-xs uppercase tracking-wider text-muted

### Status Indicators
- Online: filled circle 8px, accent-cyan, pulse animation
- Offline: filled circle 8px, text-muted
- Error: filled circle 8px, accent-coral
- Provisioning: filled circle 8px, text-secondary, pulse animation

### Toasts/Notifications
- bg elevated, border subtle, rounded-lg, shadow-lg
- Success: left border accent-cyan
- Error: left border accent-coral
- Duration: 4000ms, slide-in from right

## Motion

### Timing
- Micro (hover, focus): 150ms ease
- Small (expand, toggle): 200ms ease-out
- Medium (modal, panel): 300ms cubic-bezier(0.16, 1, 0.3, 1)
- Status pulse: 2000ms ease-in-out infinite

### Principles (Emil Kowalski restraint)
- No bounce effects
- No decorative animations
- Transitions only on state changes
- Opacity + transform for enter/exit
- Respect prefers-reduced-motion

## Layout

### Dashboard Grid
- Sidebar (240px fixed) + Main content (fluid)
- Main content max-width: 1280px, centered
- Page padding: 32px (--space-8)
- Content sections separated by 32px gap

### Responsive
- Desktop: sidebar + content grid
- Tablet (< 1024px): collapsible sidebar, overlay
- Mobile (< 768px): bottom nav, full-width content

## Anti-Patterns (NEVER)
- No light mode (dark only, matching OpenClaw)
- No Inter, Roboto, or Arial fonts
- No purple/gradient backgrounds
- No rounded-full buttons (use rounded-md)
- No box shadows without blue tint
- No bright white (#ffffff) text — use #f0f4ff
- No generic gray backgrounds — use navy spectrum
- No animations longer than 300ms
- No skeleton loaders without the navy color scheme
