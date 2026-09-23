import { createClient } from 'jsr:@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 1. Identificar quién llama, a partir de su propio token (no confiamos en nada del body para esto)
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: { user: caller }, error: callerAuthError } = await anonClient.auth.getUser(token);

  if (callerAuthError || !caller) {
    return jsonResponse({ error: 'No autenticado' }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // 2. Verificar que quien llama sea gestión (administrador o coordinación general)
  const { data: callerProfile, error: callerProfileError } = await adminClient
    .from('profiles')
    .select('rol')
    .eq('id', caller.id)
    .single();

  if (
    callerProfileError ||
    !callerProfile ||
    !['administrador', 'coordinacion_general'].includes(callerProfile.rol)
  ) {
    return jsonResponse({ error: 'No tenés permisos para crear usuarios' }, 403);
  }

  // 3. Validar payload
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Body inválido' }, 400);
  }

  const { nombreCompleto, dni, email, password, rol, cargo, legajo, areaId, subSedeId } = body as {
    nombreCompleto?: string;
    dni?: string;
    email?: string;
    password?: string;
    rol?: string;
    cargo?: string | null;
    legajo?: string | null;
    areaId?: string | null;
    subSedeId?: string | null;
  };

  if (!nombreCompleto || !dni || !email || !password) {
    return jsonResponse({ error: 'Faltan campos obligatorios (nombre, DNI, email, contraseña)' }, 400);
  }

  const rolesValidos = ['coordinacion_general', 'administrador', 'jefe_area', 'referente_subsede', 'personal'];
  const rolFinal = rolesValidos.includes(rol ?? '') ? (rol as string) : 'personal';

  const parts = nombreCompleto.trim().split(' ').filter(Boolean);
  const nombre = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0];
  const apellido = parts.length > 1 ? parts[parts.length - 1] : '';

  // 4. Crear el usuario en Auth (confirmado directamente: lo está dando de alta gestión)
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { nombre, apellido, dni: dni.trim() },
  });

  if (createError || !created.user) {
    return jsonResponse({ error: createError?.message || 'No se pudo crear el usuario' }, 400);
  }

  // 5. handle_new_user ya creó la fila en profiles (nombre/apellido/dni/email, rol='personal').
  //    Ahora completamos rol/área/sub-sede/legajo/cargo con el cliente service_role.
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({
      rol: rolFinal,
      cargo: cargo || null,
      legajo: legajo || null,
      area_id: areaId || null,
      sub_sede_id: subSedeId || null,
    })
    .eq('id', created.user.id);

  if (updateError) {
    return jsonResponse(
      { error: `Usuario creado pero no se pudo terminar de configurar: ${updateError.message}` },
      500
    );
  }

  return jsonResponse({ id: created.user.id, email: created.user.email }, 200);
});
