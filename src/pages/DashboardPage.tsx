import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { 
  BarChart3, 
  Target, 
  TrendingUp, 
  Plus,
  ArrowRight,
  RefreshCw,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { PlayerAnalysisProfile } from '../types/profileAnalysis';
import { ReportGenerationProgress } from '../types/report';

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PlayerAnalysisProfile | null>(null);
  const [platform, setPlatform] = useState<'lichess' | 'chess.com'>('lichess');
  const [username, setUsername] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<ReportGenerationProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  useEffect(() => {
    let isMounted = true;

    profileAnalysisService.loadProfile(currentUser?.id).then(savedProfile => {
      if (!isMounted) return;
      setProfile(savedProfile);
      if (savedProfile) {
        setPlatform(savedProfile.platform);
        setUsername(savedProfile.username);
      }
      setIsLoadingProfile(false);
    }).catch(loadError => {
      console.error('Error loading dashboard profile:', loadError);
      if (isMounted) {
        setError('Could not load your saved analysis profile.');
        setIsLoadingProfile(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const report = profile?.report || null;

  const reportGames = useMemo(() => {
    return report?.rawGameData || profile?.games || [];
  }, [profile?.games, report?.rawGameData]);

  const latestGames = reportGames.slice(0, 3);
  const averageAccuracy = report?.executiveSummary.averageAccuracy || 0;
  const overallRating = report?.executiveSummary.overallRating || 0;

  const stats = [
    {
      title: "Games Analyzed",
      value: profile?.analyzedGameIds.length.toString() || "0",
      change: profile?.lastAnalyzedAt ? `Updated ${new Date(profile.lastAnalyzedAt).toLocaleDateString()}` : "Set up your profile",
      icon: <BarChart3 className="w-5 h-5" />,
      color: "text-blue-600"
    },
    {
      title: "Average Accuracy",
      value: averageAccuracy ? `${averageAccuracy}%` : "-",
      change: "From cached report",
      icon: <Target className="w-5 h-5" />,
      color: "text-green-600"
    },
    {
      title: "Weaknesses Found",
      value: report?.recurringWeaknesses.length.toString() || "0",
      change: report?.recurringWeaknesses[0]?.title || "From latest analysis",
      icon: <AlertCircle className="w-5 h-5" />,
      color: "text-red-600"
    },
    {
      title: "Current Rating",
      value: overallRating ? overallRating.toLocaleString() : "-",
      change: profile?.username || "Chess username needed",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "text-orange-600"
    }
  ];

  const saveAndAnalyze = async () => {
    if (!currentUser?.id || !username.trim()) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress(null);
    profileAnalysisService.setProgressCallback(setProgress);

    try {
      const result = await profileAnalysisService.setupProfile({
        userId: currentUser.id,
        platform,
        username: username.trim(),
        gameCount: 20
      });
      setProfile(result.profile);
      setMessage(`Analyzed ${result.newGamesCount} games and saved your profile analysis.`);
    } catch (setupError) {
      setError(setupError instanceof Error ? setupError.message : 'Could not set up profile analysis.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshAnalysis = async () => {
    if (!currentUser?.id) return;

    setIsRefreshing(true);
    setError(null);
    setMessage(null);
    setProgress(null);
    profileAnalysisService.setProgressCallback(setProgress);

    try {
      const result = await profileAnalysisService.refreshProfile(currentUser.id);
      setProfile(result.profile);
      setMessage(result.reusedCache
        ? 'No new games found. Your saved analysis is already current.'
        : `Found and analyzed ${result.newGamesCount} new game${result.newGamesCount === 1 ? '' : 's'}.`
      );
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh analysis.');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {currentUser?.displayName}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's your chess improvement dashboard
        </p>
      </div>

      {isLoadingProfile && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="flex items-center gap-3 p-5 text-blue-900">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <div>
              <p className="font-medium">Loading your chess analysis</p>
              <p className="text-sm text-blue-700">We are preparing your saved game report and dashboard data.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoadingProfile && (
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Player Analysis Profile</CardTitle>
              <CardDescription>
                {profile
                  ? 'Reports, puzzles, and dashboard reuse this saved analysis.'
                  : 'Your first report is not ready yet. Add your chess username to analyze your latest 20 games before the dashboard fills in.'}
              </CardDescription>
            </div>
            {profile && (
              <Button type="button" variant="outline" onClick={refreshAnalysis} disabled={isRefreshing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!profile && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_auto]">
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as 'lichess' | 'chess.com')}
                className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm"
                disabled={isRefreshing}
              >
                <option value="lichess">Lichess</option>
                <option value="chess.com">Chess.com</option>
              </select>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Chess username"
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
                disabled={isRefreshing}
              />
              <Button type="button" onClick={saveAndAnalyze} disabled={isRefreshing || !username.trim()}>
                {isRefreshing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Save and Analyze 20
              </Button>
            </div>
          )}

          {profile && (
            <div className="flex flex-col gap-2 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="font-medium">{profile.username}</span> on {profile.platform}
                <span className="text-gray-500"> | latest {profile.gameLimit} games tracked</span>
              </div>
              <div className="text-gray-500">
                {profile.lastCheckedAt ? `Checked ${new Date(profile.lastCheckedAt).toLocaleString()}` : 'Not checked yet'}
              </div>
            </div>
          )}

          {progress && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span>{progress.message}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200">
                <div className="h-2 rounded-full bg-primary-600" style={{ width: `${progress.progress}%` }} />
              </div>
            </div>
          )}

          {message && <p className="mt-3 text-sm text-green-700">{message}</p>}
          {error && (
            <p className="mt-3 flex items-center text-sm text-red-700">
              <AlertCircle className="mr-2 h-4 w-4" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Stats Grid */}
      {report && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={stat.color}>
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-xs text-green-600 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      {report && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Games */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Games</CardTitle>
                <CardDescription>Your latest analyzed games</CardDescription>
              </div>
              <Button size="sm" onClick={() => navigate('/analyze')}>
                <Plus className="w-4 h-4 mr-2" />
                Analyze New Game
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {latestGames.map((game: any) => {
                const isUserWhite = profile?.username.toLowerCase() === game.white?.name?.toLowerCase();
                const opponent = isUserWhite ? game.black?.name : game.white?.name;
                const result = game.result === '1/2-1/2' ? 'Draw' : (isUserWhite && game.result === '1-0') || (!isUserWhite && game.result === '0-1') ? 'Win' : 'Loss';

                return (
                <div key={game.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        result === 'Win' ? 'bg-green-500' : 
                        result === 'Loss' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                      <div>
                        <p className="font-medium text-gray-900">vs {opponent}</p>
                        <p className="text-sm text-gray-500">{game.opening?.name || 'Unknown opening'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{result}</p>
                    <p className="text-xs text-gray-500">{game.date}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 ml-4" />
                </div>
              )})}
              {latestGames.length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  Save your username to fetch and analyze your latest games.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Main Improvement Areas</CardTitle>
            <CardDescription>Actual recurring patterns from the saved analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {report.recurringWeaknesses.slice(0, 3).map((weakness) => (
                <div key={weakness.title} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900">{weakness.title}</p>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      {weakness.frequency}x
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{weakness.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Playing Style Insight */}
      {report && (
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Your Analysis Summary</CardTitle>
            <CardDescription>Based on analysis of your recent games</CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {report.executiveSummary.strengthAreas[0] || 'Developing Player'}
              </h3>
              <p className="mt-2 text-gray-600">
                {report.executiveSummary.keyInsights[0]}
              </p>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md bg-green-50 p-3 text-green-800">
                  <span className="font-medium">Strengths: </span>
                  {report.executiveSummary.strengthAreas.slice(0, 3).join(', ') || '-'}
                </div>
                <div className="rounded-md bg-orange-50 p-3 text-orange-800">
                  <span className="font-medium">Focus: </span>
                  {report.recurringWeaknesses.slice(0, 3).map(weakness => weakness.title).join(', ') || '-'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
};

export default DashboardPage;
