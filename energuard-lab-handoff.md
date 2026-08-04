# 에너가드랩(ENERGUARD LAB) 시스템 현황 정리

## 1. 프로젝트 정체성
- **이름 정리**: "에너가드랩" = 이 프로젝트(`Naver-rank` 폴더, 사이트명 ENERGUARD LAB). "에너가드컴퍼니 통합관리시스템"(별도 프로젝트 `Admin_backup`)과는 다른 프로젝트이며, 통합관리시스템은 장기적으로 폐지하고 기능을 에너가드랩으로 순차 이관 중.
- **성격**: 정적 HTML/JS 사이트 + Supabase 백엔드. 회사 내부(직원)에게 공개되는 "셀러를 위한 데이터 허브" 제품형 대시보드. 로그인 없이 anon 키로 접근 가능(공개 데이터).
- **Supabase 프로젝트**: `eukwfypbfqojbaihfqye` (CLI 연동됨, `npx supabase functions deploy <name>`로 직접 배포 가능)

## 2. 기술 스택 / 컨벤션
- 정적 HTML + 바닐라 JS, 프레임워크 없음. Pretendard Variable 폰트.
- `common.css`/`common.js`: 전 페이지 공용 — 상단바(`initTopbar`, `TOPBAR_MENU` 배열 기반 자동 렌더), 푸터, 전역 로딩 오버레이(`showLoading`/`hideLoading`), 히스토리 패널, AI 챗 FAB(우하단, `gemini-chat` 함수 호출), `.store-chips`/`.store-select`/`.store-menu`/`.store-chip`(드롭박스 공용 컴포넌트), `.card`/`.app-shell`/`.app-title-tabs`/`.app-filterbar` 등 레이아웃 클래스.
- 메인 페이지들은 Supabase JS SDK 안 쓰고 **raw fetch**로 PostgREST(`/rest/v1/...`)와 Edge Function(`/functions/v1/...`) 직접 호출, anon 키 사용.
- **RLS 패턴**: 기존 테이블은 전부 `for all to anon using(true) with check(true)` (익명 오픈). **admin 전용 신규 테이블만 예외** — `to authenticated`로 잠금(아래 4번 참고).
- 색상/토큰: `--accent:#e85d2f`(오렌지), `--ink`, `--sub`, `--line`, `--bg`, `--card` 등 CSS 변수, 각 페이지 `<style>`에서 재정의.

## 3. 메인 사이트 페이지 (`index.html` 상단 nav 기준)
| 페이지 | 파일 | 비고 |
|---|---|---|
| 랭킹추적 | `rank-tracker.html` | **네이버 API 이슈로 현재 수집 중단** (6번 참고) |
| 키워드분석 | `naver-rank.html` | `naver-rank` 함수 |
| 블로그분석 | `blog-rank.html` | 블로그 노출진단/포스팅순위, **네이버 API 이슈로 순위 스캔 중단** |
| 매출분석 | `sales-analysis.html` | 스토어분석/광고분석 탭, 월별 바로가기(연도+12개월 카드) 컴포넌트의 원조 |
| 아이템발굴 | `item-discovery.html` | 실시간/구글/단열뉴스/단열급상승 4탭, `content_ideas` 테이블 |
| 유틸리티 | `utility.html` + `utility/calc/*.html` | 단열재 등 실무 계산기 모음 |

주요 Edge Functions: `naver-rank`, `blog-rank`, `shopping-trend`, `naver-ad-report`, `item-draft-openai`, `inquiry-assistant-`, `gemini-chat`.

## 4. 관리자(admin) 영역 — 오늘 대부분 신규 구축
### 설계 배경
- 에너가드랩은 사내 공개 예정 + anon 오픈이라, 업무노트 같은 내부용 데이터는 절대 같이 노출하면 안 됨 → **`admin/` 하위만 실제 Supabase Auth 로그인 + `authenticated` 전용 RLS로 분리.**
- 메인 nav 맨 끝에 "관리자" 링크(옅은 구분선으로 시각 분리) → `admin/login.html`(이메일/비번, 공개 가입 폼 없음. 계정은 Supabase 대시보드에서 수동 생성) → 통과하면 `admin/work-notes.html`.
- `admin/admin-common.js`: 세션 체크(`requireAdminSession`), 관리자 서브내비 렌더(`ADMIN_SUBNAV` 배열), 로그아웃.

### 서브내비 상태
`업무일지 / 업무기록(구현됨) / 단가표 / 견적서 / 자료실 / 위젯` — **업무기록만 구현**, 나머지는 `admin/coming-soon.html`로 연결된 자리만 있음.

### 업무기록 (`admin/work-notes.html` + `admin/work-notes.js` + `admin/admin.css`)
페이지 헤더가 매출분석과 동일한 `app-title-tabs` 패턴: **"업무기록 | 미디어채널"** 2탭, 각 탭 안에 store-select 드롭박스로 세부 종류 전환.

