import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { validateEmail, validatePassword } from '../utils/credentials';

/**
 * Signup Page Component
 */
export function SignupPage() {
  const navigate = useNavigate();
  const { register, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
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

    // Validation
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setError(emailError);
      return;
    }

    const passwordError = validatePassword(formData.password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register(formData.email.trim(), formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-neutral-900 to-accent-900 flex items-center justify-center p-lg">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-3xl">
          <h1 className="text-4xl font-bold text-white mb-md">Join SocraticAI</h1>
          <p className="text-neutral-300">Start challenging your thinking</p>
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
          <div className="mb-lg">
            <label htmlFor="password" className="block text-sm font-medium text-neutral-200 mb-sm">
              Password (min. 8 characters)
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

          {/* Confirm Password Field */}
          <div className="mb-2xl">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-200 mb-sm">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
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
            {isLoading ? 'Creating account...' : 'Create Account'}
          </button>

          {/* Divider */}
          <div className="relative my-2xl">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-md bg-neutral-800 text-neutral-400">Already have an account?</span>
            </div>
          </div>

          {/* Login Link */}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full px-lg py-md border-2 border-neutral-600 hover:border-primary-500 text-primary-400 hover:text-primary-300 font-semibold rounded-lg transition"
          >
            Log In
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-neutral-400 text-sm mt-xl">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
