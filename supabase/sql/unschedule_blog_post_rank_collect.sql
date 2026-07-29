-- 매일 KST 23:00 순위 수집 크론(daily-blog-post-rank-collect)을 끈다.
-- search.naver.com 스크래핑 + m.blog.naver.com 본문 조회가 매일 밤 무인으로 도는 걸
-- 막기 위한 조치 — blog_rank_diagnosis용 23:50 크론(daily-blog-diagnosis-collect,
-- 블로그차트/웨어이즈포스트 — 네이버가 아닌 제3자 사이트 조회)은 그대로 둔다.
-- Supabase 대시보드 SQL Editor에서 실행하세요.

select cron.unschedule('daily-blog-post-rank-collect');

-- 확인 (결과가 없어야 정상적으로 삭제된 것)
select jobid, jobname, schedule, active from cron.job where jobname = 'daily-blog-post-rank-collect';

-- 참고: 순위 수집 자체는 여전히 가능합니다 — 이제는 "전체 순위 재분석"/카드별 "순위 수집"
-- 버튼 같은 수동 트리거로만 돕니다. 다시 자동으로 돌리고 싶으면
-- cron_blog_post_rank_collect.sql을 다시 실행하면 됩니다.
