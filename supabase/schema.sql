-- Execute this script in the Supabase SQL Editor.

create table if not exists public.ferramentas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text unique,
  categoria text,
  foto_url text,
  status text not null default 'DISPONIVEL'
    check (status in ('DISPONIVEL', 'EM_USO')),
  criado_em timestamptz not null default now()
);

create table if not exists public.historico_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  ferramenta_id uuid not null references public.ferramentas(id) on delete restrict,
  responsavel_nome text not null,
  responsavel_contato text,
  tipo_movimentacao text not null
    check (tipo_movimentacao in ('RETIRADA', 'DEVOLUCAO')),
  data_movimentacao timestamptz not null default now(),
  observacoes text
);

create table if not exists public.perfis_usuario (
  user_id uuid primary key references auth.users(id) on delete cascade,
  papel text not null check (papel in ('admin')),
  criado_em timestamptz not null default now()
);

alter table public.perfis_usuario enable row level security;

drop policy if exists "Leitura do proprio perfil" on public.perfis_usuario;
create policy "Leitura do proprio perfil"
  on public.perfis_usuario
  for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke all on table public.perfis_usuario from anon, authenticated;
grant select on table public.perfis_usuario to authenticated;

create or replace function public.usuario_e_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfis_usuario
    where user_id = (select auth.uid())
      and papel = 'admin'
  );
$$;

revoke all on function public.usuario_e_admin() from public;
grant execute on function public.usuario_e_admin() to anon, authenticated;

create index if not exists historico_movimentacoes_ferramenta_data_idx
  on public.historico_movimentacoes (ferramenta_id, data_movimentacao desc);

create index if not exists historico_movimentacoes_data_idx
  on public.historico_movimentacoes (data_movimentacao desc);

-- Preserve records from the previous registro-per-withdrawal schema.
-- Each old record becomes a distinct inventory item so every old withdrawal
-- and return remains linked, even when several old rows have the same name.
do $$
begin
  if to_regclass('public.registros_ferramentas') is not null then
    execute $migration$
      insert into public.ferramentas (id, nome, codigo, status, criado_em)
      select
        id,
        ferramenta,
        'LEGACY-' || id::text,
        case when devolvido_em is null then 'EM_USO' else 'DISPONIVEL' end,
        retirado_em
      from public.registros_ferramentas
      on conflict (id) do nothing
    $migration$;

    execute $migration$
      insert into public.historico_movimentacoes (
        ferramenta_id,
        responsavel_nome,
        responsavel_contato,
        tipo_movimentacao,
        data_movimentacao
      )
      select
        r.id,
        r.responsavel,
        r.telefone,
        'RETIRADA',
        r.retirado_em
      from public.registros_ferramentas r
      where not exists (
        select 1
        from public.historico_movimentacoes h
        where h.ferramenta_id = r.id
          and h.tipo_movimentacao = 'RETIRADA'
          and h.data_movimentacao = r.retirado_em
      )
    $migration$;

    execute $migration$
      insert into public.historico_movimentacoes (
        ferramenta_id,
        responsavel_nome,
        responsavel_contato,
        tipo_movimentacao,
        data_movimentacao
      )
      select
        r.id,
        r.responsavel,
        r.telefone,
        'DEVOLUCAO',
        r.devolvido_em
      from public.registros_ferramentas r
      where r.devolvido_em is not null
        and not exists (
          select 1
          from public.historico_movimentacoes h
          where h.ferramenta_id = r.id
            and h.tipo_movimentacao = 'DEVOLUCAO'
            and h.data_movimentacao = r.devolvido_em
        )
    $migration$;
  end if;
end $$;

alter table public.ferramentas enable row level security;
alter table public.historico_movimentacoes enable row level security;

drop policy if exists "Leitura publica ferramentas" on public.ferramentas;
drop policy if exists "Cadastro publico ferramentas" on public.ferramentas;
drop policy if exists "Atualizacao publica ferramentas" on public.ferramentas;
drop policy if exists "Cadastro admin ferramentas" on public.ferramentas;
drop policy if exists "Atualizacao admin ferramentas" on public.ferramentas;
drop policy if exists "Leitura publica historico" on public.historico_movimentacoes;
drop policy if exists "Insercao publica historico" on public.historico_movimentacoes;

create policy "Leitura publica ferramentas"
  on public.ferramentas
  for select
  to anon, authenticated
  using (true);

create policy "Cadastro admin ferramentas"
  on public.ferramentas
  for insert
  to authenticated
  with check ((select public.usuario_e_admin()));

