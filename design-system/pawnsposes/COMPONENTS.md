# Reusable UI Components

## New primitives introduced

- `src/components/ui/EmptyState.tsx`
  - Consistent icon/title/description/action pattern.
  - Used for no-data scenarios to prevent blank screens.

- `src/components/ui/Skeleton.tsx`
  - Shared shimmer skeleton style for content placeholders.
  - Respects `prefers-reduced-motion`.

## Refined primitives

- `src/components/ui/Button.tsx`
  - Premium elevation, smoother hover/focus transitions, stronger variants.
  - Better visual hierarchy between primary and supporting actions.

- `src/components/ui/Card.tsx`
  - Unified radii, border, and elevation.
  - Better typography defaults for high-density card content.

## Form Patterns & Inputs

- **International Phone Input Group** (`LandingPage.tsx`)
  - Unified flex container coupling `<select>` country code prefix with `<input type="tel">`.
  - Includes right-padding (`pr-7`) on select box to prevent text overlapping arrow icon.
  - Integrated required indicator asterisks (`*`) and regex validation rules.

## Utility classes added in `src/index.css`

- `surface-card` and `surface-subtle` for consistent surfaces.
- `section-shell` for global width and horizontal spacing.
- `metric-value` and `muted-kicker` typography helpers.
- `skeleton-shimmer` animation utility.
