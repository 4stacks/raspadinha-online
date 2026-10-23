# Deploy com Docker Compose

Este guia descreve como subir o app e uma instância completa do Supabase
self-hosted. A stack inclui o app Next.js, gateway Envoy, Supabase Auth,
PostgREST, Realtime, Storage, imgproxy, Studio, PostgreSQL, Supavisor e Edge
Functions. O arquivo Compose oficial do Supabase e os arquivos de configuração
necessários estão versionados em [`deploy/supabase/`](./deploy/supabase/).

## Requisitos

- Docker Engine e Docker Compose v2.
- Node.js 22 ou superior somente para criar o arquivo de ambiente inicial.
- Espaço em disco e memória suficientes para as imagens dos serviços e para os
  dados do banco e do Storage.

## Primeiro deploy

Na raiz do repositório:

```bash
./scripts/deploy.sh
```

Na primeira execução, o script:

1. Copia [`.env.example`](./.env.example) para `.env`.
2. Gera senhas, chaves aleatórias e os JWTs `anon`/`service_role` assinados
   pelo `JWT_SECRET`.
3. Salva `.env` com permissão `0600`; o arquivo é ignorado pelo Git.
4. Valida a configuração Compose, constrói a imagem de produção do app e inicia
   a stack em segundo plano.

O script não sobrescreve um `.env` existente. Para reinicializar secrets,
edite-os conscientemente ou mova o arquivo atual para um local seguro antes de
executar o script novamente. Alterar senha/chaves depois de inicializar o banco
exige sincronizar os serviços e considerar as credenciais já persistidas.

A primeira inicialização do PostgreSQL pode levar alguns minutos. Confirme os
containers e seus estados:

```bash
docker compose ps --all
docker compose logs -f db
docker compose logs -f app-schema
```

Quando a inicialização terminar:

- App: `http://localhost:3000`
- API Supabase e Studio: `http://localhost:8000`
- Gateway Postgres via Supavisor: `localhost:54322`
- Pooler em modo transação: `localhost:6543`

O gateway usa Basic Auth nas rotas do Studio. Consulte `DASHBOARD_USERNAME` e
`DASHBOARD_PASSWORD` no `.env`; a senha é gerada automaticamente no primeiro
start.

## Configurar o `.env`

`.env.example` contém os parâmetros iniciais da stack. Após a geração, edite
`.env` para personalizar URLs ou portas. Principais configurações:

| Variável | Uso |
| --- | --- |
| `BIND_IP` | Endereço local em que as portas publicadas escutam. O padrão é `127.0.0.1`. |
| `WEB_PORT` | Porta local do app (padrão `3000`). |
| `API_GW_HTTP_PORT` | Porta local do gateway Supabase (padrão `8000`). |
| `POSTGRES_HOST_PORT` | Porta local de sessão para conexão ao Postgres via Supavisor (padrão `54322`). |
| `POOLER_PROXY_PORT_TRANSACTION` | Porta local do pooler em modo transação (padrão `6543`). |
| `SITE_URL` | URL pública do app usada pelo Supabase Auth. |
| `ADDITIONAL_REDIRECT_URLS` | URLs adicionais permitidas para redirecionamento de Auth. |
| `SUPABASE_PUBLIC_URL` | URL externa do gateway/Studio Supabase. |
| `API_EXTERNAL_URL` | URL externa de Auth; normalmente `${SUPABASE_PUBLIC_URL}/auth/v1`. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL que o navegador usa para se conectar ao Supabase. É incorporada na imagem do app. |
| `SUPABASE_INTERNAL_URL` | URL interna usada pelos endpoints do app na rede Docker. No Compose padrão, mantenha `http://api-gw:8000`. |
| `POSTGRES_PASSWORD` / `JWT_SECRET` | Credenciais usadas pelo banco e pelos serviços Supabase. |
| `ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | JWT público `anon`. Pode ser entregue ao navegador; é gerado para o projeto. |
| `SERVICE_ROLE_KEY` | JWT privilegiado interno do Supabase. Nunca o exponha ao navegador, ao bundle ou a logs públicos. |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | Proteção Basic Auth do gateway/Studio. |

O navegador precisa conseguir acessar `NEXT_PUBLIC_SUPABASE_URL`. `localhost`
serve somente quando o browser está na mesma máquina que o Compose. Se o app
for aberto por outro dispositivo, configure essa variável com um hostname/IP
acessível pelo dispositivo e reconstrua a imagem.

O `.env.example` habilita confirmação automática de e-mail e não configura um
servidor de e-mail de produção. Isso permite criar o primeiro operador sem
depender de entrega de e-mail. Antes de usar recuperação de senha ou fluxos de
e-mail em produção, configure um SMTP real (`SMTP_HOST`, `SMTP_PORT`,
`SMTP_USER`, `SMTP_PASS` e `SMTP_ADMIN_EMAIL`) e desligue a confirmação
automática conforme a política da campanha.

### Alterar URLs ou portas

Depois de mudar `NEXT_PUBLIC_SUPABASE_URL` ou
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, reconstrua o bundle do app:

```bash
docker compose up -d --build app
```

Para as URLs do Supabase Auth, configure conjuntamente `SITE_URL`,
`ADDITIONAL_REDIRECT_URLS`, `SUPABASE_PUBLIC_URL` e `API_EXTERNAL_URL`.
Com HTTPS atrás de um proxy, use os endereços HTTPS reais. URLs e variáveis
`NEXT_PUBLIC_*` são públicas e podem aparecer no bundle; não coloque segredos
nelas.

## Criar o primeiro administrador

1. Abra o Studio pela URL do gateway e entre com Basic Auth usando as
   credenciais do `.env`.
2. Na seção **Authentication > Users**, crie a conta do operador. A criação
   pública de usuários fica desabilitada por padrão.
3. Cadastre o UID da conta na tabela de administradores, trocando o e-mail no
   comando:

   ```bash
   docker compose exec -T db psql -U postgres -d postgres \
     -c "insert into public.admin_users (user_id) select id from auth.users where email = 'admin@exemplo.com' on conflict do nothing;"
   ```

4. Abra `/admin` no app e entre com essa conta.

O usuário precisa existir em Supabase Auth antes de executar o `INSERT`. Não
adicione usuários finais à tabela `admin_users`.

## Inicialização e migrações do banco do app

O serviço auxiliar `app-schema` espera o Postgres ficar acessível e aplica
[`supabase/schema.sql`](./supabase/schema.sql) se
`public.campaigns` ainda não existir. Ele não executa o esquema de novo em
starts subsequentes, preservando os dados.

O SQL inicial não é um sistema de migrações. Para evoluir o esquema após o
primeiro deploy, crie migrações incrementais e aplique-as explicitamente
depois de backup. Não apague volumes para tentar atualizar o schema: isso
remove também os dados do banco.

## Operação

```bash
# Ver status
docker compose ps --all

