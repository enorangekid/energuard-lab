const SUPABASE_URL = "https://eukwfypbfqojbaihfqye.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_MiBvlf3d6ulcVBsi7Odcgw_PTXSmXKj";
const PROGRESS_KEY = "shoppingRankProgress";
const PENDING_KEY = "shoppingRankPendingConfig";
const STORE_IDENTITIES = {
  ["\uD55C\uAD6D\uB2E8\uC5F4"]: {
    channelNos: ["500128955"],
    providerIds: ["329308"],
  },
  // \uC774\uAC8C \uC5C6\uC73C\uBA74 mallName\uC774 \uC548 \uC7A1\uD788\uB294 \uCE74\uB4DC\uB294 "\uC774\uBBF8 \uC54C\uB824\uC9C4 \uC0C1\uD488\uCF54\uB4DC"\uB85C\uB9CC \uB9E4\uCE6D\uD558\uB294\uB370, \uADF8 \uBAA9\uB85D\uC774
  // fetchCollectionContext\uC758 limit(10000)\uBCF4\uB2E4 \uC774\uB825\uC774 \uB9CE\uC544\uC9C0\uBA74 \uC624\uB798\uB41C \uCF54\uB4DC\uBD80\uD130 \uBC00\uB824\uB098
  // \uC2E4\uC81C\uB85C \uC21C\uC704\uAD8C\uC778\uB370\uB3C4 "\uC774\uD0C8"\uB85C \uC798\uBABB \uAE30\uB85D\uB41C\uB2E4(\uC5D0\uB108\uAC00\uB4DC\uCEF4\uD37C\uB2C8 8/3 \uC774\uD6C4 \uC900\uBD88\uC5F0\uB2E8\uC5F4\uC7AC \uB4F1\uC5D0\uC11C
  // \uC2E4\uC81C\uB85C \uC774 \uC0AC\uACE0\uAC00 \uB0AC\uB2E4). \uC9C1\uC811 channelNo/providerId\uB85C \uB9E4\uCE6D\uD558\uBA74 \uC774\uB825 \uD06C\uAE30\uC640 \uBB34\uAD00\uD558\uAC8C \uC548\uC804\uD558\uB2E4.
  ["\uC5D0\uB108\uAC00\uB4DC\uCEF4\uD37C\uB2C8"]: {
    channelNos: ["102352173"],
    providerIds: ["10864584"],
  },
};

// \uC0C1\uD488\uCF54\uB4DC\uBCC4 "\uC774 \uC0C1\uD488\uC774 \uC2E4\uC81C\uB85C \uCD94\uC801\uD574\uC57C \uD560 \uBA54\uC778+\uBCF4\uC870 \uD0A4\uC6CC\uB4DC" \uD654\uC774\uD2B8\uB9AC\uC2A4\uD2B8 (2026-08-13,
// \uC0AC\uC6A9\uC790\uAC00 keyword0813.xlsx\uB85C \uC9C1\uC811 \uC815\uB9AC\uD574\uC11C \uC804\uB2EC, naver-rank.html\uC758 \uB3D9\uC77C \uC0C1\uC218\uC640 \uC9DD\uC744 \uC774\uB8EC\uB2E4).
// "\uD55C\uAD6D \uB2E8\uC5F4" \uC2A4\uD1A0\uC5B4\uB294 \uBC30\uC815\uB41C \uD0A4\uC6CC\uB4DC\uAC00 \uC5C6\uC5B4 keywords.js \uC804\uCCB4\uB97C \uD6D1\uB2E4\uBCF4\uB2C8, \uC7AC\uC9C8\uC774 \uACB9\uCE58\uAC70\uB098
// \uAC19\uC740 \uBE0C\uB79C\uB4DC\uAC00 \uC5EC\uB7EC \uCE74\uD14C\uACE0\uB9AC\uB97C \uD314\uBA74 \uC5C9\uB6B1\uD55C \uD0A4\uC6CC\uB4DC\uC5D0\uB3C4 \uAC19\uC774 \uAC78\uB9AC\uB358 \uBB38\uC81C(\uC608: \uC6B0\uB808\uD0C4\uD3FC\uAC74
// \uC561\uC138\uC11C\uB9AC \uC0C1\uD488\uC774 \uC6B0\uB808\uD0C4\uBFDC\uCE60 \uB300\uC2E0 \uC6B0\uB808\uD0C4\uD3FC\uAC74\uC73C\uB85C \uACC4\uC18D \uC7A1\uD798)\uB97C \uC2E4\uC81C \uC800\uC7A5 \uC9C0\uC810(\uC774 \uD30C\uC77C\uC758
// \uBC30\uCE58\uC218\uC9D1 \uC800\uC7A5 \uB85C\uC9C1)\uC5D0\uC11C \uB9C9\uB294\uB2E4. \uBAA9\uB85D\uC5D0 \uC5C6\uB294 \uC0C1\uD488(\uC2E0\uC0C1\uD488 \uD3EC\uD568)\uC740 \uC9C0\uAE08\uCC98\uB7FC \uC81C\uD55C \uC5C6\uC774 \uC800\uC7A5.
// alt_codes(\uADF8\uB8F9\uC0C1\uD488 \uB300\uCCB4\uCF54\uB4DC)\uB3C4 \uB9C8\uC2A4\uD130 \uCF54\uB4DC\uC640 \uB3D9\uC77C\uD55C \uD0A4\uC6CC\uB4DC \uBAA9\uB85D\uC73C\uB85C \uAC19\uC774 \uB4F1\uB85D\uD574\uB480\uB2E4 \u2014
// \uC218\uC9D1\uAE30\uAC00 \uC5B4\uB290 \uCABD \uCF54\uB4DC\uB85C \uC7A1\uB4E0(\uAC00\uACA9\uBE44\uAD50ID \uD30C\uD3B8\uD654) \uD654\uC774\uD2B8\uB9AC\uC2A4\uD2B8\uAC00 \uBE60\uC9D0\uC5C6\uC774 \uAC78\uB9AC\uAC8C \uD558\uAE30 \uC704\uD568.
const PRODUCT_KEYWORD_WHITELIST = {
  "439904706": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "439103571": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "3736232926": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "5695312387": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "2229818356": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8324375715": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "11097629335": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "4995022274": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10181571912": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8131395351": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10181564057": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8324406068": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8456757485": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10181586522": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "442086644": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10181582241": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8324347562": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10181453964": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "8324352040": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "5697937041": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10185646787": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "10185649832": ["아이소핑크", "XPS단열재", "압출법보온판", "벽산아이소핑크", "아이소핑크특호", "아이소핑크규격", "압출법단열재"],
  "3020442618": ["압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "2913417918": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "437331834": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "5759250443": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "7875494911": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "3950515541": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "5763066244": ["스티로폼", "압축스티로폼", "미술용스티로폼", "EPS블럭", "대형스티로폼", "조각용스티로폼", "폼보드"],
  "2216673728": ["스티로폼단열재", "EPS단열재", "비드법단열재", "네오폴"],
  "3950655401": ["스티로폼단열재", "EPS단열재", "비드법단열재", "네오폴"],
  "446014684": ["스티로폼단열재", "EPS단열재", "비드법단열재", "네오폴"],
  "3505478787": ["스티로폼단열재", "EPS단열재", "비드법단열재", "네오폴"],
  "505443624": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "3781080651": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "349222019": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "614497979": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12605232942": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "623737324": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "3780749543": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235975": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235987": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235985": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235984": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235983": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235982": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235981": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235980": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235979": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235978": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235977": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235976": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12989235974": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "12936160195": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341781": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341786": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341784": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341783": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341782": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341779": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341778": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341777": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341776": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341775": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341774": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341773": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "13312341772": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2599242583": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10471290026": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2599610352": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10923727373": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2599158337": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10985931589": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2599273590": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "628487624": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10917153822": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10912518316": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "88457024351": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2598880337": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "2448558544": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10985933117": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10628616594": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10985932386": ["열반사단열재", "은박단열재", "온도리", "결로방지단열재", "단열필름", "외벽단열재", "보온시트"],
  "10609463678": ["캠핑단열재", "장박단열재", "캠핑바닥공사", "장박바닥공사", "텐트바닥공사"],
  "10683699346": ["캠핑단열재", "장박단열재", "캠핑바닥공사", "장박바닥공사", "텐트바닥공사"],
  "11356673932": ["은박매트", "은박돗자리", "두꺼운돗자리", "돗자리"],
  "11243899862": ["길고양이겨울집", "고양이겨울집", "고보협겨울집", "길냥이급식소"],
  "3402310018": ["에어컨커버", "실외기커버"],
  "10682944267": ["차박창문가리개", "뒷유리햇빛가리개", "조수석햇빛가리개", "운전석햇빛가리개", "자동차햇빛가리개", "차량용햇빛가리개"],
  "647994348": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "669533622": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "3394369231": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "7934125826": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "11502054249": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493768": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "90570004865": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493795": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493794": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493793": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493791": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493790": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493789": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493788": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493786": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493783": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493782": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493781": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493780": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493779": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493778": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493777": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493775": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493773": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493772": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493771": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493770": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493769": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493767": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493766": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "13025493765": ["단열벽지", "접착식단열벽지", "보온벽지", "결로방지벽지", "곰팡이벽지", "방한벽지"],
  "4654882496": ["바닥단열재", "바닥보온재", "난방필름단열재", "난방단열재"],
  "4705673971": ["전기난방필름", "난방필름", "전기판넬"],
  "82250194829": ["전기난방필름", "난방필름", "전기판넬"],
  "5812309858": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "5163448623": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "10828652365": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "5055159970": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "10839353059": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "5057319372": ["우레탄뿜칠", "타이거폼2K", "라이트폼", "스프레이폼", "단열뿜칠"],
  "10325763088": ["우레탄뿜칠", "타이거폼2K", "라이트폼", "스프레이폼", "단열뿜칠"],
  "10325744799": ["우레탄뿜칠", "타이거폼2K", "라이트폼", "스프레이폼", "단열뿜칠"],
  "692257896": ["우레탄폼건", "폼건", "스프레이폼"],
  "11235328592": ["우레탄폼건", "폼건", "스프레이폼"],
  "4132789099": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "81677310153": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "11188710454": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "682036041": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "2993746606": ["우레탄폼건", "폼건", "스프레이폼"],
  "670342159": ["우레탄뿜칠", "단열뿜칠", "스프레이폼"],
  "587600188": ["열선커터기", "스티로폼절단기"],
  "10957850942": ["열선커터기", "스티로폼절단기"],
  "88502356977": ["열선커터기", "스티로폼절단기"],
  "575543685": ["열선커터기", "스티로폼절단기"],
  "4609308307": ["창문열차단", "창문단열재", "단열뽁뽁이"],
  "4650594055": ["창문열차단", "창문단열재", "단열뽁뽁이"],
  "5012855593": ["창문햇빛가리개", "베란다햇빛가리개", "사무실햇빛가리개"],
  "11984357778": ["창문햇빛가리개", "베란다햇빛가리개", "사무실햇빛가리개"],
  "5009082205": ["에어컨가림막", "창문형에어컨가림막"],
  "12650826381": ["어싱매트", "어싱패드"],
  "13577623011": ["맨발걷기", "발매트"],
  "4563030455": ["실외기방수커버", "실외기커버"],
};

// ═══ 빠른 가격비교 수집 (백그라운드 fetch, 탭 없음) ═══
// 판다랭크 확장프로그램을 참고해서 구현: declarativeNetRequest로 sec-fetch-*/referer 헤더를
// "실제 페이지 이동"처럼 위장하면, 탭을 열지 않고 fetch()만으로 검색결과 HTML을 받을 수 있다.
// HTML 안에 이미 __NEXT_DATA__로 상품 데이터가 박혀있어(page-collector.js가 라이브 DOM에서 읽는
// 것과 같은 데이터) parser-core.js(RankParser, runner.html에서 같이 로드됨)를 그대로 재사용해서
// 파싱한다. 탭 렌더링을 안 기다려서 훨씬 빠르고, 광고/위젯 로딩 타이밍 문제 자체가 없다.
// 실패(캡차/차단/파싱 실패)하면 호출부에서 기존 탭 방식으로 안전하게 폴백한다.
const FAST_FETCH_RULE_ID = 90001;

// 판다랭크 확장프로그램(설치돼있는 실제 크롬 프로필에서 압축 해제해 코드 확인, 2026-08-06)이
// 첫 요청부터도 캡차 없이 통과하는 이유를 찾다가 발견 — 우리는 sec-fetch-*/referer만 위장했는데
// 판다랭크는 여기에 더해 navigator.userAgentData.getHighEntropyValues()로 "지금 이 브라우저의
// 진짜 User-Agent/Client Hints"를 그대로 읽어서 user-agent·sec-ch-ua* 헤더 전체를 채워 넣는다.
// 우리 쪽은 이 헤더들을 아예 안 보내서(Chrome 서비스워커/백그라운드 fetch의 기본값이 실제
// 문서 탐색과 다를 수 있음), "sec-fetch-mode:navigate인데 UA/클라이언트힌트가 없거나 다르다"는
// 모순이 탐지 신호였을 가능성이 크다. 판다랭크와 동일한 방식으로 재현한다.
async function buildBrowserHeaderHints() {
  const ua = navigator.userAgent;
  const uaData = navigator.userAgentData;
  const brands = uaData?.brands ?? [];
  let secChUa = brands.length
    ? brands.map((b) => `"${b.brand}";v="${b.version}"`).join(", ")
    : (() => {
        const m = ua.match(/Chrome\/(\d+)/);
        const v = m ? m[1] : "144";
        return `"Not(A:Brand";v="8", "Chromium";v="${v}", "Google Chrome";v="${v}"`;
      })();
  let arch = '"arm"', bitness = '"64"', formFactors = '"Desktop"', fullVersionList = secChUa,
    model = '""', platformVersion = '"12.5.0"', wow64 = "?0";
  if (uaData) {
    try {
      const h = await uaData.getHighEntropyValues([
        "architecture", "bitness", "formFactors", "fullVersionList", "model", "platformVersion", "wow64",
      ]);
      if (h.fullVersionList?.length) fullVersionList = h.fullVersionList.map((b) => `"${b.brand}";v="${b.version}"`).join(", ");
      if (h.architecture) arch = `"${h.architecture}"`;
      if (h.bitness) bitness = `"${h.bitness}"`;
      if (h.formFactors?.length) formFactors = h.formFactors.map((f) => `"${f}"`).join(", ");
      if (h.model !== undefined) model = `"${h.model}"`;
      if (h.platformVersion) platformVersion = `"${h.platformVersion}"`;
      wow64 = h.wow64 ? "?1" : "?0";
    } catch (_) {
      // 하이엔트로피 힌트 조회 실패해도 기본값으로 진행 — 그래도 sec-fetch-*는 정상 위장된다.
    }
  }
  let platform;
  if (ua.includes("Windows")) platform = '"Windows"';
  else if (ua.includes("Macintosh") || ua.includes("Mac OS X")) platform = '"macOS"';
  else if (ua.includes("Linux")) platform = '"Linux"';
  else platform = '"Unknown"';
  const mobile = uaData?.mobile ? "?1" : "?0";
  return {
    ua, secChUa, secChUaArch: arch, secChUaBitness: bitness, secChUaFormFactors: formFactors,
    secChUaFullVersionList: fullVersionList, secChUaModel: model, secChUaPlatformVersion: platformVersion,
    secChUaWow64: wow64, platform, mobile,
  };
}

async function withFastFetchHeaders(referer, fn) {
  const SET = chrome.declarativeNetRequest.HeaderOperation.SET;
  const REMOVE = chrome.declarativeNetRequest.HeaderOperation.REMOVE;
  const hints = await buildBrowserHeaderHints();
  const rule = {
    id: FAST_FETCH_RULE_ID,
    priority: 1,
    condition: {
      urlFilter: "https://search.shopping.naver.com/search/*",
      resourceTypes: [
        chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
        chrome.declarativeNetRequest.ResourceType.OTHER,
      ],
    },
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        { header: "accept", operation: SET, value: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7" },
        { header: "accept-language", operation: SET, value: "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7" },
        { header: "cache-control", operation: SET, value: "max-age=0" },
        { header: "priority", operation: SET, value: "u=0, i" },
        { header: "referer", operation: SET, value: referer },
        { header: "sec-ch-ua", operation: SET, value: hints.secChUa },
        { header: "sec-ch-ua-arch", operation: SET, value: hints.secChUaArch },
        { header: "sec-ch-ua-bitness", operation: SET, value: hints.secChUaBitness },
        { header: "sec-ch-ua-form-factors", operation: SET, value: hints.secChUaFormFactors },
        { header: "sec-ch-ua-full-version-list", operation: SET, value: hints.secChUaFullVersionList },
        { header: "sec-ch-ua-mobile", operation: SET, value: hints.mobile },
        { header: "sec-ch-ua-model", operation: SET, value: hints.secChUaModel },
        { header: "sec-ch-ua-platform", operation: SET, value: hints.platform },
        { header: "sec-ch-ua-platform-version", operation: SET, value: hints.secChUaPlatformVersion },
        { header: "sec-ch-ua-wow64", operation: SET, value: hints.secChUaWow64 },
        { header: "sec-fetch-dest", operation: SET, value: "document" },
        { header: "sec-fetch-mode", operation: SET, value: "navigate" },
        { header: "sec-fetch-site", operation: SET, value: "same-origin" },
        { header: "sec-fetch-user", operation: SET, value: "?1" },
        { header: "upgrade-insecure-requests", operation: SET, value: "1" },
        { header: "user-agent", operation: SET, value: hints.ua },
        // 아이템스카우트 확장프로그램 코드를 확인해서 발견 — 크롬이 fetch()에 자동으로 붙이는
        // sec-fetch-storage-access 헤더는 진짜 문서 탐색엔 안 붙는데, 이것도 제거해야 한다더라
        // (2026-08-07, 판다랭크에 이어 두 번째로 실제 경쟁사 확장프로그램 코드 확인).
        { header: "sec-fetch-storage-access", operation: REMOVE },
      ],
    },
  };
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [FAST_FETCH_RULE_ID], addRules: [rule] });
  try {
    return await fn();
  } finally {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [FAST_FETCH_RULE_ID] }).catch(() => {});
  }
}

