import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { fetchUserProfile, loadSavedAuthToken, isAdminOrSubAdmin, User } from '../services/api';

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
          if (requiredRole === 'customer' && isAdmin) {
            router.replace('/admin' as any);
            return;
          }
          if (requiredRole === 'admin' && !isAdmin) {
            router.replace('/');
            return;
          }
        } else {
          router.replace('/login');
          return;
        }
      } catch (e) {
      } finally {
        if (active) setLoading(false);
      }
    };

    checkRole();
    return () => { active = false; };
  }, [requiredRole]);

  return { loading, user };
}
