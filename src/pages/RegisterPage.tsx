import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertCircle, Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react';
import { profileAnalysisService } from '../services/profileAnalysisService';
import { reportService } from '../services/reportService';
import { ReportGenerationProgress } from '../types/report';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    role: 'child',
    chessPlatform: 'lichess' as 'lichess' | 'chess.com',
    chessUsername: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ReportGenerationProgress | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  const { register, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.displayName || !formData.chessUsername) {
      setError('Please fill in all fields');
      return false;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const validateChessUsername = async () => {
    setLoadingMessage('Checking chess username...');
    const isValid = await reportService.validateUserExists(formData.chessPlatform, formData.chessUsername.trim());

    if (!isValid) {
      setError(`User "${formData.chessUsername}" was not found on ${formData.chessPlatform}`);
      return false;
    }

    const isTaken = await profileAnalysisService.isChessAccountTaken(
      formData.chessPlatform,
      formData.chessUsername.trim()
    );

    if (isTaken) {
      goToLoginWithExistingAccountMessage();
      return false;
    }

    return true;
  };

  const createInitialAnalysis = async (userId: string) => {
    setLoadingMessage('Analyzing your latest 20 games...');
    profileAnalysisService.setProgressCallback(setProgress);

    await profileAnalysisService.setupProfile({
      userId,
      platform: formData.chessPlatform,
      username: formData.chessUsername.trim(),
      gameCount: 20
    });
  };

  const goToLoginWithExistingAccountMessage = () => {
    sessionStorage.removeItem('signupOnboardingInProgress');
    navigate('/login', {
      replace: true,
      state: { message: 'Account already exists. Please sign in.' }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setError('');
      setLoading(true);
      setProgress(null);

      const usernameIsValid = await validateChessUsername();
      if (!usernameIsValid) return;

      sessionStorage.setItem('signupOnboardingInProgress', 'true');
      setLoadingMessage('Creating account...');
      const user = await register(formData.email, formData.password, formData.displayName, formData.role);
      await createInitialAnalysis(user.id);
      sessionStorage.removeItem('signupOnboardingInProgress');
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        goToLoginWithExistingAccountMessage();
        return;
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create account. Please try again.');
      }
      console.error('Registration error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      setProgress(null);

      if (!formData.chessUsername.trim()) {
        setError('Please enter your chess username before continuing with Google.');
        return;
      }

      const usernameIsValid = await validateChessUsername();
      if (!usernameIsValid) return;

      sessionStorage.setItem('signupOnboardingInProgress', 'true');
      setLoadingMessage('Creating account...');
      const result = await loginWithGoogle();

      if (!result.isNewUser) {
        await logout();
        goToLoginWithExistingAccountMessage();
        return;
      }

      await createInitialAnalysis(result.user.id);
      sessionStorage.removeItem('signupOnboardingInProgress');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const passwordRequirements = [
    { text: 'At least 6 characters', met: formData.password.length >= 6 },
    { text: 'Contains letters and numbers', met: /(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password) },
  ];

  if (loading && (loadingMessage.includes('Analyzing') || progress)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
            <CardTitle className="text-center">Analyzing your games</CardTitle>
            <CardDescription className="text-center">
              We are fetching your latest 20 games and building your first chess report. This only happens once during setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-blue-50 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-blue-900">
                <span>{progress?.message || loadingMessage}</span>
                <span>{progress?.progress || 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-blue-200">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progress?.progress || 8}%` }}
                />
              </div>
            </div>
            <p className="mt-4 text-center text-sm text-gray-500">
              Keep this tab open. Your dashboard will appear automatically when the analysis is ready.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-2xl">♔</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Or{' '}
          <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Get started today</CardTitle>
            <CardDescription>
              Join thousands of chess players improving their game with AI-powered analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    <div className="ml-3">
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <div className="mt-1">
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Enter your full name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  I am a...
                </label>
                <div className="mt-1">
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  >
                    <option value="child">Chess Player</option>
                    <option value="parent">Parent</option>
                    <option value="coach">Chess Coach</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[140px_1fr]">
                <div>
                  <label htmlFor="chessPlatform" className="block text-sm font-medium text-gray-700">
                    Chess Platform
                  </label>
                  <div className="mt-1">
                    <select
                      id="chessPlatform"
                      name="chessPlatform"
                      value={formData.chessPlatform}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      disabled={loading}
                    >
                      <option value="lichess">Lichess</option>
                      <option value="chess.com">Chess.com</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="chessUsername" className="block text-sm font-medium text-gray-700">
                    Chess Username
                  </label>
                  <div className="mt-1">
                    <input
                      id="chessUsername"
                      name="chessUsername"
                      type="text"
                      required
                      value={formData.chessUsername}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="Your Lichess or Chess.com username"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Create a password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    {passwordRequirements.map((req, index) => (
                      <div key={index} className="flex items-center text-xs">
                        <CheckCircle 
                          className={`w-3 h-3 mr-2 ${req.met ? 'text-green-500' : 'text-gray-300'}`}
                        />
                        <span className={req.met ? 'text-green-600' : 'text-gray-500'}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Confirm Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Confirm your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label htmlFor="terms" className="ml-2 block text-sm text-gray-900">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary-600 hover:text-primary-500">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-primary-600 hover:text-primary-500">
                    Privacy Policy
                  </Link>
                </label>
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {loadingMessage || 'Creating account...'}
                    </>
                  ) : 'Create account'}
                </Button>
              </div>

              {progress && (
                <div className="rounded-md bg-blue-50 p-3">
                  <div className="mb-1 flex items-center justify-between text-sm text-blue-800">
                    <span>{progress.message}</span>
                    <span>{progress.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-blue-200">
                    <div className="h-2 rounded-full bg-blue-600" style={{ width: `${progress.progress}%` }} />
                  </div>
                </div>
              )}
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
                  <p className="mb-3 text-sm font-medium text-gray-800">
                    Chess account for Google signup
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[130px_1fr]">
                    <select
                      aria-label="Chess platform for Google signup"
                      name="chessPlatform"
                      value={formData.chessPlatform}
                      onChange={handleChange}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      disabled={loading}
                    >
                      <option value="lichess">Lichess</option>
                      <option value="chess.com">Chess.com</option>
                    </select>
                    <input
                      aria-label="Chess username for Google signup"
                      name="chessUsername"
                      type="text"
                      value={formData.chessUsername}
                      onChange={handleChange}
                      className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 bg-white focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                      placeholder="Chess username"
                      disabled={loading}
                    />
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign up with Google
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