create policy "Atualizacao admin ferramentas"
  on public.ferramentas
  for update
  to authenticated
  using ((select public.usuario_e_admin()))
  with check ((select public.usuario_e_admin()));

create policy "Leitura publica historico"
  on public.historico_movimentacoes
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on table public.ferramentas from anon, authenticated;
grant select on table public.ferramentas to anon, authenticated;
grant insert, update on table public.ferramentas to authenticated;

revoke insert, update, delete on table public.historico_movimentacoes from anon, authenticated;
grant select on table public.historico_movimentacoes to anon, authenticated;

create or replace function public.registrar_retirada_ferramenta(
  p_ferramenta_id uuid,
  p_responsavel_nome text,
  p_responsavel_contato text,
  p_observacoes text default null
)
returns public.historico_movimentacoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_movimentacao public.historico_movimentacoes;
begin
  if nullif(trim(p_responsavel_nome), '') is null then
    raise exception 'Informe o nome do responsável.';
  end if;

  update public.ferramentas
  set status = 'EM_USO'
  where id = p_ferramenta_id
    and status = 'DISPONIVEL';

  if not found then
    raise exception 'A ferramenta não existe ou não está disponível.';
  end if;

  insert into public.historico_movimentacoes (
    ferramenta_id,
    responsavel_nome,
    responsavel_contato,
    tipo_movimentacao,
    observacoes
  )
  values (
    p_ferramenta_id,
    trim(p_responsavel_nome),
    nullif(trim(p_responsavel_contato), ''),
    'RETIRADA',
    nullif(trim(p_observacoes), '')
  )
  returning * into v_movimentacao;

  return v_movimentacao;
end;
$$;

create or replace function public.registrar_devolucao_ferramenta(
  p_ferramenta_id uuid,
  p_observacoes text default null
)
returns public.historico_movimentacoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_ultima_movimentacao public.historico_movimentacoes;
  v_movimentacao public.historico_movimentacoes;
begin
  select status
  into v_status
  from public.ferramentas
  where id = p_ferramenta_id
  for update;

  if not found or v_status <> 'EM_USO' then
    raise exception 'A ferramenta não existe ou não está em uso.';
  end if;

  select *
  into v_ultima_movimentacao
  from public.historico_movimentacoes
  where ferramenta_id = p_ferramenta_id
  order by data_movimentacao desc, id desc
  limit 1;

  if not found or v_ultima_movimentacao.tipo_movimentacao <> 'RETIRADA' then
    raise exception 'Não foi encontrada uma retirada pendente para esta ferramenta.';
  end if;

  update public.ferramentas
  set status = 'DISPONIVEL'
  where id = p_ferramenta_id;

  insert into public.historico_movimentacoes (
    ferramenta_id,
    responsavel_nome,
    responsavel_contato,
    tipo_movimentacao,
    observacoes
  )
  values (
    p_ferramenta_id,
    v_ultima_movimentacao.responsavel_nome,
    v_ultima_movimentacao.responsavel_contato,
    'DEVOLUCAO',
    nullif(trim(p_observacoes), '')
  )
  returning * into v_movimentacao;

  return v_movimentacao;
end;
$$;

create or replace function public.excluir_ferramenta(p_ferramenta_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.usuario_e_admin() then
    raise exception 'Somente administradores podem excluir ferramentas.';
  end if;

  select status
  into v_status
  from public.ferramentas
  where id = p_ferramenta_id
  for update;

  if not found then
    raise exception 'A ferramenta não existe.';
  end if;

  if v_status <> 'DISPONIVEL' then
    raise exception 'Devolva a ferramenta antes de excluí-la.';
  end if;

  delete from public.historico_movimentacoes
  where ferramenta_id = p_ferramenta_id;

  delete from public.ferramentas
  where id = p_ferramenta_id;
end;
$$;

revoke all on function public.registrar_retirada_ferramenta(uuid, text, text, text) from public;
revoke all on function public.registrar_devolucao_ferramenta(uuid, text) from public;
revoke all on function public.excluir_ferramenta(uuid) from public;
grant execute on function public.registrar_retirada_ferramenta(uuid, text, text, text)
  to anon, authenticated;
grant execute on function public.registrar_devolucao_ferramenta(uuid, text)
  to anon, authenticated;
grant execute on function public.excluir_ferramenta(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ferramentas'
    ) then
      alter publication supabase_realtime add table public.ferramentas;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'historico_movimentacoes'
    ) then
      alter publication supabase_realtime add table public.historico_movimentacoes;
    end if;
  end if;
end $$;
