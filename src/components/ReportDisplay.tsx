import React, { useState, useEffect, useRef } from 'react';
import { ChessReport } from '../types/report';
import { reportService } from '../services/reportService';
import PositionDisplay from './PositionDisplay';
import { 
  User, 
  Calendar, 
  Trophy, 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  BookOpen,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Loader2,
  BarChart3,
  Search,
  ExternalLink,
} from 'lucide-react';

interface ReportDisplayProps {
  report: ChessReport;
  onBack: () => void;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, onBack }) => {
  // Debug: Check if report has FEN positions
  React.useEffect(() => {
    console.log('=== REPORT DISPLAY DEBUG ===');
    console.log('Report weaknesses count:', report.recurringWeaknesses.length);
    
    let totalExamplesInReport = 0;
    let examplesWithFenInReport = 0;
    
    report.recurringWeaknesses.forEach((weakness, wIndex) => {
      console.log(`Weakness ${wIndex + 1}: ${weakness.title}`);
      weakness.examples.forEach((example, eIndex) => {
        totalExamplesInReport++;
        console.log(`  Example ${eIndex + 1}: Game ${example.gameId}, Move ${example.moveNumber}, FEN: ${example.fenPosition ? 'Present' : 'Missing'}`);
        if (example.fenPosition) {
          examplesWithFenInReport++;
        }
      });
    });
    
    console.log(`Total examples in report: ${totalExamplesInReport}, With FEN: ${examplesWithFenInReport}`);
  }, [report]);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  // Helper function to get game number and opponent name
  const getGameAndOpponentInfo = (gameId: string): string => {
    const game = report.rawGameData.find(g => g.id === gameId);
    if (!game) return `Game ${gameId}`;
    
    // Find the game index (1-based) in the rawGameData array
    const gameIndex = report.rawGameData.findIndex(g => g.id === gameId) + 1;
    
    // Determine who was the opponent based on the user's name
    const opponentName = game.white.name.toLowerCase() === report.username.toLowerCase() 
      ? game.black.name 
      : game.white.name;
    
    return `Game ${gameIndex} vs ${opponentName}`;
  };

  const getGameById = (gameId: string): any | undefined => {
    return report.rawGameData.find(g => g.id === gameId) ||
      report.rawGameData.find(g => g.id?.includes(gameId) || gameId.includes(g.id));
  };

  const getPositionPly = (moveNumber: number, playerColor?: 'white' | 'black'): number => {
    const basePly = Math.max(0, (moveNumber - 1) * 2);
    return playerColor === 'black' ? basePly + 1 : basePly;
  };

  const getGamePositionUrl = (
    gameId: string,
    moveNumber: number,
    playerColor?: 'white' | 'black'
  ): string | null => {
    const game = getGameById(gameId);
    if (!game?.url) return null;

    const ply = getPositionPly(moveNumber, playerColor);
    const baseUrl = game.url.split('#')[0].split('?')[0];

    if (game.site === 'lichess') {
      return `${baseUrl}#${ply}`;
    }

    if (game.site === 'chess.com') {
      const analysisUrl = baseUrl.replace('/game/', '/analysis/game/');
      return `${analysisUrl}?tab=analysis&move=${ply}`;
    }

    return game.url;
  };

  // Helper function to generate elegant rating notation for PDF
  const getRatingNotation = (rating: number): string => {
    const filledDots = '●'.repeat(rating);
    const emptyDots = '○'.repeat(10 - rating);
    return `${filledDots}${emptyDots}`;
  };



  const exportReportAsPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExportingPDF(true);
    setShowExportDropdown(false);
    
    // Wait for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      await reportService.exportReportAsPDF(reportRef.current, report);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const exportReportAsPrintPDF = async () => {
    if (!reportRef.current) return;
    
    setIsExportingPDF(true);
    setShowExportDropdown(false);
    
    // Wait for the DOM to update
    await new Promise(resolve => setTimeout(resolve, 300));
    
    try {
      await reportService.exportReportAsPrintPDF(reportRef.current, report);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const shareReport = () => {
    if (navigator.share) {
      navigator.share({
        title: `Chess Report for ${report.username}`,
        text: `Check out my chess performance analysis! Win rate: ${report.executiveSummary.winRate}%`,
        url: window.location.href
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Report link copied to clipboard!');
    }
  };



  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f0f2f5', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
          
          .section-header {
            font-size: 1.125rem;
            font-weight: 800;
            color: #064e3b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
          }
          
          .section-header svg {
            margin-right: 0.75rem;
            color: #10b981;
          }
          
          .highlight-card {
            border: 1px solid #e5e7eb;
            border-radius: 0.5rem;
            padding: 1rem;
            text-align: center;
          }
          
          .checklist-item {
            display: flex;
            align-items: flex-start;
            padding: 0.75rem;
            border-radius: 0.5rem;
            background-color: #f8fafc;
            border: 1px solid #e5e7eb;
          }
          
          .move-code {
            font-family: monospace;
            background-color: #e5e7eb;
            padding: 2px 5px;
            border-radius: 4px;
            font-size: 0.9em;
          }
          
          .rating-bar-bg {
            background-color: #e5e7eb;
            border-radius: 9999px;
            height: 8px;
            overflow: hidden;
            width: 100%;
          }
          
          .rating-bar {
            background-color: #10b981;
            height: 100%;
            border-radius: 9999px;
          }
        `}
      </style>
      
      <div className="max-w-4xl mx-auto p-4">
        {/* Print Button Container */}
        <div className="flex justify-center mb-4 no-print">
          <div className="flex space-x-3">
            <button
              onClick={onBack}
              className="px-4 py-2 text-emerald-600 hover:text-emerald-800 font-medium"
            >
              ← Back to Generator
            </button>
            
            <button
              onClick={shareReport}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
            
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                className="flex items-center space-x-2 px-6 py-3 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 min-w-[180px] justify-center"
                style={{ 
                  backgroundColor: '#065f46',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#047857';
                  e.currentTarget.style.boxShadow = '0 7px 14px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#065f46';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
                disabled={isExportingPDF}
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
              
              {showExportDropdown && !isExportingPDF && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    <button
                      onClick={exportReportAsPDF}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>PDF (Screenshot)</span>
                    </button>
                    <button
                      onClick={exportReportAsPrintPDF}
                      className="flex items-center space-x-2 w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>PDF (Print Version)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Report Container */}
        <div 
          className="bg-white rounded-lg shadow-lg border-t-8 p-10" 
          style={{ 
            borderTopColor: '#064e3b',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.07)'
          }}
          ref={reportRef}
        >
          {/* Header */}
          <header className="flex justify-between items-start pb-4 mb-6 border-b border-gray-200">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-800">Performance Report</h1>
              <p className="text-md text-gray-500">Prepared by Pawnsposes</p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg text-gray-800">{report.username}</p>
              <p className="text-sm text-gray-500">{report.generatedAt.toLocaleDateString()}</p>
            </div>
          </header>

          {/* Tagline */}
          <div className="text-center italic text-gray-600 mb-8 font-medium">
            <p>"Built by a real master coach, not just a graph-spitting bot."</p>
            <p>"We don't just show you what's wrong — we train you to fix it."</p>
          </div>

          {/* Performance Summary */}
          <section className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <h2 className="section-header">
              <BarChart3 className="w-5 h-5" />
              Performance Summary
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="highlight-card bg-green-50 border-green-200">
                <h4 className="font-bold text-sm text-green-800">Win Rate</h4>
                <p className="text-2xl font-bold text-gray-700 mt-1">{report.executiveSummary.winRate}%</p>
              </div>
              <div className="highlight-card bg-blue-50 border-blue-200">
                <h4 className="font-bold text-sm text-blue-800">Average Accuracy</h4>
                <p className="text-2xl font-bold text-gray-700 mt-1">{report.executiveSummary.averageAccuracy}%</p>
              </div>
              <div className="highlight-card bg-yellow-50 border-yellow-200">
                <h4 className="font-bold text-sm text-yellow-800">Most Played</h4>
                <p className="text-lg font-bold text-gray-700 mt-1">
                  {report.executiveSummary.favoriteOpenings[0] || 'Various'}
                </p>
              </div>
              <div className="highlight-card bg-red-50 border-red-200">
                <h4 className="font-bold text-sm text-red-800">#1 Focus Area</h4>
                <p className="text-lg font-bold text-gray-700 mt-1">
                  {report.recurringWeaknesses[0]?.title.split(' ').slice(0, 2).join(' ') || 'Strategy'}
                </p>
              </div>
            </div>
            
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Key Insights:</h3>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {report.executiveSummary.keyInsights.map((insight, index) => (
                  <li key={index}>{insight}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* Deep Dive - Recurring Weaknesses */}
          <section className="mb-8">
            <h2 className="section-header">
              <Search className="w-5 h-5" />
              Recurring Weaknesses
            </h2>
            
            <div className="space-y-4">
              {report.recurringWeaknesses.slice(0, 3).map((weakness, index) => (
                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <h3 className="font-bold text-gray-800">{index + 1}. {weakness.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{weakness.description}</p>
                  
                  {weakness.examples && weakness.examples.length > 0 && (
                    <div className="mt-2 p-3 bg-white border-l-4 border-red-400 rounded">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">
                            vs. {getGameAndOpponentInfo(weakness.examples[0].gameId).split(' vs ')[1]} (Move {weakness.examples[0].moveNumber})
                          </p>
                          {getGamePositionUrl(
                            weakness.examples[0].gameId,
                            weakness.examples[0].moveNumber,
                            weakness.examples[0].playerColor
                          ) && (
                            <a
                              href={getGamePositionUrl(
                                weakness.examples[0].gameId,
                                weakness.examples[0].moveNumber,
                                weakness.examples[0].playerColor
                              ) || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
                            >
                              Open exact position
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <p className="text-xs text-gray-600 mb-2">
                            <strong>You played:</strong> <span className={`font-semibold ${weakness.examples[0].playerColor === 'white' ? 'text-gray-800' : 'text-gray-600'}`}>
                              {weakness.examples[0].playerColor === 'white' ? 'White' : 'Black'}
                            </span>
                          </p>
                          <p className="text-sm text-gray-700">
                            <strong>Mistake:</strong> {weakness.examples[0].mistake} <br/>
                            <strong>Better Plan:</strong> {weakness.examples[0].betterMove}
                          </p>
                        </div>
                        
                        {weakness.examples[0].fenPosition && (
                          <div className="flex justify-center lg:justify-end">
                            <PositionDisplay 
                              fen={weakness.examples[0].fenPosition}
                              lastMove={weakness.examples[0].lastMove}
                              fromSquare={weakness.examples[0].fromSquare}
                              toSquare={weakness.examples[0].toSquare}
                              title={`Position Analysis - ${weakness.examples[0].playerColor === 'white' ? 'White' : 'Black'} to move`}
                              size={200}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Phase Review */}
          <section className="mb-8">
            <h2 className="section-header">
              <Target className="w-5 h-5" />
              Phase Review
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Middlegame */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-3">
                  Middlegame <span className="text-gray-500 font-medium">(Overall: {report.middleGameAnalysis.overallRating}/10)</span>
                </h3>
                <div className="space-y-2 text-sm">
                  {Object.entries(report.middleGameAnalysis.patterns).slice(0, 4).map(([skill, rating]) => (
                    <div key={skill}>
                      <div className="flex justify-between items-center">
                        <span className="capitalize">{skill.replace(/([A-Z])/g, ' $1').trim()}</span>
                        <span>{rating}/10</span>
                      </div>
                      <div 
                        className="rating-bar-bg"
                        data-rating-display={`${rating}/10`}
                        data-rating-dots={getRatingNotation(rating)}
                        style={{ '--rating-percentage': `${(rating / 10) * 100}%` } as React.CSSProperties}
                      >
                        <div 
                          className="rating-bar" 
                          style={{ width: `${(rating / 10) * 100}%` }}
                          data-percentage={`${Math.round((rating / 10) * 100)}%`}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Endgame */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-3">
                  Endgame <span className="text-gray-500 font-medium">(Overall: {report.endgameAnalysis.overallRating}/10)</span>
                </h3>
                <div className="space-y-2 text-sm">
                  {report.endgameAnalysis.endgameTypes.slice(0, 3).map((endgame, index) => (
                    <div key={index}>
                      <div className="flex justify-between items-center">
                        <span>{endgame.type} ({endgame.gamesPlayed} games, {endgame.successRate}% success)</span>
                        <span>{endgame.performance}/10</span>
                      </div>
                      <div 
                        className="rating-bar-bg"
                        data-rating-display={`${endgame.performance}/10`}
                        data-rating-dots={getRatingNotation(endgame.performance)}
                        style={{ '--rating-percentage': `${(endgame.performance / 10) * 100}%` } as React.CSSProperties}
                      >
                        <div 
                          className="rating-bar" 
                          style={{ width: `${(endgame.performance / 10) * 100}%` }}
                          data-percentage={`${Math.round((endgame.performance / 10) * 100)}%`}
                        ></div>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 italic mt-3">
                    Common Mistakes: {report.endgameAnalysis.commonMistakes.slice(0, 2).join(', ')}.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Actionable Improvement Plan */}
          <section className="mb-8">
            <h2 className="section-header">
              <Target className="w-5 h-5" />
              Actionable Improvement Plan
            </h2>
            
            <div className="space-y-2">
              {report.improvementPlan.immediateActions.slice(0, 3).map((action, index) => (
                <div key={index} className="checklist-item">
                  <span className={`font-bold text-lg mr-4 ${
                    action.priority === 'high' ? 'text-red-600' :
                    action.priority === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {action.priority.toUpperCase()}
                  </span>
                  <div>
                    <strong className="font-semibold text-gray-800">{action.action}:</strong> {action.description}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recommended Resources */}
          <section>
            <h2 className="section-header">
              <BookOpen className="w-5 h-5" />
              Recommended Resources
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Master Game Study */}
              <div className="bg-gray-50 p-3 rounded-lg flex items-start border border-gray-200">
                <svg className="w-5 h-5 text-emerald-600 mr-4 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-800">Master Game Study</h4>
                  <p className="text-sm text-gray-600">
                    <strong>{report.improvementPlan.resources.masterGame.players}:</strong> {report.improvementPlan.resources.masterGame.description}
                    {report.improvementPlan.resources.masterGame.keyMoves && (
                      <>
                        {' '}Study moves <code className="move-code">{report.improvementPlan.resources.masterGame.keyMoves.split(',')[0]}</code>
                        {report.improvementPlan.resources.masterGame.keyMoves.split(',')[1] && (
                          <>, <code className="move-code">{report.improvementPlan.resources.masterGame.keyMoves.split(',')[1]}</code></>
                        )}
                        .
                      </>
                    )}
                  </p>
                </div>
              </div>
              
              {/* YouTube Video */}
              <div className="bg-gray-50 p-3 rounded-lg flex items-start border border-gray-200">
                <svg className="w-5 h-5 text-red-600 mr-4 mt-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                <div>
                  <h4 className="font-semibold text-gray-800">Watch This</h4>
                  <p className="text-sm text-gray-600">
                    <strong>"{report.improvementPlan.resources.recommendedVideo.title}" by {report.improvementPlan.resources.recommendedVideo.channel}:</strong> {report.improvementPlan.resources.recommendedVideo.description}
                  </p>
                </div>
              </div>
              
              {/* Books */}
              <div className="bg-gray-50 p-3 rounded-lg flex items-start border border-gray-200 col-span-1 md:col-span-2">
                <BookOpen className="w-5 h-5 text-emerald-600 mr-4 mt-1" />
                <div>
                  <h4 className="font-semibold text-gray-800">Books for Deeper Study</h4>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    <li><strong>My System</strong> by Aron Nimzowitsch</li>
                    <li><strong>Silman's Endgame Course</strong> by Jeremy Silman</li>
                    <li><strong>Pawn Power in Chess</strong> by Hans Kmoch</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
          
          {/* Footer */}
          <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
            <p>This report was generated by Pawnsposes. © 2025</p>
          </footer>
        </div>
      </div>
    </div>
  );
};

export default ReportDisplay;
