'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  getRedirectResult,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  /**
   * True only for a real (non-anonymous) account. AI analysis may sign a
   * visitor in anonymously to obtain an ID token, and such a session must not
   * render as "signed in" — it has no name, photo, or email.
   */
  isSignedIn: boolean;
  loading: boolean;
  googleAccessToken: string | null;
  youtubeConnected: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_STORAGE_KEY = 'moodradio_google_token';
const TOKEN_EXPIRY_KEY = 'moodradio_google_token_expiry';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  // Load persisted token on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (stored && expiry && Date.now() < Number(expiry)) {
      setGoogleAccessToken(stored);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        // Clear token if user signs out
        if (!firebaseUser) {
          setGoogleAccessToken(null);
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
        }
      });
    } catch (err) {
      console.error('Firebase auth init error:', err);
      setLoading(false);
    }
    return () => unsubscribe?.();
  }, []);

  // Check for redirect result (handles page reload after OAuth)
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            persistToken(credential.accessToken);
          }
        }
      })
      .catch(() => {});
  }, []);

  const persistToken = (token: string) => {
    setGoogleAccessToken(token);
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    // Google OAuth tokens last ~1 hour
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 3500 * 1000));
  };

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        persistToken(credential.accessToken);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setGoogleAccessToken(null);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isSignedIn: !!user && !user.isAnonymous,
        loading,
        googleAccessToken,
        youtubeConnected: !!googleAccessToken,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