# Acompanhar todos os logs ou somente um serviço
docker compose logs -f
docker compose logs -f app
docker compose logs -f db

# Reiniciar ou reconstruir o app
docker compose restart app
docker compose up -d --build app

# Parar sem remover dados
docker compose down
```

Compose usa volumes nomeados para o banco (`db-data`, `db-config`), Storage
(`storage-data`) e cache Deno. `docker compose down` preserva esses dados.
**Evite `docker compose down -v`**: esse comando remove os volumes e apaga os
dados persistidos.

## Backup e restauração

Faça backup com os containers ativos:

```bash
umask 077
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > backup.dump
```

Para restaurar em um banco já inicializado, pare os serviços que acessam o
banco, faça backup dos dados atuais e use o procedimento de restauração
apropriado ao estado do banco:

```bash
docker compose stop app app-schema auth rest realtime storage supavisor
docker compose exec -T db pg_restore -U postgres -d postgres --clean --if-exists < backup.dump
```

`pg_restore --clean` remove objetos existentes antes de recriá-los; valide o
backup e o destino antes de usar. Em instalações novas, restaure primeiro no
banco e depois inicie os serviços dependentes.

O Storage também precisa de backup. Por ser um volume Docker local, faça uma
cópia com os containers parados ou use snapshots consistentes do host/volume.
Armazene backups cifrados fora do servidor e teste periodicamente a restauração.

## Produção e segurança

- Portas do app, gateway e Supavisor são publicadas em `127.0.0.1` por padrão.
  Mantenha-as privadas e coloque um proxy reverso com TLS na frente. Não exponha
  diretamente Postgres, pooler, Studio ou interfaces administrativas.
- Caso o proxy também rode em container, coloque-o na mesma rede Docker e
  configure o encaminhamento sem publicar portas administrativas. Se optar por
  mudar `BIND_IP`, limite o acesso no firewall e não exponha banco ou Studio.
- Use senhas fortes, restrinja acesso ao arquivo `.env`, firewall, contas
  administrativas e host Docker. O membro do grupo `docker` pode controlar o
  host e deve ser tratado como administrador.
- Configure e teste backups e retenção para Postgres, Storage e `.env`; perder
  o `JWT_SECRET` sem coordenar as chaves pode invalidar tokens existentes.
- Defina domínio, origem e redirecionamentos do Auth de acordo com a instalação;
  reforce MFA para operadores quando disponível.
- Esse deploy não oferece alta disponibilidade, balanceamento, backups
  automáticos nem proteção antifraude. Dimensione, monitore e revise a
  infraestrutura antes de uma promoção pública.
- O Compose oficial pode incluir serviços que buscam dependências externas na
  primeira inicialização, como pacotes do Edge Runtime. O host Docker precisa
  conseguir baixar imagens e resolver os serviços externos necessários durante
  a inicialização.

## Atualizar a stack Supabase

A configuração self-hosted está fixada à revisão em
[`deploy/supabase/.supabase-source-commit`](./deploy/supabase/.supabase-source-commit).
Antes de atualizar, leia [`deploy/supabase/UPSTREAM.md`](./deploy/supabase/UPSTREAM.md)
e o guia oficial de self-hosting/atualização do Supabase. Faça e teste backup,
revise alterações no Compose e nos scripts de banco, atualize deliberadamente
as tags de imagem e verifique a stack antes de apontar tráfego ao novo deploy.

## Validar sem iniciar containers

```bash
docker compose config --quiet
npm run lint
npm run build
npm audit
```
