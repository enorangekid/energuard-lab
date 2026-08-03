const assert = require("node:assert/strict");
const parser = require("../parser-core.js");

const adDetail = [
  { key: "chnl_prod_no", value: "5880412348" },
  { key: "nv_mid", value: "83424911762" },
  { key: "chnl_prod_nm", value: "단열코리아" },
  { key: "price", value: "2430" },
  { key: "ad_expose_order", value: "1" },
];

const organicDetail = [
  { key: "prod_nm", value: "벽산 아이소핑크 (특호 20T 600X900 1장) 압출법 단열재 보온판 XPS" },
  { key: "price", value: "4300" },
  { key: "catalog_nv_mid", value: "10036281978" },
  { key: "organic_expose_order", value: "5" },
  { key: "chnl_prod_no", value: "439904706" },
];

assert.equal(parser.isAdRecord({
  group: "ad",
  type: "SA_prod",
  href: "https://ader.naver.com/v1/example",
}), true, "광고 상품을 일반 순위에 포함하면 안 됩니다.");

assert.equal(parser.isAdRecord({
  group: "prod",
  type: "nv_mid",
  href: "https://cr.shopping.naver.com/adcr?nvMid=10036281978",
}), false, "일반 상품의 추적 링크는 광고 링크로 오인하면 안 됩니다.");

const ad = parser.toDetailMap(JSON.stringify(adDetail));
const organic = parser.toDetailMap(JSON.stringify(organicDetail));
assert.equal(ad.chnl_prod_no, "5880412348");
assert.equal(organic.chnl_prod_no, "439904706");
assert.equal(parser.resolveOrganicRank(organic.organic_expose_order, 1, 5), 5,
  "화면 슬롯 7이 아니라 광고를 제외한 organic_expose_order 5를 저장해야 합니다.");
assert.equal(parser.resolveOrganicRank(5, 2, 5), 45,
  "페이지별 순번으로 제공될 경우 두 번째 페이지 오프셋을 적용해야 합니다.");

assert.equal(parser.isMainListSlot({ group: "prod", inventory: "lst*N", area: "lst*N.img" }), true);
assert.equal(parser.isMainListSlot({ group: "ad", inventory: "lst*A", area: "lst*A.img" }), true);
assert.equal(parser.isMainListSlot({ group: "prod", inventory: "rec*N", area: "rec*N.img" }), false);
assert.equal(parser.isMainListSlot({ group: "prod", inventory: "lst*N", area: "lst*N.keep" }), false);

const nextDataFixture = {
  props: { pageProps: { shoppingResult: { products: [
    { productTitle: "광고 상품", channelProductNo: "AD1", nvMid: "9001", price: 1000, mallName: "광고몰", isAd: true },
    { productTitle: "일반 상품 A", channelProductNo: "P1", nvMid: "1001", price: 4300, mallName: "한국 단열" },
    { productTitle: "일반 상품 B", channelProductNo: "P2", nvMid: "1002", price: 5500, mallName: "한국 단열" },
  ] } } },
};
const nextParsed = parser.parseNextDataProducts(nextDataFixture, 1);
assert.match(nextParsed.path, /products$/);
assert.equal(nextParsed.products.length, 3);
assert.equal(nextParsed.products[0].isAd, true);
assert.equal(nextParsed.products[1].rank, 1);
assert.equal(nextParsed.products[2].rank, 2);

console.log("parser smoke tests passed");
