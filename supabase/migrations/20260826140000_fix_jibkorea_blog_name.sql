-- 등록 당시 RSS 채널 제목("집코리아로 우리집 새로고침!")이 그대로 저장된 항목을
-- 사용자가 요청한 표시명 "집코리아"로 정정.
update public.blog_rank_blogs
set blog_name = '집코리아'
where blog_name = '집코리아로 우리집 새로고침!';
