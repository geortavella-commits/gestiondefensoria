import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getListaPerfiles } from '../services/legajo';
import type { Profile, RolUsuario } from '../types/legajo';

export type AuthView = 'login' | 'register' | 'app';

/**
 * Dueño único de la sesión, el listado de perfiles y qué legajo se está
 * mirando. `currentUserRole` es el rol REAL de quien está logueado — nunca
 * debe cambiar al navegar a otro legajo (selectProfile solo cambia
 * selectedProfileId). Este bug se reintrodujo 4 veces cuando esta lógica
 * vivía inline en App.tsx; por eso está acá, en su propio archivo.
 */
export function useAuthSession() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [listaPerfiles, setListaPerfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<RolUsuario>('personal');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = async (sessionUserId: string | null) => {
    const perfiles = await getListaPerfiles();
    setListaPerfiles(perfiles);

    if (perfiles.length === 0) return;

    const target = sessionUserId
      ? perfiles.find((p) => p.id === sessionUserId) || perfiles[0]
      : perfiles[0];

    setSelectedProfileId(target.id);
    setCurrentUserRole(target.rol);
    setCurrentUserId(sessionUserId || target.id);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setAuthView('app');
        await applySession(session?.user?.id ?? null);
      } catch (err: any) {
        if (active) setError(err.message || 'Error al inicializar la sesión');
      } finally {
        if (active) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setAuthView('app');
        await applySession(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setAuthView('login');
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Solo cambia qué legajo se está viendo. NO tocar currentUserRole acá.
  const selectProfile = (id: string) => setSelectedProfileId(id);

  return {
    authView,
    setAuthView,
    listaPerfiles,
    selectedProfileId,
    selectProfile,
    currentUserId,
    currentUserRole,
    loading,
    error,
  };
}
