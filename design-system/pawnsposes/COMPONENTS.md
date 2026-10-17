# Reusable UI Components

## Application Layout Primitives

- `src/components/layout/AppLayout.tsx`
  - Unified responsive application shell hosting persistent desktop sidebar and compact mobile drawer.
  - Controls sidebar collapsed/expanded state with `localStorage` persistence (`pnp_sidebar_collapsed`).

- `src/components/layout/Sidebar.tsx`
  - Persistent left navigation sidebar on desktop.
  - Brand header with logo (`/pnp_logo.jpeg`), academy kicker, and collapse button.
  - Learning Arena navigation (Dashboard, Analyze, Practice, Puzzles, Leaderboard, Study, Reports).
  - Bottom user profile menu integration.

- `src/components/layout/SidebarNavItem.tsx`
  - Reusable nav item with active page indicator, hover effects, and badge support.
  - Features floating tooltip when the sidebar is collapsed.

- `src/components/layout/MobileNavigation.tsx`
  - Compact mobile top header with brand and hamburger button.
  - Slide-over mobile drawer with navigation links, theme toggle, and user profile card.

- `src/components/layout/PageHeader.tsx`
  - Consistent page title header with uppercase kicker, title, description, and action button slots.

- `src/components/layout/UserProfileMenu.tsx`
  - Bottom profile flyout menu with user avatar, pro badge, theme switch, settings link, and sign out.

## Chess Primitives

- `src/components/chess/ChessboardView.tsx`
  - Single reusable shared chessboard component powered by `react-chessboard` and `chess.js`.
  - Supports Pawnposes soft sage forest theme (`#dee7d9` & `#5a8b6e`), wood theme, and classic theme.
  - External board coordinates outside the board (ranks 8..1 on left, files a..h at bottom).
  - Rounded bezel frame (`#3b5d47`) with soft drop-shadow and smooth corners.
  - Drag-and-drop and click-to-move piece interaction with smooth animation.
  - Legal move destination dots and capture rings.
  - Last-move square highlights (`LAST_MOVE_TINT`).
  - Selected square highlight (`SELECTED_SQUARE_TINT`).
  - Automatic check detection with crimson king square glow.
  - Responsive sizing that scales cleanly without overflowing.

- `src/components/chess/ChessboardControls.tsx`
  - Standardized control bar below the board matching mockup.
  - Crown turn indicator pill badge ("White to move" / "Black to move").
  - Square rounded icon buttons for Undo, Reset position, Flip board orientation, and Sound mute toggle.

- `src/components/ui/PawnMascot.tsx`
  - Delightful SVG student mascot character: friendly crowned wooden pawn with rosy cheeks.
  - Configurable mood states (`happy`, `thinking`, `celebrating`) and sizes.
  - Integrates seamlessly with coach advice cards and congratulatory speech bubbles.

## UI Primitives

- `src/components/ui/StatCard.tsx`
  - Clean KPI card with title, large metric value, change indicator, and icon badge.

- `src/components/ui/SectionHeader.tsx`
  - Section title and description with action button slot.

- `src/components/ui/EmptyState.tsx`
  - Consistent icon/title/description/action pattern for no-data scenarios.

- `src/components/ui/Skeleton.tsx`
  - Shared shimmer skeleton style for content placeholders respecting `prefers-reduced-motion`.

- `src/components/ui/Button.tsx`
  - Premium elevation, smoother hover/focus transitions, stronger variants.

- `src/components/ui/Card.tsx`
  - Unified radii, border, and elevation for high-density dashboard cards.

## Form Patterns & Inputs

- **International Phone Input Group** (`LandingPage.tsx`)
  - Unified flex container coupling `<select>` country code prefix with `<input type="tel">`.
  - Includes right-padding (`pr-7`) on select box to prevent text overlapping arrow icon.
  - Integrated required indicator asterisks (`*`) and regex validation rules.

## Utility classes in `src/index.css`

- `surface-card` and `surface-subtle` for consistent surfaces.
- `section-shell` for global width and horizontal spacing.
- `metric-value` and `muted-kicker` typography helpers.
- `skeleton-shimmer` animation utility.
- `review-chessboard` for optimized chessboard pointer events and animations.
