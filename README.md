# Sorte de Casa

Aplicação promocional de raspadinha online, gratuita para participantes, com experiência PWA, painel administrativo, probabilidades configuráveis e resgate de brindes.

## Tecnologias

- Next.js App Router, React e TypeScript
- Supabase Auth e PostgreSQL
- Service worker para instalação e shell offline; jogar e resgatar exigem conexão

## Configuração local

1. Crie um projeto Supabase.
2. No SQL Editor do Supabase, execute [`supabase/schema.sql`](./supabase/schema.sql).
3. Crie um usuário de acesso administrativo no Supabase Auth.
4. Cadastre esse usuário na lista de administradores, substituindo pelo e-mail usado na criação:

   ```sql
   insert into public.admin_users (user_id)
   select id from auth.users where email = 'admin@exemplo.com';
   ```

   Execute a consulta com acesso administrativo ao banco. A tabela não permite que participantes promovam a si mesmos.
5. Copie `.env.example` para `.env.local` e preencha a URL e a chave pública (anon) do projeto Supabase.
6. Instale e execute:

   ```bash
   npm install
   npm run dev
   ```

Abra `http://localhost:3000`. Entre no painel em `/admin`. O jogo lê o identificador da campanha no parâmetro `?campanha=slug`; o painel também oferece um link para cada campanha.

Em produção, configure essas variáveis também no ambiente de build do Next.js, pois a chave pública é incorporada ao bundle do navegador.

## Fluxo de campanha e resultado

- Crie a campanha em rascunho, adicione brindes, suas probabilidades em porcentagem e, opcionalmente, quantidades finitas.
- A soma das probabilidades de brindes ativos não pode exceder 100%; o percentual restante corresponde a resultado sem prêmio.
- Ative a campanha dentro do período configurado. O banco valida novamente a disponibilidade e os limites no momento da jogada.
- A função `play_scratchcard` gera a aleatoriedade com `pgcrypto`, registra a jogada e atualiza o estoque dentro de uma transação, bloqueando a campanha para evitar ultrapassar a quantidade disponível.
- Se o estoque de um brinde acabar, a faixa de probabilidade dele resulta em jogada sem prêmio; as demais chances não são redistribuídas.
- O resultado registrado é retornado para a interface ser revelado pela raspadinha. Para ganhadores, nome e e-mail são solicitados somente depois da revelação.
- A função de resgate valida a jogada premiada e permite um único envio por jogada. A equipe pode atualizar o status pelo painel.

## Limites e preparação para produção

- O identificador persistido no navegador impede uma segunda jogada no mesmo perfil de navegador, mas pode ser apagado ou contornado. Não equivale a validação de identidade, limitação por pessoa ou antifraude; defina as regras de elegibilidade e controles antes de uma promoção pública.
- Proteja o projeto Supabase, mantenha Auth com cadastro público desabilitado se não for necessário e conceda acesso administrativo apenas a pessoas autorizadas. A aplicação usa somente a chave pública anon; não coloque chaves `service_role` no navegador.
- Configure HTTPS e domínios permitidos no Supabase Auth. Teste políticas de acesso e restauração de dados antes de produção.
- Defina termos, regras completas da promoção, canal e prazo de entrega, fundamento legal e retenção/exclusão dos dados pessoais com a assessoria apropriada. O MVP não envia brindes nem substitui revisão jurídica.
- O service worker não armazena endpoints de campanha, jogadas ou dados pessoais. A jogada e o resgate não funcionam offline.

## Validação

```bash
npm run lint
npm run build
```
