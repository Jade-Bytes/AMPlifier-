# Dashboard page override

This page override refines the global AMPlifier design system for the academic command center.

## Direction

- **Style:** Clean Tech Minimalist, based on the skill's Minimalism & Swiss Style guidance.
- **Grid:** Compact SaaS density, target density 3–4. Keep metric cards, performance chart, and secondary dashboard panels aligned with a consistent 12px gap.
- **Motion:** Snappy state feedback, 150ms transitions; avoid motion that delays score entry or grade feedback. Respect `prefers-reduced-motion`.
- **Translucency:** Use subtle frosted surfaces in the app chrome and cards only: pale neutral fills with 0.78–0.9 opacity, a 10–16px backdrop blur, and a fine neutral border. Keep chart labels, grade values, and body text on high-opacity surfaces. Under `prefers-reduced-transparency`, use opaque fills and no blur.

## Dashboard tokens

| Role | Value |
|---|---|
| Canvas | `#F4F5F5` |
| Primary text | `#202A30` |
| Muted text | `#66727A` |
| Hairline border | `#DCE1E3` |
| Grade positive | `#43865F` |
| Warning | `#C9823C` |
| Main card radius | `12px` |
| Panel gap | `12px` |
| Motion | `150ms` |

Use the grade green for grade status, positive changes, and trend emphasis. Keep subject identifiers and decorative surfaces neutral. Use warning amber only for attention states.

## Layout and hierarchy

- Keep the academic performance chart as the primary wide panel.
- Add a compact subject-grade bar chart and a component-weight pie chart as a paired row below the performance/insight row.
- Give the bar chart a readable 80–100 scale, subject-code ticks, full subject-name tooltips, and an accessible text summary.
- Pair the pie chart with a text legend that names Written Works, Performance Tasks, and Examination and prints each percentage; never make slice color the only label.
- Place quick insights in a secondary column alongside the chart, with a distinct alert block at the bottom for the highest priority insight.
- Align the subject snapshot and upcoming work panels on the same grid row.
- Use one shared subsection title style for Subject Snapshot, Coming Up, and Quick Insights.
- Prefer hairline dividers over shadows. Reserve translucency for surfaces, not text or chart marks.
- Preserve the 375px mobile layout, let columns stack naturally, and avoid horizontal overflow.

## Accessibility

- Maintain at least 4.5:1 contrast for text on translucent surfaces; increase opacity or remove blur if contrast drops.
- Keep keyboard focus visible above the frosted surfaces.
- Do not rely on green or amber alone to communicate grade or warning state.
