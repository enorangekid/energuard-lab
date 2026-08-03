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

const merged = parser.mergeProductSources(nextParsed.products, [{
  isAd: false,
  rank: 7,
  productCode: "P1",
  naverProductId: "1001",
  title: "DOM 상품 A",
  channelNo: "500128955",
  providerId: "329308",
  storeMatched: true,
}]);
assert.equal(merged.length, 3, "DOM에 렌더링되지 않은 NEXT_DATA 상품도 유지해야 합니다.");
assert.equal(merged.find((item) => item.productCode === "P1").rank, 7,
  "DOM에서 확인한 실제 노출 순위는 NEXT_DATA 순위보다 우선해야 합니다.");
assert.equal(merged.find((item) => item.productCode === "P2").rank, 2,
  "DOM에 없는 상품은 NEXT_DATA 순위를 유지해야 합니다.");
assert.equal(merged.find((item) => item.productCode === "P1").channelNo, "500128955");

const richFixture = {
  props: {
    pageProps: {
      shoppingResult: {
        products: [
          {
            productTitle: "열반사 단열재 10T",
            channelProductNo: "RICH1",
            nvMid: "MID1",
            price: 5800,
            mallName: "한국 단열",
            imageUrl: "https://example.com/product.jpg",
          },
        ],
      },
      productDetails: [
        {
          productTitle: "열반사 단열재 10T",
          channelProductNo: "RICH1",
          nvMid: "MID1",
          price: 5800,
          mallName: "한국 단열",
          deliveryFee: "4,300원",
          purchaseCnt6m: "924",
          reviewCntSum: "12,050",
          openDate: "20160928",
          category1Name: "생활/건강",
          category2Name: "생활용품",
          category3Name: "단열시트",
          characteristic: "1m|10T|결로방지",
          manuTag: ["은박단열재", "외벽단열재", "바닥단열재"],
        },
      ],
    },
  },
};
const richParsed = parser.parseNextDataProducts(richFixture, 1).products[0];
assert.equal(richParsed.shippingFee, 4300);
assert.equal(richParsed.purchaseCount, 924);
assert.equal(richParsed.reviewCount, 12050);
assert.equal(richParsed.registrationDate, "20160928");
assert.equal(richParsed.categoryPath, "생활/건강 > 생활용품 > 단열시트");
assert.deepEqual(richParsed.specs, ["1m", "10T", "결로방지"]);
assert.deepEqual(richParsed.tags, ["은박단열재", "외벽단열재", "바닥단열재"]);

const wrappedFixture = {
  props: { pageProps: { products: [
    { item: {
      productTitle: "빌트론 열반사단열재 10T",
      productId: "WRAPPED1",
      price: 5800,
      mallName: "한국 단열",
      characterValue: "1m|10T|결로방지",
      manuTag: "은박단열재,외벽단열재",
      nluInfo: { nluTerms: ["열반사", "단열재"] },
      deliveryFeeContent: "4,300원",
      purchaseCnt: "924",
      reviewCount: "12,050",
      openDate: "20160928",
      category1Name: "생활/건강",
      category2Name: "생활용품",
      category3Name: "단열시트",
      crUrl: "https://example.com/wrapped",
    } },
  ] } },
};
const wrappedResult = parser.parseNextDataProducts(wrappedFixture, 1);
assert.equal(wrappedResult.products.length, 1, "NEXT_DATA의 item 래퍼 상품도 수집해야 합니다.");
assert.equal(wrappedResult.products[0].mallName, "한국 단열");
assert.equal(wrappedResult.products[0].shippingFee, 4300);
assert.equal(wrappedResult.products[0].purchaseCount, 924);
assert.equal(wrappedResult.products[0].reviewCount, 12050);
assert.equal(wrappedResult.products[0].categoryPath, "생활/건강 > 생활용품 > 단열시트");
assert.deepEqual(wrappedResult.products[0].specs, ["1m", "10T", "결로방지"]);
assert.deepEqual(wrappedResult.products[0].tags, ["은박단열재", "외벽단열재"]);
assert.equal(wrappedResult.products[0].link, "https://example.com/wrapped");

console.log("parser smoke tests passed");
