import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { PieceDropHandlerArgs, PieceHandlerArgs, SquareHandlerArgs } from 'react-chessboard';
import {
  BOARD_DARK,
  BOARD_LIGHT,
  BoardLastMove,
  HOVER_LEGAL_TINT,
  LAST_MOVE_TINT,
  LEGAL_CAPTURE_RING,
  LEGAL_MOVE_DOT,
  SELECTED_SQUARE_TINT,
  getLegalTargets,
  sideToMoveFromFen,
} from '../utils/chessboardTheme';

type UseChessboardInteractionOptions = {
  fen: string;
  enabled?: boolean;
  lastMove?: BoardLastMove | null;
  /** Extra square tints painted after last-move / selection (e.g. wrong-move flash). */
  extraSquareStyles?: Record<string, React.CSSProperties>;
  onMove: (from: string, to: string) => boolean;
};

export function useChessboardInteraction({
  fen,
  enabled = true,
  lastMove = null,
  extraSquareStyles,
  onMove,
}: UseChessboardInteractionOptions) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [hoverSquare, setHoverSquare] = useState<string | null>(null);
  const suppressClickRef = useRef(false);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  const sideToMove = useMemo(() => sideToMoveFromFen(fen), [fen]);

  const legalTargets = useMemo(
    () => (selectedSquare && enabled ? getLegalTargets(fen, selectedSquare) : []),
    [enabled, fen, selectedSquare]
  );

  const legalTargetSet = useMemo(
    () => new Set(legalTargets.map((target) => target.to)),
    [legalTargets]
  );

  useEffect(() => {
    setSelectedSquare(null);
    setHoverSquare(null);
  }, [fen]);

  const clearSelection = useCallback(() => {
    setSelectedSquare(null);
    setHoverSquare(null);
  }, []);

  const selectSquare = useCallback(
    (square: string) => {
      if (!enabled) {
        clearSelection();
        return;
      }

      try {
        const chess = new Chess(fen);
        const piece = chess.get(square as Square);
        if (!piece || piece.color !== sideToMove) {
          clearSelection();
          return;
        }
        setSelectedSquare(square);
      } catch {
        clearSelection();
      }
    },
    [clearSelection, enabled, fen, sideToMove]
  );

  const applyMove = useCallback(
    (from: string, to: string): boolean => {
      if (!enabled || from === to) return false;
      const accepted = onMoveRef.current(from, to);
      if (accepted) clearSelection();
      return accepted;
    },
    [clearSelection, enabled]
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      if (!enabled) return false;

      if (!targetSquare || targetSquare === sourceSquare) {
        selectSquare(sourceSquare);
        return false;
      }
      return applyMove(sourceSquare, targetSquare);
    },
    [applyMove, enabled, selectSquare]
  );

  const handleSquareClick = useCallback(
    ({ square, piece }: SquareHandlerArgs) => {
      if (suppressClickRef.current || !enabled) return;

      if (selectedSquare) {
        if (square === selectedSquare) {
          clearSelection();
          return;
        }
        if (legalTargetSet.has(square)) {
          applyMove(selectedSquare, square);
          return;
        }
        if (piece && piece.pieceType.startsWith(sideToMove)) {
          selectSquare(square);
          return;
        }
        clearSelection();
        return;
      }

      if (piece && piece.pieceType.startsWith(sideToMove)) {
        selectSquare(square);
      }
    },
    [
      applyMove,
      clearSelection,
      enabled,
      legalTargetSet,
      selectSquare,
      selectedSquare,
      sideToMove,
    ]
  );

  const handlePieceDrag = useCallback(
    ({ square }: PieceHandlerArgs) => {
      if (square && enabled) selectSquare(square);
    },
    [enabled, selectSquare]
  );

  const handleMouseOverSquare = useCallback(
    ({ square }: SquareHandlerArgs) => {
      if (selectedSquare && legalTargetSet.has(square)) {
        setHoverSquare(square);
      } else {
        setHoverSquare(null);
      }
    },
    [legalTargetSet, selectedSquare]
  );

  const handleMouseOutSquare = useCallback(() => {
    setHoverSquare(null);
  }, []);

  const canDragPiece = useCallback(
    ({ piece }: PieceHandlerArgs) => {
      if (!enabled) return false;
      const color = piece.pieceType.startsWith('w') ? 'w' : 'b';
      return color === sideToMove;
    },
    [enabled, sideToMove]
  );

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove) {
      styles[lastMove.from] = {
        ...styles[lastMove.from],
        backgroundColor: LAST_MOVE_TINT,
      };
      styles[lastMove.to] = {
        ...styles[lastMove.to],
        backgroundColor: lastMove.toTint || LAST_MOVE_TINT,
      };
    }

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: SELECTED_SQUARE_TINT,
      };
    }

    legalTargets.forEach(({ to, isCapture }) => {
      const existing = styles[to] || {};
      if (hoverSquare === to) {
        styles[to] = {
          ...existing,
          backgroundColor: HOVER_LEGAL_TINT,
          backgroundImage: 'none',
          cursor: 'pointer',
        };
        return;
      }

      styles[to] = {
        ...existing,
        backgroundImage: isCapture ? LEGAL_CAPTURE_RING : LEGAL_MOVE_DOT,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        cursor: 'pointer',
      };
    });

    if (extraSquareStyles) {
      Object.entries(extraSquareStyles).forEach(([square, style]) => {
        styles[square] = { ...styles[square], ...style };
      });
    }

    return styles;
  }, [extraSquareStyles, hoverSquare, lastMove, legalTargets, selectedSquare]);

  const boardOptions = useMemo(
    () => ({
      position: fen,
      allowDragging: enabled,
      allowDragOffBoard: false,
      dragActivationDistance: 2,
      animationDurationInMs: 200,
      showAnimations: true,
      canDragPiece,
      onPieceDrag: handlePieceDrag,
      onPieceDrop: handlePieceDrop,
      onSquareClick: handleSquareClick,
      onMouseOverSquare: handleMouseOverSquare,
      onMouseOutSquare: handleMouseOutSquare,
      showNotation: true,
      squareStyles,
      lightSquareStyle: { backgroundColor: BOARD_LIGHT },
      darkSquareStyle: { backgroundColor: BOARD_DARK },
      lightSquareNotationStyle: { color: BOARD_DARK },
      darkSquareNotationStyle: { color: BOARD_LIGHT },
      dropSquareStyle: {
        backgroundColor: HOVER_LEGAL_TINT,
        boxShadow: 'none',
      },
      draggingPieceStyle: {
        transform: 'scale(1.05)',
        filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.28))',
        cursor: 'grabbing' as const,
      },
      draggingPieceGhostStyle: {
        opacity: 0.35,
      },
      boardStyle: {
        borderRadius: '2px',
        width: '100%',
        height: '100%',
        cursor: selectedSquare ? ('pointer' as const) : ('default' as const),
      },
    }),
    [
      canDragPiece,
      enabled,
      fen,
      handleMouseOutSquare,
      handleMouseOverSquare,
      handlePieceDrag,
      handlePieceDrop,
      handleSquareClick,
      selectedSquare,
      squareStyles,
    ]
  );

  return {
    selectedSquare,
    sideToMove,
    clearSelection,
    boardOptions,
  };
}
