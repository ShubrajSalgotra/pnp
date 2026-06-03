import { Game, GameAnalysis, Puzzle, PlayerProfile, WeeklyReport } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('authToken');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
    };

    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  }

  // Game Analysis
  async analyzeGame(gameId: string, engine: string = 'stockfish'): Promise<GameAnalysis> {
    return this.request<GameAnalysis>('/analyze', {
      method: 'POST',
      body: JSON.stringify({ gameId, engine }),
    });
  }

  async getGames(username: string): Promise<Game[]> {
    return this.request<Game[]>(`/games/${username}`);
  }

  // Puzzles
  async generatePuzzles(gameId: string): Promise<Puzzle[]> {
    return this.request<Puzzle[]>(`/generate-puzzles/${gameId}`, {
      method: 'POST',
    });
  }

  async getPuzzles(userId: string, difficulty?: string): Promise<Puzzle[]> {
    const params = difficulty ? `?difficulty=${difficulty}` : '';
    return this.request<Puzzle[]>(`/puzzles/${userId}${params}`);
  }

  // Player Profile
  async getPlayerProfile(username: string): Promise<PlayerProfile> {
    return this.request<PlayerProfile>(`/style-profile/${username}`);
  }

  // Reports
  async getWeeklyReport(childId: string): Promise<WeeklyReport> {
    return this.request<WeeklyReport>(`/report/${childId}`);
  }

  // Lichess Integration
  async createLichessStudy(username: string, gameIds: string[]): Promise<{ studyUrl: string }> {
    return this.request<{ studyUrl: string }>('/lichess-study', {
      method: 'POST',
      body: JSON.stringify({ username, gameIds }),
    });
  }

  // Opening Recommendations
  async getOpeningRecommendations(userId: string): Promise<string[]> {
    return this.request<string[]>(`/openings/recommend/${userId}`);
  }

  // YouTube Recommendations
  async getYouTubeRecommendations(userId: string): Promise<{ title: string; url: string; thumbnail: string }[]> {
    return this.request<{ title: string; url: string; thumbnail: string }[]>(`/youtube/recommend/${userId}`);
  }

  // Authentication
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    return this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, displayName: string, role: string): Promise<{ token: string; user: any }> {
    return this.request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, role }),
    });
  }

  // Payment
  async createCheckoutSession(priceId: string): Promise<{ sessionUrl: string }> {
    return this.request<{ sessionUrl: string }>('/payment/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }
}

export const apiService = new ApiService();