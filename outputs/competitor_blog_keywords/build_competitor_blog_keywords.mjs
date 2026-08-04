import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const BLOG_RANK_URL = `${SUPABASE_URL}/functions/v1/blog-rank`;

const TITLE_KEYWORD_CANONICALS = [
  { label: "준불연단열재", aliases: ["준불연단열재", "준불연 단열재"] },
  { label: "불연단열재", aliases: ["불연단열재", "불연 단열재"] },
  { label: "열반사단열재", aliases: ["열반사단열재", "열반사 단열재", "열반사"] },
  { label: "비드법단열재", aliases: ["비드법단열재", "비드법 단열재"] },
  { label: "스티로폼단열재", aliases: ["스티로폼단열재", "스티로폼 단열재"] },
  { label: "압출법단열재", aliases: ["압출법단열재", "압출법 단열재", "압출법 보온판"] },
  { label: "경질우레탄보드", aliases: ["경질우레탄보드", "경질 우레탄 보드"] },
  { label: "우레탄보드", aliases: ["우레탄보드", "우레탄 보드"] },
  { label: "PF보드", aliases: ["PF보드", "피에프보드", "피에프 보드"] },
  { label: "아이소핑크", aliases: ["아이소핑크"] },
  { label: "페놀폼", aliases: ["페놀폼"] },
  { label: "네오폴", aliases: ["네오폴"] },
  { label: "단열재 종류", aliases: ["단열재종류", "단열재 종류"] },
  { label: "단열재 구매", aliases: ["단열재구매", "단열재 구매", "구매하는법", "싸게구매", "저렴하게구매"] },
  { label: "단열재 업체", aliases: ["단열재업체", "단열재 업체", "단열공사업체", "단열 업체"] },
  { label: "단열재 시공", aliases: ["단열재시공", "단열재 시공", "단열공사", "단열 공사"] },
  { label: "단열보드", aliases: ["단열보드", "단열 보드"] },
  { label: "복합단열재", aliases: ["복합단열재", "복합 단열재"] },
  { label: "보온재", aliases: ["보온재"] },
  { label: "인천 단열재", aliases: ["인천단열재", "인천 단열재", "인천단열재업체"] },
  { label: "서울 단열재", aliases: ["서울단열재", "서울 단열재", "서울단열업체"] },
  { label: "용인 단열재", aliases: ["용인단열재", "용인 단열재", "용인단열업체"] },
  { label: "학교 단열", aliases: ["학교단열", "학교 단열"] },
  { label: "블루인슈텍", aliases: ["블루인슈텍"] },
  { label: "스티로폼", aliases: ["스티로폼"] },
  { label: "단열벽지", aliases: ["단열벽지", "단열 벽지"] },
  { label: "베란다단열", aliases: ["베란다단열", "베란다 단열"] },
  { label: "창문단열", aliases: ["창문단열", "창문 단열"] },
  { label: "창문열차단", aliases: ["창문열차단", "창문 열차단"] },
  { label: "창문틈새", aliases: ["창문틈새", "창문 틈새"] },
  { label: "실외기커버", aliases: ["실외기커버", "실외기 커버"] },
  { label: "차량용햇빛가리개", aliases: ["차량용햇빛가리개", "차량용 햇빛가리개", "차량 햇빛 가리개"] },
  { label: "바닥단열재", aliases: ["바닥단열재", "바닥 단열재"] },
  { label: "난방필름", aliases: ["난방필름", "난방 필름"] },
  { label: "단열재", aliases: ["단열재"] },
];

const TITLE_KEYWORD_STOPWORDS = new Set([
  "이유", "방법", "추천", "확인", "정리", "비교", "주의", "필수", "완벽", "가이드",
  "어떻게", "무엇", "왜", "좋은가요", "있나요", "하나요", "입니다", "합니다", "그리고",
  "알려드립니다", "알려드리겠습니다", "알려드릴게요", "전문업체가", "전문업체", "구매하는법",
  "구매하는", "선택", "진행할때", "확인해야", "확인해보면", "좋은", "부분", "쉽게",
]);
const TITLE_KEYWORD_NOISE_RE = /(알려드|드립니다|드리겠습니다|전문업체|구매하는법|구매하는|확인해야|확인해보|진행할때|좋은부분|가능합니다|좋은가요|있나요|하나요|입니다|합니다)$/;

