# Backlog

## ~~Use `hubble-dash-ui` components instead of raw CSS class names~~ ✓ Done

Both `countdown` and `stopwatch` visualizations manually apply `dash-glass`, `dash-widget`, and `dash-widget-header` as raw CSS class names. This is split into two sub-tasks with different blockers.

### Part 1 — `DashWidgetHeader` (no blockers)

The current header is just:

```tsx
<div className="dash-widget-header">
  <span className="t-label">{label}</span>
</div>
```

This maps directly to `<DashWidgetHeader label={label} />`. Safe to swap today.

### Part 2 — `DashWidget` (blocked on hubble-dash-ui patch)

`DashWidget`'s prop interface is `{ children, className?, style?, statusBorder? }` — it does **not** forward `data-*` attributes to its root div. Both visualizations rely on `[data-state]` and `[data-size]` attribute selectors on the root element to drive all state styling (warning pulse, done flash, paused opacity, size scaling). Swapping in `DashWidget` as-is silently drops those attributes and breaks all that CSS.

Two options to unblock:

- **Patch DashWidget** — add `...rest` spread onto the root div in hubble-dash-ui (small change)
- **Restructure CSS** — keep `DashWidget` as the outer shell, move `data-state`/`data-size` to an inner wrapper, and update all CSS selectors to target the inner element

Once unblocked, `DashWidget.statusBorder` can also be used to surface timer state via the colored left border:

| Timer state | `statusBorder` |
|---|---|
| running | `positive` |
| warning | `warning` |
| done | `critical` |
| idle / paused | `neutral` |
