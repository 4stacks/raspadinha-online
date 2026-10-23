# Sorte de Casa

Aplicação promocional de raspadinha online, gratuita para participantes, com
experiência PWA, painel administrativo, probabilidades configuráveis e resgate
de brindes.

## Tecnologias

- Next.js App Router, React e TypeScript
- Supabase Auth e PostgreSQL
- Service worker para instalação e shell offline; jogar e resgatar exigem conexão
- Docker Compose para executar a aplicação e a infraestrutura Supabase self-hosted

## Executar em um ambiente novo com Docker

### Pré-requisitos

- Git para obter este repositório.
- Docker Engine e o plugin Docker Compose v2.
- Node.js 22 ou superior para gerar o arquivo inicial `.env`.
- Acesso à internet pelo host Docker para baixar imagens e dependências dos serviços.
- Espaço em disco e memória para imagens, banco de dados e arquivos do Storage.

### Instalação e primeiro start

1. Clone o repositório e entre na pasta do projeto:

   ```bash
   git clone https://github.com/4stacks/raspadinha-online.git
   cd raspadinha-online
   ```

2. Inicie a aplicação e toda a infraestrutura:

   ```bash
   ./scripts/deploy.sh
   ```

   Na primeira execução, o script copia [`.env.example`](./.env.example) para
   `.env`, gera senhas e chaves aleatórias, configura o arquivo com permissão
   restrita (`0600`), valida o Compose, constrói a imagem da aplicação e inicia
   os serviços em segundo plano. A stack inclui Next.js, gateway, Supabase Auth,
   PostgREST, Realtime, Storage, Studio, PostgreSQL, Supavisor e Edge Functions.

   O `.env` é ignorado pelo Git. Guarde-o com segurança: ele contém credenciais
   importantes e não deve ser publicado. O script não sobrescreve um `.env`
   existente.

3. Aguarde a inicialização, que pode levar alguns minutos na primeira vez.
   Confira o estado dos serviços e, se necessário, acompanhe o banco e a
   instalação do schema:

   ```bash
   docker compose ps --all
   docker compose logs -f db
   docker compose logs -f app-schema
   ```

4. Abra a aplicação:

   - App: <http://localhost:3000>
   - Supabase API e Studio: <http://localhost:8000>

   O acesso ao Studio pelo gateway é protegido por Basic Auth. Use
   `DASHBOARD_USERNAME` e `DASHBOARD_PASSWORD` do `.env`.

O serviço `app-schema` instala [`supabase/schema.sql`](./supabase/schema.sql)
somente quando o schema da aplicação ainda não existe. Os dados são mantidos
em volumes Docker nomeados.

### Criar o primeiro administrador

1. Abra <http://localhost:8000> e autentique no Studio com as credenciais
   `DASHBOARD_USERNAME` e `DASHBOARD_PASSWORD` do `.env`.
2. Em **Authentication > Users**, crie o usuário que administrará as campanhas.
   O cadastro público de usuários fica desabilitado por padrão.
3. No terminal, substitua o e-mail de exemplo e execute:

   ```bash
   docker compose exec -T db psql -U postgres -d postgres \
     -c "insert into public.admin_users (user_id) select id from auth.users where email = 'admin@exemplo.com' on conflict do nothing;"
   ```

4. Acesse <http://localhost:3000/admin> e entre com a conta criada.

O usuário precisa existir no Supabase Auth antes de executar o comando. Adicione
somente operadores autorizados à tabela `admin_users`.

### Configuração para outro host ou domínio

O `.env` gerado usa `localhost`, adequado quando o navegador está na mesma
máquina do Docker. Para acessar de outro dispositivo ou por um domínio:

1. Edite `.env` antes de iniciar a stack e configure as URLs acessíveis pelos
   navegadores e pelo Supabase Auth:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL pública do gateway Supabase usada pelo
     navegador.
   - `SUPABASE_PUBLIC_URL`: URL pública do gateway Supabase.
   - `API_EXTERNAL_URL`: URL pública de Auth, normalmente
     `${SUPABASE_PUBLIC_URL}/auth/v1`.
   - `SITE_URL` e `ADDITIONAL_REDIRECT_URLS`: origem do app e redirecionamentos
     permitidos pelo Auth.
   - `WEB_PORT` e `API_GW_HTTP_PORT`: portas locais publicadas.
2. Use HTTPS e configure essas URLs com o domínio HTTPS quando houver proxy
   reverso. As portas publicadas ficam em `127.0.0.1` por padrão para não
   expor diretamente a stack; mantenha Postgres, pooler e Studio privados.