function extractNextDataFromHtml(html) {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (_) { return null; }
}

function isBlockedHtml(html) {
  return /보안\s*확인을\s*완료|WtmCaptcha|접속이 일시적으로 제한|서비스 이용이 제한/.test(html || "");
}

async function fastFetchSearchPage(keyword, pageIndex) {
  const q = encodeURIComponent(keyword);
  // 기존 탭 방식(waitForTabComplete + extractPage)이 쓰는 것과 동일한 URL 파라미터로 맞춘다 —
  // adQuery/origQuery/productSet=total/sort=rel을 추가하면 카탈로그 통합형 등 다른 응답
  // 형태가 와서 __NEXT_DATA__의 상품 식별 필드 자체가 달라지는 것으로 보였다(2026-08-06 실측).
  // pagingSize는 반드시 40 — RankParser.resolveOrganicRank가 "한 페이지=40개"를 전제로 2페이지부터
  // 절대 순위를 (페이지번호-1)*40+순번으로 계산한다. 80으로 받으면 2페이지부터 순위가 틀어진다.
  const url = `https://search.shopping.naver.com/search/all?` +
    `query=${q}&pagingIndex=${pageIndex}&pagingSize=40&viewType=list`;
  const referer = `https://search.shopping.naver.com/ns/search?query=${q}`;
  return withFastFetchHeaders(referer, async () => {
    let res;
    try {
      res = await fetch(url, { credentials: "include", signal: AbortSignal.timeout(15000) });
    } catch (error) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} 네트워크 오류:`, error);
      return { blockedReason: `네트워크 오류: ${error?.message || "알 수 없는 오류"}` };
    }
    // 실패 사유를 전부 뭉뚱그려 "캡차"로 표시하면 실제 원인(진짜 캡차인지, 다른 차단/구조
    // 변경인지) 구분이 안 돼서, 콘솔에 실제 HTTP 상태와 판정 근거를 남긴다(서비스워커
    // 콘솔에서 chrome://extensions > 세부정보 > 서비스워커 검사로 확인 가능, 2026-08-06).
    if (res.status === 418 || res.status === 403) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} 상태코드 ${res.status} → 캡차 판정`);
      return { blockedReason: "네이버 쇼핑 접속이 제한되었습니다(캡차)." };
    }
    if (!res.ok) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} 응답 오류 ${res.status}`);
      return { blockedReason: `네이버 응답 오류 (${res.status})` };
    }
    const html = await res.text();
    if (isBlockedHtml(html)) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} 본문에서 캡차/차단 문구 감지`);
      return { blockedReason: "네이버 쇼핑 접속이 제한되었습니다(캡차)." };
    }
    const nextData = extractNextDataFromHtml(html);
    if (!nextData) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} __NEXT_DATA__ 없음, html 길이=${html.length}`);
      return { blockedReason: "상품 데이터를 찾지 못했습니다(페이지 구조 변경 가능성)." };
    }
    const parsed = RankParser.parseNextDataProducts(nextData, pageIndex);
    if (!parsed.products.length) {
      console.warn(`[FastFetch] ${keyword} p${pageIndex} 상품 파싱 결과 0개`);
      return { blockedReason: "상품 카드를 찾지 못했습니다." };
    }
    // 이 raw HTML의 __NEXT_DATA__ 스키마(props.pageProps.compositeList.list)엔 스토어 자체
    // 상품코드(chnl_prod_no)가 안 들어있고 네이버 통합ID(nvMid)만 있다(2026-08-06 실측 확인) —
    // 라이브 DOM/기존 tracked_items 코드는 전부 smartstore 상품코드 기준이라 이대로면 전혀 매칭이
    // 안 된다. 상품 링크(smartstore.naver.com/main/products/{코드})에서 진짜 코드를 뽑아낸다
    // (naver-rank 엣지펑션 fetchShopItems 등 이 코드베이스 다른 곳에서도 쓰는 방식과 동일).
    const products = parsed.products.map((p) => {
      if (p.productCode) return p;
      const linkId = (String(p.link || "").match(/\/products\/(\d+)/) || [])[1] || "";
      return linkId ? { ...p, productCode: linkId } : p;
    });
    return { products };
  });
}

// 여러 페이지를 이어서 받아 maxRank까지 모은다. 마지막 페이지 판단(일반상품 20개 미만)은 기존
// 탭 방식(runCollection)과 동일한 기준을 쓴다. 페이지 사이 대기(봇 탐지 완화용)는 판다랭크의
// 1~2초보다 짧게(0.4~0.8초) — 캡차 발생하면 다시 늘리는 걸 고려할 것. 중간 페이지에서
// 막히면(캡차 등) 그때까지 모은 페이지는 그대로 살려서 반환한다 — 1페이지부터 막혔을 때만
// 완전 실패로 처리한다.
async function fastFetchSearchPages(keyword, maxRank, onPage) {
  const pageSize = 40;
  const maxPages = Math.max(1, Math.ceil(maxRank / pageSize));
  const allProducts = [];
  for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
    onPage?.(pageIndex, maxPages);
    const result = await fastFetchSearchPage(keyword, pageIndex);
    if (result.blockedReason) {
      if (pageIndex === 1) return { blockedReason: result.blockedReason };
      break; // 이미 모은 페이지까지는 그대로 활용
    }
    allProducts.push(...result.products);
    const organicCount = result.products.filter((p) => !p.isAd).length;
    if (organicCount < 20) break; // 검색결과의 마지막 페이지로 판단
    if (pageIndex < maxPages) await sleep(1000 + Math.random() * 1000);
  }
  return { products: allProducts };
}

let activeRun = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const compact = (value) => String(value || "")
  .normalize("NFKC")
  .replace(/[^\p{L}\p{N}]/gu, "")
  .toLocaleLowerCase("ko-KR");
// 스토어 이름을 동일 상호명인지 비교할 땐 compact()를 쓰면 안 된다 — 공백을 통째로
// 지워서 "한국단열"(전혀 다른 업체)과 "한국 단열"(우리 스토어)이 같은 문자열이 돼버려,
// 그 업체 상품이 우리 상품으로 잘못 저장됐다(2026-08-10, product_code 310834449
// "은박 매트 3T"가 "단열뽁뽁이"/"은박단열재" 키워드에 우리 상품으로 잘못 들어간 사례로
// 확인). 상품명 매칭 등 compact()의 다른 용도는 그대로 두고, 스토어 이름 동일 여부만
// 공백 유무를 보존하는 이 함수로 비교한다.
const normalizeStoreLabel = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
const sbHeaders = (extra = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  ...extra,
});

function todayKst() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function kstDateDaysAgo(days) {
  const date = new Date(Date.now() - Math.max(0, Number(days) || 0) * 86400000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

async function updateProgress(patch) {
  if (!activeRun && patch.status === "running") return;
  const stored = await chrome.storage.local.get(PROGRESS_KEY);
  const state = { ...(stored[PROGRESS_KEY] || {}), ...patch };
  await chrome.storage.local.set({ [PROGRESS_KEY]: state });
  chrome.runtime.sendMessage({ type: "PROGRESS", state }).catch(() => {});
  const title = document.getElementById("runnerTitle");
  const message = document.getElementById("runnerMessage");
  const count = document.getElementById("runnerCount");
  const bar = document.getElementById("runnerBar");
  const stop = document.getElementById("runnerStop");
  const note = document.querySelector(".note");
  if (title) title.textContent = state.title || "순위 수집";
  if (message) message.textContent = state.error || state.message || "";
  if (count) count.textContent = `${state.completed || 0}/${state.total || 0}`;
  if (bar) bar.style.width = `${state.total ? Math.min(100, (state.completed || 0) / state.total * 100) : 0}%`;
  if (stop) stop.hidden = state.status !== "running";
  if (note) {
    note.textContent = state.status === "running"
      ? "수집이 끝날 때까지 이 탭을 닫지 마세요. 실제 검색은 별도의 네이버 쇼핑 탭에서 진행됩니다."
      : "수집 작업이 종료되었습니다. 이 탭은 닫아도 됩니다.";
  }
}

async function waitForTabComplete(tabId, timeoutMs = 30000) {
  const current = await chrome.tabs.get(tabId);
  if (current.status === "complete") return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("네이버 쇼핑 페이지 로딩 시간이 초과되었습니다."));
    }, timeoutMs);
    function listener(updatedId, info) {
      if (updatedId !== tabId || info.status !== "complete") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function extractPage(tabId, pageIndex, storeName) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PAGE", pageIndex, storeName });
    } catch (error) {
      lastError = error;
      await sleep(700);
    }
  }
  throw new Error(`페이지 수집 스크립트 연결 실패: ${lastError?.message || "알 수 없는 오류"}`);
}

async function showCollectionStatus(tabId, state) {
  if (!tabId) return;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "SHOW_COLLECTION_STATUS", state });
      return;
    } catch (_) {
      await sleep(350);
    }
  }
}

function productKey(product) {
  const identity = String(product.productCode || product.naverProductId || "").trim();
  if (!identity) return "";
  return `${product.isAd ? "ad" : "prod"}:${identity}`;
}

function matchesStore(product, storeName, knownChannelNos, knownProviderIds, knownProductCodes = new Set()) {
  if (product.isAd) return false;
  if (product.storeMatched) return true;
  if (product.mallName && normalizeStoreLabel(product.mallName) === normalizeStoreLabel(storeName)) return true;
  if (product.channelNo && knownChannelNos.has(product.channelNo)) return true;
  if (product.providerId && knownProviderIds.has(product.providerId)) return true;
  const hasCurrentStoreIdentity = !!(product.mallName || product.channelNo || product.providerId);
  if (!hasCurrentStoreIdentity && product.productCode && knownProductCodes.has(String(product.productCode))) return true;
  return false;
}

async function fetchJson(path) {
  const response = await fetch(`${SUPABASE_URL}${path}`, { headers: sbHeaders() });
  if (!response.ok) throw new Error(`저장 데이터 조회 실패: ${await response.text()}`);
  return response.json();
}

// PostgREST는 서버 설정(db-max-rows)이 limit 파라미터보다 항상 우선한다 — 이 프로젝트는
// limit=10000을 요청해도 응답이 최신 1000행으로 조용히 잘린다(2026-08-12 실측). keyword_rank_history/
// shopping_search_snapshots는 스토어 하나만 해도 수만 행이 넘어가 항상 이 캡에 걸렸고, 정렬 기준이
// 최신순(collected_date desc)이라 오래된 상품부터 매칭 대상에서 빠지며 잘못된 이탈/누락으로
// 이어졌다. offset을 밀어가며 전부 받아오되, 순차로 하면 스토어당 15~20번 왕복이라 수집 시작
// 전 "준비 중" 단계가 10초 넘게 걸려 멈춘 것처럼 보였다(2026-08-12). 처음엔 남은 페이지를
// 전부 한꺼번에 병렬로 쐈더니(제한 없는 Promise.all) 연결이 너무 많아져 fetch() 자체가
// "Failed to fetch"로 던지는 네트워크 예외가 났다 — 이 예외는 HTTP 상태코드가 아니라 재시도
// 로직이 못 잡고 있었다. concurrency만큼만 묶어서 순차 배치로 병렬 처리하고, fetch() 자체의
// 예외도 재시도 대상에 포함시킨다.
async function fetchJsonPaged(path, { pageSize = 1000, maxRows = 100000, concurrency = 8 } = {}) {
  const sep = path.includes("?") ? "&" : "?";
  async function fetchPage(offset, includeCount) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${SUPABASE_URL}${path}${sep}offset=${offset}&limit=${pageSize}`, {
          headers: sbHeaders(includeCount ? { Prefer: "count=exact" } : {}),
        });
        if (response.ok) return response;
        lastError = new Error(`저장 데이터 조회 실패: ${await response.text()}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt < 2) await sleep(350 * (attempt + 1));
    }
    throw lastError;
  }

  const first = await fetchPage(0, true);
  const firstPage = await first.json();
  const total = Number((first.headers.get("content-range") || "").split("/")[1]) || firstPage.length;
  const totalPages = Math.min(Math.ceil(maxRows / pageSize), Math.ceil(total / pageSize));
  const rows = firstPage.slice();
  if (totalPages > 1 && firstPage.length === pageSize) {
    const offsets = Array.from({ length: totalPages - 1 }, (_, i) => (i + 1) * pageSize);
    for (let i = 0; i < offsets.length; i += concurrency) {
      const batch = offsets.slice(i, i + concurrency);
      const responses = await Promise.all(batch.map((offset) => fetchPage(offset)));
      const pages = await Promise.all(responses.map((response) => response.json()));
      pages.forEach((page) => rows.push(...page));
    }
  }
  return rows;
}

async function fetchCollectionContext(config) {
  const encodedStore = encodeURIComponent(config.storeName);
  const [historyRows, trackedItems, snapshotIdRows, productMasters] = await Promise.all([
    fetchJsonPaged(`/rest/v1/keyword_rank_history?store_name=eq.${encodedStore}&product_code=neq.&select=id,keyword,product_code,product_name,product_image,product_link,product_price,collected_date,checked_at&order=collected_date.desc,checked_at.desc,id.desc`),
    fetchJson("/rest/v1/tracked_items?select=product_code,product_name,product_image,product_link,mall_name,keywords&limit=5000"),
    // 가격비교(카탈로그)형으로 렌더링된 카드는 chnl_prod_no(product_code)가 안 잡히고
    // naver_product_id만 잡힐 때가 있다 — 예전에 이 카드의 product_code가 잡혔던 적이 있으면
    // naver_product_id로 역추적해서 같은 상품으로 이어붙이기 위한 매핑. 정렬 기준이 최신순이라
    // "첫 등장 = 최신"으로 맵을 채우는 폴백용 데이터인데, 스토어에 따라 5~6만 행까지 나와서
    // (2026-08-12 실측, 한국 단열 59,663행 = 60페이지) 전부 받으면 수집 준비 단계가 심하게
    // 느려진다 — 최신 10,000행(약 10일 안팎)이면 폴백 매칭에 충분하다고 보고 상한을 둔다.
    fetchJsonPaged(`/rest/v1/shopping_search_snapshots?store_name=eq.${encodedStore}&product_code=neq.&naver_product_id=neq.&select=id,product_code,naver_product_id,collected_date&order=collected_date.desc,id.desc`, { maxRows: 10000 }),
    // naver_product_id(가격비교 ID)는 상품마다 계속 바뀔 수 있어서 naverIdToCode 매핑조차
    // 못 찾는 경우가 있다 — 그럴 땐 상품명으로 마스터/이력과 매칭해서 진짜 코드를 역추적한다.
    fetchJson(`/rest/v1/product_rankings?select=code,name&code=neq.&name=neq.&limit=5000`).catch(() => []),
  ]);
  const knownProducts = new Map();
  const keywordProducts = new Map();
  const latestDateByKeyword = new Map();
  const codeByName = new Map();
  historyRows.forEach((row) => {
    const code = String(row.product_code || "").trim();
    if (!code) return;
    if (!knownProducts.has(code)) knownProducts.set(code, row);
    if (!latestDateByKeyword.has(row.keyword)) latestDateByKeyword.set(row.keyword, row.collected_date);
    const nameKey = compact(row.product_name);
    if (nameKey && !codeByName.has(nameKey)) codeByName.set(nameKey, code);
    if (row.collected_date !== latestDateByKeyword.get(row.keyword)) return;
    if (!keywordProducts.has(row.keyword)) keywordProducts.set(row.keyword, new Map());
    if (!keywordProducts.get(row.keyword).has(code)) keywordProducts.get(row.keyword).set(code, row);
  });
  trackedItems.forEach((row) => {
    const code = String(row.product_code || "").trim();
    const nameKey = compact(row.product_name);
    if (code && nameKey && !codeByName.has(nameKey)) codeByName.set(nameKey, code);
  });
  // product_rankings(상품 마스터)가 가장 정확한 출처라 이력/추적목록보다 우선한다.
  productMasters.forEach((row) => {
    const code = String(row.code || "").trim();
    const nameKey = compact(row.name);
    if (code && nameKey) codeByName.set(nameKey, code);
  });
  const naverIdToCode = new Map();
  snapshotIdRows.forEach((row) => {
    const naverId = String(row.naver_product_id || "").trim();
    const code = String(row.product_code || "").trim();
    if (!naverId || !code) return;
    if (!naverIdToCode.has(naverId)) naverIdToCode.set(naverId, code);
  });
  return {
    knownProducts,
    keywordProducts,
    naverIdToCode,
    codeByName,
    trackedItems: trackedItems.map((item) => ({
      ...item,
      product_code: String(item.product_code || "").trim(),
      keywords: Array.isArray(item.keywords) ? item.keywords.map(String) : [],
    })),
  };
}

async function postRows(table, rows, onConflict, chunkSize = 100) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const suffix = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}${suffix}`, {
      method: "POST",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal",
      }),
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`${table} 저장 실패: ${await response.text()}`);
  }
}

