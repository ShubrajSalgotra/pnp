# 10. Puzzle Move Feedback & Step Navigation

## Summary

Improved the practice puzzle experience with optional multi-move analysis and right-side controls.

## Changes

- Moved tactical hint text from the banner above the board into a card directly below the Hint / Show Move controls.
- Incorrect legal moves only show a red cross and retry guidance; no move is suggested.
- Students can draw their own continuous move line on the board using right-click-and-drag arrows, then analyze that exact line.
- The engine replays the drawn moves, validates that the sequence is legal, checks it against the puzzle solution, and evaluates the resulting position without suggesting a move.
- Correct solution moves show a green check indicator.
- Added a Back control for multi-step puzzles. It restores the position and solution index from before the student's previous move, including when undoing while an opponent reply is pending.
- Invalidates stale line-analysis results when the drawn line or puzzle position changes, or when the student requests a hint, undoes, resets, or leaves the trainer.
- Guards the completion coin reward so undoing and replaying a solved puzzle cannot award the same puzzle's coins more than once.

## Files

- `src/components/PracticePuzzleTrainer.tsx`
- `src/components/chess/ChessboardView.tsx` (passes through manual arrow-drawing events)
- `src/services/stockfishService.ts` (existing position evaluator reused)
- `design-system/pawnsposes/COMPONENTS.md`

## Verification

- `npm run build`
- `git diff --check`
