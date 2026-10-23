# Supabase self-hosted configuration

`docker-compose.yml` and the files under `volumes/` are derived from the
official self-hosted Docker configuration in `supabase/supabase`, licensed
under Apache License 2.0. The included license is in [`LICENSE`](./LICENSE).

Upstream revision: [`2ddb9a9894c93f5d76e00c0554a2f43e96e6660e`](https://github.com/supabase/supabase/tree/2ddb9a9894c93f5d76e00c0554a2f43e96e6660e/docker).

The Compose file is adjusted for this project to bind published services to
loopback by default and use named persistent volumes for Postgres and Storage.
Review the upstream self-hosting update guide before changing the pinned
Supabase revision or service image versions.
