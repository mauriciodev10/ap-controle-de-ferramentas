# Controle de Ferramentas

Aplicativo web simples para controle de retiradas e devoluções de ferramentas do almoxarifado.

## Funcionalidades

- Cadastro de ferramentas no inventário, com nome, código, categoria e URL de foto
- Retirada de ferramentas disponíveis e registro de responsável, contato e observações
- Devolução com atualização do status e criação de movimentação
- Histórico cronológico completo de retiradas e devoluções
- Persistência compartilhada no PostgreSQL via Supabase e sincronização em tempo real
- Login de administrador para cadastrar ferramentas; retiradas e devoluções continuam públicas, sem login

## Como rodar

Copie `.env.example` para `.env.local` e substitua os valores pelos dados do projeto Supabase. `VITE_SUPABASE_URL` deve ser a URL completa do projeto (por exemplo, `https://<project-ref>.supabase.co`), não apenas o identificador. Use somente a chave pública (`anon`/publishable); nunca use a `service_role` no frontend.

No Supabase, execute o SQL de [`supabase/schema.sql`](./supabase/schema.sql) em **SQL Editor** para criar/atualizar as tabelas, funções transacionais, papéis, políticas RLS e publicação Realtime. Execute-o também em projetos existentes para aplicar as novas permissões de administrador e a função de exclusão de ferramentas. O script migra os registros existentes de `registros_ferramentas` para o inventário e o histórico, preservando cada registro antigo; ferramentas migradas recebem um código `LEGACY-...`.

Administradores podem excluir ferramentas disponíveis pelo inventário. A exclusão também apaga permanentemente todas as movimentações relacionadas; ferramentas em uso precisam ser devolvidas primeiro. Para habilitar essa função em um banco existente, execute novamente `supabase/schema.sql` no SQL Editor.

### Criar um administrador

1. No painel Supabase, abra **Authentication → Users** e crie um usuário com e-mail e senha. Não habilite cadastro público de usuários.
2. No **SQL Editor**, atribua o papel de administrador ao e-mail criado, substituindo o endereço no exemplo:

   ```sql
   do $$
   declare
     usuario_id uuid;
   begin
     select id into usuario_id
     from auth.users
     where email = 'admin@exemplo.com';

     if usuario_id is null then
       raise exception 'Usuário não encontrado em Authentication → Users.';
     end if;

     insert into public.perfis_usuario (user_id, papel)
     values (usuario_id, 'admin')
     on conflict (user_id)
     do update set papel = excluded.papel;
   end $$;
   ```

3. No app, use **Entrar como administrador** para cadastrar ferramentas. A permissão é conferida no banco com RLS; ocultar o formulário não é a única proteção.

Para redefinir a senha, use **Esqueci minha senha** na tela de acesso. O Supabase deve ter a URL publicada em **Authentication → URL Configuration** como **Site URL** e na lista **Redirect URLs**; sem isso, o link pode redirecionar para um endereço local. Ao abrir o link, o app permite cadastrar uma nova senha.

Qualquer pessoa continua podendo consultar inventário e histórico e registrar retiradas/devoluções sem login, como antes. O histórico inclui contatos e permanece público; se esses dados precisarem ser privados, será necessário rever as permissões de leitura.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (geralmente `http://localhost:5173`).

## Build de produção

```bash
npm run build
npm run preview
```