function parseProductCode(value) {
  const text = String(value || "").trim();
  return text.match(/\/products\/(\d+)/)?.[1] || (/^\d+$/.test(text) ? text : "");
}

function parseCodeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  try {
    return (JSON.parse(value || "[]") || []).map(String).map((item) => item.trim()).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function runSingleProductLookup(config) {
  const runId = crypto.randomUUID();
  const productCode = String(config.targetProductCode || parseProductCode(config.targetProductUrl)).trim();
  if (!productCode) throw new Error("상품 URL에서 상품번호를 확인할 수 없습니다.");

  activeRun = { id: runId, cancelled: false, tabId: null };
  await updateProgress({
    status: "running", title: "단건 순위 확인", completed: 0, total: 1, saved: 0,
    runId, mode: "singleProduct", message: "아이템 추적에 등록된 상품 정보를 불러오고 있습니다.", error: "",
  });

  let finishedSuccessfully = false;
  try {
    const rows = await fetchJson(
      `/rest/v1/tracked_items?product_code=eq.${encodeURIComponent(productCode)}` +
      "&select=*&limit=1"
    );
    const item = rows[0];
    if (!item) throw new Error(`아이템 추적에서 상품번호 ${productCode}을 찾지 못했습니다.`);
    const keywords = Array.isArray(item.keywords) ? item.keywords.map(String).filter(Boolean) : [];
    const keyword = String(config.targetKeyword || keywords[0] || "").trim();
    if (!keyword) throw new Error("이 상품에 등록된 추적 키워드가 없습니다.");

    const matchingCodes = new Set([productCode, ...parseCodeList(item.alt_codes)]);
    const searchUrl = "https://search.shopping.naver.com/search/all?" + new URLSearchParams({
      query: keyword, pagingIndex: "1", pagingSize: "40", viewType: "list",
    });
    const tab = await chrome.tabs.create({ active: true, url: searchUrl });
    activeRun.tabId = tab.id;
    await updateProgress({ message: `“${keyword}” 1페이지에서 ${item.product_name || productCode} 상품을 찾고 있습니다.` });
    await waitForTabComplete(tab.id);
    await showCollectionStatus(tab.id, {
      status: "running", keyword, message: "상품 URL의 상품번호를 1페이지 검색결과와 대조하고 있습니다.",
      pageIndex: 1, pageCount: 1, completed: 0, total: 1,
    });
    await sleep(Math.max(1500, Number(config.pageDelay) || 1500));
    const extracted = await extractPage(tab.id, 1, item.mall_name || "");
    if (extracted.blockedReason) throw new Error(extracted.blockedReason);
    const products = normalizePageProducts(extracted.products, 1);
    validatePage(products, 1);
    const found = products.find((product) => (
      !product.isAd && matchingCodes.has(String(product.productCode || ""))
    ));
    const now = new Date().toISOString();
    const collectedDate = todayKst();

    await postRows("tracked_item_history", [{
      product_code: productCode,
      keyword,
      rank: found?.rank ?? null,
      price: Number(found?.price) || 0,
      mall_name: found?.mallName || item.mall_name || "",
      collected_date: collectedDate,
      checked_at: now,
    }], "product_code,keyword,collected_date");

    if (found) {
      const metadata = {
        product_name: found.title || item.product_name || "",
        product_image: found.image || item.product_image || "",
        product_link: found.link || item.product_link || "",
        mall_name: found.mallName || item.mall_name || "",
        updated_at: now,
      };
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/tracked_items?product_code=eq.${encodeURIComponent(productCode)}`,
        {
          method: "PATCH",
          headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }),
          body: JSON.stringify(metadata),
        }
      );
      if (!response.ok) throw new Error(`추적 상품 정보 갱신 실패: ${await response.text()}`);
    }

    const sourceLabel = String(extracted.extractionSource || "dom").includes("next-data") ? "NEXT_DATA" : "DOM";
    const message = found
      ? `${item.mall_name || "추적 상품"} · ${keyword} 일반검색 ${found.rank}위 · 광고 제외 · ${sourceLabel}`
      : `${item.mall_name || "추적 상품"} · ${keyword} 1페이지 미노출 · 광고 제외 · ${sourceLabel}`;
    await showCollectionStatus(tab.id, {
      status: "done", keyword, message, source: sourceLabel,
      pageIndex: 1, pageCount: 1, completed: 1, total: 1,
    });
    await updateProgress({
      status: "done", title: found ? `${found.rank}위 확인` : "1페이지 미노출",
      completed: 1, total: 1, saved: 1, runId, mode: "singleProduct", message,
    });
    finishedSuccessfully = true;
  } catch (error) {
    await updateProgress({
      status: "error", title: "단건 조회 실패", completed: 0, total: 1,
      runId, mode: "singleProduct", message: error?.message || "순위 확인 중 오류가 발생했습니다.",
      error: error?.message || "순위 확인 중 오류가 발생했습니다.", saved: 0,
    });
  } finally {
    if (finishedSuccessfully && activeRun?.tabId) chrome.tabs.remove(activeRun.tabId).catch(() => {});
    activeRun = null;
  }
}

// 아이템 추적 일괄 수집 — 예전엔 Supabase Edge Function(naver-rank)을 직접 호출했는데, 그 함수가
// 쓰는 네이버쇼핑 상품검색 API 자체가 막혀서(크롤링도 IP 차단) 계속 실패하고 있었다. 단건 조회
// (runSingleProductLookup)는 이미 확장프로그램의 실제 브라우저 검색 스크래핑으로 잘 동작하는 걸
// 확인했으니, 그 방식을 키워드별로 묶어서 등록된 추적 상품 전체에 한 번에 적용한다.
async function runTrackedItemsBatchLookup(config) {
  const runId = crypto.randomUUID();
  activeRun = { id: runId, cancelled: false, tabId: null };

  const items = await fetchJson("/rest/v1/tracked_items?select=*&limit=2000");
  if (!items.length) throw new Error("아이템 추적에 등록된 상품이 없습니다.");
  // 그룹상품은 "대표 옵션" 코드가 며칠 사이 다른 코드로 로테이션될 수 있다 — 코드로만 매칭하면
  // 실제로 1페이지에 떠 있는데도 처음 보는 코드라 "이탈"로 잘못 기록된다(에너가드컴퍼니 8/3 이후
  // 준불연단열재 등에서 실제로 이 사고가 났음, saveSearchSnapshot에서 이미 겪은 문제와 동일).
  // 코드가 안 걸리면 상품명으로 한 번 더 대조한다.
  const productMasters = await fetchJson(
    `/rest/v1/product_rankings?select=code,name&code=neq.&name=neq.&limit=5000`
  ).catch(() => []);

  const itemByCode = new Map();
  const codeToCanonical = new Map();
  const codeByName = new Map();
  const keywordMap = new Map(); // keyword -> Set(canonical product_code)
  items.forEach((item) => {
    itemByCode.set(item.product_code, item);
    codeToCanonical.set(item.product_code, item.product_code);
    parseCodeList(item.alt_codes).forEach((alt) => codeToCanonical.set(alt, item.product_code));
    const nameKey = compact(item.product_name);
    if (nameKey && !codeByName.has(nameKey)) codeByName.set(nameKey, item.product_code);
    const keywords = Array.isArray(item.keywords) ? item.keywords : [];
    keywords.map(String).map((k) => k.trim()).filter(Boolean).forEach((keyword) => {
      if (!keywordMap.has(keyword)) keywordMap.set(keyword, new Set());
      keywordMap.get(keyword).add(item.product_code);
    });
  });
  // product_rankings(상품 마스터)가 tracked_items 이름보다 더 정확한 출처라 나중에 덮어써서 우선한다.
  productMasters.forEach((row) => {
    const code = String(row.code || "").trim();
    const nameKey = compact(row.name);
    if (code && nameKey && itemByCode.has(code)) codeByName.set(nameKey, code);
  });
  if (!keywordMap.size) throw new Error("추적 상품에 등록된 키워드가 없습니다.");

  const total = keywordMap.size;
  await updateProgress({
    status: "running", title: "아이템 추적 수집", completed: 0, total, saved: 0,
    runId, mode: "trackedItems", message: "준비하고 있습니다.", error: "",
  });

  // 탭은 필요할 때(빠른 경로가 막혔을 때만) 그때 연다 — 빠른 경로가 계속 통하면 탭을 아예 안 연다.
  let tab = null;
  async function ensureTab() {
    if (!tab) {
      tab = await chrome.tabs.create({ active: true, url: "about:blank" });
      activeRun.tabId = tab.id;
    }
    return tab;
  }
  let completed = 0;
  let saved = 0;
  let finishedSuccessfully = false;
  let fastFetchDisabled = false; // 캡차 한 번 걸리면 이후 키워드도 계속 막힐 가능성이 높아 탭 방식으로 전환
  // 1000위(25페이지)는 키워드당 페이지 사이 대기(1~2초)가 누적되면서 너무 오래 걸렸다
  // (2026-08-06 실측 확인) — 판다랭크도 200위까지만 제공하는 걸로 보여 기존 관례(200위=5페이지)로
  // 되돌린다.
  const trackedMaxRank = Math.min(1000, Math.max(40, Number(config.maxRank) || 200));

  try {
    for (const [keyword, codes] of keywordMap) {
      if (!activeRun || activeRun.id !== runId || activeRun.cancelled) throw new Error("사용자가 수집을 중단했습니다.");
      completed += 1;
      await updateProgress({ completed, message: `“${keyword}” 검색 중입니다. (${completed}/${total})` });

      let products = null;
      let usedFastPath = false;
      if (!fastFetchDisabled) {
        try {
          const fast = await fastFetchSearchPages(keyword, trackedMaxRank, (pageIndex, pageCount) => {
            updateProgress({ message: `“${keyword}” 검색 중입니다. (${completed}/${total}) · ${pageIndex}/${pageCount}페이지` });
          });
          if (fast.products?.length) {
            const candidate = normalizePageProducts(fast.products, 1);
            validatePage(candidate, 1);
            products = candidate;
            usedFastPath = true;
          } else if (fast.blockedReason && /캡차/.test(fast.blockedReason)) {
            fastFetchDisabled = true;
          }
        } catch (_) {
          // 빠른 경로 파싱/검증 실패 — 아래에서 탭 방식으로 폴백
        }
        // 키워드 사이에 전혀 쉬지 않고 fast 요청을 연달아 쏘고 있었다 — 판다랭크의 요청 간격
        // (1~2초)에 맞춰 다음 키워드로 넘어가기 전에 쉰다(2026-08-06, 배치 수집 캡차 빈발 조사).
        // 페이지 사이 대기(캡차 방지 핵심)는 그대로 두고, 키워드 전환 대기만 좀 더 짧게 잡아서
        // 속도를 살린다 — 82개 키워드 실측으로 캡차 없이 잘 끝난 뒤 "느려서 불편하다"는
        // 피드백으로 조정(2026-08-07).
        if (usedFastPath) await sleep(600 + Math.random() * 400);
      }

      if (!products) {
        await ensureTab();
        const url = "https://search.shopping.naver.com/search/all?" + new URLSearchParams({
          query: keyword, pagingIndex: "1", pagingSize: "40", viewType: "list",
        });
        await chrome.tabs.update(tab.id, { url });
        await waitForTabComplete(tab.id);
        await showCollectionStatus(tab.id, {
          status: "running", keyword, message: "검색결과에서 추적 상품을 찾고 있습니다.",
          pageIndex: 1, pageCount: 1, completed, total,
        });
        await sleep(Math.max(1500, Number(config.pageDelay) || 1500));

        try {
          const extracted = await extractPage(tab.id, 1, "");
          if (extracted.blockedReason) throw new Error(extracted.blockedReason);
          products = normalizePageProducts(extracted.products, 1);
          validatePage(products, 1);
        } catch (error) {
          // 이 키워드 하나가 실패해도(차단/파싱 오류 등) 나머지 키워드는 계속 진행한다.
          await showCollectionStatus(tab.id, {
            status: "running", keyword, message: `실패: ${error?.message || "알 수 없는 오류"} — 다음 키워드로 넘어갑니다.`,
            pageIndex: 1, pageCount: 1, completed, total,
          });
          continue;
        }
      }

      const foundByCanon = new Map();
      const rotatedCodesByCanon = new Map(); // canon -> Set(코드 매칭 실패해서 상품명으로 찾아낸 새 코드)
      products.forEach((product) => {
        if (product.isAd) return;
        const rawCode = String(product.productCode || "").trim();
        let canon = rawCode ? codeToCanonical.get(rawCode) : undefined;
        if (!canon) {
          // 코드로 못 찾으면 상품명으로 한 번 더 대조한다 — 그룹상품 대표옵션 코드가
          // 로테이션돼서 처음 보는 코드인 경우, 실제로는 1페이지에 있는데 "이탈"로
          // 잘못 기록되는 걸 막는다.
          const nameMatch = codeByName.get(compact(product.title));
          if (nameMatch) {
            canon = nameMatch;
            if (rawCode) {
              if (!rotatedCodesByCanon.has(canon)) rotatedCodesByCanon.set(canon, new Set());
              rotatedCodesByCanon.get(canon).add(rawCode);
            }
          }
        }
        if (canon && !foundByCanon.has(canon)) foundByCanon.set(canon, product);
      });

      const now = new Date().toISOString();
      const collectedDate = todayKst();
      const rows = [...codes].map((code) => {
        const found = foundByCanon.get(code);
        return {
          product_code: code, keyword,
          rank: found?.rank ?? null,
          price: Number(found?.price) || 0,
          mall_name: found?.mallName || itemByCode.get(code)?.mall_name || "",
          collected_date: collectedDate, checked_at: now,
        };
      });
      if (rows.length) {
        await postRows("tracked_item_history", rows, "product_code,keyword,collected_date");
        saved += rows.length;
      }

      // 검색 결과에서 상품명/이미지/판매처 메타 자동 갱신 — alt_codes로 걸렸어도 기준 코드 행을 갱신
      for (const [canon, found] of foundByCanon) {
        const item = itemByCode.get(canon);
        if (!item) continue;
        const patch = {};
        if (found.title && found.title !== item.product_name) patch.product_name = found.title;
        if (found.image && found.image !== item.product_image) patch.product_image = found.image;
        if (found.mallName && found.mallName !== item.mall_name) patch.mall_name = found.mallName;
        if (found.link && !item.product_link) patch.product_link = found.link;
        const rotatedCodes = rotatedCodesByCanon.get(canon);
        if (rotatedCodes && rotatedCodes.size) {
          // 상품명으로 새로 찾아낸 로테이션 코드를 alt_codes에 등록 — 다음 수집부터는
          // 코드만으로 바로 매칭돼서 매번 이름 대조에 의존하지 않게 된다.
          const existingAlt = new Set(parseCodeList(item.alt_codes));
          let altChanged = false;
          rotatedCodes.forEach((code) => {
            if (!existingAlt.has(code)) { existingAlt.add(code); altChanged = true; }
          });
          if (altChanged) patch.alt_codes = [...existingAlt];
        }
        if (Object.keys(patch).length) {
          patch.updated_at = now;
          const response = await fetch(
            `${SUPABASE_URL}/rest/v1/tracked_items?product_code=eq.${encodeURIComponent(canon)}`,
            { method: "PATCH", headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=minimal" }), body: JSON.stringify(patch) }
          );
          if (response.ok) Object.assign(item, patch);
        }
      }

      const sourceLabel = usedFastPath
        ? "FAST"
        : (String(products[0]?.extractionSource || "dom").includes("next-data") ? "NEXT_DATA" : "DOM");
      if (tab) {
        await showCollectionStatus(tab.id, {
          status: "running", keyword,
          message: `${keyword} · 추적 상품 ${foundByCanon.size}/${codes.size}개 확인 · ${sourceLabel}`,
          source: sourceLabel, pageIndex: 1, pageCount: 1, completed, total,
        });
      }
      await updateProgress({ saved, message: `${keyword} · ${sourceLabel} · 추적 상품 ${foundByCanon.size}/${codes.size}개 확인` });
    }

    await updateProgress({
      status: "done", title: "수집 완료", completed: total, total, saved,
      runId, mode: "trackedItems", message: `${total}개 키워드 · ${saved}개 순위를 저장했습니다.`,
    });
    finishedSuccessfully = true;
  } catch (error) {
    const cancelled = /중단/.test(error?.message || "");
    await updateProgress({
      status: cancelled ? "cancelled" : "error",
      title: cancelled ? "수집 중단" : "수집 실패",
      runId, mode: "trackedItems",
      message: error?.message || "수집 중 오류가 발생했습니다.",
      error: cancelled ? "" : (error?.message || "수집 중 오류가 발생했습니다."),
      saved,
    });
  } finally {
    if (finishedSuccessfully && activeRun?.tabId) chrome.tabs.remove(activeRun.tabId).catch(() => {});
    activeRun = null;
  }
}

// ═══ N+스토어(search.shopping.naver.com/ns/search) 순위 수집 ═══
// 가격비교와 개념이 다른 별도 랭킹(프로모션/멤버십 맥락이 섞인 결과셋)이라, 저장은 같은
// keyword_rank_history 테이블에 source="nplus_store"로 분리해서 넣는다 — curated(가격비교)/
// naver_diagnosis(관리자 진단)와 절대 안 섞이게 정리 쿼리도 source로 좁힌다.
async function extractNplusPage(tabId, targetRank, storeName) {
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_NPLUS_PAGE", targetRank, storeName });
    } catch (error) {
      lastError = error;
      await sleep(700);
    }
  }
  throw new Error(`N+스토어 수집 스크립트 연결 실패: ${lastError?.message || "알 수 없는 오류"}`);
}

async function saveNplusSnapshot(config, keywordMeta, products) {
  const collectedDate = todayKst();
  const now = new Date().toISOString();
  const matched = products.filter(
    (p) => !p.isAd && p.mallName && normalizeStoreLabel(p.mallName) === normalizeStoreLabel(config.storeName)
  );

  const byCode = new Map();
  matched.forEach((p) => {
    const code = String(p.productCode || p.naverProductId || "").trim();
    if (!code || byCode.has(code)) return;
    byCode.set(code, p);
  });

  const rows = [...byCode.values()].map((p) => ({
    store_name: config.storeName,
    keyword: keywordMeta.keyword,
    main_keyword: keywordMeta.mainKeyword,
    is_sub: keywordMeta.isSub,
    rank: p.rank,
    max_rank: config.targetRank || 200,
    checked_at: now,
    product_code: String(p.productCode || p.naverProductId || ""),
    product_name: p.title || "",
    product_image: p.image || "",
    product_link: p.link || "",
    product_price: Number(p.price) || 0,
    collected_date: collectedDate,
    source: "nplus_store",
  }));
  if (!rows.length) {
    rows.push({
      store_name: config.storeName, keyword: keywordMeta.keyword,
      main_keyword: keywordMeta.mainKeyword, is_sub: keywordMeta.isSub,
      rank: null, max_rank: config.targetRank || 200, checked_at: now,
      product_code: "", product_name: "", product_image: "", product_link: "",
      product_price: 0, collected_date: collectedDate, source: "nplus_store",
    });
  }
  await postRows("keyword_rank_history", rows, "store_name,keyword,product_code,collected_date,source");

  const cleanupUrl = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&source=eq.nplus_store` +
    `&checked_at=neq.${encodeURIComponent(now)}`;
  const cleanup = await fetch(cleanupUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanup.ok) throw new Error(`이전 N+스토어 순위 정리 실패: ${await cleanup.text()}`);

  return { targetCount: rows.filter((row) => row.product_code).length };
}

async function runNplusStoreCollection(config) {
  const runId = crypto.randomUUID();
  const total = config.keywords.length;
  activeRun = { id: runId, cancelled: false, tabId: null };
  await updateProgress({
    status: "running", title: "N+스토어 순위 수집", completed: 0, total, saved: 0,
    runId, mode: "nplusStore", message: "네이버플러스스토어 검색결과를 수집할 준비를 하고 있습니다.", error: "",
  });

  let saved = 0;
  let completed = 0;
  let finishedSuccessfully = false;
  const failedKeywords = [];
  const targetRank = config.targetRank || 200;
  try {
    const tab = await chrome.tabs.create({ active: true, url: "about:blank" });
    activeRun.tabId = tab.id;

    for (const keywordMeta of config.keywords) {
      if (!activeRun || activeRun.id !== runId || activeRun.cancelled) throw new Error("사용자가 수집을 중단했습니다.");
      const url = "https://search.shopping.naver.com/ns/search?" + new URLSearchParams({
        query: keywordMeta.keyword, prevQuery: keywordMeta.keyword, sort: "RECOMMEND",
      });
      await updateProgress({ completed, message: `“${keywordMeta.keyword}” 검색 중입니다. (${completed + 1}/${total})` });
      await chrome.tabs.update(tab.id, { url });
      await waitForTabComplete(tab.id);
      await showCollectionStatus(tab.id, {
        status: "running", keyword: keywordMeta.keyword,
        message: "스크롤하며 N+스토어 검색결과를 수집하고 있습니다.",
        pageIndex: 1, pageCount: 1, completed: completed + 1, total,
      });

      let products = [];
      try {
        const extracted = await extractNplusPage(tab.id, targetRank, config.storeName);
        if (extracted.blockedReason) throw new Error(extracted.blockedReason);
        products = extracted.products || [];
        const organic = products.filter((p) => !p.isAd);
        if (organic.length < Math.min(15, targetRank)) {
          throw new Error(`일반상품이 ${organic.length}개만 확인되어 저장하지 않았습니다.`);
        }
      } catch (error) {
        const reason = error?.message || "알 수 없는 오류";
        failedKeywords.push({ keyword: keywordMeta.keyword, reason });
        await showCollectionStatus(tab.id, {
          status: "running", keyword: keywordMeta.keyword,
          message: `실패: ${reason} — 다음 키워드로 넘어갑니다.`,
          pageIndex: 1, pageCount: 1, completed: completed + 1, total,
        });
        completed += 1;
        await updateProgress({ completed, message: `${keywordMeta.keyword} 실패: ${reason}` });
        continue;
      }

      const result = await saveNplusSnapshot(config, keywordMeta, products);
      saved += result.targetCount;
      completed += 1;
      await showCollectionStatus(tab.id, {
        status: "running", keyword: keywordMeta.keyword,
        message: `${keywordMeta.keyword} · 일반상품 ${products.filter((p) => !p.isAd).length}개 확인 · 자사 매칭 ${result.targetCount}개`,
        pageIndex: 1, pageCount: 1, completed, total,
      });
      await updateProgress({ completed, saved });
    }

    const allFailed = failedKeywords.length > 0 && failedKeywords.length === total;
    const failureNote = failedKeywords.length
      ? ` · 실패 ${failedKeywords.length}개(${failedKeywords.map((f) => `${f.keyword}: ${f.reason}`).join(" / ")})`
      : "";
    await updateProgress({
      status: allFailed ? "error" : "done",
      title: allFailed ? "수집 실패" : "수집 완료",
      completed: total, total, saved,
      runId, mode: "nplusStore",
      message: `${total}개 키워드의 N+스토어 검색결과에서 ${saved}개 순위를 저장했습니다.${failureNote}`,
      error: allFailed ? failedKeywords.map((f) => `${f.keyword}: ${f.reason}`).join(" / ") : "",
    });
    // 전부 실패(캡차 등)했으면 수집 탭을 자동으로 닫지 않는다 — 사용자가 그 탭에서 직접
    // 인증하거나 상태를 확인할 수 있어야 한다.
    finishedSuccessfully = !allFailed;
    if (!allFailed) {
      const reportParams = new URLSearchParams({
        storeName: config.storeName,
        date: todayKst(),
        keywords: config.keywords.map((k) => k.keyword).join(","),
      });
      chrome.tabs.create({
        active: true,
        url: chrome.runtime.getURL(`nplus-report.html?${reportParams.toString()}`),
      }).catch(() => {});
    }
  } catch (error) {
    const cancelled = /중단/.test(error?.message || "");
    await updateProgress({
      status: cancelled ? "cancelled" : "error",
      title: cancelled ? "수집 중단" : "수집 실패",
      runId, mode: "nplusStore",
      message: error?.message || "수집 중 오류가 발생했습니다.",
      error: cancelled ? "" : (error?.message || "수집 중 오류가 발생했습니다."),
      saved,
    });
  } finally {
    if (finishedSuccessfully && activeRun?.tabId) chrome.tabs.remove(activeRun.tabId).catch(() => {});
    activeRun = null;
  }
}

async function cleanupOldSnapshots(retentionDays = 8) {
  const cutoff = kstDateDaysAgo(retentionDays);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/shopping_search_snapshots?collected_date=lt.${encodeURIComponent(cutoff)}`,
    { method: "DELETE", headers: sbHeaders() }
  );
  if (!response.ok) throw new Error(`오래된 검색 스냅샷 정리 실패: ${await response.text()}`);
}

function normalizePageProducts(products, pageIndex) {
  const unique = new Map();
  (products || []).forEach((product) => {
    const key = productKey(product);
    if (!key || unique.has(key)) return;
    unique.set(key, { ...product });
  });
  let organicIndex = 0;
  return [...unique.values()].map((product, index) => {
    if (!product.isAd) organicIndex += 1;
    const extractedRank = Number(product.rank);
    return {
      ...product,
      pageIndex,
      pagePosition: Number(product.pagePosition) || index + 1,
      rank: product.isAd
        ? null
        : (Number.isFinite(extractedRank) && extractedRank > 0
          ? extractedRank
          : (pageIndex - 1) * 40 + organicIndex),
    };
  });
}

function validatePage(products, pageIndex) {
  const organic = products.filter((product) => !product.isAd);
  if (pageIndex === 1 && organic.length < 20) {
    throw new Error(`${pageIndex}페이지 일반상품이 ${organic.length}개만 확인되어 저장하지 않았습니다.`);
  }
  const fingerprint = organic.slice(0, 8).map(productKey).join("|");
  return fingerprint;
}

// 메인/보조 키워드 일괄 수집에도 검색량을 같이 채운다 — naver-rank 엣지함수의 keywordInsight
// 액션(검색광고 API, 순위 스캔과 무관하게 살아있음)을 그대로 재활용한다. 이 호출 자체가 서버에서
// keyword_search_volume_monthly에도 이번 달 검색량을 자동 저장해주므로 별도 저장 코드가 필요 없다.
// 실패해도 순위 저장 자체는 그대로 진행해야 하므로 여기서 에러를 삼킨다.
async function fetchKeywordVolume(keyword) {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/naver-rank`, {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ action: "keywordInsight", keyword }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ad = data?.ad;
    if (!ad || ad.monthlyTotal == null) return null;
    return {
      pc: Number(ad.monthlyPc) || 0,
      mobile: Number(ad.monthlyMobile) || 0,
      total: Number(ad.monthlyTotal) || 0,
    };
  } catch (_) {
    return null;
  }
}

async function saveSearchSnapshot(config, keywordMeta, products, runId, context) {
  const collectedDate = todayKst();
  // 순위 데이터 저장(POST/DELETE)과 겹치게 미리 던져둔다 — 나중에 targetPayload 만들 때만 기다리면 된다.
  const volumePromise = fetchKeywordVolume(keywordMeta.keyword);
  const now = new Date().toISOString();
  const identity = STORE_IDENTITIES[compact(config.storeName)] || {};
  const knownChannelNos = new Set(identity.channelNos || []);
  const knownProviderIds = new Set(identity.providerIds || []);
  const knownProductCodes = new Set(context.knownProducts.keys());
  const trackedCodes = new Set(context.trackedItems.map((item) => item.product_code));

  products.forEach((product) => {
    if (product.mallName && normalizeStoreLabel(product.mallName) === normalizeStoreLabel(config.storeName)) {
      if (product.channelNo) knownChannelNos.add(product.channelNo);
      if (product.providerId) knownProviderIds.add(product.providerId);
    }
  });

  const snapshotByKey = new Map();
  products.forEach((product) => {
    const isTargetStore = matchesStore(
      product, config.storeName, knownChannelNos, knownProviderIds, knownProductCodes
    );
    const row = {
      run_id: runId,
      store_name: config.storeName,
      keyword: keywordMeta.keyword,
      main_keyword: keywordMeta.mainKeyword,
      is_sub: keywordMeta.isSub,
      collected_date: collectedDate,
      collected_at: now,
      page_index: product.pageIndex,
      page_position: product.pagePosition,
      organic_rank: product.rank,
      slot_rank: product.slotRank || null,
      is_ad: !!product.isAd,
      product_key: productKey(product),
      product_code: String(product.productCode || ""),
      naver_product_id: String(product.naverProductId || ""),
      product_name: product.title || "",
      mall_name: product.mallName || "",
      channel_no: product.channelNo || "",
      provider_id: product.providerId || "",
      product_image: product.image || "",
      product_link: product.link || "",
      product_price: Number(product.price) || 0,
      shipping_fee: Number(product.shippingFee) || 0,
      purchase_count: Number(product.purchaseCount) || 0,
      review_count: Number(product.reviewCount) || 0,
      registration_date: product.registrationDate || "",
      brand: product.brand || "",
      maker: product.maker || "",
      category_path: product.categoryPath || "",
      specs: Array.isArray(product.specs) ? product.specs : [],
      tags: Array.isArray(product.tags) ? product.tags : [],
      attributes: {},
      is_target_store: isTargetStore,
      is_tracked: !!product.productCode && trackedCodes.has(String(product.productCode)),
      extraction_source: product.extractionSource || "",
    };
    const conflictKey = `${row.is_ad ? "ad" : "prod"}:${row.product_key}`;
    const current = snapshotByKey.get(conflictKey);
    const currentRank = Number(current?.organic_rank) || Number.MAX_SAFE_INTEGER;
    const nextRank = Number(row.organic_rank) || Number.MAX_SAFE_INTEGER;
    const preferred = !current || nextRank < currentRank ? row : current;
    const fallback = preferred === row ? current : row;
    snapshotByKey.set(conflictKey, {
      ...fallback,
      ...preferred,
      product_name: preferred.product_name || fallback?.product_name || "",
      mall_name: preferred.mall_name || fallback?.mall_name || "",
      product_image: preferred.product_image || fallback?.product_image || "",
      product_link: preferred.product_link || fallback?.product_link || "",
      is_target_store: !!(preferred.is_target_store || fallback?.is_target_store),
      is_tracked: !!(preferred.is_tracked || fallback?.is_tracked),
    });
  });
  const snapshotRows = [...snapshotByKey.values()];

  await postRows(
    "shopping_search_snapshots",
    snapshotRows,
    "store_name,keyword,collected_date,is_ad,product_key"
  );
  const cleanupSnapshotUrl = `${SUPABASE_URL}/rest/v1/shopping_search_snapshots` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&run_id=neq.${encodeURIComponent(runId)}`;
  const cleanupSnapshot = await fetch(cleanupSnapshotUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanupSnapshot.ok) throw new Error(`이전 검색 스냅샷 정리 실패: ${await cleanupSnapshot.text()}`);

  // 가격비교(카탈로그)형으로 렌더링된 카드는 product_code(chnl_prod_no)가 안 잡히고
  // naver_product_id만 잡힐 때가 있다 — 예전엔 이런 경우 product_code가 없다고 통째로
  // 버려서, 실제로는 노출 중인 자사 상품이 "이탈"로 잘못 저장됐다. naver_product_id로
  // 예전에 알아낸 진짜 코드를 역추적하고, naver_product_id 자체가 낯설면(가격비교 ID가
  // 자꾸 바뀌는 상품이라 naverIdToCode에도 없음) 상품명으로 마스터/이력을 한 번 더 뒤진다.
  // 그마저 없으면 naver_product_id 자체를 코드로 써서 최소한 데이터가 사라지지는 않게 한다
  // (다만 이 마지막 경우는 나중에 진짜 코드가 잡히면 별도 코드로 쪼개질 수 있다).
  const targetProducts = snapshotRows
    .filter((product) => !product.is_ad && product.is_target_store)
    .map((product) => ({
      ...product,
      resolvedCode: product.product_code
        || context.naverIdToCode?.get(product.naver_product_id)
        || context.codeByName?.get(compact(product.product_name))
        || product.naver_product_id
        || "",
    }))
    .filter((product) => product.resolvedCode)
    .sort((a, b) => a.organic_rank - b.organic_rank);
  // context는 이 수집 실행(러닝) 시작 시점에 한 번만 만들어져서, 키워드를 넘어갈 때마다
  // 다시 안 채워졌다 — 그래서 "아이소핑크" 키워드에서 방금 알아낸 진짜 코드를 바로 다음
  // "XPS단열재" 키워드 처리할 땐 몰라서 또 가격비교ID로 쪼개졌다. 이번에 실제 DOM에서
  // 코드를 직접 잡은 상품은(=확실한 값만) 같은 실행 안의 나머지 키워드에도 바로 넘겨준다.
  targetProducts.forEach((product) => {
    if (!product.product_code) return;
    const code = String(product.product_code).trim();
    const naverId = String(product.naver_product_id || "").trim();
    const nameKey = compact(product.product_name);
    if (naverId) context.naverIdToCode.set(naverId, code);
    if (nameKey) context.codeByName.set(nameKey, code);
  });
  const targetByCode = new Map();
  targetProducts.forEach((product) => {
    // 화이트리스트에 등록된 상품인데 지금 이 키워드가 그 상품의 메인+보조 목록에 없으면
    // 우연히 검색결과에 걸려도 저장하지 않는다(예: 우레탄폼건 액세서리 상품이 우레탄뿜칠
    // 대신 계속 우레탄폼건으로 잡히던 문제). 목록에 없는 상품은 지금처럼 제한 없이 저장.
    const allowed = PRODUCT_KEYWORD_WHITELIST[product.resolvedCode];
    if (allowed && !allowed.includes(keywordMeta.keyword)) return;
    if (!targetByCode.has(product.resolvedCode)) targetByCode.set(product.resolvedCode, product);
  });
  const previousKeywordProducts = context.keywordProducts.get(keywordMeta.keyword) || new Map();
  const volume = await volumePromise;
  const volumeFields = {
    search_volume_pc: volume?.pc ?? null,
    search_volume_mobile: volume?.mobile ?? null,
    search_volume_total: volume?.total ?? null,
  };
  // source: "curated" — 메인/보조 키워드를 직접 검색해서 얻은 값임을 표시한다.
  // 네이버 순위진단 스크래핑("naver_diagnosis")과 같은 store+keyword+product+날짜 조합이 겹쳐도
  // 서로 다른 행으로 남아야 하고, 아래 정리(DELETE)가 그쪽 데이터를 지우면 안 된다.
  const targetPayload = [...targetByCode.values()].map((product) => ({
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: product.organic_rank,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: product.resolvedCode,
        product_name: product.product_name,
        product_image: product.product_image,
        product_link: product.product_link,
        product_price: product.product_price,
        collected_date: collectedDate,
        source: "curated",
        ...volumeFields,
  }));
  previousKeywordProducts.forEach((previous, code) => {
    if (targetByCode.has(code)) return;
    const allowedPrev = PRODUCT_KEYWORD_WHITELIST[code];
    if (allowedPrev && !allowedPrev.includes(keywordMeta.keyword)) return;
    targetPayload.push({
        store_name: config.storeName,
        keyword: keywordMeta.keyword,
        main_keyword: keywordMeta.mainKeyword,
        is_sub: keywordMeta.isSub,
        rank: null,
        max_rank: config.pageCount * 40,
        checked_at: now,
        product_code: code,
        product_name: previous.product_name || "",
        product_image: previous.product_image || "",
        product_link: previous.product_link || "",
        product_price: Number(previous.product_price) || 0,
        collected_date: collectedDate,
        source: "curated",
        ...volumeFields,
    });
  });
  if (!targetPayload.length) {
    targetPayload.push({
      store_name: config.storeName, keyword: keywordMeta.keyword,
      main_keyword: keywordMeta.mainKeyword, is_sub: keywordMeta.isSub,
      rank: null, max_rank: config.pageCount * 40, checked_at: now,
      product_code: "", product_name: "", product_image: "", product_link: "",
      product_price: 0, collected_date: collectedDate,
      source: "curated",
      ...volumeFields,
    });
  }
  await postRows(
    "keyword_rank_history",
    targetPayload,
    "store_name,keyword,product_code,collected_date,source"
  );

  // 같은 날 다시 수집하면 이번 배치에 없는 예전 오탐 행이 남지 않게 정리합니다.
  // source=curated로 반드시 좁혀야 한다 — 안 그러면 같은 키워드로 저장된 naver_diagnosis 행까지
  // "이번 배치에 없는 예전 행"으로 오인해서 지워버린다.
  const cleanupUrl = `${SUPABASE_URL}/rest/v1/keyword_rank_history` +
    `?store_name=eq.${encodeURIComponent(config.storeName)}` +
    `&keyword=eq.${encodeURIComponent(keywordMeta.keyword)}` +
    `&collected_date=eq.${encodeURIComponent(collectedDate)}` +
    `&source=eq.curated` +
    `&checked_at=neq.${encodeURIComponent(now)}`;
  const cleanup = await fetch(cleanupUrl, { method: "DELETE", headers: sbHeaders() });
  if (!cleanup.ok) throw new Error(`이전 오탐 행 정리 실패: ${await cleanup.text()}`);
  const trackedPayload = [];
  context.trackedItems.forEach((item) => {
    if (item.keywords.length && !item.keywords.includes(keywordMeta.keyword)) return;
    const found = snapshotRows.find((row) => !row.is_ad && row.product_code === item.product_code);
    if (!found && !item.keywords.includes(keywordMeta.keyword)) return;
    trackedPayload.push({
      product_code: item.product_code,
      keyword: keywordMeta.keyword,
      rank: found?.organic_rank ?? null,
      price: found?.product_price || 0,
      mall_name: found?.mall_name || item.mall_name || "",
      collected_date: collectedDate,
      checked_at: now,
    });
  });
  if (trackedPayload.length) {
    await postRows(
      "tracked_item_history",
      trackedPayload,
      "product_code,keyword,collected_date"
    );
  }
  return { targetCount: targetByCode.size, snapshotCount: snapshotRows.filter((row) => !row.is_ad).length };
}

async function runCollection(config) {
  if (config.mode === "singleProduct") {
    await runSingleProductLookup(config);
    return;
  }
  if (config.mode === "trackedItems") {
    await runTrackedItemsBatchLookup(config);
    return;
  }
  if (config.mode === "nplusStore") {
    await runNplusStoreCollection(config);
    return;
  }
  const runId = crypto.randomUUID();
  const total = config.keywords.length * config.pageCount;
  activeRun = { id: runId, cancelled: false, tabId: null };
  await updateProgress({
    status: "running", title: "수집 중", completed: 0, total, saved: 0,
    runId, requestToken: config.requestToken || "", mode: config.mode || "batch",
    message: `선택한 키워드의 네이버 쇼핑 검색결과를 수집할 준비를 하고 있습니다.`, error: "",
  });

  let saved = 0;
  let snapshotSaved = 0;
  let finishedSuccessfully = false;
  // 탭은 필요할 때(빠른 경로가 막혔을 때만) 그때 연다 — trackedItems와 동일한 패턴.
  let tab = null;
  async function ensureTab() {
    if (!tab) {
      tab = await chrome.tabs.create({ active: true, url: "about:blank" });
      activeRun.tabId = tab.id;
    }
    return tab;
  }
  async function fetchPageViaTab(pageIndex, keyword) {
    await ensureTab();
    const url = "https://search.shopping.naver.com/search/all?" + new URLSearchParams({
      query: keyword, pagingIndex: String(pageIndex), pagingSize: "40", viewType: "list",
    });
    await chrome.tabs.update(tab.id, { url });
    await waitForTabComplete(tab.id);
    await sleep(config.pageDelay);
    const result = await extractPage(tab.id, pageIndex, config.storeName);
    if (result.blockedReason) throw new Error(result.blockedReason);
    const pageProducts = normalizePageProducts(result.products, pageIndex).map((product) => ({
      ...product, extractionSource: result.extractionSource || "dom",
    }));
    const sourceLabel = String(result.extractionSource || "dom").includes("next-data") ? "NEXT_DATA" : "DOM";
    return { pageProducts, sourceLabel };
  }
  let fastFetchDisabled = false; // 캡차 한 번 걸리면 이후 페이지도 계속 막힐 가능성이 높아 탭 방식으로 전환

  try {
    let completed = 0;
    // 매칭 컨텍스트 조회와 오래된 스냅샷 정리는 서로 의존관계가 없어 병렬로 돌린다.
    const [context] = await Promise.all([fetchCollectionContext(config), cleanupOldSnapshots()]);

    for (const keywordMeta of config.keywords) {
      const completedBeforeKeyword = completed; // 이 키워드가 통째로 실패했을 때 진행률을 채우는 데 씀
      const allProducts = [];
      let previousFingerprint = "";
      let usedFastInKeyword = false; // 이 키워드에서 fast로 마지막 요청을 보냈는지 — 다음 키워드로
        // 넘어가기 전 대기(아래 finally 블록)를 넣을지 판단하는 데 쓴다. pageCount 마지막 페이지든
        // organicCount<20 등으로 중간에 break하든 상관없이 항상 다음 키워드 전에 쉬어야 한다 —
        // 예전엔 "이 키워드의 마지막 페이지가 아닐 때만" 쉬어서, 페이지 루프가 break로 끝나거나
        // 키워드마다 1페이지만 보는 경우엔 키워드 사이에 대기가 전혀 없었다(2026-08-06 실측,
        // 82개 키워드 배치에서 캡차가 자주 걸린 원인 중 하나로 추정).
      try {
      for (let pageIndex = 1; pageIndex <= config.pageCount; pageIndex += 1) {
        if (!activeRun || activeRun.id !== runId || activeRun.cancelled) throw new Error("사용자가 수집을 중단했습니다.");
        await updateProgress({
          completed,
          message: `“${keywordMeta.keyword}” ${pageIndex}/${config.pageCount}페이지를 확인하고 있습니다.`,
        });

        let pageProducts = null;
        let sourceLabel = "";
        let usedFast = false;
        if (!fastFetchDisabled) {
          try {
            const fast = await fastFetchSearchPage(keywordMeta.keyword, pageIndex);
            if (fast.products) {
              pageProducts = normalizePageProducts(fast.products, pageIndex).map((product) => ({
                ...product, extractionSource: "fast",
              }));
              sourceLabel = "FAST";
              usedFast = true;
              usedFastInKeyword = true;
            } else if (fast.blockedReason) {
              console.warn(`[FastFetch] ${keywordMeta.keyword} p${pageIndex} 실패 → 탭 폴백: ${fast.blockedReason}`);
              if (/캡차/.test(fast.blockedReason)) {
                console.warn(`[FastFetch] 캡차 판정 — 이 실행의 나머지 키워드는 전부 탭 방식으로 전환됩니다.`);
                fastFetchDisabled = true;
              }
            }
          } catch (error) {
            // 빠른 경로 파싱/검증 실패 — 아래에서 탭 방식으로 폴백
            console.warn(`[FastFetch] ${keywordMeta.keyword} p${pageIndex} 예외 발생 → 탭 폴백:`, error);
          }
        }
        if (!pageProducts) {
          if (tab) {
            await showCollectionStatus(tab.id, {
              status: "running", keyword: keywordMeta.keyword, message: `검색결과 원본을 수집하고 있습니다.`,
              pageIndex, pageCount: config.pageCount, completed: completed + 1, total,
            });
          }
          const viaTab = await fetchPageViaTab(pageIndex, keywordMeta.keyword);
          pageProducts = viaTab.pageProducts;
          sourceLabel = viaTab.sourceLabel;
        }

        let organicCount = pageProducts.filter((item) => !item.isAd).length;
        let currentFingerprint = validatePage(pageProducts, pageIndex);

        // 네이버가 간헐적으로 pagingIndex 이동 후 이전 페이지 데이터를 다시 보여주는 경우가 있다.
        // 탭 방식으로 한 번 더 확인하고(빠른 경로는 매번 새 요청이라 재시도해도 같은 결과일 뿐이라
        // 탭으로 바꿔서 재확인한다), 그래도 같으면 이 키워드의 마지막 페이지로 처리한다.
        if (pageIndex > 1 && currentFingerprint && currentFingerprint === previousFingerprint) {
          await updateProgress({
            completed,
            message: `“${keywordMeta.keyword}” ${pageIndex}페이지 이동을 다시 확인하고 있습니다.`,
          });
          const retry = await fetchPageViaTab(pageIndex, keywordMeta.keyword);
          pageProducts = retry.pageProducts;
          sourceLabel = retry.sourceLabel;
          organicCount = pageProducts.filter((item) => !item.isAd).length;
          currentFingerprint = validatePage(pageProducts, pageIndex);
          if (currentFingerprint && currentFingerprint === previousFingerprint) {
            completed += config.pageCount - pageIndex + 1;
            await updateProgress({
              completed,
              message: `${keywordMeta.keyword} ${pageIndex - 1}페이지까지 저장하고 다음 키워드로 이동합니다.`,
            });
            break;
          }
        }

        previousFingerprint = currentFingerprint;
        if (pageIndex > 1 && organicCount === 0) {
          completed += config.pageCount - pageIndex + 1;
          await updateProgress({ completed, message: `${keywordMeta.keyword} 검색결과의 마지막 페이지까지 확인했습니다.` });
          break;
        }
        allProducts.push(...pageProducts);
        completed += 1;
        if (tab) {
          await showCollectionStatus(tab.id, {
            status: "running",
            keyword: keywordMeta.keyword,
            message: `검색결과 원본 누적 ${allProducts.filter((item) => !item.isAd).length}개를 수집했습니다.`,
            source: sourceLabel,
            pageIndex,
            pageCount: config.pageCount,
            completed,
            total,
          });
        }
        await updateProgress({
          completed,
          message: `${keywordMeta.keyword} ${pageIndex}/${config.pageCount}페이지 · ${sourceLabel} 일반상품 ${organicCount}개 · 원본 누적 ${allProducts.filter((item) => !item.isAd).length}개`,
        });
        if (pageIndex > 1 && organicCount < 20) {
          completed += config.pageCount - pageIndex;
          await updateProgress({ completed, message: `${keywordMeta.keyword} 검색결과의 마지막 페이지까지 확인했습니다.` });
          break;
        }
        if (usedFast && pageIndex < config.pageCount) await sleep(1000 + Math.random() * 1000);
      }
      // 이 키워드에서 fast 경로를 한 번이라도 썼으면, 페이지 루프가 어떻게 끝났든(break 포함)
      // 다음 키워드로 넘어가기 전에 한 번 더 쉰다. 페이지 사이 대기(캡차 방지 핵심)는 그대로
      // 두고, 키워드 전환 대기만 짧게 잡아서 속도를 살린다(2026-08-07, 82개 키워드 실측으로
      // 캡차 없이 잘 끝난 뒤 "느려서 불편하다"는 피드백으로 조정).
      if (usedFastInKeyword) await sleep(600 + Math.random() * 400);
      const result = await saveSearchSnapshot(config, keywordMeta, allProducts, runId, context);
      saved += result.targetCount;
      snapshotSaved += result.snapshotCount;
      await updateProgress({ saved, snapshotSaved });
      } catch (error) {
        // 사용자가 직접 중단한 건 이 키워드만 건너뛸 게 아니라 전체 실행을 진짜로 멈춰야 하므로
        // 그대로 다시 던진다. 그 외(캡차 후 탭 리로드로 메시지 채널이 끊기는 것 같은 일시적
        // 오류 등)는 이 키워드 하나만 건너뛰고 나머지 키워드는 계속 진행한다 — 예전엔 여기 try/
        // catch가 없어서 키워드 하나의 일시적 오류가 나머지 전체(예: 110개 중 40개째에서 멈춤)를
        // 통째로 실패시켰다(2026-08-07, 캡차를 직접 풀고 난 직후 탭 리로드로 인한 메시지 채널
        // 끊김 실측).
        if (/중단/.test(error?.message || "")) throw error;
        console.warn(`[FastFetch] ${keywordMeta.keyword} 키워드 전체 실패 → 건너뜀:`, error);
        completed = completedBeforeKeyword + config.pageCount;
        await updateProgress({
          completed,
          message: `${keywordMeta.keyword} 실패: ${error?.message || "알 수 없는 오류"} — 다음 키워드로 넘어갑니다.`,
        });
      }
    }

    await updateProgress({
      status: "done", title: "수집 완료", completed: total, total, saved,
      runId, requestToken: config.requestToken || "", mode: config.mode || "batch",
      message: `${config.keywords.length}개 키워드의 검색결과 ${snapshotSaved}개를 저장하고 자사·추적 상품을 분류했습니다.`,
    });
    finishedSuccessfully = true;
    if (config.openReport !== false) {
      chrome.tabs.create({
        active: true,
        url: chrome.runtime.getURL(`report.html?runId=${encodeURIComponent(runId)}`),
      }).catch(() => {});
    }
  } catch (error) {
    const cancelled = /중단/.test(error?.message || "");
    if (activeRun?.tabId) {
      await showCollectionStatus(activeRun.tabId, {
        status: "error",
        keyword: cancelled ? "수집이 중단되었습니다." : "수집 결과를 확인하세요.",
        message: error?.message || "수집 중 오류가 발생했습니다.",
      });
    }
    await updateProgress({
      status: cancelled ? "cancelled" : "error",
      title: cancelled ? "수집 중단" : "수집 실패",
      runId, requestToken: config.requestToken || "", mode: config.mode || "batch",
      message: error?.message || "수집 중 오류가 발생했습니다.",
      error: cancelled ? "" : (error?.message || "수집 중 오류가 발생했습니다."),
      saved,
    });
  } finally {
    if (finishedSuccessfully && activeRun?.tabId) {
      chrome.tabs.remove(activeRun.tabId).catch(() => {});
    }
    activeRun = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "CANCEL_COLLECTION") {
    if (activeRun) activeRun.cancelled = true;
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

document.getElementById("runnerStop")?.addEventListener("click", () => {
  if (activeRun) activeRun.cancelled = true;
});

(async function startPendingCollection() {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const config = stored[PENDING_KEY];
  if (!config) {
    await updateProgress({
      status: "error", title: "수집 설정 없음", error: "확장프로그램 팝업에서 수집을 다시 시작하세요.",
    });
    return;
  }
  await chrome.storage.local.remove(PENDING_KEY);
  await runCollection(config);
})();
