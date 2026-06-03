import React, { useEffect, useState } from 'react';
import { ChessReport } from '../types/report';
import { useAuth } from '../contexts/AuthContext';
import ReportGenerator from '../components/ReportGenerator';
import ReportDisplay from '../components/ReportDisplay';
import { TrendingUp, Target, BookOpen, Lightbulb } from 'lucide-react';
import { profileAnalysisService } from '../services/profileAnalysisService';

const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [currentReport, setCurrentReport] = useState<ChessReport | null>(null);

  useEffect(() => {
    let isMounted = true;

    profileAnalysisService.loadProfile(currentUser?.id).then(profile => {
      if (isMounted && profile?.report) {
        setCurrentReport(profile.report);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser?.id]);

  const handleReportGenerated = (report: ChessReport) => {
    // Set user ID from auth context
    report.userId = currentUser?.id || '';
    setCurrentReport(report);
  };

  const handleBackToGenerator = () => {
    setCurrentReport(null);
  };

  if (currentReport) {
    return <ReportDisplay report={currentReport} onBack={handleBackToGenerator} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Chess Performance Reports
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Get comprehensive insights into your chess performance with AI-powered analysis 
            of your recent games. Discover patterns, identify weaknesses, and receive 
            personalized improvement recommendations.
          </p>
        </div>

        {/* Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mb-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
            <p className="text-gray-600 text-sm">
              Get a high-level overview of your chess performance, including win rates, 
              favorite openings, and overall playing strength.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg mb-4">
              <Target className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Weakness Analysis</h3>
            <p className="text-gray-600 text-sm">
              Identify recurring mistakes and patterns in your play with specific 
              examples from your games and targeted improvement suggestions.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mb-4">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Game Phase Analysis</h3>
            <p className="text-gray-600 text-sm">
              Deep dive into your middlegame and endgame performance with detailed 
              analysis of your tactical and positional understanding.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mb-4">
              <Lightbulb className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Improvement Plan</h3>
            <p className="text-gray-600 text-sm">
              Receive a personalized roadmap for improvement with specific actions, 
              weekly goals, and recommended study materials.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Account</h3>
              <p className="text-gray-600">
                Select your chess platform (Lichess or Chess.com) and enter your username. 
                We'll fetch your recent games for analysis.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-green-600">2</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>
              <p className="text-gray-600">
                Our advanced AI analyzes your games, identifying patterns, strengths, 
                weaknesses, and opportunities for improvement.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-purple-600">3</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Your Report</h3>
              <p className="text-gray-600">
                Receive a comprehensive report with actionable insights and a personalized 
                improvement plan to take your chess to the next level.
              </p>
            </div>
          </div>
        </div>

        {/* Sample Report Info */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
            What's Included in Your Report
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📊 Executive Summary</h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Win rate and performance statistics</li>
                <li>• Favorite openings and time controls</li>
                <li>• Overall playing strength assessment</li>
                <li>• Key insights about your playing style</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">⚠️ Weakness Analysis</h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Recurring mistake patterns</li>
                <li>• Specific examples from your games</li>
                <li>• Frequency and impact assessment</li>
                <li>• Targeted improvement suggestions</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">🎯 Game Phase Analysis</h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Middlegame tactical and positional skills</li>
                <li>• Endgame technique evaluation</li>
                <li>• Skill breakdown and ratings</li>
                <li>• Phase-specific recommendations</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📚 Improvement Plan</h3>
              <ul className="text-gray-700 space-y-2">
                <li>• Immediate high-priority actions</li>
                <li>• Weekly focus areas and exercises</li>
                <li>• Monthly goals and milestones</li>
                <li>• Curated study resources</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Report Generator */}
        <ReportGenerator onReportGenerated={handleReportGenerated} />

        {/* Additional Info */}
        <div className="mt-12 text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-3xl mx-auto">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tips</h3>
            <ul className="text-yellow-700 space-y-2 text-left">
              <li>• Analyze 20-50 games for the most comprehensive insights</li>
              <li>• Use recent games (last 3-6 months) for current skill assessment</li>
              <li>• Focus on rated games for more accurate performance analysis</li>
              <li>• Generate reports regularly to track your improvement over time</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
