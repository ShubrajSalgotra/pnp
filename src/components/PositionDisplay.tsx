import React, { useEffect, useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

interface PositionDisplayProps {
  fen: string;
  title?: string;
  size?: number;
  lastMove?: string;
  fromSquare?: string;
  toSquare?: string;
}

const PositionDisplay: React.FC<PositionDisplayProps> = ({ 
  fen, 
  title, 
  size = 280,
  lastMove,
  fromSquare,
  toSquare
}) => {
  useEffect(() => {
    console.log('PositionDisplay mounted with FEN:', fen);
    console.log('Title:', title);
    console.log('Last Move:', lastMove);
    console.log('From Square:', fromSquare);
    console.log('To Square:', toSquare);
  }, [fen, title, lastMove, fromSquare, toSquare]);

  // Calculate highlight squares for the last move
  const highlightSquares = useMemo(() => {
    console.log('Calculating highlight squares:', { fromSquare, toSquare, lastMove });
    
    if (!fromSquare || !toSquare) {
      console.log('No fromSquare or toSquare, no highlighting');
      return {};
    }

    const squares = {
      [fromSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' },
      [toSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.5)' }
    };
    
    console.log('Highlighting squares:', squares);
    return squares;
  }, [fromSquare, toSquare]);

  return (
    <div className="flex flex-col items-center">
      {title && (
        <h4 className="text-sm font-medium text-gray-700 mb-2 text-center">{title}</h4>
      )}
      <div 
        className="border border-gray-300 rounded-lg overflow-hidden shadow-sm"
        style={{ width: size, height: size }}
      >
        <Chessboard
          options={{
            position: fen,
            boardOrientation: 'white',
            allowDragging: false,
            squareStyles: highlightSquares,
            boardStyle: {
              borderRadius: '4px',
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
            }
          }}
        />
      </div>
    </div>
  );
};

export default PositionDisplay;