import fs from "node:fs/promises";

const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const INPUT_PATH = "C:/Users/Hankook_design/.codex/attachments/6afd5e2c-b128-43e1-9452-97dea6c92c5d/pasted-text.txt";

const headers = {
  apikey: SUPABASE_ANON_KEY,
  authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "content-type": "application/json",
};

function cleanText(value) {
  return String(value ?? "").trim();
}

function uniq(values) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method || "GET"} ${path} failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const raw = await fs.readFile(INPUT_PATH, "utf8");
const parsed = raw
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean)
  .map((line, index) => {
    const [blogId, logNo, keywordText] = line.split(/\t/).map(cleanText);
    if (!blogId || !logNo || !keywordText) throw new Error(`입력 형식 오류 ${index + 1}행: ${line}`);
    return {
      blogId,
      logNo,
      keywords: uniq(keywordText.split(",")),
    };
  });

const targetMap = new Map();
for (const row of parsed) {
  const key = `${row.blogId}::${row.logNo}`;
  const current = targetMap.get(key) || { blogId: row.blogId, logNo: row.logNo, keywords: [] };
  current.keywords = uniq([...current.keywords, ...row.keywords]);
  targetMap.set(key, current);
}
const targets = [...targetMap.values()];

const byBlog = new Map();
for (const target of targets) {
  if (!byBlog.has(target.blogId)) byBlog.set(target.blogId, []);
  byBlog.get(target.blogId).push(target.logNo);
}

let deletedGroups = 0;
for (const [blogId, logNos] of byBlog.entries()) {
  for (const logChunk of chunk(uniq(logNos), 80)) {
    const inFilter = logChunk.map(encodeURIComponent).join(",");
    await rest(`blog_rank_post_keywords?blog_id=eq.${encodeURIComponent(blogId)}&log_no=in.(${inFilter})`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    deletedGroups += 1;
  }
}

const now = new Date().toISOString();
const rows = targets.flatMap(target => target.keywords.map(keyword => ({
  blog_id: target.blogId,
  log_no: target.logNo,
  keyword,
  source: "manual",
  search_volume: null,
  device: "desktop",
  max_rank: 300,
  active: true,
  updated_at: now,
})));

let inserted = 0;
for (const rowChunk of chunk(rows, 500)) {
  await rest("blog_rank_post_keywords?on_conflict=blog_id,log_no,keyword,device", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rowChunk),
  });
  inserted += rowChunk.length;
}

const verify = await rest(`blog_rank_post_keywords?select=blog_id,log_no,keyword&blog_id=in.(${[...byBlog.keys()].map(encodeURIComponent).join(",")})&limit=5000`);
const targetKeys = new Set(targets.map(row => `${row.blogId}::${row.logNo}`));
const matched = (verify || []).filter(row => targetKeys.has(`${row.blog_id}::${row.log_no}`));
const uniquePostCount = new Set(matched.map(row => `${row.blog_id}::${row.log_no}`)).size;

console.log(JSON.stringify({
  inputLines: parsed.length,
  targetPosts: targets.length,
  deleteRequests: deletedGroups,
  insertedKeywords: inserted,
  verifiedRows: matched.length,
  verifiedPosts: uniquePostCount,
}, null, 2));
