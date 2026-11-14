# Opponent Repertoire Practice

## Summary

Practice as Bot uses the selected opponent's moves from their analyzed games. The repertoire is aggregated by chess position and stored in chunked, private Firestore subcollection documents, separate from the report document so it does not increase Firestore document size or require Firebase Storage CORS configuration.

## Behavior

- Each position key contains piece placement, side to move, castling rights, and en-passant square; move counters are ignored.
- Each recorded move count represents the number of distinct games in which the opponent played that move from the position. Repeated occurrences of the same position and move within one game count once.
- The practice bot samples historical moves in proportion to their game counts, including moves seen in only one game.
- Practice displays the historical move counts and their share of recorded move samples for the position from which the opponent is to play.
- Stockfish is used only when the selected opponent has no recorded move from the current position.
- Older saved reports without a stored repertoire rebuild it from their imported game data and attempt to save it for future practice.

## Storage and Access

- Firestore path: `users/{userId}/opponentReports/{reportId}/openingBook/{chunkId}`
- Each chunk stores up to 200 position records; a metadata document points to the active generation so a failed update does not replace the last complete repertoire.
- `firestore.rules` restricts reading and writing the repertoire to its owning user.
- The repertoire is loaded once when entering Practice as Bot and retained in the in-memory opening book for the session; moves do not trigger Firebase reads.
- Replacing or deleting an opponent report also removes its opening-book documents.

## Files

- `src/utils/opponentOpeningBook.ts`
- `src/utils/opponentStyleBot.ts`
- `src/services/userDataService.ts`
- `src/pages/GameAnalysisPage.tsx`
- `src/pages/OpponentPracticePage.tsx`
- `firestore.rules`
- `src/utils/opponentOpeningBook.test.ts`

## Verification

- `npm test -- --watchAll=false --runTestsByPath src/utils/opponentOpeningBook.test.ts`
- `npm run build`