- **업무기록 탭** → 드롭박스로 두 화면 전환
  - **업무 정리**(Admin_backup의 "업무노트" 이식): 월별(연도+12개월 카드 선택) 일반노트 자동저장(2초 디바운스), Quill 2.x 리치에디터. 에디터 툴바 완전 커스텀 — Quill 기본 font/size 피커 대신 `.store-select` 컴포넌트로 교체해 `quill.format()` 직접 호출(Quill 자체 picker와 계속 충돌해서 이 방식으로 확정). 기본 글꼴 나눔스퀘어/15px. 아이콘 전부 Tabler 아이콘 세트로 교체.
  - **업무 타임라인**(Admin_backup `js/tasks.js`의 `time_logs` 이식): 날짜/구분/업무내용/시작-끝시간 입력, 날짜별 접기/펼치기 목록, 소요시간 색상강조(1시간↑/2시간↑), 검색, 수정/삭제. `work_timelogs` 테이블.
- **미디어채널 탭** → 드롭박스로 블로그원고/유튜브원고 전환(목록↔상세, 같은 Quill 에디터 재사용, AI추천 결과를 `ai_suggestion` 컬럼에 영구저장 — 레거시는 localStorage였음)
- 에디터 영역은 툴바 고정 + 본문만 내부 스크롤(`calc(100vh - 360px)`, 360~680px 범위)

### 신규 Supabase 테이블 (전부 `to authenticated` RLS)
- `work_notes`: id, type(general/blog/youtube), date, title, content, status, ai_suggestion, deleted_at, saved_at, created_at
- `work_timelogs`: id, date, category, task, start_time, end_time, duration, minutes, created_at
- 이관 SQL 2개 존재(`migrate_notes_to_work_notes.sql`, `migrate_timelogs_to_work_timelogs.sql`) — Admin_backup의 구 `notes`/`time_logs` 테이블(같은 Supabase 프로젝트 안에 공존)에서 1회성 복사, 재실행해도 중복 안 쌓이게 가드 처리. **원본 legacy 테이블은 안 건드림.**
- 이미지 업로드용 `admin-images` 스토리지 버킷(public read, authenticated만 insert).

## 5. 아직 안 한 것 / 남은 작업
- 관리자 서브내비: 업무일지/단가표/견적서/자료실/위젯 — 전부 미착수(Admin_backup에서 순서대로 이관 예정)
- 업무 정리(구 업무노트)와 통합관리시스템 쪽 `notes`는 **실시간 동기화 안 됨** — 전환 시점에 이관 SQL 한 번 더 돌리는 식. 현재는 과도기라 실제 작성은 여전히 통합관리시스템에서 하고 에너가드랩 쪽은 기능 테스트만 하는 중.

## 6. ⚠️ 현재 진행 중인 심각한 이슈 — 네이버 오픈API 붕괴
- **2026-08부터** 네이버가 검색 오픈API(뉴스/블로그/쇼핑 등)를 구 `developers.naver.com` 콘솔에서 **NAVER API HUB**(네이버클라우드플랫폼 운영)로 강제 이전. 구 `openapi.naver.com/v1/search/*.json` + `X-Naver-Client-Id/Secret` 조합이 `SE05(존재하지 않는 검색 api)`로 전면 거부됨.
- **영향**: 랭킹추적(rank-tracker) 전체, 블로그분석 포스팅순위 스캔, 메인화면 TOP노출상품, 아이템발굴 뉴스검색 전부 중단.
- **확인된 사실**:
  - 뉴스·블로그 검색은 NAVER API HUB로 정상 이관됨. 새 URL(`https://naverapihub.apigw.ntruss.com/search/v1/{news|blog}`) + 새 헤더(`X-NCP-APIGW-API-KEY-ID`, `X-NCP-APIGW-API-KEY`) + **NCP 콘솔에서 새로 발급받은 Client ID/Secret**만 있으면 복구 가능(기존 자격증명은 새 엔드포인트에서 아예 안 먹힘).
  - **네이버 "쇼핑" 개별 상품검색 API(제목/가격/링크/이미지 반환하는 `shop.json` 상당 기능)는 NAVER API HUB Application 등록 화면(실제 콘솔 스크린샷으로 확인) 어디에도 없음.** 있는 건 "쇼핑인사이트"(Data Lab, 카테고리/키워드별 클릭 "추세" 인덱스만 제공 — 개별 상품 정보 없음)뿐. 즉 랭킹추적의 핵심 기능(임의 키워드로 전체 네이버쇼핑 검색해서 내 상품 순위 찾기)은 **공식 API로 재현 불가능해진 것으로 보임** (100% 확정은 아니나 정황 강함 — 공식 문서 미스크랩 가능성 남아있음, 필요하면 네이버 쪽에 직접 문의 권장).
  - 이건 우리만의 문제가 아니라 경쟁사 랭킹추적 사이트들도 동시에 다운된 것을 사용자가 직접 확인함 — 업계 전반의 강제 이전 이슈.
- **코드 상태**: 한 번 새 엔드포인트로 수정+배포했다가, 대책을 다시 세우기 위해 **오늘 작업 전 원본 코드로 로컬+배포 전부 롤백 완료**. 즉 지금은 예전과 동일한 방식(구 API, 구 자격증명)으로 남아있고 당연히 계속 안 되는 상태.
- **다음에 결정해야 할 것**: (1) 뉴스/블로그만이라도 NCP 새 자격증명 받아서 먼저 복구할지, (2) 쇼핑 상품검색 대체 수단(스크래핑? 다른 API? 기능 축소?)을 어떻게 할지.
