import React from 'react';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  RotateCcw,
  SkipBack,
  SkipForward,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface ChessboardControlsProps {
  boardOrientation: 'white' | 'black';
  onFlipOrientation: () => void;
  onReset?: () => void;
  onUndo?: () => void;
  onPrevMove?: () => void;
  onNextMove?: () => void;
  onFirstMove?: () => void;
  onLastMove?: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  sideToMove?: 'white' | 'black' | 'w' | 'b';
  isMuted?: boolean;
  onToggleMute?: () => void;
  className?: string;
}

export const ChessboardControls: React.FC<ChessboardControlsProps> = ({
  boardOrientation,
  onFlipOrientation,
  onReset,
  onUndo,
  onPrevMove,
  onNextMove,
  onFirstMove,
  onLastMove,
  canGoBack = false,
  canGoForward = false,
  sideToMove,
  isMuted,
  onToggleMute,
  className = '',
}) => {
  const normalizedSide =
    sideToMove === 'w' ? 'white' : sideToMove === 'b' ? 'black' : sideToMove;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 pt-2 ${className}`}
    >
      {/* Turn indicator pill matching mockup */}
      {normalizedSide && (
        <div className="inline-flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div
            className={`flex h-6 w-6 items-center justify-center rounded-full border shadow-xs ${
              normalizedSide === 'white'
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-slate-900 border-slate-700 text-slate-100'
            }`}
          >
            <Crown className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
            {normalizedSide === 'white' ? 'White to move' : 'Black to move'}
          </span>
        </div>
      )}

      {/* Navigation & Controls matching mockup */}
      <div className="flex items-center gap-2 ml-auto">
        {onFirstMove && (
          <button
            type="button"
            onClick={onFirstMove}
            disabled={!canGoBack}
            aria-label="First move"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <SkipBack className="h-4 w-4" />
          </button>
        )}

        {onPrevMove && (
          <button
            type="button"
            onClick={onPrevMove}
            disabled={!canGoBack}
            aria-label="Previous move"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}

        {onNextMove && (
          <button
            type="button"
            onClick={onNextMove}
            disabled={!canGoForward}
            aria-label="Next move"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {onLastMove && (
          <button
            type="button"
            onClick={onLastMove}
            disabled={!canGoForward}
            aria-label="Last move"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        )}

        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            title="Undo move"
            aria-label="Undo move"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs"
          >
            <Undo2 className="h-4 w-4" />
          </button>
        )}

        {onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Reset position"
            aria-label="Reset position"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onFlipOrientation}
          title={`Flip board (currently ${boardOrientation})`}
          aria-label="Flip board orientation"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs"
        >
          <ArrowUpDown className="h-4 w-4" />
        </button>

        {onToggleMute && (
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
            aria-label="Toggle chess sounds"
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors shadow-xs"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
