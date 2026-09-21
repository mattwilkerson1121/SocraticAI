import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

/**
 * Login Page Component
 */
export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-neutral-900 to-accent-900 flex items-center justify-center p-lg">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-3xl">
          <h1 className="text-4xl font-bold text-white mb-md">SocraticAI</h1>
          <p className="text-neutral-300">Challenge your thinking</p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-neutral-800 rounded-xl p-2xl shadow-2xl border border-neutral-700"
        >
          {/* Error Alert */}
          {error && (
            <div className="bg-error/10 border border-error/30 text-error px-lg py-md rounded-lg mb-lg text-sm">
              {error}
            </div>
          )}

          {/* Email Field */}
          <div className="mb-lg">
            <label htmlFor="email" className="block text-sm font-medium text-neutral-200 mb-sm">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              className="w-full px-lg py-md bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            />
          </div>

          {/* Password Field */}
          <div className="mb-2xl">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-200 mb-sm">
              Password
            </label>
            <input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full px-lg py-md bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:bg-neutral-600 text-white font-semibold py-md rounded-lg transition duration-200 flex items-center justify-center gap-md"
          >
            {isLoading && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>

          {/* Divider */}
          <div className="relative my-2xl">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-md bg-neutral-800 text-neutral-400">Don't have an account?</span>
            </div>
          </div>

          {/* Sign Up Link */}
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="w-full px-lg py-md border-2 border-neutral-600 hover:border-primary-500 text-primary-400 hover:text-primary-300 font-semibold rounded-lg transition"
          >
            Create Account
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-neutral-400 text-sm mt-xl">
          By logging in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
