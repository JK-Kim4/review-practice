// 참고 자료 (도서·영상·무료 자료)

const BOOKS = [
  {
    title: '글쓰기의 최전선',
    author: '은유',
    publisher: '메멘토 · 2022년 개정판',
    badge: '가장 먼저 추천',
    note: '감정에 질문을 던지고 자신의 경험을 구체적인 언어로 표현하는 데 참고하기 좋습니다. 개인적인 감상문을 쓰려는 목적에 가장 가까운 책입니다.',
    order: 1,
  },
  {
    title: '주의를 기울이는 법',
    author: '롭 워커',
    publisher: '마주 · 2026년',
    note: '131가지 관찰 연습. 글을 잘 쓰는 법보다 감상할 거리를 발견하는 능력을 키우는 데 적합합니다.',
    order: 2,
  },
  {
    title: '다른 방식으로 보기',
    author: '존 버거',
    publisher: '열화당',
    note: '이미지를 바라보는 방식이 맥락에 따라 어떻게 달라지는지 살펴봅니다. 글쓰기 입문서보다는 미술비평서에 가깝습니다.',
    order: 3,
  },
  {
    title: '해석에 반하여',
    author: '수전 손택',
    publisher: '윌북 · 2025년 번역판',
    note: '작가의 의도를 정확히 맞혀야 한다는 부담에서 벗어나게 해주는 평론집. 이론적으로 밀도가 높아 마지막에 읽기를 권합니다.',
    order: 4,
  },
];

const MEDIA = [
  {
    title: 'Ways of Seeing — Episode 1',
    by: '존 버거 · BBC · 영어 영상',
    note: '『다른 방식으로 보기』의 토대가 된 1972년 방송 시리즈.',
    url: 'https://www.youtube.com/results?search_query=Ways+of+Seeing+Episode+1+John+Berger',
  },
  {
    title: 'How to do visual (formal) analysis',
    by: 'Smarthistory · 무료 강의 영상 · 영어',
    note: '크기, 구도, 색채, 빛과 공간을 어떤 순서로 관찰하고 언어화하는지 실제 회화로 설명합니다.',
    url: 'https://smarthistory.org/visual-analysis/',
  },
  {
    title: 'A Guide to Slow Looking',
    by: 'Tate · 무료 글 자료 · 영어',
    note: '작품 하나를 골라 5~10분 이상 천천히 관찰하는 방법. 전시장에서 바로 실천할 수 있습니다.',
    url: 'https://www.tate.org.uk/search?q=slow+looking',
  },
];

module.exports = { BOOKS, MEDIA };
