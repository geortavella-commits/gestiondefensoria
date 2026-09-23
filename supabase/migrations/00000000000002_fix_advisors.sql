-- ============================================================================
-- FIX ADVISORS — search_path mutable + grants de funciones SECURITY DEFINER
-- ============================================================================

-- Fija search_path en funciones plpgsql para evitar search_path hijacking
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.prevent_privilege_escalation()
returns trigger language plpgsql set search_path = public as $$
begin
  if not es_gestion() then
    if new.rol is distinct from old.rol
       or new.area_id is distinct from old.area_id
       or new.sub_sede_id is distinct from old.sub_sede_id
       or new.estado is distinct from old.estado
       or new.legajo is distinct from old.legajo
    then
      raise exception 'No tenés permiso para modificar esos campos';
    end if;
  end if;
  return new;
end;
$$;

-- El grant por defecto es al pseudo-rol PUBLIC (incluye anon + authenticated).
-- Revocamos de PUBLIC y otorgamos solo a authenticated, que es quien las necesita
-- desde las policies de RLS.
revoke execute on function public.mi_rol() from public;
revoke execute on function public.mi_area() from public;
revoke execute on function public.mi_subsede() from public;
revoke execute on function public.es_gestion() from public;
revoke execute on function public.es_coordinador_subsedes() from public;

grant execute on function public.mi_rol() to authenticated;
grant execute on function public.mi_area() to authenticated;
grant execute on function public.mi_subsede() to authenticated;
grant execute on function public.es_gestion() to authenticated;
grant execute on function public.es_coordinador_subsedes() to authenticated;

-- handle_new_user solo la invoca el trigger on_auth_user_created, nunca el cliente
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
