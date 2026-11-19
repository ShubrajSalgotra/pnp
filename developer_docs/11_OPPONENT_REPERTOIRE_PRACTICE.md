# Opponent Repertoire Practice

## Summary

Practice as Bot uses the selected opponent's moves from their full Chess.com/Lichess game archive. The selected recent games drive the Gemini scouting report; the full archive is fetched only after the user chooses a side in Practice, and is replayed locally with chess.js without sending it to Gemini. Only moves by the bot's chosen color are indexed. The resulting position map stays in browser memory for that practice session; returning to Practice fetches the archive again.

## Behavior

- Each position key contains piece placement, side to move, castling rights, and en-passant square; move counters are ignored.
- Each recorded move count represents the number of distinct games in which the opponent played that move from the position. Repeated occurrences of the same position and move within one game count once.
- The practice bot samples historical moves in proportion to their game counts, including moves seen in only one game.
- Practice displays the historical move counts and their share of recorded move samples for the position from which the opponent is to play.
- Stockfish is used only when the selected opponent has no recorded move from the current position.
- The full archive is not uploaded to Firestore or persisted in browser storage by this flow.
- Full-history import reports progress and fails visibly if Chess.com cannot provide an archive, rather than silently treating a partial history as complete.

## Storage

- Opponent reports remain saved in Firestore as before; the full-history practice repertoire is not.
- Legacy `openingBook` Firestore documents are not read, written, or automatically deleted by the current flow; they remain untouched.
- The fetched games and move counts exist only in memory while the practice page is active. A later visit fetches fresh history.

## Files

- `src/utils/opponentOpeningBook.ts`
- `src/utils/opponentStyleBot.ts`
- `src/services/opponentRepertoireService.ts`
- `src/services/gameImport.ts`
- `src/pages/GameAnalysisPage.tsx`
- `src/pages/OpponentPracticePage.tsx`
- `src/utils/opponentOpeningBook.test.ts`

## Verification

- `npm test -- --watchAll=false --runTestsByPath src/utils/opponentOpeningBook.test.ts`
- `npm run build`
