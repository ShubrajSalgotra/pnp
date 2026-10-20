# 9. Coin System, Board Themes Unlock Milestones & Light Theme Text Contrast

This document records the transformation from the XP/Level system to a gamified Coin Economy with progressive Board UI unlocking milestones (400, 600, 800 Coins) and complete light-theme text readability fixes.

---

## 🎯 Objectives & User Requirements

1. **Replace Level with Coin System**:
   - Replaced generic XP / Level badges with **🪙 Coins**.
   - Dynamically tracks total earned coins from Firestore practice statistics and local storage (`pnp_practice_coins`).
   - Earn `+10 🪙` directly on solving tactical puzzles with animated green/gold celebration feedback.

2. **Progressive Board UI Themes Unlock Milestones**:
   - **0 Coins (Starter)**:
     - 🟣 **Royal Amethyst** (Vibrant signature purple & lavender)
     - 🟩 **Tournament Green** (Championship match green & buff)
   - **400 Coins (Milestone 1)**:
     - 🌲 **Emerald Forest** (Deep woodland pine & fresh mint)
   - **600 Coins (Milestone 2)**:
     - 🪵 **Master Walnut** (Handcrafted natural warm wood grain)
   - **800 Coins (Milestone 3)**:
     - 👑 **Obsidian Gold** (Grandmaster exclusive obsidian and royal gold)
   - **Equip & Switch**:
     - Students can click "Board Themes" to expand the selector.
     - Unlocked boards feature an **Equip** button (or **Active** badge if equipped).
     - Locked boards display the required milestone and exact coins remaining (e.g. `🔒 400 🪙 (need 150 more)`).
     - Selected theme persists in `localStorage` (`pnp_board_theme`) and immediately skins `ChessboardView`.

3. **Light-Theme Contrast & Text Visibility Fixes**:
   - In `PracticePuzzleTrainer.tsx`, previously hardcoded `text-white/95`, `text-white/80`, `border-white/10`, and `bg-white/10` caused white text and ghost buttons on the light slate canvas.
   - Refactored:
     - **Coach Message**: High-contrast `text-slate-800 dark:text-slate-100`.
     - **Mascot Box**: `bg-slate-900 dark:bg-slate-800 border-slate-700/20 dark:border-white/15` with crisp white capsule eyes.
     - **Back Button**: `border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-white/80`.
     - **Hint Button**: `border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/20 dark:bg-white/10 dark:text-white`.
     - **Reset / Inspect Button**: `border-slate-300 bg-white text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-white`.
     - **Coin & Board Cards**: Adaptive card backgrounds `bg-white border-slate-200/90 text-slate-900 dark:bg-[#1e2025] dark:border-white/10 dark:text-white`.
     - **Board Coordinates**: Updated `lightSquareNotationStyle` to use `darkColor` and `darkSquareNotationStyle` to use `lightColor` so row/column coordinates never wash out on light squares.

---

## 📁 Key File Changes

### 1. `src/components/chess/ChessboardView.tsx`
- Added `'gold'` theme with luxury gold palette (`#fef3c7` / `#854d0e`).
- Set coordinate notation styles with contrasting colors for light vs dark squares.

### 2. `src/components/PracticePuzzleTrainer.tsx`
- Defined `AVAILABLE_BOARD_THEMES` configuration array with milestones (0, 400, 600, 800).
- Replaced `XP_PER_LEVEL` and `totalPoints` with `totalCoins` and milestone progress calculation (`nextMilestone`, `nextThemeName`, `progressPercent`).
- Added expandable Board Theme Picker with real-time 2x2 board color swatches, status badges, and equip handlers.
- Fixed all light mode text and border opacity issues.

---

## 🧪 Verification
- `npm run build` executed and passed cleanly with **0 errors**.
