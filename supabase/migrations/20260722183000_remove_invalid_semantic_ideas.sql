delete from public.content_ideas
where id like 'trend-20260722-%'
  and status = 'candidate'
  and content_angle <> '';
