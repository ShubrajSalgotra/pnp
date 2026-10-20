import React, { useMemo } from 'react';
import { Chessboard, type Arrow } from 'react-chessboard';
import { Chess } from 'chess.js';
import {
  HOVER_LEGAL_TINT,
  LAST_MOVE_TINT,
  LEGAL_CAPTURE_RING,
  LEGAL_MOVE_DOT,
  SELECTED_SQUARE_TINT,
} from '../../utils/chessboardTheme';

export type ChessArrow = Arrow | [string, string, string?];

export interface ChessboardViewProps {
  fen: string;
  boardOrientation?: 'white' | 'black';
  isInteractive?: boolean;
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean;
  onSquareClick?: (square: string) => void;
  lastMove?: { from: string; to: string; toTint?: string } | null;
  selectedSquare?: string | null;
  legalTargets?: Array<{ to: string; isCapture?: boolean }>;
  customSquareStyles?: Record<string, React.CSSProperties>;
  customArrows?: ChessArrow[];
  showNotation?: boolean;
  showExternalCoordinates?: boolean;
  animationDuration?: number;
  theme?: 'purple' | 'forest' | 'wood' | 'classic' | 'gold';
  className?: string;
  autoCheckHighlight?: boolean;
  isLoading?: boolean;
}

