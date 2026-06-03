import React, { useState } from 'react';
import { GameReportRequest, ReportGenerationProgress } from '../types/report';
import { reportService } from '../services/reportService';
import { AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react';

interface ReportGeneratorProps {
  onReportGenerated: (report: any) => void;
}

const ReportGenerator: React.FC<ReportGeneratorProps> = ({ onReportGenerated }) => {
  const [formData, setFormData] = useState<GameReportRequest>({
    platform: 'lichess',
    username: '',
    gameCount: 20,
    rated: undefined
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<ReportGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<boolean | null>(null);

  const handleInputChange = (field: keyof GameReportRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
    setValidationResult(null);
  };

  const validateUsername = async () => {
    if (!formData.username) return;
    
    setIsValidating(true);
    setValidationResult(null);
    
    try {
      const isValid = await reportService.validateUserExists(formData.platform, formData.username);
      setValidationResult(isValid);
      if (!isValid) {
        setError(`User "${formData.username}" not found on ${formData.platform}`);
      }
    } catch (error) {
      console.error('Username validation error:', error);
      setError('Failed to validate username');
    } finally {
      setIsValidating(false);
    }
  };

  const generateReport = async () => {
    if (!formData.username || formData.gameCount < 1 || formData.gameCount > 100) {
      setError('Please enter a valid username and game count (1-100)');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    // Set up progress callback
    reportService.setProgressCallback(setProgress);

    try {
      const report = await reportService.generateReportWithUnifiedPrompts(formData);
      onReportGenerated(report);
    } catch (error: any) {
      console.error('Report generation error:', error);
      setError(error.message || 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  };

  const estimatedTime = reportService.estimateGenerationTime(formData.gameCount);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Generate Chess Report</h2>
        <p className="text-gray-600">
          Get a comprehensive analysis of your recent games with personalized improvement recommendations.
        </p>
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>✨ Enhanced Analysis:</strong> Using unified prompts for better chess insights
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Platform Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chess Platform
          </label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="platform"
                value="lichess"
                checked={formData.platform === 'lichess'}
                onChange={(e) => handleInputChange('platform', e.target.value as 'lichess' | 'chess.com')}
                className="mr-2"
              />
              <span className="text-sm">Lichess</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="platform"
                value="chess.com"
                checked={formData.platform === 'chess.com'}
                onChange={(e) => handleInputChange('platform', e.target.value as 'lichess' | 'chess.com')}
                className="mr-2"
              />
              <span className="text-sm">Chess.com</span>
            </label>
          </div>
        </div>

        {/* Username Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Enter your username"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isGenerating}
            />
            <button
              onClick={validateUsername}
              disabled={!formData.username || isValidating || isGenerating}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              <span>Validate</span>
            </button>
          </div>
          
          {/* Validation Result */}
          {validationResult !== null && (
            <div className={`mt-2 p-2 rounded-md ${validationResult ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {validationResult ? (
                <span className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  User found on {formData.platform}
                </span>
              ) : (
                <span className="flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  User not found on {formData.platform}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Game Count */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Games to Analyze
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={formData.gameCount}
            onChange={(e) => handleInputChange('gameCount', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          />
          <p className="text-sm text-gray-500 mt-1">
            Recommended: 20-50 games for comprehensive analysis
          </p>
        </div>

        {/* Rated Games Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Game Type
          </label>
          <select
            value={formData.rated === undefined ? 'all' : formData.rated ? 'rated' : 'unrated'}
            onChange={(e) => {
              const value = e.target.value;
              handleInputChange('rated', value === 'all' ? undefined : value === 'rated');
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isGenerating}
          >
            <option value="all">All Games</option>
            <option value="rated">Rated Games Only</option>
            <option value="unrated">Unrated Games Only</option>
          </select>
        </div>

        {/* Estimated Time */}
        <div className="p-3 bg-blue-50 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Estimated Generation Time:</strong> {Math.ceil(estimatedTime / 60)} minutes
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <div>
              <span>{error}</span>
              {error.includes('high demand') || error.includes('overloaded') ? (
                <p className="text-sm mt-1">You can try generating the report again by clicking the button below.</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Progress Display */}
      {progress && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <div className="flex items-center mb-2">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            <span className="font-medium">{progress.message}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-1">{progress.progress}% complete</p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateReport}
        disabled={isGenerating || !formData.username || validationResult === false}
        className="w-full mt-6 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating Report...</span>
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            <span>Generate Report</span>
          </>
        )}
      </button>
    </div>
  );
};

export default ReportGenerator;