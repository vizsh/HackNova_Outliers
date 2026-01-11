
// Centralized configuration for API URL
// In production (Vercel/Netlify), set VITE_API_URL environment variable.
// In development, it falls back to localhost:3000.

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper to get full socket URL (usually just the base domain)
export const SOCKET_URL = API_URL;
