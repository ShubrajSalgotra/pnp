# Milestone 5: Chess Report Quality Improvements

This milestone introduces logic fixes to improve the accuracy and instructiveness of the generated chess reports. It addresses two primary issues:
1. Material blunders and missed captures being counted/reported when the player is already in a losing position.
2. Opponent blunders being misattributed to the player in the "Recurring Weaknesses" section.

---

## 1. Context & Architectural Changes

### A. Material Scanning Filtering (`src/utils/gameEvidence.ts`)
In chess, once a player is in a heavily disadvantaged or losing position, the game's nature changes (it becomes about survival, and almost any move registers as sub-optimal or losing material). To prevent cluttering the report with non-instructive mistakes from dead-lost positions:
- We modified `scanGame` to filter the candidates list before calculating material drops.
- If the player's material balance *before* a move is already `-3.0` pawns or lower (a minor piece or more of disadvantage), we skip generating `dropped_material` or `missed_material` moments.
- We explicitly exclude `missed_mate` from this skip rule, because a missed checkmate-in-one is always critical and can win the game immediately regardless of the current material deficit.

### B. Prompt Attribution Guidelines (`src/services/geminiService.ts`)
To prevent the LLM from confusing the user's and the opponent's moves/blunders:
- We injected a strict **`CRITICAL ROLE / MOVE ATTRIBUTION RULES`** section in both the coaching report (`generateCompleteReportFast`) and opponent scouting report (`generateCompleteScoutDossierFast`) prompts.
- These rules instruct Gemini that all `CITABLE MOMENTS` represent mistakes made *only* by the target player being scanned, and the move in `played=...` is the move played *only* by them. It strictly prohibits the LLM from attributing opponent blunders as the player's own weaknesses.

### C. Robust Player Color Extraction (`src/services/geminiService.ts`)
- Replaced the flawed fallback logic in `getPlayerInfo` that matched White/Black color using move number parity (odd/even). Since both White and Black play moves at every move number (e.g. 15. Nd2 vs 15... e5), the parity check was incorrect and caused misattribution of player color.
- We updated this check to perform trimmed, case-insensitive string containment checks on player names and fallback to a warning-logged default if all matches fail.

---

## 2. Code Modifications

### Modified Files:
- [**`src/utils/gameEvidence.ts`**](file:///d:/F%20drive/client%20projects/pnp/pawns-poses-insight/src/utils/gameEvidence.ts#L320-L330): Staged candidate filtering for `candidate.balanceBefore <= -3`.
- [**`src/services/geminiService.ts`**](file:///d:/F%20drive/client%20projects/pnp/pawns-poses-insight/src/services/geminiService.ts#L516-L539): Upgraded `getPlayerInfo` name parsing and replaced move parity fallback.
- [**`src/services/geminiService.ts`**](file:///d:/F%20drive/client%20projects/pnp/pawns-poses-insight/src/services/geminiService.ts#L2378-L2384): Staged role/move attribution instructions in coaching report prompt.
- [**`src/services/geminiService.ts`**](file:///d:/F%20drive/client%20projects/pnp/pawns-poses-insight/src/services/geminiService.ts#L2556-L2562): Staged role/move attribution instructions in scout dossier prompt.

---

## 3. Verification & Verification Results
- **Type Safety**: Verified type correctness by running `npx tsc --noEmit` which completed successfully with zero compilation errors.