export const ChessboardView: React.FC<ChessboardViewProps> = ({
  fen,
  boardOrientation = 'white',
  isInteractive = true,
  onPieceDrop,
  onSquareClick,
  lastMove = null,
  selectedSquare = null,
  legalTargets = [],
  customSquareStyles = {},
  customArrows = [],
  showNotation = true,
  showExternalCoordinates = false,
  animationDuration = 200,
  theme = 'purple',
  className = '',
  autoCheckHighlight = true,
  isLoading = false,
}) => {
  // Determine square colors based on theme
  const { lightColor, darkColor } = useMemo(() => {
    switch (theme) {
      case 'purple':
        return { lightColor: '#9ea4f6', darkColor: '#554de0' };
      case 'forest':
        return { lightColor: '#dee7d9', darkColor: '#2d6a4f' };
      case 'wood':
        return { lightColor: '#f0d9b5', darkColor: '#b58863' };
      case 'gold':
        return { lightColor: '#fef3c7', darkColor: '#854d0e' };
      case 'classic':
      default:
        return { lightColor: '#eeeed2', darkColor: '#769656' };
    }
  }, [theme]);

  // Normalize arrows to react-chessboard Arrow[] format
  const normalizedArrows = useMemo((): Arrow[] => {
    return customArrows.map((arrow): Arrow => {
      if (Array.isArray(arrow)) {
        return {
          startSquare: arrow[0],
          endSquare: arrow[1],
          color: arrow[2] || 'rgba(255, 170, 0, 0.8)',
        };
      }
      return {
        startSquare: arrow.startSquare,
        endSquare: arrow.endSquare,
        color: arrow.color || 'rgba(255, 170, 0, 0.8)',
      };
    });
  }, [customArrows]);

  // Find checked king if king is in check
  const inCheckSquare = useMemo(() => {
    if (!autoCheckHighlight) return null;
    try {
      const chess = new Chess(fen);
      if (chess.inCheck()) {
        const turn = chess.turn();
        // Locate king of side to move
        const board = chess.board();
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.type === 'k' && piece.color === turn) {
              return piece.square;
            }
          }
        }
      }
    } catch {
      // ignore invalid fen
    }
    return null;
  }, [autoCheckHighlight, fen]);

  // Build merged square styles
  const computedSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    // 1. Last move highlights
    if (lastMove) {
      const defaultTint =
        theme === 'purple' ? 'rgba(244, 114, 182, 0.6)' : LAST_MOVE_TINT;
      const highlightTint = lastMove.toTint || defaultTint;
      const pinkGlow =
        theme === 'purple' ? 'inset 0 0 12px rgba(244, 114, 182, 0.85)' : undefined;

      if (lastMove.from) {
        styles[lastMove.from] = {
          backgroundColor: defaultTint,
          boxShadow: pinkGlow,
        };
      }
      if (lastMove.to) {
        styles[lastMove.to] = {
          backgroundColor: highlightTint,
          boxShadow: pinkGlow,
        };
      }
    }

    // 2. Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...(styles[selectedSquare] || {}),
        backgroundColor: SELECTED_SQUARE_TINT,
      };
    }

    // 3. Legal move targets
    legalTargets.forEach(({ to, isCapture }) => {
      styles[to] = {
        ...(styles[to] || {}),
        backgroundImage: isCapture ? LEGAL_CAPTURE_RING : LEGAL_MOVE_DOT,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        cursor: 'pointer',
      };
    });

    // 4. In-check king glow
    if (inCheckSquare) {
      styles[inCheckSquare] = {
        ...(styles[inCheckSquare] || {}),
        backgroundColor: 'rgba(239, 68, 68, 0.85)',
        boxShadow:
          '0 0 24px 8px rgba(239, 68, 68, 0.95), inset 0 0 16px rgba(239, 68, 68, 0.95)',
      };
    }

    // 5. Custom overrides
    Object.entries(customSquareStyles).forEach(([square, style]) => {
      styles[square] = {
        ...(styles[square] || {}),
        ...style,
      };
    });

    return styles;
  }, [customSquareStyles, inCheckSquare, lastMove, legalTargets, selectedSquare, theme]);

  const handleDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string | null;
  }) => {
    if (!isInteractive || !onPieceDrop || !targetSquare) return false;
    return onPieceDrop(sourceSquare, targetSquare);
  };

  const handleSquare = ({ square }: { square: string }) => {
    if (!isInteractive || !onSquareClick) return;
    onSquareClick(square);
  };

  const ranks =
    boardOrientation === 'white'
      ? ['8', '7', '6', '5', '4', '3', '2', '1']
      : ['1', '2', '3', '4', '5', '6', '7', '8'];
  const files =
    boardOrientation === 'white'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const boardContent = (
    <div className="relative h-full w-full rounded-2xl overflow-hidden review-chessboard shadow-2xl ring-1 ring-white/10">
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          allowDragging: isInteractive,
          allowDragOffBoard: false,
          dragActivationDistance: 2,
          animationDurationInMs: animationDuration,
          showAnimations: true,
          showNotation,
          squareStyles: computedSquareStyles,
          arrows: normalizedArrows,
          lightSquareStyle: { backgroundColor: lightColor },
          darkSquareStyle: { backgroundColor: darkColor },
          lightSquareNotationStyle: {
            color: darkColor,
            fontWeight: 700,
            fontSize: '0.72rem',
          },
          darkSquareNotationStyle: {
            color: lightColor,
            fontWeight: 700,
            fontSize: '0.72rem',
          },
          dropSquareStyle: {
            backgroundColor: HOVER_LEGAL_TINT,
            boxShadow: 'none',
          },
          draggingPieceStyle: {
            transform: 'scale(1.08)',
            filter: 'drop-shadow(0 10px 16px rgba(0, 0, 0, 0.35))',
            cursor: 'grabbing',
          },
          boardStyle: {
            borderRadius: '1rem',
            width: '100%',
            height: '100%',
            touchAction: 'none',
          },
          onPieceDrop: handleDrop,
          onSquareClick: handleSquare,
        }}
      />

      {isLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-800 shadow-md dark:bg-slate-900/90 dark:text-slate-100">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" />
            <span>Loading position…</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`relative mx-auto w-full select-none max-w-[560px] ${className}`}>
      {showExternalCoordinates ? (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-stretch w-full">
            <div className="flex flex-col justify-around h-full w-5 sm:w-6 pr-1.5 select-none text-slate-400 font-semibold text-xs sm:text-sm">
              {ranks.map((rank) => (
                <span key={rank} className="flex aspect-square items-center justify-center">
                  {rank}
                </span>
              ))}
            </div>
            <div className="relative flex-1 aspect-square">{boardContent}</div>
          </div>
          <div className="flex w-full pl-5 sm:pl-6 pt-2 select-none text-slate-400 font-semibold text-xs sm:text-sm">
            {files.map((file) => (
              <span key={file} className="flex-1 text-center">
                {file}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="relative aspect-square w-full">{boardContent}</div>
      )}
    </div>
  );
};
