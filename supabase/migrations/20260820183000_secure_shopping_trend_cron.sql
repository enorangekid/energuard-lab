-- shopping-trend validates either an admin JWT or the shared cron secret.
-- Replace the old publishable-key cron headers with the Vault secret.
do $$
begin
  perform cron.unschedule('realtime-trend-collect-3h');
exception when others then
  null;
end $$;

select cron.schedule(
  'realtime-trend-collect-3h',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/shopping-trend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-energuard-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'energuard_cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('action', 'collectRealtime')
  );
  $$
);

do $$
begin
  perform cron.unschedule('niche-trend-collect-daily');
exception when others then
  null;
end $$;

select cron.schedule(
  'niche-trend-collect-daily',
  '15 21 * * *',
  $$
  select net.http_post(
    url := 'https://eukwfypbfqojbaihfqye.supabase.co/functions/v1/shopping-trend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-energuard-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'energuard_cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('action', 'collectNicheDaily')
  );
  $$
);
