// Supabase Free 플랜은 자동 백업이 없다 — anon 키로 SELECT 가능한 모든 테이블을 로컬 JSON으로
// 통째로 받아두는 수동 백업 스크립트. RLS가 anon에게 쓰기까지 열려있는 구조라(2026-08-12
// 리뷰에서 확인) 실수/외부 유출로 데이터가 지워지는 최악의 경우를 대비한 마지막 안전망이다.
//
// 실행: node supabase/backup-tables.mjs
// 결과: supabase/backups/<날짜시각>/<테이블명>.json 로 전체 테이블이 저장된다.

const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";

// supabase/sql, supabase/migrations의 create table 전체를 훑어서 뽑은 목록(2026-08-12 기준).
// 새 테이블을 추가하면 여기도 같이 추가해야 한다.
const TABLES = [
  "niche_trend_daily_snapshot",
  "realtime_trend_archive",
  "blog_rank_targets",
  "blog_rank_history",
  "shopping_search_snapshots",
  "blog_rank_diagnosis",
  "blog_rank_target_keywords",
  "blog_rank_exposure_history",
  "blog_rank_post_title_check",
  "blog_rank_post_ai_check",
  "blog_rank_post_content_check",
  "blog_rank_blogs",
  "blog_rank_posts",
  "blog_rank_post_keywords",
  "content_ideas",
  "content_drafts",
  "content_idea_rejected_keywords",
  "custom_tracked_keywords",
  "keyword_rank_history",
  "keyword_search_volume_monthly",
  "naver_ad_campaign_daily",
  "naver_customer_interest_monthly",
  "naver_search_daily",
  "sales_upload_rows",
  "coupang_ad_daily",
  "coupang_sales_daily",
  "coupang_item_snapshot",
  "coupang_product_map",
  "naver_product_daily",
  "naver_visit_daily",
  "realtime_trend_snapshot",
  "naver_customer_snapshot",
  "tracked_items",
  "tracked_item_history",
  "work_timelogs",
  "work_notes",
  "product_rankings",
];

async function fetchAllRows(table) {
  const pageSize = 1000;
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=*&offset=${offset}&limit=${pageSize}`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) {
      if (res.status === 404 || res.status === 400) return { error: `테이블 없음/조회 불가 (${res.status})` };
      throw new Error(`${table} 조회 실패 (${res.status}): ${await res.text()}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return { rows };
}

async function main() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(import.meta.dirname, "backups", stamp);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`백업 시작 -> ${outDir}`);
  const summary = [];
  for (const table of TABLES) {
    process.stdout.write(`  ${table} ... `);
    try {
      const { rows, error } = await fetchAllRows(table);
      if (error) {
        console.log(`건너뜀 (${error})`);
        summary.push({ table, status: "skip", detail: error });
        continue;
      }
      await fs.writeFile(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 0), "utf8");
      console.log(`${rows.length}행`);
      summary.push({ table, status: "ok", rows: rows.length });
    } catch (e) {
      console.log(`실패: ${e.message}`);
      summary.push({ table, status: "error", detail: e.message });
    }
  }

  await fs.writeFile(path.join(outDir, "_summary.json"), JSON.stringify(summary, null, 2), "utf8");
  const ok = summary.filter((s) => s.status === "ok");
  const totalRows = ok.reduce((sum, s) => sum + s.rows, 0);
  console.log(`\n완료: ${ok.length}/${TABLES.length}개 테이블, 총 ${totalRows.toLocaleString()}행 -> ${outDir}`);
}

main().catch((e) => {
  console.error("백업 실패:", e);
  process.exit(1);
});
