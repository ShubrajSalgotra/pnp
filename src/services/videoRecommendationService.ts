import { RecurringWeakness, MiddleGameAnalysis, EndgameAnalysis } from '../types/report';

interface WeaknessProfile {
  primaryWeakness: string;
  specificPatterns: string[];
  gamePhase: 'opening' | 'middlegame' | 'endgame' | 'mixed';
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  frequency: number;
  context: string;
}

interface VideoRecommendation {
  title: string;
  channel: string;
  url: string;
  description: string;
  relevantWeakness: string;
  duration?: string;
  searchQuery: string;
}

interface VideoDatabase {
  [key: string]: {
    keywords: string[];
    videos: {
      title: string;
      channel: string;
      url: string;
      description: string;
      duration?: string;
      skillLevel: string[];
      gamePhase: string[];
    }[];
  };
}

class VideoRecommendationService {
  private videoDatabase: VideoDatabase = {
    // Specific tactical patterns
    'pins': {
      keywords: ['pin', 'pinned', 'pinning', 'absolute pin', 'relative pin'],
      videos: [
        {
          title: "Master the Pin: Chess Tactics Explained",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=kL8g7cxJ9vM",
          description: "Deep dive into pin tactics with practical examples and pattern recognition",
          duration: "32:15",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['middlegame', 'opening']
        }
      ]
    },
    'forks': {
      keywords: ['fork', 'forked', 'forking', 'knight fork', 'double attack'],
      videos: [
        {
          title: "Chess Forks: The Most Powerful Tactical Weapon",
          channel: "ChessNetwork",
          url: "https://youtube.com/watch?v=mK9sF4MC2Ls",
          description: "Complete guide to fork tactics and how to spot them in your games",
          duration: "28:43",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'skewers': {
      keywords: ['skewer', 'skewered', 'skewering', 'x-ray'],
      videos: [
        {
          title: "Skewer Tactics: Pin's Deadly Cousin",
          channel: "Chess.com",
          url: "https://youtube.com/watch?v=cF9xJ8F7Kls",
          description: "Master skewer patterns and learn to execute them effectively",
          duration: "19:27",
          skillLevel: ['intermediate'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'discovered_attacks': {
      keywords: ['discovered attack', 'discovered check', 'discovery', 'x-ray attack'],
      videos: [
        {
          title: "Discovered Attacks: The Hidden Tactical Weapon",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=tM8fxE8Qb4s",
          description: "Understanding and executing discovered attacks in practical play",
          duration: "35:18",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'back_rank_mate': {
      keywords: ['back rank', 'back-rank', 'back rank mate', 'mate threats', 'king safety', 'escape squares'],
      videos: [
        {
          title: "Back Rank Mate: The Most Common Checkmate Pattern",
          channel: "GothamChess",
          url: "https://youtube.com/watch?v=iBZLU1FXhcI",
          description: "Comprehensive guide to recognizing and executing back-rank mates",
          duration: "21:46",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['middlegame', 'endgame']
        }
      ]
    },
    'weak_squares': {
      keywords: ['weak squares', 'weak square', 'outpost', 'holes', 'square weakness'],
      videos: [
        {
          title: "Weak Squares: The Foundation of Positional Chess",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=p3Hxk2uBLg8",
          description: "Understanding and exploiting weak squares in your opponent's position",
          duration: "42:18",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'pawn_structure': {
      keywords: ['pawn structure', 'pawn chain', 'pawn break', 'pawn weakness', 'isolated pawn', 'doubled pawn'],
      videos: [
        {
          title: "Pawn Structure Secrets: The Key to Positional Mastery",
          channel: "Chess Vibes",
          url: "https://youtube.com/watch?v=nXyJdetptXg",
          description: "Complete guide to understanding and evaluating pawn structures",
          duration: "35:42",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'piece_activity': {
      keywords: ['piece activity', 'active pieces', 'passive pieces', 'piece coordination', 'improving pieces'],
      videos: [
        {
          title: "Piece Activity: Making Your Pieces Work Together",
          channel: "Chess.com",
          url: "https://youtube.com/watch?v=Esi5jgWEP3I",
          description: "Learn how to activate your pieces and coordinate them effectively",
          duration: "28:14",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'pawn_endgames': {
      keywords: ['pawn endgame', 'pawn ending', 'king and pawn', 'opposition', 'zugzwang', 'pawn promotion'],
      videos: [
        {
          title: "Pawn Endgames: The Foundation of Chess Mastery",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=uszf3ZRxYMo",
          description: "Deep dive into pawn endgame theory and practical technique",
          duration: "52:18",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['endgame']
        }
      ]
    },
    'rook_endgames': {
      keywords: ['rook endgame', 'rook ending', 'rook and pawn', 'lucena position', 'philidor position'],
      videos: [
        {
          title: "Rook Endgames: Essential Techniques and Positions",
          channel: "Chess.com",
          url: "https://youtube.com/watch?v=mK9sF4MC2Ls",
          description: "Master the most common rook endgame positions and techniques",
          duration: "38:45",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['endgame']
        }
      ]
    },
    'king_activity': {
      keywords: ['king activity', 'active king', 'king centralization', 'king in endgame'],
      videos: [
        {
          title: "King Activity in the Endgame: Your Most Powerful Piece",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=cF9xJ8F7Kls",
          description: "Learn how to activate your king effectively in endgame positions",
          duration: "29:33",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['endgame']
        }
      ]
    },
    'planning': {
      keywords: ['planning', 'plan', 'strategic plan', 'long-term plan', 'positional plan'],
      videos: [
        {
          title: "Chess Planning: How to Create and Execute Winning Plans",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=mK9sF4MC2Ls",
          description: "Advanced positional concepts and strategic planning methodology",
          duration: "41:28",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'space_advantage': {
      keywords: ['space advantage', 'space', 'cramped position', 'expanding', 'territory'],
      videos: [
        {
          title: "Space Advantage: How to Use Extra Room Effectively",
          channel: "Chess Vibes",
          url: "https://youtube.com/watch?v=p3Hxk2uBLg8",
          description: "Understanding and converting space advantages in chess",
          duration: "33:17",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'calculation': {
      keywords: ['calculation', 'calculating', 'variations', 'analysis', 'visualization'],
      videos: [
        {
          title: "How to Calculate Like a Chess Master",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=cF9xJ8F7Kls",
          description: "Advanced calculation techniques and accuracy improvement methods",
          duration: "47:12",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['middlegame']
        }
      ]
    },
    'development': {
      keywords: ['development', 'developing', 'piece development', 'underdeveloped', 'slow development'],
      videos: [
        {
          title: "Opening Development: Getting Your Pieces Out Fast",
          channel: "GothamChess",
          url: "https://youtube.com/watch?v=OCSbzArwB10",
          description: "Master the art of quick and effective piece development",
          duration: "18:35",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['opening']
        }
      ]
    },
    'center_control': {
      keywords: ['center control', 'central control', 'center', 'central squares', 'e4', 'd4', 'e5', 'd5'],
      videos: [
        {
          title: "Center Control: The Heart of Chess Strategy",
          channel: "Chess.com",
          url: "https://youtube.com/watch?v=Txvz97tzDfM",
          description: "Understanding and fighting for central control in chess",
          duration: "24:17",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['opening', 'middlegame']
        }
      ]
    },
    'castling': {
      keywords: ['castling', 'king safety', 'castle', 'kingside castling', 'queenside castling'],
      videos: [
        {
          title: "King Safety and Castling: Protecting Your Most Important Piece",
          channel: "Saint Louis Chess Club",
          url: "https://youtube.com/watch?v=kL8g7cxJ9vM",
          description: "When and how to castle for optimal king safety",
          duration: "26:48",
          skillLevel: ['beginner', 'intermediate'],
          gamePhase: ['opening']
        }
      ]
    },
    'time_pressure': {
      keywords: ['time pressure', 'time trouble', 'clock', 'time management', 'blunders', 'rushing'],
      videos: [
        {
          title: "Time Management in Chess: Think Fast, Play Better",
          channel: "Chess.com",
          url: "https://youtube.com/watch?v=tM8fxE8Qb4s",
          description: "Strategies for effective time management and avoiding time pressure blunders",
          duration: "19:43",
          skillLevel: ['intermediate', 'advanced'],
          gamePhase: ['mixed']
        }
      ]
    }
  };

  /**
   * Analyzes user's weaknesses and generates a comprehensive weakness profile
   */
  private analyzeWeaknessProfile(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): WeaknessProfile {
    // Find the most frequent and impactful weakness
    const sortedWeaknesses = recurringWeaknesses.sort((a, b) => b.frequency - a.frequency);
    const primaryWeakness = sortedWeaknesses[0];

    // Extract all text from weakness for keyword analysis
    const allWeaknessText = [
      primaryWeakness.title,
      primaryWeakness.description,
      primaryWeakness.improvementSuggestion,
      ...primaryWeakness.examples.map(ex => `${ex.mistake} ${ex.betterMove} ${ex.position}`)
    ].join(' ').toLowerCase();

    // Determine game phase based on move numbers and context
    let gamePhase: 'opening' | 'middlegame' | 'endgame' | 'mixed' = 'mixed';
    
    if (primaryWeakness.examples.length > 0) {
      const avgMoveNumber = primaryWeakness.examples.reduce((sum, ex) => sum + ex.moveNumber, 0) / primaryWeakness.examples.length;
      
      if (avgMoveNumber <= 15) {
        gamePhase = 'opening';
      } else if (avgMoveNumber <= 40) {
        gamePhase = 'middlegame';
      } else {
        gamePhase = 'endgame';
      }
    }

    // Override based on explicit phase mentions
    if (allWeaknessText.includes('opening') || allWeaknessText.includes('development') || allWeaknessText.includes('castling')) {
      gamePhase = 'opening';
    } else if (allWeaknessText.includes('endgame') || allWeaknessText.includes('pawn ending') || allWeaknessText.includes('king and pawn')) {
      gamePhase = 'endgame';
    }

    // Determine skill level based on analysis ratings
    const avgRating = (middleGameAnalysis.overallRating + endgameAnalysis.overallRating) / 2;
    let skillLevel: 'beginner' | 'intermediate' | 'advanced';
    
    if (avgRating <= 4) {
      skillLevel = 'beginner';
    } else if (avgRating <= 7) {
      skillLevel = 'intermediate';
    } else {
      skillLevel = 'advanced';
    }

    // Extract specific keywords and patterns from the weakness text
    const specificPatterns = this.extractSpecificKeywords(allWeaknessText, primaryWeakness.examples);

    // Create contextual description
    const context = this.generateWeaknessContext(primaryWeakness, middleGameAnalysis, endgameAnalysis);

    return {
      primaryWeakness: primaryWeakness.title,
      specificPatterns,
      gamePhase,
      skillLevel,
      frequency: primaryWeakness.frequency,
      context
    };
  }

  /**
   * Extracts specific chess keywords from weakness descriptions and examples
   */
  private extractSpecificKeywords(weaknessText: string, examples: any[]): string[] {
    const keywords = new Set<string>();
    
    // Define chess-specific terms to look for
    const chessTerms = [
      // Tactical terms
      'pin', 'pinned', 'pinning', 'fork', 'forked', 'forking', 'skewer', 'skewered',
      'discovered attack', 'double attack', 'deflection', 'decoy', 'clearance',
      'back rank', 'back-rank', 'mate threat', 'checkmate', 'check',
      
      // Positional terms
      'weak square', 'weak squares', 'outpost', 'hole', 'pawn structure',
      'pawn break', 'pawn chain', 'isolated pawn', 'doubled pawn', 'backward pawn',
      'piece activity', 'active piece', 'passive piece', 'coordination',
      'space advantage', 'cramped', 'planning', 'plan', 'strategy',
      
      // Opening terms
      'development', 'developing', 'underdeveloped', 'center control', 'central control',
      'castling', 'castle', 'king safety', 'opening principle',
      
      // Endgame terms
      'pawn endgame', 'pawn ending', 'king activity', 'active king', 'opposition',
      'zugzwang', 'rook endgame', 'rook ending', 'promotion', 'passed pawn',
      
      // General terms
      'calculation', 'calculating', 'analysis', 'visualization', 'blunder',
      'time pressure', 'time trouble', 'time management', 'accuracy'
    ];

    // Extract keywords from weakness text
    for (const term of chessTerms) {
      if (weaknessText.includes(term)) {
        keywords.add(term);
      }
    }

    // Extract specific move-related keywords from examples
    for (const example of examples) {
      const exampleText = `${example.mistake} ${example.betterMove}`.toLowerCase();
      
      // Look for specific piece moves and patterns
      const piecePatterns = [
        /([a-h][1-8])/g, // Square references
        /(knight|bishop|rook|queen|king|pawn)/g, // Piece names
        /(capture|takes|x)/g, // Capture notation
        /(check|mate|\+|#)/g, // Check/mate symbols
        /(castle|castling|o-o)/g // Castling
      ];

      for (const pattern of piecePatterns) {
        const matches = exampleText.match(pattern);
        if (matches) {
          matches.forEach(match => keywords.add(match));
        }
      }
    }

    return Array.from(keywords);
  }

  /**
   * Generates contextual description of the weakness
   */
  private generateWeaknessContext(
    weakness: RecurringWeakness,
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): string {
    const contexts = [];
    
    // Add frequency context
    if (weakness.frequency >= 5) {
      contexts.push(`occurs very frequently (${weakness.frequency} times)`);
    } else if (weakness.frequency >= 3) {
      contexts.push(`occurs regularly (${weakness.frequency} times)`);
    }

    // Add skill area context
    if (middleGameAnalysis.patterns.tacticalAwareness <= 4) {
      contexts.push('particularly in tactical situations');
    }
    
    if (middleGameAnalysis.patterns.positionalUnderstanding <= 4) {
      contexts.push('especially in positional evaluations');
    }

    // Add specific game examples context
    if (weakness.examples.length > 0) {
      const moveNumbers = weakness.examples.map(ex => ex.moveNumber);
      const avgMove = moveNumbers.reduce((a, b) => a + b, 0) / moveNumbers.length;
      
      if (avgMove <= 15) {
        contexts.push('mainly in the opening phase');
      } else if (avgMove <= 40) {
        contexts.push('primarily in middlegame positions');
      } else {
        contexts.push('often in endgame scenarios');
      }
    }

    return contexts.join(', ');
  }

  /**
   * Matches weakness profile to the most appropriate video category using keyword analysis
   */
  private matchWeaknessToCategory(profile: WeaknessProfile): string {
    const userKeywords = profile.specificPatterns.map(p => p.toLowerCase());
    const weaknessText = profile.primaryWeakness.toLowerCase();
    const contextText = profile.context.toLowerCase();
    const allUserText = [...userKeywords, weaknessText, contextText];

    // Calculate match scores for each category
    const categoryScores: { [key: string]: number } = {};

    for (const [categoryName, categoryData] of Object.entries(this.videoDatabase)) {
      let score = 0;
      
      // Check for exact keyword matches
      for (const keyword of categoryData.keywords) {
        for (const userText of allUserText) {
          if (userText.includes(keyword.toLowerCase())) {
            // Give higher score for exact matches
            score += keyword.length > 3 ? 3 : 2;
          }
        }
      }

      // Bonus for specific tactical patterns
      if (categoryName === 'pins' && (userKeywords.some(k => k.includes('pin')) || weaknessText.includes('pin'))) {
        score += 5;
      }
      if (categoryName === 'forks' && (userKeywords.some(k => k.includes('fork')) || weaknessText.includes('fork'))) {
        score += 5;
      }
      if (categoryName === 'skewers' && (userKeywords.some(k => k.includes('skewer')) || weaknessText.includes('skewer'))) {
        score += 5;
      }
      if (categoryName === 'back_rank_mate' && (userKeywords.some(k => k.includes('back rank')) || weaknessText.includes('back rank'))) {
        score += 5;
      }

      // Bonus for game phase matching
      if (categoryName.includes('endgame') && profile.gamePhase === 'endgame') {
        score += 2;
      }
      if ((categoryName === 'development' || categoryName === 'center_control' || categoryName === 'castling') && profile.gamePhase === 'opening') {
        score += 2;
      }

      categoryScores[categoryName] = score;
    }

    // Find the category with the highest score
    const bestMatch = Object.entries(categoryScores).reduce((best, current) => 
      current[1] > best[1] ? current : best
    );

    // If no good match found, use fallback logic
    if (bestMatch[1] === 0) {
      return this.getFallbackCategory(profile);
    }

    return bestMatch[0];
  }

  /**
   * Provides fallback category when no specific match is found
   */
  private getFallbackCategory(profile: WeaknessProfile): string {
    // Use game phase as fallback
    if (profile.gamePhase === 'endgame') {
      return 'pawn_endgames'; // Most common endgame type
    }
    if (profile.gamePhase === 'opening') {
      return 'development'; // Most common opening issue
    }
    
    // Default to calculation for middlegame issues
    return 'calculation';
  }

  /**
   * Selects the best video from the matched category
   */
  private selectBestVideo(category: string, profile: WeaknessProfile): VideoRecommendation {
    const categoryData = this.videoDatabase[category];
    if (!categoryData) {
      // Fallback to a general video
      return this.getFallbackVideo(profile);
    }

    // Filter videos by skill level and game phase
    const suitableVideos = categoryData.videos.filter(video => {
      const skillMatch = video.skillLevel.includes(profile.skillLevel) ||
                        (profile.skillLevel === 'intermediate' && video.skillLevel.includes('beginner'));
      
      const phaseMatch = video.gamePhase.includes(profile.gamePhase) ||
                        video.gamePhase.includes('mixed') ||
                        profile.gamePhase === 'mixed';

      return skillMatch && phaseMatch;
    });

    // If no suitable videos, use any from the category
    const videosToChoose = suitableVideos.length > 0 ? suitableVideos : categoryData.videos;
    
    // Select the most appropriate video (prefer first match for now, could add more sophisticated scoring)
    const selectedVideo = videosToChoose[0];

    // Generate search query for dynamic discovery
    const searchQuery = this.generateSearchQuery(profile, categoryData.keywords);

    return {
      title: selectedVideo.title,
      channel: selectedVideo.channel,
      url: selectedVideo.url,
      description: this.customizeDescription(selectedVideo.description, profile),
      relevantWeakness: profile.primaryWeakness,
      duration: selectedVideo.duration,
      searchQuery
    };
  }

  /**
   * Generates a search query for dynamic video discovery based on specific user keywords
   */
  private generateSearchQuery(profile: WeaknessProfile, keywords: string[]): string {
    const searchTerms = [];

    // Prioritize user's specific keywords
    const userSpecificTerms = profile.specificPatterns
      .filter(pattern => pattern.length > 2) // Filter out very short terms
      .slice(0, 3); // Take top 3 most relevant

    if (userSpecificTerms.length > 0) {
      searchTerms.push(...userSpecificTerms);
    } else {
      // Fallback to category keywords
      searchTerms.push(...keywords.slice(0, 2));
    }

    // Add primary weakness terms
    const weaknessWords = profile.primaryWeakness
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 3 && !['chess', 'game', 'player'].includes(word))
      .slice(0, 2);
    
    searchTerms.push(...weaknessWords);

    // Add skill level for more targeted results
    if (profile.skillLevel !== 'intermediate') {
      searchTerms.push(profile.skillLevel);
    }

    // Add game phase for context
    if (profile.gamePhase !== 'mixed') {
      searchTerms.push(profile.gamePhase);
    }

    // Create final search query
    const uniqueTerms = Array.from(new Set(searchTerms)); // Remove duplicates
    return `${uniqueTerms.join(' ')} chess tutorial explanation`.trim();
  }

  /**
   * Customizes video description based on user's specific weakness and extracted keywords
   */
  private customizeDescription(baseDescription: string, profile: WeaknessProfile): string {
    const specificKeywords = profile.specificPatterns.slice(0, 3).join(', ');
    
    let customization = `This video directly addresses your primary weakness: ${profile.primaryWeakness}. `;
    
    // Add specific keyword context
    if (specificKeywords) {
      customization += `Focus on the sections covering: ${specificKeywords}. `;
    }

    // Add frequency context
    if (profile.frequency >= 5) {
      customization += `Since this pattern appears very frequently in your games (${profile.frequency} times), mastering this concept will have immediate impact on your results. `;
    } else if (profile.frequency >= 3) {
      customization += `This recurring issue (${profile.frequency} occurrences) is limiting your progress. `;
    }

    // Add game phase context
    if (profile.gamePhase !== 'mixed') {
      customization += `Pay special attention to ${profile.gamePhase} applications. `;
    }

    return customization + baseDescription;
  }

  /**
   * Provides a fallback video when no specific match is found
   */
  private getFallbackVideo(profile: WeaknessProfile): VideoRecommendation {
    // Create a more specific fallback based on user's keywords
    const specificKeywords = profile.specificPatterns.slice(0, 2).join(' ');
    const searchQuery = specificKeywords 
      ? `${specificKeywords} ${profile.primaryWeakness} chess tutorial`
      : `${profile.primaryWeakness} chess improvement tutorial`;

    return {
      title: "35 Vital Chess Principles in 35 Minutes",
      channel: "Chess Vibes", 
      url: "https://youtube.com/watch?v=nXyJdetptXg",
      description: `This comprehensive video covers fundamental chess principles that will help address your primary weakness: ${profile.primaryWeakness}. ${specificKeywords ? `Look for sections on: ${specificKeywords}.` : ''} The broad coverage ensures you'll find relevant insights for your specific issues.`,
      relevantWeakness: profile.primaryWeakness,
      duration: "35:42",
      searchQuery
    };
  }

  /**
   * Main method to get personalized video recommendation
   */
  public getPersonalizedVideoRecommendation(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): VideoRecommendation {
    // Analyze user's weakness profile
    const profile = this.analyzeWeaknessProfile(recurringWeaknesses, middleGameAnalysis, endgameAnalysis);
    
    // Match to appropriate category
    const category = this.matchWeaknessToCategory(profile);
    
    // Select and customize the best video
    const recommendation = this.selectBestVideo(category, profile);
    
    return recommendation;
  }

  /**
   * Get search query for dynamic video discovery (for future API integration)
   */
  public getSearchQueryForWeakness(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): string {
    const profile = this.analyzeWeaknessProfile(recurringWeaknesses, middleGameAnalysis, endgameAnalysis);
    const category = this.matchWeaknessToCategory(profile);
    const categoryData = this.videoDatabase[category];
    
    return this.generateSearchQuery(profile, categoryData?.keywords || ['chess', 'improvement']);
  }
}

export const videoRecommendationService = new VideoRecommendationService();
export type { VideoRecommendation, WeaknessProfile };