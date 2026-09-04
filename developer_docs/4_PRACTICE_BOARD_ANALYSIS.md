# Practice Board Analysis Mode & Outcome Modal

This document provides developer context on the **Chess Board Analysis Mode** and **Graceful Error/Outcome Popups** implemented in the Opponent Practice feature. Refer to this document when developing future enhancements.

---

## 1. Feature Overview
The **Opponent Practice** page (`src/pages/OpponentPracticePage.tsx`) allows users to practice against a bot styled after their Chess.com opponents. We upgraded this page to double as an **Analysis Board** (similar to Chess.com's game review/analysis) where users can:
- Navigate back and forward in the move history.
- Jump to specific moves by clicking them.
- Try alternative moves from any point in the history (which truncates future moves and starts a new line).
- Toggle automatic bot responses ON/OFF to play moves for both sides manually (Self Analysis).
- Receive clean visual feedback when the game ends via a premium popup modal instead of static texts.
- Play without crashing when an illegal move is accidentally played.

---

## 2. Technical Implementation Details

### A. State Architecture
We consolidated several individual states (`fen`, `lastMove`, `moveSans`) and the mutable `gameRef` (which was out-of-sync with React renders) into a unified history tracker:
```typescript
const [history, setHistory] = useState<Array<{
  fen: string;
  lastMove: BoardLastMove | null;
  san: string | null;
}>>([{ fen: new Chess().fen(), lastMove: null, san: null }]);

const [historyIndex, setHistoryIndex] = useState(0);
const [botActive, setBotActive] = useState(true);
const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
```
* **History Array**: `history[0]` is the start position (before any moves). Subsequent entries represent plies.
* **History Index**: Represents the currently viewed position. The board reads `history[historyIndex]` for rendering.
* **Forking / Truncating**: When a player makes a move on the board at `historyIndex < history.length - 1`, we truncate the array to `historyIndex + 1`, apply the new move, and update `historyIndex` to the new end.

### B. Safe Move Handling (Try-Catch)
In `chess.js` (v1.0.0+), calling `.move()` on invalid moves throws a runtime exception. To prevent crash screens:
- Wrappers were placed around `tempGame.move` in `handlePlayerMove` and `game.move` in `applyBotMove`.
- If an illegal move is dragged/dropped, it catches the error gracefully, plays the illegal move sound (`playIllegal()`), and rejects the move on the board without interrupting the app.

### C. Sidebar Toggle switch (Bot Active)
- Exposes a toggle for `botActive` in the sidebar.
- If `botActive` is `false`, `boardEnabled` allows moving pieces of *either* color (`!botActive || tempGame.turn() === playerColor`), enabling full manual two-sided analysis.
- If toggled from `false` to `true` while it is the bot's turn, it immediately triggers `applyBotMove`.

### D. CSS Keyframes and Modal Animations
In [**`src/index.css`**](file:///d:/F%20drive/client%20projects/pnp/pawns-poses-insight/src/index.css#L223-L247), we added bouncy spring keyframes mimicking premium platform aesthetics:
```css
@keyframes practice-modal-backdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes practice-modal-content {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(15px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.practice-overlay-animate {
  animation: practice-modal-backdrop 0.25s ease-out forwards;
}
.practice-content-animate {
  animation: practice-modal-content 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
```

### E. End Game Outcome Modal
- Triggered when `status` is set to `'ended'` by setting `showResultModal` to `true`.
- Dynamically parses the final result (Win / Defeat / Draw) to display custom icons (Gold Trophy, Broken Crown, or Handshake).
- Direct buttons:
  - **Rematch**: Calls `startGame(playerColor)` and resets the board.
  - **Change Color**: Triggers setting status back to `'setup'`.
  - **Review Board / Close**: Closes the modal so the player can use the navigation buttons to analyze their final position.

---

## 3. Future Plans & Potential Roadmap
If you are asked to build further on this practice/analysis board, consider these potential additions:
1. **Engine Evaluation Gauge**: Show a dynamic evaluation bar (using Stockfish) on the side of the board during analysis mode when the bot is deactivated.
2. **Move Classification Badges**: Integrate the move quality indicators (e.g., Best Move, Book, Mistake, Blunder) similar to the Game Review screen.
3. **Practice Puzzles**: Generate chess puzzles dynamically from positions where the player made mistakes during their practice match.
