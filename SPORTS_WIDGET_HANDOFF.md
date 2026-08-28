# 스포츠 위젯 작업 인수인계

최종 정리일: 2026-08-28 (KST)

## 1. 실제 작업 프로젝트

- 스포츠 위젯은 현재 `Naver-rank`가 아니라 아래 관리자 프로젝트에 있다.
- 프로젝트: `C:\Users\Hankook_design\Desktop\★계산기모음\Admin_backup`
- GitHub: `https://github.com/enorangekid/energuard-system.git`
- 브랜치: `main`
- 핵심 로직: `Admin_backup/js/widget-sports.js`
- 위젯 스타일: `Admin_backup/css/panels.css`
- 스크립트 로드: `Admin_backup/index.html`
- 로컬 확인 주소: `http://127.0.0.1:5500/`

새 채팅에서 작업을 재개할 때는 반드시 `Admin_backup`의 현재 파일과 `git status`, 최근 커밋을 먼저 확인한다. Claude와 함께 수정할 수 있으므로 과거 상태를 전제로 덮어쓰지 않는다.

## 2. 현재 종목과 데이터 소스

### NBA

- 경기 일정/결과: ESPN scoreboard
- 팀 순위: ESPN standings
- 선수 스탯: ESPN `statistics/byathlete` 엔드포인트
- 선수 항목: 득점, 리바운드, 어시스트, 스틸, 블록
- 현재 시즌과 과거 시즌 선택 지원
- `팀 순위 | 선수 스탯` 탭으로 분리

### EPL

- 경기 일정/결과: ESPN scoreboard
- 팀 순위: ESPN standings
- 선수 스탯: ESPN statistics
- 현재 시즌과 과거 시즌 선택 지원
- `팀 순위 | 선수 스탯` 탭으로 분리

### MLB

- ESPN MLB 통계는 시즌 중간 데이터가 멈춰 사용하지 않는다.
- 경기 일정/결과: MLB 공식 Stats API
- 팀 순위: MLB 공식 Stats API
- 선수 스탯: MLB 공식 Stats API
- 현재 시즌과 과거 시즌 선택 지원
- `팀 순위 | 선수 스탯` 탭으로 분리
- 선수 스탯은 `아메리칸리그 | 내셔널리그`로 분리
- 타자 순서: 타율, 홈런, 타점, 도루
- 투수 순서: 평균자책, 다승, 탈삼진, 세이브

### UEFA Champions League

- UEFA가 이 위젯에 바로 사용할 공개 공식 API를 제공하지 않아 ESPN을 사용한다.
- 본선: `uefa.champions`
- 예선/플레이오프: `uefa.champions_qual`
- 두 scoreboard 응답을 병합하고 경기 ID로 중복 제거한다.
- 경기 검색 범위는 최근 6일~향후 14일이다.

### FIFA World Cup

- ESPN scoreboard와 standings를 사용한다.

## 3. UI 공통 상태

- NBA, EPL, MLB는 `팀 순위`가 기본 탭이다.
- NBA, EPL, MLB에서 현재/과거 시즌 선택을 지원한다.
- 선수 스탯의 `더보기`를 눌러도 열 너비가 틀어지지 않도록 공통 렌더링을 수정했다.
- MLB 선수 스탯은 리그 선택 탭 아래에 타자/투수 그룹으로 나뉜다.
- 팀명 한글 매핑에서 `Spurs`, `Rangers`처럼 종목 간 이름이 겹치는 팀은 종목 문맥으로 구분한다.

## 4. UCL 마지막 문제와 조치

사용자 화면에서는 UCL이 `경기 정보가 없습니다`로 표시됐다.

확인 결과(2026-08-27):

- ESPN `uefa.champions`: 해당 조회 기간 경기 0건
- ESPN `uefa.champions_qual`: 해당 조회 기간 경기 7건
- 같은 브라우저/로컬 origin에서 CORS fetch도 예선 7건 정상
- 따라서 API와 CORS 문제가 아니라 이전 JS 캐시가 남은 문제로 판단했다.

조치:

- UCL 본선+예선 API 병합: 커밋 `94cf904`
- `index.html`의 위젯 스크립트에 캐시 버전 추가:
  `js/widget-sports.js?v=20260827-uclfix`
- 캐시 갱신 커밋: `49c69ed`

주의:

- 위 캐시 갱신 이후 실제 사용자 화면에서 UCL 7경기가 표시되는지는 아직 최종 확인 전이다.
- 새 채팅에서 사용자가 계속 정보 없음이라고 하면 캐시라고 다시 단정하지 말고, 먼저 현재 HTML이 버전 URL을 로드하는지와 위젯 런타임 오류를 브라우저 콘솔에서 확인한다.
- 현재 시점에 본선 경기가 없더라도 예선/플레이오프가 조회 범위에 있으면 UCL 탭에 표시되어야 정상이다.

## 5. 최근 관련 커밋

- `49c69ed` fix: UCL 위젯 캐시 갱신
- `94cf904` fix: UCL 예선 경기 피드 통합
- `e23a61c` feat: EPL 팀 순위와 선수 스탯 분리
- `88bed65` feat: NBA 시즌별 순위와 선수 스탯 추가
- `47f2d3e` fix: MLB 팀 순위 탭을 기본으로 표시
- `92af613` refactor: MLB 위젯 공식 API로 통일
- `c71b6ea` fix: MLB 과거 시즌 선수 스탯 렌더링
- `17b3d7d` fix: MLB 과거 시즌 스탯 우선 표시
- `666babc` feat: MLB 과거 시즌 통계 선택 추가
- `bb2cb73` fix: 선수 스탯 더보기 열 정렬 유지
- `6c0b84e` feat: MLB 리그별 선수 순위 탭 추가

## 6. 재개 시 점검 순서

1. `Admin_backup`에서 `git status --short`와 `git log -10 --oneline` 확인
2. `node --check js/widget-sports.js` 실행
3. `index.html`이 최신 `widget-sports.js?v=...`를 로드하는지 확인
4. 로컬 관리자 페이지에서 UCL 탭 열기
5. 브라우저 콘솔 오류와 ESPN 본선/예선 응답 건수 확인
6. 수정 후 NBA/EPL/MLB의 팀 순위, 선수 스탯, 시즌 변경도 함께 회귀 테스트

## 7. 구현 시 주의사항

- ESPN의 문서화되지 않은 API는 응답 구조가 바뀔 수 있으므로 null-safe하게 렌더링한다.
- MLB는 다시 ESPN 통계로 되돌리지 않는다. 공식 MLB Stats API가 현재 기준 데이터 정확성이 더 높다.
- UCL은 본선과 예선 엔드포인트 중 하나만 조회하면 시즌 시점에 따라 빈 화면이 생긴다.
- 사용자와 Claude가 동시에 작업할 수 있으므로 변경 전 현재 diff를 읽고 사용자 변경을 되돌리지 않는다.
- 캐시 문제를 막기 위해 `widget-sports.js` 수정 시 `index.html`의 버전 쿼리도 함께 갱신한다.