3. Reconstrua o app após alterar `NEXT_PUBLIC_SUPABASE_URL` ou
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, pois esses valores são incorporados ao
   bundle:

   ```bash
   docker compose up -d --build app
   ```

O `.env.example` habilita confirmação automática de e-mail e não configura SMTP
de produção. Antes de usar recuperação de senha ou fluxos de e-mail em
produção, configure SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` e
`SMTP_ADMIN_EMAIL`) e ajuste `ENABLE_EMAIL_AUTOCONFIRM` à política desejada.
`SERVICE_ROLE_KEY`, senha do banco e senha do Studio são segredos: nunca as
coloque em variáveis `NEXT_PUBLIC_*`, no navegador ou em logs públicos.

### Operação diária

```bash
# Ver estado
docker compose ps --all

# Acompanhar logs
docker compose logs -f
docker compose logs -f app

# Reiniciar ou reconstruir a aplicação
docker compose restart app
docker compose up -d --build app

# Parar preservando os dados
docker compose down
```

**Não use `docker compose down -v` para parar ou atualizar:** ele remove os
volumes persistentes e apaga dados do banco e do Storage. O SQL inicial não é
um sistema de migrações; mudanças futuras no banco devem ser aplicadas com
migrações incrementais, depois de backup.

### Backup do banco

Com os containers ativos, gere um backup PostgreSQL:

```bash
umask 077
docker compose exec -T db pg_dump -U postgres -d postgres -Fc > backup.dump
```

O Storage também precisa ser copiado; faça isso com os containers parados ou
use snapshots consistentes dos volumes do host. Guarde backups cifrados fora do
servidor e teste a restauração regularmente. O procedimento de restauração e
as instruções completas de manutenção estão em [`DEPLOY.md`](./DEPLOY.md).

## Desenvolvimento local com Supabase hospedado

1. Crie um projeto Supabase.
2. No SQL Editor do Supabase, execute [`supabase/schema.sql`](./supabase/schema.sql).
3. Crie um usuário no Supabase Auth e cadastre-o como administrador, usando o
   e-mail escolhido:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@exemplo.com';
   ```

   Execute a consulta com acesso administrativo ao banco. A tabela não permite
   que participantes promovam a si mesmos.
4. Copie `.env.example` para `.env.local` e configure a URL e a chave pública
   (anon) do projeto Supabase:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-publica-anon
   ```

5. Instale dependências e inicie o servidor:

   ```bash
   npm ci
   npm run dev
   ```

Abra <http://localhost:3000>. O painel fica em `/admin`. Em produção, configure
as variáveis também durante o build do Next.js, pois a URL e a chave pública
são incorporadas ao bundle do navegador.

## Fluxo de campanha e resultado

- Crie a campanha em rascunho, adicione brindes, suas probabilidades em
  porcentagem e, opcionalmente, quantidades finitas.
- A soma das probabilidades de brindes ativos não pode exceder 100%; o
  percentual restante corresponde a resultado sem prêmio.
- Ative a campanha dentro do período configurado. O banco valida novamente a
  disponibilidade e os limites no momento da jogada.
- A função `play_scratchcard` gera a aleatoriedade com `pgcrypto`, registra a
  jogada e atualiza o estoque dentro de uma transação, bloqueando a campanha
  para evitar ultrapassar a quantidade disponível.
- Se o estoque de um brinde acabar, a faixa de probabilidade dele resulta em
  jogada sem prêmio; as demais chances não são redistribuídas.
- Para ganhadores, nome e e-mail são solicitados somente depois da revelação.
  A função de resgate valida a jogada premiada e permite um único envio por
  jogada; a equipe pode atualizar o status pelo painel.

## Validação

```bash
npm run lint
npm run build
```

## Limites e preparação para produção

- O identificador persistido no navegador impede uma segunda jogada no mesmo
  perfil, mas pode ser apagado ou contornado. Não equivale a validação de
  identidade, limitação por pessoa ou antifraude.
- Configure HTTPS, domínios e redirecionamentos do Supabase Auth, restrinja
  contas administrativas e teste políticas de acesso e restauração antes da
  promoção.
- Defina termos, regras completas da promoção, canal e prazo de entrega,
  fundamento legal e retenção/exclusão dos dados pessoais com a assessoria
  apropriada. O MVP não envia brindes nem substitui revisão jurídica.
- O service worker não armazena endpoints de campanha, jogadas ou dados
  pessoais. Jogar e resgatar não funcionam offline.
- O deploy Compose não fornece alta disponibilidade, backups automáticos nem
  proteção antifraude. Antes de uma promoção pública, dimensione, monitore e
  revise a infraestrutura.
