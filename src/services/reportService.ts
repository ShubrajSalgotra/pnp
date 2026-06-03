import { gameImportService } from './gameImport';
import { geminiService } from './geminiService';
import { fenExtractor } from '../utils/fenExtractor';
import { 
  ChessReport, 
  GameReportRequest, 
  ReportGenerationProgress,
  ReportGenerationError 
} from '../types/report';
import { ChessGame } from '../types/game';
// Using browser's native print functionality for PDF export
// ChessGame imported via ChessReport type

class ReportService {
  private progressCallback?: (progress: ReportGenerationProgress) => void;

  setProgressCallback(callback: (progress: ReportGenerationProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: ReportGenerationProgress['stage'], message: string, progress: number) {
    if (this.progressCallback) {
      this.progressCallback({ stage, message, progress });
    }
  }

  async generateReport(request: GameReportRequest): Promise<ChessReport> {
    try {
      // Validate input
      if (!request.username || !request.platform || !request.gameCount) {
        throw new ReportGenerationError(
          'Invalid request parameters',
          'INVALID_INPUT'
        );
      }

      if (request.gameCount > 100) {
        throw new ReportGenerationError(
          'Maximum 100 games can be analyzed at once',
          'INVALID_INPUT'
        );
      }

      // Step 1: Fetch games
      this.updateProgress('fetching', 'Fetching games from chess platform...', 10);
      
      const importResponse = await gameImportService.importGames({
        platform: request.platform,
        username: request.username,
        count: request.gameCount,
        rated: request.rated
      });

      if (!importResponse.games || importResponse.games.length === 0) {
        throw new ReportGenerationError(
          'No games found for the specified user',
          'FETCH_ERROR'
        );
      }

      const games = importResponse.games;
      this.updateProgress('fetching', `Fetched ${games.length} games successfully`, 20);

      // Extract FEN positions from all games for report generation
      console.log('🔍 [REPORT GENERATION] Starting FEN extraction for report...');
      console.log(`📊 [REPORT GENERATION] Processing ${games.length} games for user: ${request.username}`);
      
      const allGamesFenData = fenExtractor.extractAllGamesPositions(games, request.username);
      
      // Display comprehensive FEN data in console
      console.log('🎯 [REPORT GENERATION] === COMPLETE FEN EXTRACTION RESULTS ===');
      console.log('📈 [REPORT GENERATION] Summary:', {
        username: allGamesFenData.username,
        totalGames: allGamesFenData.totalGames,
        extractedAt: allGamesFenData.extractedAt,
        totalPositions: allGamesFenData.games.reduce((sum, game) => sum + game.positions.length, 0)
      });
      
      // Display detailed JSON for each game
      allGamesFenData.games.forEach((gameData, index) => {
        console.log(`🏆 [REPORT GENERATION] Game ${index + 1} (${gameData.gameId}):`);
        console.log(`🎯 [REPORT GENERATION] Game Info:`, gameData.gameInfo);
        console.log(`📍 [REPORT GENERATION] Total Positions: ${gameData.positions.length}`);
        console.log(`⚡ [REPORT GENERATION] User Color: ${gameData.userColor}`);
        console.log(`🎮 [REPORT GENERATION] Full Game Positions (JSON):`, JSON.stringify(gameData, null, 2));
      });
      
      // Extract and display user's move positions for analysis
      const userMovePositions = fenExtractor.getUserMovePositions(allGamesFenData);
      console.log('👤 [REPORT GENERATION] === USER MOVE POSITIONS FOR ANALYSIS ===');
      console.log(`🎯 [REPORT GENERATION] Found ${userMovePositions.length} positions where user made moves`);
      console.log('📊 [REPORT GENERATION] User Move Positions (JSON):', JSON.stringify(userMovePositions, null, 2));
      
      // Extract positions before user moves (for alternative move suggestions)
      const analysisPositions = fenExtractor.getPositionsBeforeUserMoves(allGamesFenData);
      console.log('🔍 [REPORT GENERATION] === POSITIONS BEFORE USER MOVES (FOR ANALYSIS) ===');
      console.log(`🎯 [REPORT GENERATION] Found ${analysisPositions.length} positions before user moves`);
      console.log('🧠 [REPORT GENERATION] Analysis Positions (JSON):', JSON.stringify(analysisPositions, null, 2));
      
      // Sample display of first few positions with FEN strings
      if (analysisPositions.length > 0) {
        console.log('📋 [REPORT GENERATION] === SAMPLE ANALYSIS POSITIONS ===');
        analysisPositions.slice(0, 5).forEach((pos, index) => {
          console.log(`🎯 [REPORT GENERATION] Sample ${index + 1}:`);
          console.log(`  🏆 Game: ${pos.gameId}`);
          console.log(`  🎲 Move: ${pos.moveNumber}`);
          console.log(`  ⚡ User played: ${pos.userMove} as ${pos.userColor}`);
          console.log(`  📍 Position before move (FEN): ${pos.positionBeforeMove}`);
          console.log('---');
        });
      }
      
      console.log('✅ [REPORT GENERATION] FEN extraction completed successfully!');
      console.log('🎯 [REPORT GENERATION] This data is available for enhanced Gemini analysis');

      // Step 2: Generate Executive Summary
      this.updateProgress('analyzing', 'Generating executive summary...', 30);
      const executiveSummary = await geminiService.generateExecutiveSummary(games, request.username);
      this.updateProgress('analyzing', 'Executive summary generated', 40);

      // Step 3: Identify Recurring Weaknesses
      this.updateProgress('analyzing', 'Analyzing recurring weaknesses...', 50);
      const recurringWeaknesses = await geminiService.generateRecurringWeaknesses(games, request.username);
      this.updateProgress('analyzing', 'Recurring weaknesses identified', 60);

      // Step 4: Analyze Middlegame
      this.updateProgress('analyzing', 'Analyzing middlegame patterns...', 70);
      const middleGameAnalysis = await geminiService.generateMiddleGameAnalysis(games, request.username);
      this.updateProgress('analyzing', 'Middlegame analysis complete', 80);

      // Step 5: Analyze Endgame
      this.updateProgress('analyzing', 'Analyzing endgame performance...', 85);
      const endgameAnalysis = await geminiService.generateEndgameAnalysis(games, request.username);
      this.updateProgress('analyzing', 'Endgame analysis complete', 90);

      // Step 6: Generate Improvement Plan
      this.updateProgress('generating', 'Creating personalized improvement plan...', 95);
      const improvementPlan = await geminiService.generateImprovementPlan(
        games,
        request.username,
        recurringWeaknesses,
        middleGameAnalysis,
        endgameAnalysis
      );

      // Step 7: Compile final report
      this.updateProgress('generating', 'Compiling final report...', 98);
      
      const report: ChessReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: '', // Will be set by the calling component
        username: request.username,
        platform: request.platform,
        gameCount: games.length,
        generatedAt: new Date(),
        executiveSummary,
        recurringWeaknesses,
        middleGameAnalysis,
        endgameAnalysis,
        improvementPlan,
        rawGameData: games
      };

      this.updateProgress('complete', 'Report generation completed successfully!', 100);
      
      return report;

    } catch (error) {
      console.error('Error generating report:', error);
      
      let errorMessage = 'An unexpected error occurred';
      let errorCode: ReportGenerationError['code'] = 'ANALYSIS_ERROR';
      
      if (error instanceof ReportGenerationError) {
        errorMessage = error.message;
        errorCode = error.code;
        
        // Provide more user-friendly messages for temporary rate limiting without hiding quota/billing issues.
        if (error.code === 'RATE_LIMIT' && !error.message.toLowerCase().includes('quota')) {
          errorMessage = 'The AI service is currently experiencing high demand. Please wait a few minutes and try again.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.updateProgress('error', errorMessage, 0);
      
      throw new ReportGenerationError(errorMessage, errorCode, error);
    }
  }

  async validateUserExists(platform: 'lichess' | 'chess.com', username: string): Promise<boolean> {
    try {
      return await gameImportService.validateUsername(platform, username);
    } catch (error) {
      console.error('Error validating username:', error);
      return false;
    }
  }

  // Helper method to estimate report generation time
  estimateGenerationTime(gameCount: number): number {
    // Base time: 30 seconds
    // Additional time: 2 seconds per game
    // AI processing: 60 seconds
    return 30 + (gameCount * 2) + 60;
  }

  async generateReportFromGamesWithUnifiedPrompts(
    request: GameReportRequest,
    games: ChessGame[]
  ): Promise<ChessReport> {
    try {
      if (!request.username || !request.platform || !request.gameCount) {
        throw new ReportGenerationError('Invalid request parameters', 'INVALID_INPUT');
      }

      if (!games || games.length === 0) {
        throw new ReportGenerationError('No games found for the specified user', 'FETCH_ERROR');
      }

      console.log(`[REPORT SERVICE] Loaded ${games.length} cached/imported games for unified prompts`);
      this.updateProgress('fetching', `Loaded ${games.length} games successfully`, 20);

      const allGamesFenData = fenExtractor.extractAllGamesPositions(games, request.username);
      const analysisPositions = fenExtractor.getPositionsBeforeUserMoves(allGamesFenData);
      console.log(`[UNIFIED REPORT] Prepared ${analysisPositions.length} positions before user moves`);

      this.updateProgress('analyzing', 'Generating executive summary (unified prompt)...', 30);
      const executiveSummary = await geminiService.generateUnifiedExecutiveSummary(games, request.username);
      this.updateProgress('analyzing', 'Executive summary generated', 35);

      this.updateProgress('analyzing', 'Analyzing weaknesses, middlegame, and endgame (unified prompt)...', 40);
      const unifiedAnalysis = await geminiService.generateUnifiedAnalysis(games, request.username);
      this.updateProgress('analyzing', 'Core analysis complete', 75);

      this.updateProgress('generating', 'Creating personalized improvement plan...', 85);
      const improvementPlan = await geminiService.generateImprovementPlan(
        games,
        request.username,
        unifiedAnalysis.recurringWeaknesses,
        unifiedAnalysis.middlegameAnalysis,
        unifiedAnalysis.endgameAnalysis
      );

      this.updateProgress('generating', 'Compiling final report...', 95);

      const report: ChessReport = {
        id: `unified_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: '',
        username: request.username,
        platform: request.platform,
        gameCount: games.length,
        generatedAt: new Date(),
        executiveSummary,
        recurringWeaknesses: unifiedAnalysis.recurringWeaknesses,
        middleGameAnalysis: unifiedAnalysis.middlegameAnalysis,
        endgameAnalysis: unifiedAnalysis.endgameAnalysis,
        improvementPlan,
        rawGameData: games
      };

      this.updateProgress('complete', 'Report generation completed successfully!', 100);
      return report;
    } catch (error) {
      console.error('Error generating unified report from games:', error);

      let errorMessage = 'An unexpected error occurred';
      let errorCode: ReportGenerationError['code'] = 'ANALYSIS_ERROR';

      if (error instanceof ReportGenerationError) {
        errorMessage = error.message;
        errorCode = error.code;

        if (error.code === 'RATE_LIMIT' && !error.message.toLowerCase().includes('quota')) {
          errorMessage = 'The AI service is currently experiencing high demand. Please wait a few minutes and try again.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.updateProgress('error', errorMessage, 0);
      throw new ReportGenerationError(errorMessage, errorCode, error);
    }
  }

  // NEW: Test method using unified prompts - hybrid approach
  async generateReportWithUnifiedPrompts(request: GameReportRequest): Promise<ChessReport> {
    try {
      // Validate input
      if (!request.username || !request.platform || !request.gameCount) {
        throw new ReportGenerationError(
          'Invalid request parameters',
          'INVALID_INPUT'
        );
      }

      if (request.gameCount > 100) {
        throw new ReportGenerationError(
          'Maximum 100 games can be analyzed at once',
          'INVALID_INPUT'
        );
      }

      // Step 1: Fetch games
      this.updateProgress('fetching', 'Fetching games from chess platform...', 10);
      
      const importResponse = await gameImportService.importGames({
        platform: request.platform,
        username: request.username,
        count: request.gameCount,
        rated: request.rated
      });

      if (!importResponse.games || importResponse.games.length === 0) {
        throw new ReportGenerationError(
          'No games found for the specified user',
          'FETCH_ERROR'
        );
      }

      const games = importResponse.games;
      console.log(`[REPORT SERVICE] Loaded ${games.length} games for unified prompts`);
      console.log(`[REPORT SERVICE] Sample game IDs:`, games.slice(0, 3).map(g => g.id));
      this.updateProgress('fetching', `Fetched ${games.length} games successfully`, 20);

      // Extract FEN positions from all games for unified report generation
      console.log('🔍 [UNIFIED REPORT] Starting FEN extraction for unified report...');
      console.log(`📊 [UNIFIED REPORT] Processing ${games.length} games for user: ${request.username}`);
      
      const allGamesFenData = fenExtractor.extractAllGamesPositions(games, request.username);
      
      // Display comprehensive FEN data in console
      console.log('🎯 [UNIFIED REPORT] === COMPLETE FEN EXTRACTION RESULTS ===');
      console.log('📈 [UNIFIED REPORT] Summary:', {
        username: allGamesFenData.username,
        totalGames: allGamesFenData.totalGames,
        extractedAt: allGamesFenData.extractedAt,
        totalPositions: allGamesFenData.games.reduce((sum, game) => sum + game.positions.length, 0)
      });
      
      // Display detailed JSON for each game
      allGamesFenData.games.forEach((gameData, index) => {
        console.log(`🏆 [UNIFIED REPORT] Game ${index + 1} (${gameData.gameId}):`);
        console.log(`🎯 [UNIFIED REPORT] Game Info:`, gameData.gameInfo);
        console.log(`📍 [UNIFIED REPORT] Total Positions: ${gameData.positions.length}`);
        console.log(`⚡ [UNIFIED REPORT] User Color: ${gameData.userColor}`);
        console.log(`🎮 [UNIFIED REPORT] Full Game Positions (JSON):`, JSON.stringify(gameData, null, 2));
      });
      
      // Extract and display user's move positions for analysis
      const userMovePositions = fenExtractor.getUserMovePositions(allGamesFenData);
      console.log('👤 [UNIFIED REPORT] === USER MOVE POSITIONS FOR ANALYSIS ===');
      console.log(`🎯 [UNIFIED REPORT] Found ${userMovePositions.length} positions where user made moves`);
      console.log('📊 [UNIFIED REPORT] User Move Positions (JSON):', JSON.stringify(userMovePositions, null, 2));
      
      // Extract positions before user moves (for alternative move suggestions)
      const analysisPositions = fenExtractor.getPositionsBeforeUserMoves(allGamesFenData);
      console.log('🔍 [UNIFIED REPORT] === POSITIONS BEFORE USER MOVES (FOR ANALYSIS) ===');
      console.log(`🎯 [UNIFIED REPORT] Found ${analysisPositions.length} positions before user moves`);
      console.log('🧠 [UNIFIED REPORT] Analysis Positions (JSON):', JSON.stringify(analysisPositions, null, 2));
      
      // Sample display of first few positions with FEN strings
      if (analysisPositions.length > 0) {
        console.log('📋 [UNIFIED REPORT] === SAMPLE ANALYSIS POSITIONS ===');
        analysisPositions.slice(0, 5).forEach((pos, index) => {
          console.log(`🎯 [UNIFIED REPORT] Sample ${index + 1}:`);
          console.log(`  🏆 Game: ${pos.gameId}`);
          console.log(`  🎲 Move: ${pos.moveNumber}`);
          console.log(`  ⚡ User played: ${pos.userMove} as ${pos.userColor}`);
          console.log(`  📍 Position before move (FEN): ${pos.positionBeforeMove}`);
          console.log('---');
        });
      }
      
      console.log('✅ [UNIFIED REPORT] FEN extraction completed successfully!');
      console.log('🎯 [UNIFIED REPORT] This data is available for enhanced Gemini analysis');

      // Step 2: Generate Executive Summary using unified prompt
      this.updateProgress('analyzing', 'Generating executive summary (unified prompt)...', 30);
      const executiveSummary = await geminiService.generateUnifiedExecutiveSummary(games, request.username);
      this.updateProgress('analyzing', 'Executive summary generated', 35);

      // Step 3: Generate core analysis using unified prompt (hybrid approach)
      this.updateProgress('analyzing', 'Analyzing weaknesses, middlegame, and endgame (unified prompt)...', 40);
      console.log(`[REPORT SERVICE] About to call generateUnifiedAnalysis with ${games.length} games`);
      const unifiedAnalysis = await geminiService.generateUnifiedAnalysis(games, request.username);
      console.log(`[REPORT SERVICE] UnifiedAnalysis completed. Weaknesses count:`, unifiedAnalysis.recurringWeaknesses.length);
      this.updateProgress('analyzing', 'Core analysis complete', 75);

      // Step 4: Generate Improvement Plan using updated prompt
      this.updateProgress('generating', 'Creating personalized improvement plan...', 85);
      const improvementPlan = await geminiService.generateImprovementPlan(
        games,
        request.username,
        unifiedAnalysis.recurringWeaknesses,
        unifiedAnalysis.middlegameAnalysis,
        unifiedAnalysis.endgameAnalysis
      );

      // Step 5: Compile final report
      this.updateProgress('generating', 'Compiling final report...', 95);
      
      const report: ChessReport = {
        id: `unified_report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: '', // Will be set by the calling component
        username: request.username,
        platform: request.platform,
        gameCount: games.length,
        generatedAt: new Date(),
        executiveSummary,
        recurringWeaknesses: unifiedAnalysis.recurringWeaknesses,
        middleGameAnalysis: unifiedAnalysis.middlegameAnalysis,
        endgameAnalysis: unifiedAnalysis.endgameAnalysis,
        improvementPlan,
        rawGameData: games
      };

      this.updateProgress('complete', 'Report generation completed successfully!', 100);
      
      return report;

    } catch (error) {
      console.error('Error generating unified report:', error);
      
      let errorMessage = 'An unexpected error occurred';
      let errorCode: ReportGenerationError['code'] = 'ANALYSIS_ERROR';
      
      if (error instanceof ReportGenerationError) {
        errorMessage = error.message;
        errorCode = error.code;
        
        // Provide more user-friendly messages for temporary rate limiting without hiding quota/billing issues.
        if (error.code === 'RATE_LIMIT' && !error.message.toLowerCase().includes('quota')) {
          errorMessage = 'The AI service is currently experiencing high demand. Please wait a few minutes and try again.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      this.updateProgress('error', errorMessage, 0);
      
      throw new ReportGenerationError(errorMessage, errorCode, error);
    }
  }

  // Helper method to get opponent name from game data
  private getOpponentName(gameId: string, report: ChessReport): string {
    const game = report.rawGameData.find(g => g.id === gameId);
    if (!game) return `Game ${gameId}`;
    
    // Determine who was the opponent based on the user's name
    if (game.white.name.toLowerCase() === report.username.toLowerCase()) {
      return game.black.name;
    } else {
      return game.white.name;
    }
  }

  private getGameById(gameId: string, report: ChessReport): any | undefined {
    return report.rawGameData.find(g => g.id === gameId) ||
      report.rawGameData.find(g => g.id?.includes(gameId) || gameId.includes(g.id));
  }

  private getPositionPly(moveNumber: number, playerColor?: 'white' | 'black'): number {
    const basePly = Math.max(0, (moveNumber - 1) * 2);
    return playerColor === 'black' ? basePly + 1 : basePly;
  }

  private getGamePositionUrl(
    gameId: string,
    moveNumber: number,
    playerColor: 'white' | 'black' | undefined,
    report: ChessReport
  ): string | null {
    const game = this.getGameById(gameId, report);
    if (!game?.url) return null;

    const ply = this.getPositionPly(moveNumber, playerColor);
    const baseUrl = game.url.split('#')[0].split('?')[0];

    if (game.site === 'lichess') {
      return `${baseUrl}#${ply}`;
    }

    if (game.site === 'chess.com') {
      const analysisUrl = baseUrl.replace('/game/', '/analysis/game/');
      return `${analysisUrl}?tab=analysis&move=${ply}`;
    }

    return game.url;
  }

  // Helper method to format report for export
  formatReportForExport(report: ChessReport): string {
    return `
# Chess Performance Report
**Player:** ${report.username}  
**Platform:** ${report.platform}  
**Games Analyzed:** ${report.gameCount}  
**Generated:** ${report.generatedAt.toLocaleDateString()}  

## Executive Summary
- **Total Games:** ${report.executiveSummary.totalGames}
- **Win Rate:** ${report.executiveSummary.winRate}%
- **Average Accuracy:** ${report.executiveSummary.averageAccuracy}%
- **Overall Rating:** ${report.executiveSummary.overallRating}
- **Favorite Openings:** ${report.executiveSummary.favoriteOpenings.join(', ')}

### Key Insights
${report.executiveSummary.keyInsights.map(insight => `- ${insight}`).join('\n')}

## Recurring Weaknesses
${report.recurringWeaknesses.map(weakness => `
### ${weakness.title}
**Frequency:** ${weakness.frequency}  
**Description:** ${weakness.description}  

${weakness.examples && weakness.examples.length > 0 ? `
**Examples:**
${weakness.examples.map(example => `
- **Opponent:** ${this.getOpponentName(example.gameId, report)}
- **Move:** ${example.moveNumber}
- **Game Position:** ${this.getGamePositionUrl(example.gameId, example.moveNumber, example.playerColor, report) || 'Unavailable'}
- **Position:** ${example.position}
- **Mistake:** ${example.mistake}
- **Better:** ${example.betterMove}
`).join('\n')}
` : ''}

**Improvement Suggestion:** ${weakness.improvementSuggestion}
`).join('\n')}

## Middlegame Analysis
**Overall Rating:** ${report.middleGameAnalysis.overallRating}/10  
**Strengths:** ${report.middleGameAnalysis.strengths.join(', ')}  
**Weaknesses:** ${report.middleGameAnalysis.weaknesses.join(', ')}  

### Recommendations
${report.middleGameAnalysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Endgame Analysis
**Overall Rating:** ${report.endgameAnalysis.overallRating}/10  
**Strengths:** ${report.endgameAnalysis.strengths.join(', ')}  
**Weaknesses:** ${report.endgameAnalysis.weaknesses.join(', ')}

## Improvement Plan
### Immediate Actions
${report.improvementPlan.immediateActions.map(action => `- **${action.priority.toUpperCase()}:** ${action.action} (${action.timeframe})`).join('\n')}

### Resources
**Recommended Video:** ${report.improvementPlan.resources.recommendedVideo.title} by ${report.improvementPlan.resources.recommendedVideo.channel}  
**Master Game Study:** ${report.improvementPlan.resources.masterGame.players} - ${report.improvementPlan.resources.masterGame.event}  
    `.trim();
  }

  // Helper method to export report as PDF using screenshot approach (preserves exact visual design)
  async exportReportAsPDF(reportElement: HTMLElement, report: ChessReport): Promise<void> {
    try {
      console.log('Starting PDF export using screenshot approach...');
      
      // Import html2canvas and jsPDF dynamically
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;
      
      // Temporarily hide action buttons and other non-printable elements
      const elementsToHide = reportElement.querySelectorAll('.no-print, button, .export-dropdown, .back-button');
      const originalDisplayValues: string[] = [];
      
      elementsToHide.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        originalDisplayValues[index] = htmlElement.style.display;
        htmlElement.style.display = 'none';
      });
      
      // Ensure all content is visible and properly styled
      const hiddenElements = reportElement.querySelectorAll('[style*="display: none"], [style*="display:none"]');
      const originalHiddenDisplayValues: string[] = [];
      
      hiddenElements.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        originalHiddenDisplayValues[index] = htmlElement.style.display;
        htmlElement.style.display = 'block';
        htmlElement.style.visibility = 'visible';
      });
      
      // Wait for any images or content to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Configure html2canvas options for high quality
      const canvas = await html2canvas(reportElement, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        removeContainer: false,
        width: reportElement.scrollWidth,
        height: reportElement.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });
      
      console.log('Screenshot captured successfully');
      
      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      if (imgHeight <= pageHeight) {
        // Single page
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
      } else {
        // Multiple pages
        let heightLeft = imgHeight;
        let position = 0;
        
        // First page
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        // Additional pages
        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
      }
      
      // Generate filename
      const filename = `chess-report-${report.username}-${report.generatedAt.toISOString().split('T')[0]}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      console.log('PDF saved successfully');
      
      // Restore original display values
      elementsToHide.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = originalDisplayValues[index];
      });
      
      hiddenElements.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = originalHiddenDisplayValues[index];
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF. Please try again.');
    }
  }

  // Alternative method using browser's print functionality (preserves text selection and clickable links)
  async exportReportAsPrintPDF(reportElement: HTMLElement, report: ChessReport): Promise<void> {
    try {
      console.log('Starting PDF export using browser print...');
      
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        throw new Error('Unable to open print window. Please allow popups for this site.');
      }

      // Clone the report content
      const clonedContent = reportElement.cloneNode(true) as HTMLElement;
      console.log('Content cloned successfully');
      
      // Debug: Check what buttons exist in the cloned content
      console.log('=== DEBUGGING BUTTONS IN CLONED CONTENT ===');
      const allButtons = clonedContent.querySelectorAll('button');
      console.log(`Found ${allButtons.length} buttons total`);
      allButtons.forEach((btn, index) => {
        console.log(`Button ${index + 1}:`, btn.className, btn.textContent?.substring(0, 50));
      });
      
      // Check for section headers with icons
      const sectionHeaders = clonedContent.querySelectorAll('.section-header');
      console.log(`Found ${sectionHeaders.length} section headers`);
      sectionHeaders.forEach((header, index) => {
        console.log(`Section header ${index + 1}:`, header.textContent?.substring(0, 50));
        const icon = header.querySelector('svg');
        const textContent = header.textContent || '';
        
        if (icon) {
          // Create a simple inline version that preserves the SVG
          const inlineHeader = document.createElement('div');
          inlineHeader.style.cssText = 'display: block !important; margin-bottom: 1rem !important; font-size: 1.125rem !important; font-weight: 800 !important; color: #064e3b !important; text-transform: uppercase !important; letter-spacing: 0.05em !important; white-space: nowrap !important;';
          
          // Create icon container
          const iconContainer = document.createElement('span');
          iconContainer.style.cssText = 'display: inline-block !important; vertical-align: middle !important; margin-right: 0.75rem !important; color: #10b981 !important;';
          iconContainer.appendChild(icon.cloneNode(true));
          
          // Create text container
          const textContainer = document.createElement('span');
          textContainer.style.cssText = 'display: inline-block !important; vertical-align: middle !important;';
          // Extract just the text without the icon
          const textOnly = textContent.replace(/^\s*[\u2022\u25CF\u25A0\u25B2\u25C6\u2713\u2717\u2605\u2606\u2660\u2663\u2665\u2666]\s*/, '').trim();
          textContainer.textContent = textOnly;
          
          // Append both containers
          inlineHeader.appendChild(iconContainer);
          inlineHeader.appendChild(textContainer);
          
          // Replace the header
          header.parentNode?.replaceChild(inlineHeader, header);
        }
      });
      
      // Remove remaining interactive elements that shouldn't be in PDF
      const elementsToRemove = [
        'button',
        '.export-dropdown',
        '.back-button',
        '[class*="dropdown"]',
        '.no-print'
      ];
      
      elementsToRemove.forEach(selector => {
        const elements = clonedContent.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });
      
      // Remove the action buttons container specifically
      const actionButtons = clonedContent.querySelector('.flex.space-x-3');
      if (actionButtons) {
        actionButtons.remove();
      }
      
      // Ensure all content is visible and properly styled for PDF
      clonedContent.style.maxWidth = 'none';
      clonedContent.style.width = '100%';
      clonedContent.style.margin = '0';
      clonedContent.style.padding = '0';
      clonedContent.style.display = 'block';
      
      // Force expand all collapsible sections
      const hiddenElements = clonedContent.querySelectorAll('[style*="display: none"], [style*="display:none"]');
      hiddenElements.forEach(el => {
        (el as HTMLElement).style.display = 'block';
        (el as HTMLElement).style.visibility = 'visible';
      });
      
      // Make sure all sections are visible and remove empty elements
      const allDivs = clonedContent.querySelectorAll('div');
      allDivs.forEach(div => {
        if (div.style.display === 'none') {
          div.style.display = 'block';
        }
        
        // Remove empty divs that only contain whitespace
        if (div.textContent?.trim() === '' && div.children.length === 0) {
          div.remove();
        }
      });
      
      // Remove excessive empty paragraphs and line breaks
      const emptyPs = clonedContent.querySelectorAll('p');
      emptyPs.forEach(p => {
        if (p.textContent?.trim() === '' || p.innerHTML.trim() === '&nbsp;') {
          p.remove();
        }
      });
      
      // Remove multiple consecutive br tags
      const brs = clonedContent.querySelectorAll('br');
      brs.forEach((br, index) => {
        const nextSibling = br.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'BR') {
          br.remove();
        }
      });
      
      // Remove any CSS classes that might force page breaks
      const allElements = clonedContent.querySelectorAll('*');
      allElements.forEach(element => {
        // Remove any inline styles that force page breaks
        if (element instanceof HTMLElement) {
          element.style.pageBreakBefore = 'auto';
          element.style.pageBreakAfter = 'auto';
          element.style.pageBreakInside = 'auto';
          
          // Remove classes that might cause page breaks
          const classList = Array.from(element.classList);
          classList.forEach(className => {
            if (className.includes('page-break') || className.includes('break-')) {
              element.classList.remove(className);
            }
          });
        }
      });
      
      // Style links for better PDF appearance while preserving functionality
      const links = clonedContent.querySelectorAll('a');
      links.forEach(link => {
        link.style.color = '#0066cc';
        link.style.textDecoration = 'underline';
        link.style.display = 'inline';
        link.style.visibility = 'visible';
      });

      // Get Tailwind CSS link from the current page
      const tailwindLink = document.querySelector('link[href*="tailwind"], link[href*="main."], style') as HTMLLinkElement;
      let tailwindHref = '';
      
      if (tailwindLink && tailwindLink.href) {
        tailwindHref = tailwindLink.href;
      }

      // Create the complete HTML document for printing
      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Chess Report - ${report.username}</title>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          ${tailwindHref ? `<link rel="stylesheet" href="${tailwindHref}">` : ''}
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    'sans': ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
                  }
                }
              }
            }
          </script>
          <style>
            /* Preserve exact Tailwind styling */
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            @media screen {
              body {
                margin: 20px;
                background-color: #f9fafb;
                font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
              }
            }
            
            @media print {
              @page {
                size: A4;
                margin: 0 !important;
                padding: 0 !important;
              }
              
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                height: 100% !important;
                background-color: white !important;
                font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
                line-height: 1.4 !important;
                position: relative !important;
              }
              
              /* Add dark green line only on the first page */
              @page :first {
                margin: 0 !important;
                padding: 0 !important;
                size: A4;
              }
              

              

              
              /* Remove all container margins and padding */
              .max-w-4xl, .mx-auto {
                max-width: none !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
              }
              
              /* Main report container should fill the page */
              .bg-white.rounded-lg.shadow-lg {
                margin: 0 !important;
                padding: 1.5rem !important;
                padding-left: 1.5rem !important;
                padding-right: 1.5rem !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                border: none !important;
                width: 100% !important;
                min-height: 100vh !important;
                box-sizing: border-box !important;
                position: relative !important;
              }
              

              
              .no-print {
                display: none !important;
              }
              
              /* Increase font weight for bold text */
              .font-bold, .font-semibold, .font-extrabold, strong, b {
                font-weight: 800 !important;
              }
              
              .font-medium {
                font-weight: 600 !important;
              }
              
              h1, h2, h3, h4, h5, h6 {
                font-weight: 800 !important;
              }
              
              /* Ensure section headings and SVG icons display properly */
              div[style*="color: #064e3b"] {
                display: block !important;
                white-space: nowrap !important;
                overflow: visible !important;
              }
              
              div[style*="color: #064e3b"] span {
                display: inline-block !important;
                vertical-align: middle !important;
              }
              
              div[style*="color: #064e3b"] svg {
                display: inline-block !important;
                vertical-align: middle !important;
                width: 20px !important;
                height: 20px !important;
                color: #10b981 !important;
                fill: currentColor !important;
              }
              
              /* Make username larger and bolder in print */
              .text-right .font-semibold.text-lg {
                font-size: 1.375rem !important; /* text-xl */
                font-weight: 800 !important;
              }
              
              /* Significantly reduce excessive spacing for better space utilization */
              .mb-6, .my-6 {
                margin-bottom: 0.5rem !important;
                margin-top: 0.25rem !important;
              }
              
              .mb-4, .my-4 {
                margin-bottom: 0.375rem !important;
                margin-top: 0.125rem !important;
              }
              
              .mb-3 {
                margin-bottom: 0.25rem !important;
              }
              
              .mt-4 {
                margin-top: 0.25rem !important;
              }
              
              .mt-6 {
                margin-top: 0.375rem !important;
              }
              
              .p-6 {
                padding: 0.75rem !important;
              }
              
              .p-4 {
                padding: 0.5rem !important;
              }
              
              .p-3 {
                padding: 0.375rem !important;
              }
              
              .py-6 {
                padding-top: 0.5rem !important;
                padding-bottom: 0.5rem !important;
              }
              
              .py-4 {
                padding-top: 0.375rem !important;
                padding-bottom: 0.375rem !important;
              }
              
              .px-2 {
                padding-left: 0.25rem !important;
                padding-right: 0.25rem !important;
              }
              
              .py-1 {
                padding-top: 0.125rem !important;
                padding-bottom: 0.125rem !important;
              }
              
              /* Reduce gap between grid items */
              .gap-6 {
                gap: 0.5rem !important;
              }
              
              .gap-4 {
                gap: 0.375rem !important;
              }
              
              /* Compact spacing for sections */
              .space-y-6 > * + * {
                margin-top: 0.375rem !important;
              }
              
              .space-y-4 > * + * {
                margin-top: 0.25rem !important;
              }
              
              .space-y-3 > * + * {
                margin-top: 0.25rem !important;
              }
              
              .space-y-2 > * + * {
                margin-top: 0.125rem !important;
              }
              
              .space-y-1 > * + * {
                margin-top: 0.0625rem !important;
              }
              
              /* Allow content to flow naturally across pages and optimize card spacing */
              .bg-blue-50, .bg-green-50, .bg-purple-50, .bg-red-100, .bg-gray-50 {
                page-break-inside: auto !important;
                page-break-before: auto !important;
                page-break-after: auto !important;
                margin-bottom: 0.25rem !important;
              }
              
              .border, .rounded-lg {
                page-break-inside: auto !important;
                page-break-before: auto !important;
                page-break-after: auto !important;
                margin-bottom: 0.375rem !important;
              }
              
              /* Optimize border spacing */
              .border-l-4 {
                padding-left: 0.75rem !important;
                margin-bottom: 0.5rem !important;
              }
              
              .pl-6 {
                padding-left: 0.75rem !important;
              }
              
              h1, h2, h3, h4, h5, h6 { 
                page-break-after: auto !important;
                page-break-before: auto !important;
                page-break-inside: auto !important;
                margin-top: 0.75rem !important;
                margin-bottom: 0.5rem !important;
                line-height: 1.3 !important;
              }
              
              p { 
                orphans: 2;
                widows: 2;
                margin-top: 0.25rem !important;
                margin-bottom: 0.5rem !important;
                line-height: 1.4 !important;
                page-break-inside: auto !important;
              }
              
              /* Ensure all sections flow continuously */
              div, section, article {
                page-break-before: auto !important;
                page-break-after: auto !important;
                page-break-inside: auto !important;
              }
              
              /* Reduce spacing before Performance Summary section */
              .text-center.italic.text-gray-600.mb-8 {
                margin-bottom: 0.25rem !important;
                padding-bottom: 0 !important;
              }
              
              /* Performance Summary section spacing */
              section.mb-8.p-6 {
                margin-bottom: 0.5rem !important;
                padding: 0.5rem !important;
                margin-top: 0.25rem !important;
              }
              
              /* Target any section that contains Performance Summary */
              section[style*="rgba(16, 185, 129"] {
                margin-top: 0.25rem !important;
                margin-bottom: 0.5rem !important;
                padding: 0.5rem !important;
              }
              
              /* Performance Summary - Force grid items to display in a single row */
              .grid.grid-cols-1.sm\\:grid-cols-2.md\\:grid-cols-4 {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 0.5rem !important;
                margin-bottom: 0.5rem !important;
                margin-top: 0.5rem !important;
              }
              
              /* Ensure performance summary cards are compact */
              .highlight-card {
                padding: 0.5rem !important;
                margin-bottom: 0 !important;
                display: block !important;
                page-break-inside: avoid !important;
              }
              
              /* Section header spacing within Performance Summary */
              .section-header {
                margin-bottom: 0.5rem !important;
                margin-top: 0 !important;
              }
              
              /* Performance summary specific styling */
              .highlight-card h4 {
                font-size: 0.75rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.2 !important;
              }
              
              .highlight-card p {
                margin-top: 0.125rem !important;
                margin-bottom: 0 !important;
                line-height: 1.2 !important;
              }
              
              /* Alternative approach - target any grid with 4 columns */
              .grid[class*="grid-cols-4"] {
                display: grid !important;
                grid-template-columns: repeat(4, 1fr) !important;
                gap: 0.5rem !important;
              }
              
              /* Override responsive grid classes in print */
              .sm\\:grid-cols-2,
              .md\\:grid-cols-4,
              .lg\\:grid-cols-4 {
                grid-template-columns: repeat(4, 1fr) !important;
              }
              
              /* Ensure grid items don't break to new lines */
              .grid > div {
                display: block !important;
                width: auto !important;
                flex: none !important;
              }
              
              /* Actionable Improvement Plan styling */
              .checklist-item {
                display: flex !important;
                align-items: flex-start !important;
                padding: 1rem !important;
                margin-bottom: 0.75rem !important;
                background-color: #f9fafb !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 0.5rem !important;
                border-left: 4px solid #10b981 !important;
                page-break-inside: avoid !important;
                line-height: 1.5 !important;
              }
              
              .checklist-item span {
                flex-shrink: 0 !important;
                font-weight: 700 !important;
                font-size: 0.875rem !important;
                margin-right: 1rem !important;
                padding: 0.25rem 0.5rem !important;
                border-radius: 0.25rem !important;
                background-color: white !important;
                border: 1px solid currentColor !important;
              }
              
              .checklist-item div {
                flex: 1 !important;
                line-height: 1.5 !important;
              }
              
              .checklist-item strong {
                color: #1f2937 !important;
                font-weight: 600 !important;
              }
              
              /* Priority color styling for print */
              .text-red-600 {
                color: #dc2626 !important;
                border-color: #dc2626 !important;
              }
              
              .text-yellow-600 {
                color: #d97706 !important;
                border-color: #d97706 !important;
              }
              
              .text-green-600 {
                color: #059669 !important;
                border-color: #059669 !important;
              }
              
              /* Ensure proper spacing for the improvement plan section */
              .space-y-2 > * + * {
                margin-top: 0.5rem !important;
              }
              
              /* Header padding adjustments - ensure consistent spacing */
              header.flex.justify-between.items-start {
                padding-left: 0 !important;
                padding-right: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
              }
              
              /* Performance Report heading - no extra padding */
              header div:first-child {
                padding-left: 0 !important;
                margin-left: 0 !important;
              }
              
              /* Username section - no extra padding */
              header .text-right {
                padding-right: 0 !important;
                margin-right: 0 !important;
              }
              
              /* Ensure all sections have consistent horizontal padding */
              section, div {
                padding-left: 0 !important;
                padding-right: 0 !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
              }
              
              /* Content box padding improvements */
              .highlight-card {
                padding: 1rem !important;
                margin-bottom: 0.5rem !important;
                border-radius: 0.5rem !important;
                border-width: 1px !important;
              }
              
              .bg-gray-50.p-4.rounded-lg.border {
                padding: 1rem !important;
                margin-bottom: 0.75rem !important;
                border-radius: 0.5rem !important;
                background-color: #f9fafb !important;
                border: 1px solid #e5e7eb !important;
              }
              
              .bg-white.border-l-4 {
                padding: 0.75rem !important;
                margin-top: 0.5rem !important;
                border-radius: 0.25rem !important;
                background-color: white !important;
              }
              
              .bg-gray-50.p-3.rounded-lg.flex.items-start.border {
                padding: 0.75rem !important;
                margin-bottom: 0.5rem !important;
                border-radius: 0.5rem !important;
                background-color: #f9fafb !important;
                border: 1px solid #e5e7eb !important;
              }
              
              /* Text spacing within boxes */
              .text-sm.text-gray-600 {
                margin-top: 0.25rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.4 !important;
              }
              
              .text-xs.text-gray-500 {
                margin-bottom: 0.25rem !important;
                line-height: 1.3 !important;
              }
              
              /* Ensure proper spacing for nested content */
              .mt-1 {
                margin-top: 0.25rem !important;
              }
              
              .mt-2 {
                margin-top: 0.5rem !important;
              }
              
              .mb-2 {
                margin-bottom: 0.5rem !important;
              }
              
              /* List styling improvements */
              .list-disc.list-inside {
                padding-left: 0.5rem !important;
              }
              
              .list-disc.list-inside li {
                margin-bottom: 0.25rem !important;
                line-height: 1.4 !important;
                padding-left: 0.25rem !important;
              }
              
              .rating-bar-bg {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                background: none !important;
                position: absolute !important;
                left: -99999px !important;
                top: -99999px !important;
                z-index: -9999 !important;
              }
              
              .rating-bar-bg *,
              .rating-bar-bg > *,
              .rating-bar-bg .rating-bar,
              .rating-bar-bg > .rating-bar,
              .rating-bar,
              div[class*="rating-bar"],
              *[class*="rating-bar"] {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                background: none !important;
                position: absolute !important;
                left: -99999px !important;
                top: -99999px !important;
                z-index: -9999 !important;
              }
              
              .rating-bar-bg::before,
              .rating-bar-bg::after,
              .rating-bar::before,
              .rating-bar::after,
              .rating-bar-bg *::before,
              .rating-bar-bg *::after {
                display: none !important;
                content: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                width: 0 !important;
                height: 0 !important;
              }
              
              /* Space-y utilities for better content spacing */
              .space-y-1 > * + * {
                margin-top: 0.25rem !important;
              }
              
              .space-y-4 > * + * {
                margin-top: 0.75rem !important;
              }
              
              /* Grid improvements for better layout */
              .grid.grid-cols-1.lg\\:grid-cols-2.gap-4 {
                gap: 0.75rem !important;
              }
              
              .grid.grid-cols-1.md\\:grid-cols-2.gap-4 {
                gap: 0.75rem !important;
              }
              
              /* Font weight and size adjustments for better readability */
              .font-bold.text-gray-800 {
                font-weight: 600 !important;
                color: #1f2937 !important;
                margin-bottom: 0.25rem !important;
              }
              
              .font-semibold.text-gray-800 {
                font-weight: 600 !important;
                color: #1f2937 !important;
              }
              
              /* Remove any forced page breaks */
              * {
                page-break-before: auto !important;
                page-break-after: auto !important;
              }
              
              /* Only avoid breaks for very small elements */
              .text-sm, .text-xs {
                page-break-inside: avoid;
              }
              
              /* Optimize grid layouts for better space utilization in PDF */
              .grid.grid-cols-1 {
                display: block !important;
              }
              
              /* Executive summary stats - use horizontal layout for better space usage */
              .grid.grid-cols-1.md\\:grid-cols-3 {
                display: flex !important;
                flex-wrap: wrap !important;
                justify-content: space-between !important;
                gap: 0.5rem !important;
              }
              
              .grid.grid-cols-1.md\\:grid-cols-3 > * {
                flex: 1 1 30% !important;
                min-width: 150px !important;
                margin-bottom: 0.5rem !important;
                display: block !important;
              }
              
              /* Two-column grids - use side-by-side layout for better space usage */
              .grid.grid-cols-1.md\\:grid-cols-2 {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 1rem !important;
              }
              
              .grid.grid-cols-1.md\\:grid-cols-2 > * {
                flex: 1 1 45% !important;
                min-width: 200px !important;
                margin-bottom: 0.5rem !important;
                display: block !important;
              }
              
              /* CHESSBOARD LAYOUT FIX - Ensure examples with chessboards stay side-by-side */
              .grid.grid-cols-1.lg\\:grid-cols-2 {
                display: flex !important;
                flex-wrap: nowrap !important;
                gap: 1rem !important;
                align-items: flex-start !important;
              }
              
              /* Text content container - first child (left side) */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child {
                flex: 1 1 50% !important;
                max-width: 50% !important;
                margin-right: 1rem !important;
                margin-bottom: 0.5rem !important;
              }
              
              /* Increase font size and line spacing for text content in examples */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child p {
                font-size: 0.9rem !important;
                line-height: 1.6 !important;
                margin-bottom: 0.5rem !important;
              }
              
              /* Specific styling for the mistake and better plan text */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child p.text-sm {
                font-size: 0.95rem !important;
                line-height: 1.7 !important;
                margin-bottom: 0.6rem !important;
              }
              
              /* Styling for the smaller info text */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child p.text-xs {
                font-size: 0.8rem !important;
                line-height: 1.5 !important;
                margin-bottom: 0.4rem !important;
              }
              
              /* Improve spacing for strong tags within text */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child strong {
                font-weight: 600 !important;
                margin-right: 0.25rem !important;
              }
              
              /* Add spacing between mistake and better plan lines */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:first-child br {
                margin-bottom: 0.3rem !important;
              }
              
              /* Chessboard container - second child (right side) */
              .grid.grid-cols-1.lg\\:grid-cols-2 > div:last-child {
                flex: 0 0 50% !important;
                max-width: 50% !important;
                display: flex !important;
                justify-content: center !important;
                align-items: flex-start !important;
                margin-bottom: 0.5rem !important;
              }
              
              /* Ensure chessboard containers don't shrink too much */
              .grid.grid-cols-1.lg\\:grid-cols-2 > .flex.justify-center.lg\\:justify-end {
                flex: 0 0 50% !important;
                max-width: 50% !important;
                display: flex !important;
                justify-content: center !important;
                align-items: flex-start !important;
              }
              
              /* CHESSBOARD COMPONENT STYLING - Ensure proper rendering in PDF */
              .flex.flex-col.items-center {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                flex-shrink: 0 !important;
                min-width: 180px !important;
                max-width: 200px !important;
              }
              
              /* Chessboard container */
              .border.border-gray-300.rounded-lg.overflow-hidden.shadow-sm {
                border: 1px solid #d1d5db !important;
                border-radius: 0.5rem !important;
                overflow: hidden !important;
                box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.1) !important;
                flex-shrink: 0 !important;
              }
              
              /* Chessboard title */
              .text-sm.font-medium.text-gray-700.mb-2.text-center {
                font-size: 0.75rem !important;
                line-height: 1.2 !important;
                margin-bottom: 0.25rem !important;
                text-align: center !important;
                font-weight: 500 !important;
                color: #374151 !important;
              }
              
              /* Convert other flex to optimized layouts (but not chessboard layouts) */
              .flex:not(.grid.grid-cols-1.lg\\:grid-cols-2 > .flex) {
                display: block !important;
                margin-bottom: 0.25rem !important;
              }
              
              .flex.items-center {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                gap: 0.25rem !important;
                margin-bottom: 0.25rem !important;
              }
              
              .flex.items-center > * {
                display: inline-block !important;
                vertical-align: middle !important;
                margin-right: 0.25rem !important;
              }
              
              .flex.justify-between {
                display: flex !important;
                justify-content: space-between !important;
                flex-wrap: wrap !important;
                gap: 0.5rem !important;
              }
              
              .flex.justify-between > *:last-child {
                margin-left: auto !important;
              }
              
              .space-x-6 > * + * {
                margin-left: 0 !important;
                margin-top: 0.25rem !important;
              }
              
              /* Remove excessive spacing from containers */
              .container, .max-w-4xl, .max-w-6xl {
                padding-left: 0 !important;
                padding-right: 0 !important;
              }
              
              /* Compact list spacing */
              ul, ol {
                margin-top: 0.125rem !important;
                margin-bottom: 0.25rem !important;
              }
              
              li {
                margin-bottom: 0.125rem !important;
                line-height: 1.3 !important;
              }
              
              /* Reduce spacing in cards and sections */
              .bg-white {
                margin-bottom: 0.375rem !important;
              }
              
              /* Compact text elements */
              .text-sm {
                line-height: 1.2 !important;
                font-size: 0.825rem !important;
              }
              
              .text-lg {
                line-height: 1.3 !important;
              }
              
              .text-2xl {
                line-height: 1.2 !important;
                font-size: 1.375rem !important;
              }
              
              .text-3xl {
                line-height: 1.1 !important;
                font-size: 1.625rem !important;
              }
              
              /* Optimize stat cards for better horizontal space usage */
              .text-center {
                text-align: left !important;
                padding: 0.5rem !important;
              }
              
              .text-center .text-2xl {
                display: inline-block !important;
                margin-right: 0.5rem !important;
              }
              
              .text-center .text-sm {
                display: inline-block !important;
                vertical-align: middle !important;
              }
              
              /* Remove extra spacing from dividers */
              hr {
                margin-top: 0.25rem !important;
                margin-bottom: 0.25rem !important;
              }
              
              /* Optimize skill breakdown cards for PDF */
              .bg-gray-50.p-3 {
                padding: 0.375rem !important;
                margin-bottom: 0.25rem !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 0.125rem !important;
              }
              
              /* Progress bars - make them more compact (keeping for middlegame section) */
              .w-full.bg-gray-200 {
                height: 4px !important;
                margin-top: 0.125rem !important;
              }
              
              .bg-blue-600.h-2 {
                height: 4px !important;
              }
              
              .bg-purple-600.h-2 {
                height: 4px !important;
              }
              
              /* Enhanced progress bars for phase review section */
              .rating-bar-bg {
                background-color: #e5e7eb !important;
                border-radius: 9999px !important;
                height: 12px !important;
                overflow: hidden !important;
                width: 100% !important;
                margin-top: 0.25rem !important;
                margin-bottom: 0.5rem !important;
                border: 1px solid #d1d5db !important;
                box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1) !important;
              }
              
              .rating-bar {
                background: linear-gradient(90deg, #ef4444 0%, #f59e0b 30%, #10b981 70%, #059669 100%) !important;
                height: 100% !important;
                border-radius: 9999px !important;
                transition: width 0.3s ease !important;
                position: relative !important;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
              }
              
              /* Add percentage text overlay on progress bars */
              .rating-bar::after {
                content: attr(data-percentage) !important;
                position: absolute !important;
                right: 4px !important;
                top: 50% !important;
                transform: translateY(-50%) !important;
                color: white !important;
                font-size: 0.7rem !important;
                font-weight: 600 !important;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5) !important;
              }
              
              /* Style the skill labels for better readability */
              .rating-bar-bg + div .flex.justify-between.items-center {
                margin-bottom: 0.125rem !important;
                font-weight: 600 !important;
              }
              
              .rating-bar-bg + div .flex.justify-between.items-center span:first-child {
                font-size: 0.85rem !important;
                color: #374151 !important;
                text-transform: capitalize !important;
              }
              
              .rating-bar-bg + div .flex.justify-between.items-center span:last-child {
                font-size: 0.8rem !important;
                color: #6b7280 !important;
                font-weight: 700 !important;
                background-color: #f3f4f6 !important;
                padding: 0.125rem 0.375rem !important;
                border-radius: 0.25rem !important;
                border: 1px solid #d1d5db !important;
              }
              
              /* Phase review section specific styling */
              .bg-gray-50.p-4.rounded-lg.border.border-gray-200 {
                background-color: #f9fafb !important;
                border: 1px solid #e5e7eb !important;
                border-radius: 0.5rem !important;
                padding: 1rem !important;
                margin-bottom: 0.75rem !important;
              }
              
              /* Phase review headings */
              .bg-gray-50.p-4.rounded-lg.border.border-gray-200 h3 {
                font-size: 1rem !important;
                font-weight: 700 !important;
                color: #1f2937 !important;
                margin-bottom: 0.75rem !important;
              }
              
              /* Phase review overall rating */
              .bg-gray-50.p-4.rounded-lg.border.border-gray-200 h3 span {
                color: #6b7280 !important;
                font-weight: 500 !important;
              }
              
              /* Skill labels - make them inline when possible */
              .flex.items-center.justify-between.mb-1 {
                margin-bottom: 0.0625rem !important;
                gap: 0.5rem !important;
              }
              
              /* Optimize recommendation cards */
              .bg-blue-50.p-3 {
                padding: 0.375rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.3 !important;
              }
              
              /* Make headers more compact */
              .font-semibold.text-gray-800.mb-3 {
                margin-bottom: 0.25rem !important;
                line-height: 1.2 !important;
              }
              
              .font-semibold.text-gray-800.mb-2 {
                margin-bottom: 0.125rem !important;
                line-height: 1.2 !important;
              }
              
              .font-medium.mb-2 {
                margin-bottom: 0.125rem !important;
                line-height: 1.2 !important;
              }
              
              /* Optimize weakness examples for compactness */
              .text-sm.bg-gray-50.p-3 {
                padding: 0.375rem !important;
                margin-bottom: 0.25rem !important;
                line-height: 1.2 !important;
              }
              
              .text-sm.bg-gray-50.p-3 div {
                margin-bottom: 0.0625rem !important;
                line-height: 1.2 !important;
              }
              
              .text-sm.bg-gray-50.p-3 div strong {
                font-weight: 600 !important;
                margin-right: 0.25rem !important;
              }
              
              /* Optimize frequency badges */
              .text-sm.text-red-600.bg-red-100 {
                padding: 0.125rem 0.375rem !important;
                font-size: 0.75rem !important;
                line-height: 1.2 !important;
              }
              
              /* Optimize improvement suggestion boxes */
              .bg-blue-50.p-3.rounded-md {
                padding: 0.375rem !important;
                margin-top: 0.25rem !important;
              }
              
              .font-medium.text-blue-800.mb-1 {
                margin-bottom: 0.0625rem !important;
                line-height: 1.2 !important;
              }
              
              .text-blue-700 {
                line-height: 1.3 !important;
              }
              
              /* Optimize header gradient section */
              .bg-gradient-to-r {
                padding: 0.75rem !important;
                margin-bottom: 0.5rem !important;
              }
              
              .text-3xl.font-bold.mb-2 {
                margin-bottom: 0.25rem !important;
                line-height: 1.1 !important;
              }
              
              .space-x-6 {
                gap: 0.75rem !important;
              }
              
              .space-x-6 > * + * {
                margin-left: 0 !important;
              }
              
              .space-x-2 {
                gap: 0.25rem !important;
              }
              
              .space-x-2 > * + * {
                margin-left: 0 !important;
              }
              
              /* Optimize header icons and text */
              .text-blue-100 {
                line-height: 1.2 !important;
              }
              
              .w-4.h-4 {
                width: 0.875rem !important;
                height: 0.875rem !important;
              }
              
              /* Page layout optimization */
              .max-w-4xl {
                max-width: 100% !important;
              }
              
              /* Ensure proper page utilization */
              body {
                margin: 0.5rem !important;
              }
              
              /* Remove excessive margins from main container */
              .mx-auto {
                margin-left: 0 !important;
                margin-right: 0 !important;
              }
              
              /* Optimize overall padding */
              .p-6.bg-white {
                padding: 0.75rem !important;
                background-color: white !important;
              }
              
              /* Style preserved section headings for PDF */
              .flex.items-center.space-x-3.p-4.bg-gray-50 {
                padding: 0.5rem !important;
                margin-bottom: 0.25rem !important;
                background-color: #f9fafb !important;
                border-radius: 0.5rem !important;
              }
              
              .flex.items-center.space-x-3.p-4.bg-gray-50 h2 {
                margin: 0 !important;
                line-height: 1.2 !important;
                font-size: 1.125rem !important;
              }
              
              .flex.items-center.space-x-3.p-4.bg-gray-50 svg {
                width: 1rem !important;
                height: 1rem !important;
                flex-shrink: 0 !important;
              }
              
              /* Optimize endgame performance ratings display */
              .flex.items-center.justify-between .text-sm.font-medium.text-purple-600 {
                line-height: 1.2 !important;
                font-size: 0.825rem !important;
              }
            }
            
            /* Print button for the print window */
            .print-button {
              position: fixed;
              top: 10px;
              right: 10px;
              background: #2563eb;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
              z-index: 1000;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            }
            
            .print-button:hover {
              background: #1d4ed8;
            }
            
            @media print {
              .print-button {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>
          ${clonedContent.outerHTML}
          
          <script>
            // Auto-focus the window and show print dialog after content loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
            
            // Close window after printing (optional)
            window.onafterprint = function() {
              // Uncomment the next line if you want to auto-close after printing
              // window.close();
            };
          </script>
        </body>
        </html>
      `;

      // Write the HTML to the print window
      printWindow.document.write(printHtml);
      printWindow.document.close();

      console.log('Print window opened with report content');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF. Please try again.');
    }
  }
}

export const reportService = new ReportService();
