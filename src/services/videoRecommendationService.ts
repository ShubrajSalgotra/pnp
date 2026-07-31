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
  /**
   * oembed-verified educational watch URLs (researched 2026-07).
   * Each category gets distinct lessons — avoid reusing the same URL across themes.
   */
  private readonly verifiedUrls = {
    pins: 'https://www.youtube.com/watch?v=lcdrgk1Im0Q',
    forks: 'https://www.youtube.com/watch?v=QhjJL41Wz9Y',
    skewers: 'https://www.youtube.com/watch?v=0GPMzLS-u3A',
    discoveredAttacks: 'https://www.youtube.com/watch?v=XTNplr3nwck',
    backRank: 'https://www.youtube.com/watch?v=iIc4JdGqX3w',
    deflection: 'https://www.youtube.com/watch?v=1p9yaWZKNKY',
    interference: 'https://www.youtube.com/watch?v=0ehLrDd2pn4',
    clearance: 'https://www.youtube.com/watch?v=3wTn5RNleME',
    overloading: 'https://www.youtube.com/watch?v=oQQPRaSO9Eg',
    zwischenzug: 'https://www.youtube.com/watch?v=8fB8CoomhNw',
    weakSquares: 'https://www.youtube.com/watch?v=jEehFvnO3ZA',
    pawnStructures: 'https://www.youtube.com/watch?v=Ed7YLNLm8iY',
    pawnBreakthroughs: 'https://www.youtube.com/watch?v=ibe2x66VEdQ',
    hangingPawns: 'https://www.youtube.com/watch?v=OlbF8j6_0KU',
    minorityAttack: 'https://www.youtube.com/watch?v=kx-bKo7XB-w',
    iqp: 'https://www.youtube.com/watch?v=vxDSXwYl-Ns',
    bishopVsKnight: 'https://www.youtube.com/watch?v=E3gIjes-Sxc',
    prophylaxis: 'https://www.youtube.com/watch?v=QgMVXBDJbZg',
    spaceAdvantage: 'https://www.youtube.com/watch?v=t81S1wLUOcU',
    planning: 'https://www.youtube.com/watch?v=9PrGtLmfsnQ',
    pawnBreaks: 'https://www.youtube.com/watch?v=jv1PAS-zGrw',
    pawnMiddlegame: 'https://www.youtube.com/watch?v=h58-sBkPQt8',
    openFiles: 'https://www.youtube.com/watch?v=cKs0m3Kj_Jc',
    openFilesAlt: 'https://www.youtube.com/watch?v=cDIWd1UnMP0',
    initiative: 'https://www.youtube.com/watch?v=ABk2HS8r4uc',
    lucena: 'https://www.youtube.com/watch?v=V1QXsV9SKlk',
    philidor: 'https://www.youtube.com/watch?v=qftbzl1dZws',
    philidorAlt: 'https://www.youtube.com/watch?v=FXxgPK5AceU',
    opposition: 'https://www.youtube.com/watch?v=v5HBtQ7KHNo',
    zugzwang: 'https://www.youtube.com/watch?v=zSKaXg_kkFs',
    passedPawns: 'https://www.youtube.com/watch?v=W0Lw4ox_n_M',
    passedPawnsAlt: 'https://www.youtube.com/watch?v=ni8UxqjSRPM',
    oppositeBishops: 'https://www.youtube.com/watch?v=3IvFxKm5Y-Y',
    fortress: 'https://www.youtube.com/watch?v=k8yZE4p0arw',
    rookMate: 'https://www.youtube.com/watch?v=hpq5_jr5IQg',
    kingActivity: 'https://www.youtube.com/watch?v=mhUoe2JBxco',
    calculation: 'https://www.youtube.com/watch?v=fHtMC-EqYhs',
    calculationAlt: 'https://www.youtube.com/watch?v=4KBOBEsciwA',
    candidateMoves: 'https://www.youtube.com/watch?v=o_-tynR20mk',
    timeManagement: 'https://www.youtube.com/watch?v=d_K8Xe3obMM',
    blitzTips: 'https://www.youtube.com/watch?v=xyBYrbiZ9_M',
    castling: 'https://www.youtube.com/watch?v=0boZ1OZSHeE',
    firstMoves: 'https://www.youtube.com/watch?v=6Ly7c0uNuUw',
    openings: 'https://www.youtube.com/watch?v=cfiaB9PtvAo',
    italian: 'https://www.youtube.com/watch?v=qUews8fEGkc',
    italianAlt: 'https://www.youtube.com/watch?v=5aM6KP2VJtk',
    queensGambit: 'https://www.youtube.com/watch?v=mtsabsZ4wG4',
    queensGambitAlt: 'https://www.youtube.com/watch?v=KEmkjOL_hCc',
    sicilian: 'https://www.youtube.com/watch?v=qM4e7g2RukI',
    sicilianAlt: 'https://www.youtube.com/watch?v=0iAyyKxh3zc',
    london: 'https://www.youtube.com/watch?v=49H728S_VjM',
    londonAlt: 'https://www.youtube.com/watch?v=dMNnjwT0RPE',
    caroKann: 'https://www.youtube.com/watch?v=rmbU97iftC8',
    caroKannAlt: 'https://www.youtube.com/watch?v=0p_881Nwoo4',
    french: 'https://www.youtube.com/watch?v=5pec-u6PSvA',
    frenchAlt: 'https://www.youtube.com/watch?v=vOw5BQYCfWA',
    ruyLopez: 'https://www.youtube.com/watch?v=IQrtrPvU3bQ',
    ruyLopezAlt: 'https://www.youtube.com/watch?v=xD0iTgHMQVQ',
  } as const;

  private watchVideo(
    title: string,
    channel: string,
    url: string,
    description: string,
    skillLevel: string[],
    gamePhase: string[],
    duration?: string
  ) {
    return { title, channel, url, description, duration, skillLevel, gamePhase };
  }

  private videoDatabase: VideoDatabase = {
    pins: {
      keywords: ['pin', 'pinned', 'pinning', 'absolute pin', 'relative pin'],
      videos: [
        this.watchVideo('How to use Pins in Chess!', 'Chesski', this.verifiedUrls.pins, 'Create and exploit pins in practical games', ['beginner', 'intermediate'], ['middlegame', 'opening'], '12:00'),
      ],
    },
    forks: {
      keywords: ['fork', 'forked', 'forking', 'knight fork', 'double attack'],
      videos: [
        this.watchVideo('THE FORK', 'GothamChess', this.verifiedUrls.forks, 'Spot and execute fork / double-attack patterns', ['beginner', 'intermediate'], ['middlegame'], '10:00'),
      ],
    },
    skewers: {
      keywords: ['skewer', 'skewered', 'skewering', 'x-ray'],
      videos: [
        this.watchVideo('10 Levels of Tactics: Master the Skewer', 'Chess.com', this.verifiedUrls.skewers, 'Skewer patterns from basic to advanced', ['intermediate'], ['middlegame'], '15:00'),
      ],
    },
    discovered_attacks: {
      keywords: ['discovered attack', 'discovered check', 'discovery'],
      videos: [
        this.watchVideo('Discovered Attack Chess Tactic', 'thechesswebsite', this.verifiedUrls.discoveredAttacks, 'Concepts and examples of discovered attacks', ['intermediate', 'advanced'], ['middlegame'], '12:00'),
      ],
    },
    deflection: {
      keywords: ['deflection', 'deflect', 'decoy', 'remove the defender'],
      videos: [
        this.watchVideo('8 Examples of Deflection Tactics In Chess', 'Chess Vibes', this.verifiedUrls.deflection, 'Practical deflection patterns that win material', ['intermediate'], ['middlegame'], '14:00'),
      ],
    },
    interference: {
      keywords: ['interference', 'interfere', 'obstruction'],
      videos: [
        this.watchVideo('4 Levels of INTERFERENCE (Chess Tactic)', 'Chess Vibes', this.verifiedUrls.interference, 'Interference tactics across difficulty levels', ['intermediate', 'advanced'], ['middlegame'], '12:00'),
      ],
    },
    clearance: {
      keywords: ['clearance', 'clearance sacrifice', 'vacating'],
      videos: [
        this.watchVideo('Clearance Sacrifices', 'LET\'S LEARN CHESS', this.verifiedUrls.clearance, 'Clearance sacrifices that open lines and squares', ['intermediate'], ['middlegame'], '10:00'),
      ],
    },
    overloading: {
      keywords: ['overload', 'overloading', 'overworked'],
      videos: [
        this.watchVideo('10 Levels of Tactics: Master Overloading', 'the chess nerd', this.verifiedUrls.overloading, 'Exploit overworked defenders', ['intermediate', 'advanced'], ['middlegame'], '12:00'),
      ],
    },
    zwischenzug: {
      keywords: ['zwischenzug', 'in-between', 'intermediate move', 'intermezzo'],
      videos: [
        this.watchVideo('Zwischenzug: IN BETWEEN MOVES!!', 'two niche', this.verifiedUrls.zwischenzug, 'Spot powerful in-between moves before recapturing', ['intermediate', 'advanced'], ['middlegame'], '8:00'),
      ],
    },
    back_rank_mate: {
      keywords: ['back rank', 'back-rank', 'back rank mate', 'escape squares'],
      videos: [
        this.watchVideo('Chess Back Rank Checkmate', 'ChessNetwork', this.verifiedUrls.backRank, 'Recognize and execute back-rank mate patterns', ['beginner', 'intermediate'], ['middlegame', 'endgame'], '8:00'),
      ],
    },
    weak_squares: {
      keywords: ['weak squares', 'weak square', 'outpost', 'holes', 'square weakness'],
      videos: [
        this.watchVideo('Weak Squares and Outposts', 'Hanging Pawns', this.verifiedUrls.weakSquares, 'Identify holes and plant unassailable pieces', ['intermediate', 'advanced'], ['middlegame'], '25:34'),
      ],
    },
    pawn_structure: {
      keywords: ['pawn structure', 'pawn chain', 'isolated pawn', 'doubled pawn', 'backward pawn', 'hanging pawns'],
      videos: [
        this.watchVideo('Understanding Pawn Structure', 'Hanging Pawns', this.verifiedUrls.pawnStructures, 'Evaluate and play typical pawn structures', ['intermediate', 'advanced'], ['middlegame'], '20:00'),
        this.watchVideo('Pawn Breakthroughs', 'Hanging Pawns', this.verifiedUrls.pawnBreakthroughs, 'Breakthrough motifs in pawn structures', ['intermediate', 'advanced'], ['middlegame'], '18:00'),
      ],
    },
    minority_attack: {
      keywords: ['minority attack', 'queenside minority', 'pawn minority'],
      videos: [
        this.watchVideo('Minority Attack Ideas, Concepts and Examples', 'Chess Vibes', this.verifiedUrls.minorityAttack, 'Classic minority-attack plans and structures', ['intermediate', 'advanced'], ['middlegame'], '16:00'),
      ],
    },
    isolated_queen_pawn: {
      keywords: ['isolated queen pawn', 'iqp', 'isolani', 'isolated pawn'],
      videos: [
        this.watchVideo('Isolated Queen\'s Pawn Strategy', 'Pegasus Chess', this.verifiedUrls.iqp, 'Attacking and defending IQP positions', ['intermediate', 'advanced'], ['middlegame'], '15:00'),
      ],
    },
    bishop_vs_knight: {
      keywords: ['bishop vs knight', 'good knight', 'bad bishop', 'knight vs bishop', 'minor piece'],
      videos: [
        this.watchVideo('Knights vs Bishops | Middlegame Chess Strategy', 'Coach B.', this.verifiedUrls.bishopVsKnight, 'When to prefer knights or bishops', ['intermediate', 'advanced'], ['middlegame'], '14:00'),
      ],
    },
    prophylaxis: {
      keywords: ['prophylaxis', 'prophylactic', 'prevent', 'petrosian'],
      videos: [
        this.watchVideo('Prophylaxis | Chess Middlegames', 'Hanging Pawns', this.verifiedUrls.prophylaxis, 'Stop opponent plans before they start', ['intermediate', 'advanced'], ['middlegame'], '20:00'),
      ],
    },
    space_advantage: {
      keywords: ['space advantage', 'space', 'cramped', 'expanding', 'territory'],
      videos: [
        this.watchVideo('Space Advantage | Chess Middlegames', 'Hanging Pawns', this.verifiedUrls.spaceAdvantage, 'Use space and punish cramped setups', ['intermediate', 'advanced'], ['middlegame'], '18:00'),
      ],
    },
    planning: {
      keywords: ['planning', 'plan', 'strategic plan', 'long-term plan', 'positional plan', 'creating a plan'],
      videos: [
        this.watchVideo('Creating Strategic Plans', 'Hanging Pawns', this.verifiedUrls.planning, 'Build coherent middlegame plans from the structure', ['intermediate', 'advanced'], ['middlegame'], '22:00'),
      ],
    },
    pawn_breaks: {
      keywords: ['pawn break', 'pawn breaks', 'lever', 'pawn lever', 'f5', 'c5', 'e5', 'd5 break'],
      videos: [
        this.watchVideo('Master the Pawn Break In Chess', 'Critical Chess', this.verifiedUrls.pawnBreaks, 'Timing and preparation for critical pawn breaks', ['intermediate', 'advanced'], ['middlegame'], '15:00'),
        this.watchVideo('How To Use Pawns In Chess Middlegames', 'GothamChess', this.verifiedUrls.pawnMiddlegame, 'Practical pawn play in the middlegame', ['beginner', 'intermediate'], ['middlegame'], '12:00'),
      ],
    },
    open_files: {
      keywords: ['open file', 'open files', 'rook file', 'seventh rank', '7th rank'],
      videos: [
        this.watchVideo('Why Rooks ❤️ Open Files & 7th Rank', 'Remote Chess Academy', this.verifiedUrls.openFiles, 'Seize open files and invade the 7th rank', ['beginner', 'intermediate'], ['middlegame'], '12:00'),
        this.watchVideo('Why put ROOK on an OPEN FILE', 'Remote Chess Academy', this.verifiedUrls.openFilesAlt, 'How and why to contest open files', ['beginner', 'intermediate'], ['middlegame'], '10:00'),
      ],
    },
    piece_activity: {
      keywords: ['piece activity', 'active pieces', 'passive pieces', 'piece coordination', 'improving pieces', 'worst piece'],
      videos: [
        this.watchVideo('Hanging Pawns | Chess Middlegames', 'Hanging Pawns', this.verifiedUrls.hangingPawns, 'Piece activity and coordination principles', ['intermediate', 'advanced'], ['middlegame'], '22:15'),
        this.watchVideo('Creating Strategic Plans', 'Hanging Pawns', this.verifiedUrls.planning, 'Improve pieces as part of a clear plan', ['intermediate', 'advanced'], ['middlegame'], '22:00'),
      ],
    },
    initiative: {
      keywords: ['initiative', 'tempo', 'attacking initiative', 'seizing initiative'],
      videos: [
        this.watchVideo('Initiative in Chess', 'Coach Daniel Greiner', this.verifiedUrls.initiative, 'How to seize and keep the initiative', ['intermediate', 'advanced'], ['middlegame'], '14:00'),
      ],
    },
    pawn_endgames: {
      keywords: ['pawn endgame', 'pawn ending', 'king and pawn', 'opposition', 'zugzwang', 'pawn promotion'],
      videos: [
        this.watchVideo('Chess Endgame: Opposition & Pawn Promotion', 'ChessNetwork', this.verifiedUrls.opposition, 'Opposition technique in king-and-pawn endings', ['beginner', 'intermediate'], ['endgame'], '15:00'),
        this.watchVideo('The Zugzwang', 'the chess nerd', this.verifiedUrls.zugzwang, 'Force zugzwang in simplified endings', ['intermediate', 'advanced'], ['endgame'], '8:00'),
        this.watchVideo('Principles of Chess Endgames | King Activity', 'Hanging Pawns', this.verifiedUrls.kingActivity, 'Activate the king in pawn endings', ['beginner', 'intermediate'], ['endgame'], '18:00'),
      ],
    },
    rook_endgames: {
      keywords: ['rook endgame', 'rook ending', 'lucena', 'philidor', 'rook and pawn'],
      videos: [
        this.watchVideo('Learn the Lucena Position (The Shield)', 'ChessNetwork', this.verifiedUrls.lucena, 'Build the bridge in Lucena positions', ['intermediate', 'advanced'], ['endgame'], '12:30'),
        this.watchVideo('Philidor Position - Rook and Pawn Endgames', 'Hanging Pawns', this.verifiedUrls.philidor, 'Hold draws with the Philidor defense', ['intermediate', 'advanced'], ['endgame'], '14:00'),
        this.watchVideo('Learn the Philidor Position', 'ChessKid', this.verifiedUrls.philidorAlt, 'Beginner-friendly Philidor technique', ['beginner', 'intermediate'], ['endgame'], '10:00'),
        this.watchVideo('Chess Endgame: How to Checkmate with a Rook', 'ChessNetwork', this.verifiedUrls.rookMate, 'Basic rook mating patterns', ['beginner'], ['endgame'], '8:00'),
      ],
    },
    passed_pawns: {
      keywords: ['passed pawn', 'passed pawns', 'outside passed', 'protected passed'],
      videos: [
        this.watchVideo('Understanding Passed Pawns', 'GM Naroditsky', this.verifiedUrls.passedPawns, 'Naroditsky on creating and using passed pawns', ['intermediate', 'advanced'], ['endgame', 'middlegame'], '20:00'),
        this.watchVideo('Passed Pawns | Chess Endgames', 'NM Robert Ramirez', this.verifiedUrls.passedPawnsAlt, 'Practical passed-pawn endgame technique', ['beginner', 'intermediate'], ['endgame'], '12:00'),
      ],
    },
    opposite_bishops: {
      keywords: ['opposite color', 'opposite-colored', 'opposite bishops', 'opposite coloured'],
      videos: [
        this.watchVideo('Opposite Colored Bishop Endgame!', 'the chess nerd', this.verifiedUrls.oppositeBishops, 'Attacking and drawing OCB endings', ['intermediate', 'advanced'], ['endgame'], '12:00'),
      ],
    },
    fortress: {
      keywords: ['fortress', 'fortresses', 'defensive fortress'],
      videos: [
        this.watchVideo('How to build a Fortress in Chess', 'Chess.com', this.verifiedUrls.fortress, 'Must-know defensive fortress ideas', ['intermediate', 'advanced'], ['endgame'], '12:00'),
      ],
    },
    king_activity: {
      keywords: ['king activity', 'active king', 'king centralization', 'king in endgame'],
      videos: [
        this.watchVideo('Principles of Chess Endgames | King Activity', 'Hanging Pawns', this.verifiedUrls.kingActivity, 'Centralize and activate the king', ['beginner', 'intermediate'], ['endgame'], '18:00'),
      ],
    },
    calculation: {
      keywords: ['calculation', 'calculating', 'variations', 'visualization', 'candidate moves', 'tactics'],
      videos: [
        this.watchVideo('How To Calculate & Find Tactics In Chess', 'Remote Chess Academy', this.verifiedUrls.calculation, 'Structured calculation for finding tactics', ['intermediate', 'advanced'], ['middlegame'], '20:00'),
        this.watchVideo('This Simple Method Helps You Calculate Better', 'Remote Chess Academy', this.verifiedUrls.calculationAlt, 'A practical calculation method under pressure', ['intermediate'], ['middlegame', 'mixed'], '25:00'),
        this.watchVideo('How to choose candidate moves', 'mate_tricks', this.verifiedUrls.candidateMoves, 'Generate candidate moves before calculating', ['intermediate', 'advanced'], ['middlegame'], '10:00'),
      ],
    },
    time_pressure: {
      keywords: ['time pressure', 'time trouble', 'clock', 'time management', 'blitz', 'bullet', 'rushing'],
      videos: [
        this.watchVideo('Time Management In Chess', 'GothamChess', this.verifiedUrls.timeManagement, 'Allocate clock time without blundering', ['beginner', 'intermediate', 'advanced'], ['mixed'], '15:00'),
        this.watchVideo('7 Blitz & Bullet Chess Tips from Hikaru Nakamura', 'Remote Chess Academy', this.verifiedUrls.blitzTips, 'Practical tips for fast time controls', ['intermediate', 'advanced'], ['mixed'], '12:00'),
      ],
    },
    development: {
      keywords: ['development', 'developing', 'underdeveloped', 'opening principle', 'slow development'],
      videos: [
        this.watchVideo('The ONLY Opening You Should Learn as a Chess Beginner', 'Nemo', this.verifiedUrls.openings, 'Sound opening development principles', ['beginner', 'intermediate'], ['opening'], '15:00'),
        this.watchVideo('The Top 3 First Moves In Chess', 'Chess.com', this.verifiedUrls.firstMoves, 'Fight for the center from move one', ['beginner'], ['opening'], '12:00'),
      ],
    },
    center_control: {
      keywords: ['center control', 'central control', 'central squares', 'occupy the center'],
      videos: [
        this.watchVideo('The Top 3 First Moves In Chess', 'Chess.com', this.verifiedUrls.firstMoves, 'Central control with the best first moves', ['beginner', 'intermediate'], ['opening', 'middlegame'], '12:00'),
      ],
    },
    castling: {
      keywords: ['castling', 'king safety', 'castle', 'kingside castling', 'queenside castling'],
      videos: [
        this.watchVideo('How Does Castling In Chess Work?', 'Chess.com', this.verifiedUrls.castling, 'Rules and timing for castling safely', ['beginner', 'intermediate'], ['opening'], '8:00'),
      ],
    },
    italian_game: {
      keywords: ['italian', 'italian game', 'giuoco piano', 'two knights', 'evans gambit'],
      videos: [
        this.watchVideo('Italian Game Chess Opening Explained in 20 Minutes', 'Remote Chess Academy', this.verifiedUrls.italian, 'Crash course on Italian Game plans', ['beginner', 'intermediate'], ['opening'], '20:00'),
        this.watchVideo('BEGINNER GUIDE TO THE ITALIAN GAME', 'Volclus', this.verifiedUrls.italianAlt, 'Beginner-friendly Italian Game overview', ['beginner'], ['opening'], '12:00'),
      ],
    },
    queens_gambit: {
      keywords: ['queen\'s gambit', 'queens gambit', 'qg', 'qgd', 'qga', 'slav'],
      videos: [
        this.watchVideo('How To Play The Queen\'s Gambit', 'GothamChess', this.verifiedUrls.queensGambit, 'Main ideas of the Queen\'s Gambit', ['beginner', 'intermediate'], ['opening'], '12:00'),
        this.watchVideo('The Queen\'s Gambit chess opening explained in 3 minutes', 'Chess Vibes', this.verifiedUrls.queensGambitAlt, 'Quick Queen\'s Gambit primer', ['beginner'], ['opening'], '3:00'),
      ],
    },
    sicilian: {
      keywords: ['sicilian', 'najdorf', 'dragon', 'sveshnikov', 'taimanov', 'kan'],
      videos: [
        this.watchVideo('The Sicilian Defense | 10-Minute Chess Openings', 'GothamChess', this.verifiedUrls.sicilian, 'Sicilian Defense foundations in 10 minutes', ['beginner', 'intermediate'], ['opening'], '10:00'),
        this.watchVideo('DOMINATE as Black with the Sicilian Defense', 'ChessPage1', this.verifiedUrls.sicilianAlt, 'Practical Sicilian plans as Black', ['intermediate'], ['opening'], '15:00'),
      ],
    },
    london_system: {
      keywords: ['london', 'london system'],
      videos: [
        this.watchVideo('Learn the London System | 10-Minute Chess Openings', 'GothamChess', this.verifiedUrls.london, 'London System setup and plans', ['beginner', 'intermediate'], ['opening'], '10:00'),
        this.watchVideo('London System Every Single Line Explained', 'Remote Chess Academy', this.verifiedUrls.londonAlt, 'Deep London System crash course', ['intermediate', 'advanced'], ['opening'], '25:00'),
      ],
    },
    caro_kann: {
      keywords: ['caro-kann', 'caro kann', 'carokann'],
      videos: [
        this.watchVideo('Learn the Caro-Kann Defense | 10-Minute Chess Openings', 'GothamChess', this.verifiedUrls.caroKann, 'Caro-Kann main ideas for Black', ['beginner', 'intermediate'], ['opening'], '10:00'),
        this.watchVideo('Learn the Caro-Kann in 8 Minutes', 'ChessPage1', this.verifiedUrls.caroKannAlt, 'Compact Caro-Kann overview', ['beginner', 'intermediate'], ['opening'], '8:00'),
      ],
    },
    french_defense: {
      keywords: ['french', 'french defense', 'winawer', 'advance french'],
      videos: [
        this.watchVideo('Learn the French Defense | 10-Minute Chess Openings', 'GothamChess', this.verifiedUrls.french, 'French Defense structures and plans', ['beginner', 'intermediate'], ['opening'], '10:00'),
        this.watchVideo('The French Defense Chess Opening Explained in 4 Minutes', 'Chess Vibes', this.verifiedUrls.frenchAlt, 'Quick French Defense primer', ['beginner'], ['opening'], '4:00'),
      ],
    },
    ruy_lopez: {
      keywords: ['ruy lopez', 'spanish', 'spanish opening', 'berlin'],
      videos: [
        this.watchVideo('Chess Openings: Ruy Lopez | Ideas, Theory, and Attacking Plans', 'Remote Chess Academy', this.verifiedUrls.ruyLopez, 'Ruy Lopez ideas and attacking plans', ['intermediate', 'advanced'], ['opening'], '18:00'),
        this.watchVideo('Ruy Lopez Chess Opening Explained in 10 Minutes', 'Remote Chess Academy', this.verifiedUrls.ruyLopezAlt, 'Ruy Lopez crash course with traps', ['beginner', 'intermediate'], ['opening'], '10:00'),
      ],
    },
  };

  /**
   * Analyzes user's weaknesses and generates a comprehensive weakness profile
   */
  private analyzeWeaknessProfile(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): WeaknessProfile {
    const sortedWeaknesses = [...(recurringWeaknesses || [])].sort((a, b) => b.frequency - a.frequency);
    const primaryWeakness = sortedWeaknesses[0] || {
      title: 'General chess improvement',
      description: 'Build calculation, planning, and endgame technique',
      frequency: 1,
      examples: [],
      improvementSuggestion: 'Study targeted lessons for your rating level',
    };

    const allWeaknessText = [
      primaryWeakness.title,
      primaryWeakness.description,
      primaryWeakness.improvementSuggestion,
      ...(primaryWeakness.examples || []).map((ex) => `${ex.mistake} ${ex.betterMove} ${ex.position}`),
      ...sortedWeaknesses.slice(0, 3).map((w) => `${w.title} ${w.description}`),
    ]
      .join(' ')
      .toLowerCase();

    let gamePhase: 'opening' | 'middlegame' | 'endgame' | 'mixed' = 'mixed';

    if (primaryWeakness.examples.length > 0) {
      const avgMoveNumber =
        primaryWeakness.examples.reduce((sum, ex) => sum + ex.moveNumber, 0) /
        primaryWeakness.examples.length;

      if (avgMoveNumber <= 15) gamePhase = 'opening';
      else if (avgMoveNumber <= 40) gamePhase = 'middlegame';
      else gamePhase = 'endgame';
    }

    if (
      allWeaknessText.includes('opening') ||
      allWeaknessText.includes('development') ||
      allWeaknessText.includes('castling') ||
      /sicilian|london|italian|caro|french|ruy|queens gambit|queen'?s gambit/.test(allWeaknessText)
    ) {
      gamePhase = 'opening';
    } else if (
      allWeaknessText.includes('endgame') ||
      allWeaknessText.includes('pawn ending') ||
      allWeaknessText.includes('lucena') ||
      allWeaknessText.includes('philidor')
    ) {
      gamePhase = 'endgame';
    }

    const avgRating = (middleGameAnalysis.overallRating + endgameAnalysis.overallRating) / 2;
    let skillLevel: 'beginner' | 'intermediate' | 'advanced';
    if (avgRating <= 4) skillLevel = 'beginner';
    else if (avgRating <= 7) skillLevel = 'intermediate';
    else skillLevel = 'advanced';

    const specificPatterns = this.extractSpecificKeywords(
      allWeaknessText,
      primaryWeakness.examples || []
    );
    const context = this.generateWeaknessContext(primaryWeakness, middleGameAnalysis, endgameAnalysis);

    return {
      primaryWeakness: primaryWeakness.title,
      specificPatterns,
      gamePhase,
      skillLevel,
      frequency: primaryWeakness.frequency,
      context,
    };
  }

  /**
   * Extracts specific chess keywords from weakness descriptions and examples
   */
  private extractSpecificKeywords(weaknessText: string, examples: any[]): string[] {
    const keywords = new Set<string>();
    
    // Define chess-specific terms to look for
    const chessTerms = [
      'pin', 'pinned', 'pinning', 'fork', 'forked', 'forking', 'skewer', 'skewered',
      'discovered attack', 'double attack', 'deflection', 'decoy', 'clearance',
      'interference', 'overload', 'overloading', 'zwischenzug', 'intermezzo',
      'back rank', 'back-rank', 'mate threat', 'checkmate',
      'weak square', 'weak squares', 'outpost', 'hole', 'pawn structure',
      'pawn break', 'pawn chain', 'isolated pawn', 'doubled pawn', 'backward pawn',
      'minority attack', 'iqp', 'isolani', 'hanging pawns',
      'piece activity', 'active piece', 'passive piece', 'coordination', 'worst piece',
      'space advantage', 'cramped', 'planning', 'plan', 'strategy', 'prophylaxis',
      'bishop vs knight', 'good knight', 'bad bishop', 'initiative', 'open file',
      'development', 'developing', 'underdeveloped', 'center control', 'central control',
      'castling', 'castle', 'king safety', 'opening principle',
      'italian', 'sicilian', 'london', 'caro-kann', 'caro kann', 'french', 'ruy lopez',
      "queen's gambit", 'queens gambit', 'najdorf', 'dragon',
      'pawn endgame', 'pawn ending', 'king activity', 'active king', 'opposition',
      'zugzwang', 'rook endgame', 'rook ending', 'promotion', 'passed pawn',
      'lucena', 'philidor', 'fortress', 'opposite color', 'opposite-colored',
      'calculation', 'calculating', 'analysis', 'visualization', 'candidate moves',
      'time pressure', 'time trouble', 'time management', 'blitz', 'accuracy',
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
    const combined = allUserText.join(' ');

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

      // Bonus for opening repertoire names
      if (categoryName === 'sicilian' && /sicilian|najdorf|dragon/.test(combined)) score += 8;
      if (categoryName === 'london_system' && /london/.test(combined)) score += 8;
      if (categoryName === 'italian_game' && /italian|giuoco/.test(combined)) score += 8;
      if (categoryName === 'queens_gambit' && /queen.?s gambit|qgd|qga|slav/.test(combined)) score += 8;
      if (categoryName === 'caro_kann' && /caro/.test(combined)) score += 8;
      if (categoryName === 'french_defense' && /french/.test(combined)) score += 8;
      if (categoryName === 'ruy_lopez' && /ruy|spanish|berlin/.test(combined)) score += 8;
      if (categoryName === 'prophylaxis' && /prophyl/.test(combined)) score += 6;
      if (categoryName === 'minority_attack' && /minority/.test(combined)) score += 6;
      if (categoryName === 'passed_pawns' && /passed pawn/.test(combined)) score += 6;
      if (categoryName === 'pawn_breaks' && /pawn break|lever/.test(combined)) score += 6;
      if (categoryName === 'open_files' && /open file|7th rank|seventh/.test(combined)) score += 6;
      if (categoryName === 'deflection' && /deflect|decoy/.test(combined)) score += 6;

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
      if (
        (categoryName === 'development' ||
          categoryName === 'center_control' ||
          categoryName === 'castling' ||
          categoryName.endsWith('_game') ||
          categoryName.endsWith('_system') ||
          categoryName.endsWith('_defense') ||
          categoryName === 'ruy_lopez' ||
          categoryName === 'sicilian' ||
          categoryName === 'queens_gambit' ||
          categoryName === 'caro_kann') &&
        profile.gamePhase === 'opening'
      ) {
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
      url: this.resolveWatchUrl(selectedVideo.url, searchQuery),
      description: this.customizeDescription(selectedVideo.description, profile),
      relevantWeakness: profile.primaryWeakness,
      duration: selectedVideo.duration,
      searchQuery,
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
    const specificKeywords = profile.specificPatterns.slice(0, 2).join(' ');
    const searchQuery = specificKeywords
      ? `${specificKeywords} ${profile.primaryWeakness} chess tutorial`
      : `${profile.primaryWeakness} chess improvement tutorial`;

    return {
      title: 'Understanding Pawn Structure',
      channel: 'Hanging Pawns',
      url: this.verifiedUrls.pawnStructures,
      description: `Fundamental pawn-structure ideas to address your primary weakness: ${profile.primaryWeakness}. ${specificKeywords ? `Focus on sections covering: ${specificKeywords}.` : ''}`,
      relevantWeakness: profile.primaryWeakness,
      duration: '20:00',
      searchQuery,
    };
  }

  private buildYouTubeSearchUrl(query: string): string {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  }

  /**
   * Heal stored / legacy URLs so report links never open dead YouTube videos.
   * Prefer a verified watch URL; fall back to a topic search only as last resort.
   */
  public resolveWatchUrl(url: string, searchQuery: string): string {
    const fallback = this.verifiedUrls.pawnStructures;
    if (!url) return fallback;

    // Search-result pages and known-dead IDs from older report data
    const brokenIds = [
      'kL8g7cxJ9vM',
      'mK9sF4MC2Ls',
      'cF9xJ8F7Kls',
      'tM8fxE8Qb4s',
      'p3Hxk2uBLg8',
      'nXyJdetptXg',
      'Esi5jgWEP3I',
      'uszf3ZRxYMo',
      'iBZLU1FXhcI',
      'lrzeurWi_w0', // ChessBase product — often geo/unavailable
    ];

    if (url.includes('youtube.com/results') || brokenIds.some((id) => url.includes(id))) {
      // Prefer a real lesson over a raw search page
      return fallback;
    }

    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      return url;
    }

    return this.buildYouTubeSearchUrl(searchQuery || 'chess improvement tutorial');
  }

  /**
   * Main method to get personalized video recommendation
   */
  public getPersonalizedVideoRecommendation(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis
  ): VideoRecommendation {
    return this.getPersonalizedVideoRecommendations(
      recurringWeaknesses,
      middleGameAnalysis,
      endgameAnalysis,
      1
    )[0];
  }

  /** Return multiple distinct lessons matched to weaknesses / openings. */
  public getPersonalizedVideoRecommendations(
    recurringWeaknesses: RecurringWeakness[],
    middleGameAnalysis: MiddleGameAnalysis,
    endgameAnalysis: EndgameAnalysis,
    limit = 3
  ): VideoRecommendation[] {
    const profile = this.analyzeWeaknessProfile(
      recurringWeaknesses,
      middleGameAnalysis,
      endgameAnalysis
    );

    const rankedCategories = this.rankCategories(profile);
    const results: VideoRecommendation[] = [];
    const usedUrls = new Set<string>();

    for (const category of rankedCategories) {
      if (results.length >= limit) break;
      const categoryData = this.videoDatabase[category];
      if (!categoryData) continue;

      for (const video of categoryData.videos) {
        if (results.length >= limit) break;
        if (usedUrls.has(video.url)) continue;
        usedUrls.add(video.url);
        results.push({
          title: video.title,
          channel: video.channel,
          url: this.resolveWatchUrl(video.url, profile.primaryWeakness),
          description: this.customizeDescription(video.description, profile),
          relevantWeakness: profile.primaryWeakness,
          duration: video.duration,
          searchQuery: this.generateSearchQuery(profile, categoryData.keywords),
        });
      }
    }

    while (results.length < limit) {
      const fallback = this.getFallbackVideo(profile);
      if (usedUrls.has(fallback.url)) break;
      usedUrls.add(fallback.url);
      results.push(fallback);
    }

    return results;
  }

  private rankCategories(profile: WeaknessProfile): string[] {
    const userKeywords = profile.specificPatterns.map((p) => p.toLowerCase());
    const weaknessText = profile.primaryWeakness.toLowerCase();
    const contextText = profile.context.toLowerCase();
    const allUserText = [...userKeywords, weaknessText, contextText];
    const combined = allUserText.join(' ');
    const scores: Array<{ name: string; score: number }> = [];

    for (const [categoryName, categoryData] of Object.entries(this.videoDatabase)) {
      let score = 0;
      for (const keyword of categoryData.keywords) {
        for (const userText of allUserText) {
          if (userText.includes(keyword.toLowerCase())) {
            score += keyword.length > 3 ? 3 : 2;
          }
        }
      }
      if (categoryName === 'sicilian' && /sicilian|najdorf|dragon/.test(combined)) score += 8;
      if (categoryName === 'london_system' && /london/.test(combined)) score += 8;
      if (categoryName === 'italian_game' && /italian|giuoco/.test(combined)) score += 8;
      if (categoryName === 'queens_gambit' && /queen.?s gambit|qgd|qga|slav/.test(combined)) score += 8;
      if (categoryName === 'caro_kann' && /caro/.test(combined)) score += 8;
      if (categoryName === 'french_defense' && /french/.test(combined)) score += 8;
      if (categoryName === 'ruy_lopez' && /ruy|spanish|berlin/.test(combined)) score += 8;
      if (profile.gamePhase === 'endgame' && categoryName.includes('endgame')) score += 2;
      if (profile.gamePhase === 'opening' && /italian|sicilian|london|caro|french|ruy|queens|development|castling/.test(categoryName)) {
        score += 2;
      }
      scores.push({ name: categoryName, score });
    }

    scores.sort((a, b) => b.score - a.score);
    const ranked = scores.filter((s) => s.score > 0).map((s) => s.name);
    if (ranked.length === 0) {
      return [this.getFallbackCategory(profile), 'calculation', 'pawn_structure', 'planning'];
    }
    // Always diversify with secondary related categories
    const fallbackExtras = [
      this.getFallbackCategory(profile),
      profile.gamePhase === 'endgame' ? 'rook_endgames' : 'planning',
      'calculation',
    ];
    for (const extra of fallbackExtras) {
      if (!ranked.includes(extra)) ranked.push(extra);
    }
    return ranked;
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