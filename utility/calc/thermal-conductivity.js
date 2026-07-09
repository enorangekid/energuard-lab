/* ─────────────────────────────────────────
   칸칸 — 재료별 열전도율 표 (thermal-conductivity.js)
   ───────────────────────────────────────── */

'use strict';

/* ── 데이터 ── */
const TC_DATA = [
  /* ───────── 단열재 ───────── */
  { cat:'단열재', group:'압출법보온판 (XPS / 아이소핑크)', name:'압출법보온판 특호', sub:true, lambda:0.027, lambdaStr:'0.027 이하', density:35, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'압출법보온판 (XPS / 아이소핑크)', name:'압출법보온판 1호', sub:true, lambda:0.028, lambdaStr:'0.028 이하', density:30, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'압출법보온판 (XPS / 아이소핑크)', name:'압출법보온판 2호', sub:true, lambda:0.029, lambdaStr:'0.029 이하', density:25, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'압출법보온판 (XPS / 아이소핑크)', name:'압출법보온판 3호', sub:true, lambda:0.031, lambdaStr:'0.031 이하', density:20, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'압출법보온판 (XPS / 아이소핑크)', name:'압출법보온판 (DIN)', sub:true, lambda:0.035, lambdaStr:'0.035', density:33, mu:'80/200', cp:'—', basis:'DIN' },
  { cat:'단열재', group:'비드법보온판 1종 (EPS / 스티로폼)', name:'비드법보온판 1종 1호', sub:true, lambda:0.036, lambdaStr:'0.036 이하', density:30, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 1종 (EPS / 스티로폼)', name:'비드법보온판 1종 2호', sub:true, lambda:0.037, lambdaStr:'0.037 이하', density:25, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 1종 (EPS / 스티로폼)', name:'비드법보온판 1종 3호', sub:true, lambda:0.040, lambdaStr:'0.040 이하', density:20, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 1종 (EPS / 스티로폼)', name:'비드법보온판 1종 4호', sub:true, lambda:0.043, lambdaStr:'0.043 이하', density:15, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 1종 (EPS / 스티로폼)', name:'비드법보온판 1종 (DIN)', sub:true, lambda:0.035, lambdaStr:'0.035', density:30, mu:'20/100', cp:1500, basis:'DIN' },
  { cat:'단열재', group:'비드법보온판 2종 (EPS 준불연)', name:'비드법보온판 2종 1호', sub:true, lambda:0.031, lambdaStr:'0.031 이하', density:30, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 2종 (EPS 준불연)', name:'비드법보온판 2종 2호', sub:true, lambda:0.032, lambdaStr:'0.032 이하', density:25, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 2종 (EPS 준불연)', name:'비드법보온판 2종 3호', sub:true, lambda:0.033, lambdaStr:'0.033 이하', density:20, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 2종 (EPS 준불연)', name:'비드법보온판 2종 4호', sub:true, lambda:0.034, lambdaStr:'0.034 이하', density:15, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'비드법보온판 2종 (EPS 준불연)', name:'비드법보온판 2종 (DIN)', sub:true, lambda:0.032, lambdaStr:'0.032', density:17, mu:'20/50', cp:1500, basis:'DIN' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 1종 1호', sub:true, lambda:0.024, lambdaStr:'0.024 이하', density:45, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 1종 2호', sub:true, lambda:0.024, lambdaStr:'0.024 이하', density:35, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 1종 3호', sub:true, lambda:0.026, lambdaStr:'0.026 이하', density:25, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 2종 1호', sub:true, lambda:0.023, lambdaStr:'0.023 이하', density:45, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 2종 2호', sub:true, lambda:0.023, lambdaStr:'0.023 이하', density:35, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'경질우레탄폼 보온판 (PIR/PUR)', name:'경질우레탄폼 2종 3호', sub:true, lambda:0.028, lambdaStr:'0.028 이하', density:25, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄울 펠트', sub:true, lambda:0.038, lambdaStr:'0.038 이하', density:'40~70', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄울 1호', sub:true, lambda:0.037, lambdaStr:'0.037 이하', density:'71~100', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄울 2호', sub:true, lambda:0.036, lambdaStr:'0.036 이하', density:'101~160', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄울 3호', sub:true, lambda:0.038, lambdaStr:'0.038 이하', density:'161~300', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄울 (DIN)', sub:true, lambda:0.036, lambdaStr:'0.036', density:20, mu:'1', cp:850, basis:'DIN' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'락울 (DIN)', sub:true, lambda:0.036, lambdaStr:'0.036', density:100, mu:'1/2', cp:900, basis:'DIN' },
  { cat:'단열재', group:'미네랄울 (암면)', name:'미네랄보드 (DIN)', sub:true, lambda:0.045, lambdaStr:'0.045', density:115, mu:'3', cp:1300, basis:'DIN' },
  { cat:'단열재', group:'글라스울', name:'글라스울 64K', sub:true, lambda:0.035, lambdaStr:'0.035 이하', density:64, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'글라스울', name:'글라스울 48K', sub:true, lambda:0.036, lambdaStr:'0.036 이하', density:48, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'글라스울', name:'글라스울 32K', sub:true, lambda:0.037, lambdaStr:'0.037 이하', density:32, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'글라스울', name:'글라스울 24K', sub:true, lambda:0.038, lambdaStr:'0.038 이하', density:24, mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'글라스울', name:'글라스울 20K (DIN)', sub:true, lambda:0.040, lambdaStr:'0.040', density:20, mu:'1/2', cp:830, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'불연 열반사 단열재 (미네랄울)', sub:true, lambda:0.015, lambdaStr:'0.015', density:'—', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'기타 단열재', name:'무기섬유(암면) 뿜칠재', sub:true, lambda:0.042, lambdaStr:'0.042 이하', density:'—', mu:'—', cp:'—', basis:'KS' },
  { cat:'단열재', group:'기타 단열재', name:'페놀폼 (PF보드)', sub:true, lambda:0.022, lambdaStr:'0.022', density:40, mu:'35', cp:1000, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'종이단열재 (셀룰로즈)', sub:true, lambda:0.040, lambdaStr:'0.040', density:60, mu:'1/2', cp:1600, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'발포유리단열재 (판형)', sub:true, lambda:0.040, lambdaStr:'0.040', density:120, mu:'불투과', cp:840, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'점토코팅발포유리 (자갈형)', sub:true, lambda:0.090, lambdaStr:'0.090', density:300, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'에어로겔', sub:true, lambda:0.021, lambdaStr:'0.021', density:90, mu:'2/3', cp:'—', basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'진공단열재 (VIP)', sub:true, lambda:0.007, lambdaStr:'0.007', density:205, mu:'불투과', cp:900, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'양모 단열재', sub:true, lambda:0.037, lambdaStr:'0.037', density:'28~35', mu:'1', cp:1630, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'스트로베일 (갈대)', sub:true, lambda:0.060, lambdaStr:'0.060', density:100, mu:'2', cp:2100, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'삼베단열재', sub:true, lambda:0.040, lambdaStr:'0.040', density:36, mu:'1/2', cp:1600, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'퍼라이트', sub:true, lambda:0.050, lambdaStr:'0.050', density:90, mu:'5', cp:1000, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'규산칼슘보드 (단열용)', sub:true, lambda:0.060, lambdaStr:'0.060', density:220, mu:'3/6', cp:'—', basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'코르크', sub:true, lambda:0.050, lambdaStr:'0.050', density:160, mu:'5/10', cp:1800, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'목섬유단열재 (연질)', sub:true, lambda:0.040, lambdaStr:'0.040', density:55, mu:'5', cp:2100, basis:'DIN' },
  { cat:'단열재', group:'기타 단열재', name:'목섬유단열재 (경질)', sub:true, lambda:0.045, lambdaStr:'0.045', density:160, mu:'3/5', cp:2100, basis:'DIN' },

  /* ───────── 금속 ───────── */
  { cat:'금속', group:'금속류', name:'동 (구리)', lambda:370, lambdaStr:'370', density:8900, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'청동 (75Cu 25Sn)', lambda:25, lambdaStr:'25', density:8600, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'황동 (70Cu 30Zn)', lambda:110, lambdaStr:'110', density:8500, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'알루미늄/합금', lambda:200, lambdaStr:'200', density:2700, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'알루미늄호일', lambda:160, lambdaStr:'160', density:2700, mu:'불투과', cp:896, basis:'DIN' },
  { cat:'금속', group:'금속류', name:'강재', lambda:53, lambdaStr:'53', density:7800, mu:'불투과', cp:470, basis:'KS' },
  { cat:'금속', group:'금속류', name:'납', lambda:34, lambdaStr:'34', density:11400, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'아연도금철판', lambda:44, lambdaStr:'44', density:7860, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'스테인레스강', lambda:15, lambdaStr:'15', density:7400, mu:'—', cp:'—', basis:'KS' },
  { cat:'금속', group:'금속류', name:'스테인레스강 V2A', lambda:15, lambdaStr:'15', density:7900, mu:'불투과', cp:470, basis:'DIN' },

  /* ───────── 콘크리트/몰탈 ───────── */
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'시멘트몰탈 (1:3)', lambda:1.4, lambdaStr:'1.4', density:2000, mu:'15/35', cp:'—', basis:'KS' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'경석고', lambda:1.2, lambdaStr:'1.2', density:2100, mu:'15/35', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'석고', lambda:0.35, lambdaStr:'0.35', density:1000, mu:'10', cp:1090, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'콘크리트 (1:2:4)', lambda:1.6, lambdaStr:'1.6', density:2200, mu:'—', cp:'—', basis:'KS' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'경량콘크리트', lambda:1.3, lambdaStr:'1.3', density:1800, mu:'70/150', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'콘크리트 (DIN)', lambda:2.0, lambdaStr:'2.0', density:2400, mu:'80/130', cp:950, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'철근콘크리트 (1%)', lambda:2.3, lambdaStr:'2.3', density:2300, mu:'80/130', cp:880, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'철근콘크리트 (2%)', lambda:2.5, lambdaStr:'2.5', density:2400, mu:'80/130', cp:880, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'기포콘크리트 0.4폼', lambda:0.13, lambdaStr:'0.13', density:'300~400', mu:'—', cp:'—', basis:'KS' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'기포콘크리트 0.5폼', lambda:0.16, lambdaStr:'0.16', density:'401~500', mu:'—', cp:'—', basis:'KS' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'기포콘크리트 0.6폼', lambda:0.19, lambdaStr:'0.19', density:'501~700', mu:'—', cp:1185, basis:'KS' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'아스팔트테라죠', lambda:0.7, lambdaStr:'0.7', density:2350, mu:'44000', cp:920, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'수평몰탈 (방통몰탈)', lambda:1.4, lambdaStr:'1.4', density:2000, mu:'15/35', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'석회석고몰탈', lambda:0.7, lambdaStr:'0.7', density:1400, mu:'10', cp:1100, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'석회몰탈', lambda:0.87, lambdaStr:'0.87', density:1400, mu:'10', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'석회시멘트몰탈', lambda:1.0, lambdaStr:'1.0', density:1800, mu:'15/35', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'합성수지몰탈', lambda:0.7, lambdaStr:'0.7', density:1200, mu:'50/200', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'실리콘수지몰탈', lambda:0.7, lambdaStr:'0.7', density:1800, mu:'20/70', cp:1000, basis:'DIN' },
  { cat:'콘크리트', group:'몰탈/콘크리트', name:'황토몰탈', lambda:0.8, lambdaStr:'0.8', density:1700, mu:'5/10', cp:1000, basis:'DIN' },

  /* ───────── 벽돌/타일 ───────── */
  { cat:'벽돌', group:'벽돌/블록', name:'시멘트벽돌', lambda:0.6, lambdaStr:'0.6', density:1700, mu:'—', cp:'—', basis:'KS' },
  { cat:'벽돌', group:'벽돌/블록', name:'내화벽돌', lambda:0.99, lambdaStr:'0.99', density:'1700~2000', mu:'—', cp:'—', basis:'KS' },
  { cat:'벽돌', group:'벽돌/블록', name:'붉은벽돌', lambda:0.96, lambdaStr:'0.96', density:2000, mu:'50/100', cp:1000, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'콘크리트블록 (경량)', lambda:0.70, lambdaStr:'0.70', density:870, mu:'—', cp:'—', basis:'KS' },
  { cat:'벽돌', group:'벽돌/블록', name:'콘크리트블록 (중량)', lambda:1.00, lambdaStr:'1.00', density:1500, mu:'—', cp:'—', basis:'KS' },
  { cat:'벽돌', group:'벽돌/블록', name:'시멘트블록 (DIN)', lambda:0.35, lambdaStr:'0.35', density:650, mu:'5/10', cp:900, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'점토벽돌 700', lambda:0.21, lambdaStr:'0.21', density:700, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'점토벽돌 1200', lambda:0.47, lambdaStr:'0.47', density:1200, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'점토벽돌 1500', lambda:0.66, lambdaStr:'0.66', density:1500, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'점토벽돌 1800', lambda:0.91, lambdaStr:'0.91', density:1800, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'ALC 350', lambda:0.09, lambdaStr:'0.09', density:350, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'ALC 400', lambda:0.10, lambdaStr:'0.10', density:400, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'벽돌', group:'벽돌/블록', name:'ALC 500', lambda:0.12, lambdaStr:'0.12', density:500, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'벽돌', group:'타일', name:'타일', lambda:1.3, lambdaStr:'1.3', density:'—', mu:'—', cp:'—', basis:'KS' },
  { cat:'벽돌', group:'타일', name:'자기질타일', lambda:1.80, lambdaStr:'1.80', density:'—', mu:'—', cp:'—', basis:'기타' },
  { cat:'벽돌', group:'타일', name:'세라믹타일', lambda:1.2, lambdaStr:'1.2', density:2000, mu:'150/300', cp:840, basis:'DIN' },
  { cat:'벽돌', group:'타일', name:'짚점토벽돌 700', lambda:0.21, lambdaStr:'0.21', density:700, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'타일', name:'짚점토벽돌 1200', lambda:0.47, lambdaStr:'0.47', density:1200, mu:'5/10', cp:1200, basis:'DIN' },
  { cat:'벽돌', group:'타일', name:'짚점토벽돌 1800', lambda:0.91, lambdaStr:'0.91', density:1800, mu:'5/10', cp:1200, basis:'DIN' },

  /* ───────── 석재 ───────── */
  { cat:'석재', group:'석재', name:'대리석', lambda:2.8, lambdaStr:'2.8', density:2600, mu:'—', cp:'—', basis:'KS' },
  { cat:'석재', group:'석재', name:'화강석', lambda:3.3, lambdaStr:'3.3', density:2700, mu:'—', cp:'—', basis:'KS' },
  { cat:'석재', group:'석재', name:'화강석 (DIN)', lambda:2.8, lambdaStr:'2.8', density:2600, mu:'1000', cp:790, basis:'DIN' },
  { cat:'석재', group:'석재', name:'천연슬레이트', lambda:1.5, lambdaStr:'1.5', density:2300, mu:'—', cp:'—', basis:'KS' },
  { cat:'석재', group:'석재', name:'현무암', lambda:3.5, lambdaStr:'3.5', density:2850, mu:'4000', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 1200', lambda:0.56, lambdaStr:'0.56', density:1200, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 1400', lambda:0.70, lambdaStr:'0.70', density:1400, mu:'5/10', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 1600', lambda:0.79, lambdaStr:'0.79', density:1600, mu:'15/25', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 1800', lambda:0.99, lambdaStr:'0.99', density:1800, mu:'15/25', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 2000', lambda:1.1, lambdaStr:'1.1', density:2000, mu:'15/25', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회사암 2200', lambda:1.3, lambdaStr:'1.3', density:2200, mu:'15/25', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'석회암', lambda:1.4, lambdaStr:'1.4', density:2000, mu:'40', cp:1000, basis:'DIN' },
  { cat:'석재', group:'석재', name:'사암', lambda:2.3, lambdaStr:'2.3', density:2600, mu:'30', cp:710, basis:'DIN' },
  { cat:'석재', group:'석재', name:'슬레이트석', lambda:2.2, lambdaStr:'2.2', density:2400, mu:'800', cp:760, basis:'DIN' },

  /* ───────── 판재/목재 ───────── */
  { cat:'판재', group:'판재', name:'파티클보드', lambda:0.15, lambdaStr:'0.15', density:'400~700', mu:'—', cp:'—', basis:'KS' },
  { cat:'판재', group:'판재', name:'석고보드 (KS)', lambda:0.18, lambdaStr:'0.18', density:'700~800', mu:'—', cp:'—', basis:'KS' },
  { cat:'판재', group:'판재', name:'석고보드 (DIN)', lambda:0.21, lambdaStr:'0.21', density:790, mu:'8', cp:1000, basis:'DIN' },
  { cat:'판재', group:'판재', name:'섬유강화석고보드', lambda:0.32, lambdaStr:'0.32', density:1150, mu:'13', cp:1100, basis:'DIN' },
  { cat:'판재', group:'판재', name:'방수석고보드', lambda:0.24, lambdaStr:'0.24', density:'700~800', mu:'—', cp:'—', basis:'기타' },
  { cat:'판재', group:'판재', name:'목섬유보드 (목모보드)', lambda:0.09, lambdaStr:'0.09', density:460, mu:'2/5', cp:2100, basis:'DIN' },
  { cat:'판재', group:'판재', name:'규산칼슘보드 (판재)', lambda:0.06, lambdaStr:'0.06', density:220, mu:'3/6', cp:0, basis:'DIN' },
  { cat:'판재', group:'판재', name:'점토보드 (채움형)', lambda:0.073, lambdaStr:'0.073', density:670, mu:'7', cp:1400, basis:'link' },
  { cat:'판재', group:'판재', name:'점토보드 (유공형)', lambda:0.33, lambdaStr:'0.33', density:1170, mu:'4/6', cp:1120, basis:'link' },
  { cat:'판재', group:'판재', name:'MDF (경량)', lambda:0.09, lambdaStr:'0.09', density:500, mu:'11', cp:1700, basis:'DIN' },
  { cat:'판재', group:'판재', name:'MDF (보통)', lambda:0.13, lambdaStr:'0.13', density:750, mu:'50', cp:1700, basis:'DIN' },
  { cat:'판재', group:'판재', name:'OSB (외부용)', lambda:0.13, lambdaStr:'0.13', density:650, mu:'200/300', cp:1700, basis:'DIN' },
  { cat:'판재', group:'판재', name:'합판마루', lambda:0.13, lambdaStr:'0.13', density:500, mu:'30/80', cp:1600, basis:'DIN' },
  { cat:'판재', group:'판재', name:'칩보드 (Chipboard)', lambda:0.14, lambdaStr:'0.14', density:650, mu:'15/50', cp:1800, basis:'DIN' },
  { cat:'판재', group:'판재', name:'합판', lambda:0.15, lambdaStr:'0.15', density:'400~650', mu:'—', cp:'—', basis:'기타' },
  { cat:'판재', group:'판재', name:'텍스', lambda:0.20, lambdaStr:'0.20', density:'—', mu:'—', cp:'—', basis:'기타' },
  { cat:'판재', group:'목재', name:'목재 (경량)', lambda:0.14, lambdaStr:'0.14', density:400, mu:'—', cp:'—', basis:'KS' },
  { cat:'판재', group:'목재', name:'목재 (보통량)', lambda:0.17, lambdaStr:'0.17', density:500, mu:'—', cp:'—', basis:'KS' },
  { cat:'판재', group:'목재', name:'목재 (중량)', lambda:0.19, lambdaStr:'0.19', density:600, mu:'—', cp:'—', basis:'KS' },
  { cat:'판재', group:'목재', name:'너도밤나무', lambda:0.16, lambdaStr:'0.16', density:720, mu:'50/200', cp:2100, basis:'DIN' },
  { cat:'판재', group:'목재', name:'더글라스 전나무', lambda:0.12, lambdaStr:'0.12', density:530, mu:'20/50', cp:1600, basis:'DIN' },
  { cat:'판재', group:'목재', name:'낙엽송', lambda:0.13, lambdaStr:'0.13', density:460, mu:'20/50', cp:1600, basis:'DIN' },
  { cat:'판재', group:'목재', name:'오크 (참나무)', lambda:0.18, lambdaStr:'0.18', density:690, mu:'50/200', cp:2400, basis:'DIN' },
  { cat:'판재', group:'목재', name:'소나무', lambda:0.13, lambdaStr:'0.13', density:520, mu:'20/50', cp:1600, basis:'DIN' },
  { cat:'판재', group:'목재', name:'가문비나무', lambda:0.13, lambdaStr:'0.13', density:450, mu:'20/50', cp:1600, basis:'DIN' },

  /* ───────── 방습/기타 ───────── */
  { cat:'방습', group:'바닥재', name:'바닥재 - 플라스틱계', lambda:0.19, lambdaStr:'0.19', density:1500, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'바닥재', name:'바닥재 - 아스팔트계', lambda:0.33, lambdaStr:'0.33', density:1800, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'PE 필름 (KS)', lambda:0.21, lambdaStr:'0.21', density:700, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'PE 필름 (DIN)', lambda:0.40, lambdaStr:'0.40', density:930, mu:'100000', cp:1800, basis:'DIN' },
  { cat:'방습', group:'방습재료', name:'PP 필름', lambda:0.22, lambdaStr:'0.22', density:910, mu:'10000', cp:1700, basis:'DIN' },
  { cat:'방습', group:'방습재료', name:'아스팔트펠트 17kg', lambda:0.11, lambdaStr:'0.11', density:688, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트펠트 22kg', lambda:0.14, lambdaStr:'0.14', density:762, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트펠트 26kg', lambda:0.22, lambdaStr:'0.22', density:671, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트루핑 17kg', lambda:0.19, lambdaStr:'0.19', density:870, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트루핑 22kg', lambda:0.27, lambdaStr:'0.27', density:920, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트루핑 30kg', lambda:0.34, lambdaStr:'0.34', density:979, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'방습재료', name:'아스팔트쉬트', lambda:0.17, lambdaStr:'0.17', density:1050, mu:'10000/80000', cp:1000, basis:'DIN' },
  { cat:'방습', group:'벽지/기타', name:'벽지 - 비닐계', lambda:0.27, lambdaStr:'0.27', density:'—', mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'벽지/기타', name:'벽지 - 종이계', lambda:0.17, lambdaStr:'0.17', density:700, mu:'—', cp:'—', basis:'KS' },
  { cat:'방습', group:'벽지/기타', name:'알루미늄복합패널 (단열재 제외)', lambda:0.50, lambdaStr:'0.50', density:'—', mu:'—', cp:'—', basis:'기타' },
  { cat:'방습', group:'벽지/기타', name:'유리', lambda:0.76, lambdaStr:'0.76', density:2500, mu:'불투과', cp:840, basis:'DIN' },
  { cat:'방습', group:'벽지/기타', name:'자갈', lambda:2.0, lambdaStr:'2.0', density:2200, mu:'50', cp:1000, basis:'DIN' },
  { cat:'방습', group:'벽지/기타', name:'기와', lambda:0.75, lambdaStr:'0.75', density:933, mu:'5/10', cp:840, basis:'DIN' },
];

/* ── 테이블 렌더링 ── */
function render(filter = '', catFilter = 'all') {
  const body  = document.getElementById('tcBody');
  const empty = document.getElementById('tcEmpty');
  let html = '';
  let count = 0;
  let lastGroup = null;
  const q = filter.toLowerCase();

  for (const row of TC_DATA) {
    const catMatch  = catFilter === 'all' || row.cat === catFilter;
    const textMatch = !q || row.name.toLowerCase().includes(q) || row.group.toLowerCase().includes(q) || row.cat.toLowerCase().includes(q);
    if (!catMatch || !textMatch) continue;

    if (row.group !== lastGroup) {
      html += `<tr class="group-row" data-cat="${row.cat}"><td colspan="6"><span>${row.group}</span></td></tr>`;
      lastGroup = row.group;
    }

    const nameClass = row.sub ? 'col-name col-sub' : 'col-name';
    html += `<tr class="data-row" data-cat="${row.cat}">
      <td class="${nameClass}">${row.name}</td>
      <td class="col-lambda"><span class="lambda-val">${row.lambdaStr}</span><span class="lambda-unit">W/m·K</span></td>
      <td class="col-density">${row.density}</td>
      <td class="col-mu">${row.mu}</td>
      <td class="col-cp">${row.cp}</td>
      <td class="col-basis">${row.basis}</td>
    </tr>`;
    count++;
  }

  body.innerHTML = html;
  empty.style.display = count === 0 ? 'block' : 'none';
  document.getElementById('tcTable').style.display = count === 0 ? 'none' : '';
}

/* ── 초기화 ── */
let currentCat = 'all';

document.addEventListener('DOMContentLoaded', () => {
  render();

  document.getElementById('tcSearch').addEventListener('input', e => {
    render(e.target.value.trim(), currentCat);
  });

  document.getElementById('tcFilterTabs').addEventListener('click', e => {
    const tab = e.target.closest('.tc-tab');
    if (!tab) return;
    document.querySelectorAll('.tc-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCat = tab.dataset.cat;
    render(document.getElementById('tcSearch').value.trim(), currentCat);
  });

  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});