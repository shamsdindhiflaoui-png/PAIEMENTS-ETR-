import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { api } from '../services/api';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  authLoading: true,
  authError: null,
  signInWithGoogle: async () => {},
  signOutUser: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    api.setTokenProvider(async () => {
      if (!auth.currentUser) return null;
      return auth.currentUser.getIdToken();
    });

    const unsubscribe = onAuthStateChanged(auth, async user => {
      setFirebaseUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          api.setAuthToken(token);
        } catch (err) {
          console.error('Error retrieving Firebase ID token:', err);
          api.setAuthToken(null);
        }
      } else {
        api.setAuthToken(null);
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribe();
      api.setTokenProvider(null);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      api.setAuthToken(token);
      setFirebaseUser(cred.user);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthError('Connexion annulée. Veuillez réessayer avec votre compte Google.');
      } else {
        setAuthError(err?.message || 'Échec de l’authentification Google.');
      }
    }
  }, []);

  const signOutUser = useCallback(async () => {
    api.setAuthToken(null);
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        authLoading,
        authError,
        signInWithGoogle,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  return useContext(AuthContext);
}
