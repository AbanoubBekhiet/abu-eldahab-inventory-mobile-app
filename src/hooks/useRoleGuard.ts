import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  fetchUserProfile,
  loadSavedAuthToken,
  isAdminOrSubAdmin,
  User,
} from '../services/api';
import {
  getActiveAppMode,
  setActiveAppMode,
} from '../services/app-mode';

export function useRoleGuard(requiredRole: 'admin' | 'customer') {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;
    const checkRole = async () => {
      try {
        await loadSavedAuthToken();
        const userObj = await fetchUserProfile();
        if (!active) return;

        setUser(userObj);

        if (userObj) {
          const isAdmin = isAdminOrSubAdmin(userObj);
          const currentMode = await getActiveAppMode();

          if (!isAdmin) {
            if (requiredRole === 'admin') {
              router.replace('/');
              return;
            }
          } else {
            if (requiredRole === 'admin') {
              if (currentMode !== 'admin') {
                await setActiveAppMode('admin');
              }
            } else if (requiredRole === 'customer') {
              if (currentMode === 'admin') {
                router.replace('/admin' as any);
                return;
              }
            }
          }
        } else {
          router.replace('/login');
          return;
        }
      } catch (e) {
        console.warn("Auth Error:", e);
        router.replace('/login');
      } finally {
        if (active) setLoading(false);
      }
    };

    checkRole();
    return () => { active = false; };
  }, [requiredRole]);

  return { loading, user };
}
