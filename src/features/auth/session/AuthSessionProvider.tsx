import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../../lib/supabase/client';
import {
  clearPasswordRecoveryMarker,
  markPasswordRecovery,
} from '../password/passwordRecoveryService';
import { getStudentSessionProfile, signOutStudent } from './authService';
import type { StudentSessionProfile } from './types';

type StudentAuthContextValue = {
  session: Session | null;
  profile: StudentSessionProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  profileError: string;
  refreshProfile: () => Promise<StudentSessionProfile | null>;
  acceptLogin: (nextSession: Session, nextProfile: StudentSessionProfile) => void;
  signOut: () => Promise<void>;
};

const StudentAuthContext = createContext<StudentAuthContextValue | null>(null);

export function AuthSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<StudentSessionProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Fetch initial session immediately on load
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        setProfileLoading(true);
      }
      setAuthReady(true);
    }).catch(() => {
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        markPasswordRecovery();
      }

      if (event === 'SIGNED_OUT') {
        clearPasswordRecoveryMarker();
        setProfile(null);
        setProfileLoading(false);
      }

      setSession(nextSession);
      if (nextSession) {
        setProfileLoading(true);
      }
      setAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      setProfileError('');
      setProfileLoading(false);
      return null;
    }

    setProfileLoading(true);
    setProfileError('');

    try {
      const nextProfile = await getStudentSessionProfile(userId);
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      setProfile(null);
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Không thể tải trạng thái tài khoản học sinh.',
      );
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => {
    if (!authReady) return;
    void refreshProfile();
  }, [authReady, refreshProfile]);

  const acceptLogin = useCallback(
    (nextSession: Session, nextProfile: StudentSessionProfile) => {
      setSession(nextSession);
      setProfile(nextProfile);
      setProfileError('');
      setProfileLoading(false);
      setAuthReady(true);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await signOutStudent();
    clearPasswordRecoveryMarker();
    setSession(null);
    setProfile(null);
    setProfileError('');
    setProfileLoading(false);
    setAuthReady(true);
  }, []);

  const value = useMemo<StudentAuthContextValue>(
    () => ({
      session,
      profile,
      authReady,
      profileLoading,
      profileError,
      refreshProfile,
      acceptLogin,
      signOut,
    }),
    [
      acceptLogin,
      authReady,
      profile,
      profileError,
      profileLoading,
      refreshProfile,
      session,
      signOut,
    ],
  );

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth() {
  const value = useContext(StudentAuthContext);
  if (!value) {
    throw new Error(
      'useStudentAuth phải được dùng bên trong AuthSessionProvider.',
    );
  }
  return value;
}