function normalizeTitleKeywordText(value) {
  return String(value || "")
    .replace(/[(){}\[\]'"“”‘’!?…·,:/|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactTitleKeyword(value) {
  return normalizeTitleKeywordText(value).replace(/\s+/g, "").toLowerCase();
}

function addTitleKeyword(list, label) {
  const compact = compactTitleKeyword(label);
  if (!compact || TITLE_KEYWORD_NOISE_RE.test(compact)) return;
  if (list.some(keyword => compactTitleKeyword(keyword).includes(compact))) return;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (compact.includes(compactTitleKeyword(list[i]))) list.splice(i, 1);
  }
  list.push(label);
}

function fallbackTitleKeywords(normalized) {
  return normalized
    .split(/\s+/)
    .map(word => word.replace(/[^0-9A-Za-z가-힣]/g, ""))
    .filter(word => {
      const compact = compactTitleKeyword(word);
      return word.length >= 2
        && !/^\d+$/.test(word)
        && !TITLE_KEYWORD_STOPWORDS.has(word)
        && !TITLE_KEYWORD_NOISE_RE.test(compact)
        && /(단열|보드|보온|창문|커버|가리개|필름|결로|곰팡이)/.test(word);
    })
    .sort((a, b) => b.length - a.length);
}

function titleKeywords(title) {
  const normalized = normalizeTitleKeywordText(title);
  const compact = compactTitleKeyword(normalized);
  const keywords = [];
  TITLE_KEYWORD_CANONICALS.forEach(({ label, aliases }) => {
    if (aliases.some(alias => compact.includes(compactTitleKeyword(alias)))) addTitleKeyword(keywords, label);
  });
  if (!keywords.length) fallbackTitleKeywords(normalized).forEach(keyword => addTitleKeyword(keywords, keyword));
  return keywords.slice(0, 3);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date;
}

const response = await fetch(BLOG_RANK_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "list" }),
});
if (!response.ok) throw new Error(`blog-rank list failed: ${response.status} ${await response.text()}`);
const state = await response.json();

const blogById = new Map((state.blogs || []).map(blog => [blog.blog_id, blog]));
const competitorRows = (state.posts || [])
  .filter(post => {
    const blog = blogById.get(post.blog_id);
    return blog && !blog.is_mine;
  })
  .sort((a, b) => {
    const blogA = blogById.get(a.blog_id)?.blog_name || a.blog_id;
    const blogB = blogById.get(b.blog_id)?.blog_name || b.blog_id;
    return blogA.localeCompare(blogB, "ko") || String(b.published_at || "").localeCompare(String(a.published_at || ""));
  })
  .map(post => {
    const blog = blogById.get(post.blog_id) || {};
    return [
      blog.blog_name || "",
      post.blog_id || "",
      post.log_no || "",
      post.title || "",
      titleKeywords(post.title || "").join(", "),
      formatDate(post.published_at),
      post.post_url || "",
      post.thumbnail_url || "",
    ];
  });

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("경쟁업체 블로그");
sheet.showGridLines = false;

sheet.getRange("A1:H1").merge();
sheet.getRange("A1").values = [["경쟁업체 블로그 주요 키워드"]];
sheet.getRange("A2:H2").merge();
sheet.getRange("A2").values = [[`저장된 경쟁업체 포스팅 ${competitorRows.length}개 기준 · 생성일 ${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`]];

const headers = [["업체명", "블로그 ID", "포스팅 ID", "제목", "주요 키워드", "발행일", "포스팅 URL", "썸네일 URL"]];
sheet.getRange("A4:H4").values = headers;
if (competitorRows.length) {
  sheet.getRangeByIndexes(4, 0, competitorRows.length, headers[0].length).values = competitorRows;
}

const lastRow = Math.max(5, competitorRows.length + 4);
sheet.getRange("A1:H1").format = {
  fill: "#FFFFFF",
  font: { bold: true, size: 16, color: "#0F172A" },
};
sheet.getRange("A2:H2").format = {
  fill: "#FFFFFF",
  font: { size: 10, color: "#64748B" },
};
sheet.getRange("A4:H4").format = {
  fill: "#F8FAFC",
  font: { bold: true, color: "#64748B" },
  borders: { preset: "all", style: "thin", color: "#DDE4EE" },
};
sheet.getRange(`A5:H${lastRow}`).format = {
  borders: { preset: "insideHorizontal", style: "thin", color: "#E8EDF4" },
  font: { size: 10, color: "#0F172A" },
};
sheet.getRange(`B5:C${lastRow}`).format = { font: { size: 10, color: "#475569" } };
sheet.getRange(`D5:E${lastRow}`).format.wrapText = true;
sheet.getRange(`F5:F${lastRow}`).format.numberFormat = "yyyy-mm-dd";
sheet.getRange(`G5:H${lastRow}`).format.wrapText = false;

sheet.getRange("A:A").format.columnWidth = 18;
sheet.getRange("B:B").format.columnWidth = 16;
sheet.getRange("C:C").format.columnWidth = 18;
sheet.getRange("D:D").format.columnWidth = 52;
sheet.getRange("E:E").format.columnWidth = 28;
sheet.getRange("F:F").format.columnWidth = 14;
sheet.getRange("G:G").format.columnWidth = 44;
sheet.getRange("H:H").format.columnWidth = 44;
sheet.freezePanes.freezeRows(4);

const tableRange = `A4:H${lastRow}`;
const table = sheet.tables.add(tableRange, true, "CompetitorBlogKeywordTable");
table.style = "TableStyleLight1";
table.showFilterButton = true;

const inspect = await workbook.inspect({
  kind: "table",
  range: `A1:H${Math.min(lastRow, 18)}`,
  include: "values",
  tableMaxRows: 18,
  tableMaxCols: 8,
});
console.log(inspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const preview = await workbook.render({ sheetName: "경쟁업체 블로그", range: `A1:H${Math.min(lastRow, 18)}`, scale: 1, format: "png" });
await fs.writeFile("competitor_blog_keywords_preview.png", new Uint8Array(await preview.arrayBuffer()));

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save("competitor_blog_keywords.xlsx");
console.log(`saved competitor_blog_keywords.xlsx rows=${competitorRows.length}`);
