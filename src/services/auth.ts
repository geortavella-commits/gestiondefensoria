import { supabase } from './supabaseClient';

export interface RegisterPayload {
  nombreCompleto: string;
  dni: string;
  email: string;
  password: string;
}

/**
 * Inicia sesión con email o DNI y contraseña
 */
export async function loginUser(identifier: string, password: string) {
  let emailToUse = identifier.trim();

  // Si no contiene '@', asumimos que el usuario ingresó su DNI.
  // RLS bloquea leer `profiles` sin sesión, así que usamos una RPC acotada
  // (security definer) que solo expone el email correspondiente a ese DNI.
  if (!emailToUse.includes('@')) {
    const { data, error } = await supabase.rpc('email_por_dni', { p_dni: emailToUse });

    if (error || !data) {
      throw new Error('No se encontró ninguna cuenta asociada a ese DNI.');
    }
    emailToUse = data as string;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailToUse,
    password,
  });

  if (error) {
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      throw new Error('Credenciales incorrectas. Verificá tu correo/DNI y contraseña.');
    }
    throw error;
  }

  return data;
}

/**
 * Registra un nuevo agente en Supabase Auth y sincroniza los datos en profiles
 */
export async function registerUser({
  nombreCompleto,
  dni,
  email,
  password,
}: RegisterPayload) {
  // Separar nombre y apellido
  const parts = nombreCompleto.trim().split(' ');
  const nombre = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const apellido = parts.length > 1 ? parts[parts.length - 1] : '';

  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        nombre,
        apellido,
        dni: dni.trim(),
      },
    },
  });

  if (error) throw error;

  // El DNI ya queda guardado por el trigger handle_new_user a partir de los
  // metadatos del signUp — no depende de que haya sesión activa después
  // (rompía si el proyecto exige confirmación de email).
  return data;
}

/**
 * Cierra la sesión activa
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
