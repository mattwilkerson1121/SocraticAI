/**
 * Shared auth credential validation
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIAL_CHAR_REGEX = /[#\$%^&*()\-_]/;

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Email is required';
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Username must be a valid email address';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  const digitCount = (password.match(/\d/g) || []).length;
  if (digitCount < 2) {
    return 'Password must contain at least two numbers';
  }
  if (!SPECIAL_CHAR_REGEX.test(password)) {
    return 'Password must contain at least one special character: # $ % ^ & * ( ) - _';
  }
  return null;
}

export function validateLoginCredentials(
  email: string,
  password: string
): string | null {
  return validateEmail(email) || validatePassword(password);
}
