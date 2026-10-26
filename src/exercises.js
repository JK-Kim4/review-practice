// 연습 유형 정의. 프런트엔드는 /api/exercises 로 이 목록을 받아 화면을 그린다.
// field.question === true 인 칸은 '남은 질문' 모음에 모인다.

const EXERCISES = [
  {
    id: 'capture',
    stage: '포착하기',
    title: '기억나는 장면 세 가지',
    summary: '감상 대신 사실부터 적습니다. 왜 기억나는지는 아직 설명하지 않습니다.',
    minutes: 5,
    fields: [
      { key: 'scene1', label: '장면 1', hint: '배우의 대사·침묵·움직임, 조명, 무대 / 색채, 재료, 형태, 배치 등' },
      { key: 'scene2', label: '장면 2', hint: '해석하거나 평가하지 말고 있었던 일만 적어보세요.' },
      { key: 'scene3', label: '장면 3', hint: '유독 오래 바라본 것, 보여주지 않았는데 크게 느껴진 것도 좋습니다.' },
    ],
    example: {
      scene1: '니나가 자신의 고통을 이야기하면서도 배우로 살아가겠다는 의지를 보였다.',
      scene2: '니나가 떠난 뒤 트레플레프에게 남겨진 시간이 인상적이었다.',
      scene3: '마지막 장면에서 직접 보여주지 않은 사건이 오히려 크게 느껴졌다.',
    },
  },
  {
    id: 'five-questions',
    stage: '질문하기',
    title: '한 장면에 질문 다섯 개',
    summary: '기록한 장면 하나를 골라 질문을 던집니다. 모두 답하지 않아도 되고, 가장 흥미로운 하나를 고르면 됩니다.',
    minutes: 10,
    fields: [
      { key: 'scene', label: '고른 장면', hint: '포착하기에서 기록한 장면 중 하나' },
      { key: 'q1', label: 'Q1. 왜 다른 장면보다 이것이 기억에 남았을까?', hint: '' },
      { key: 'q2', label: 'Q2. 그때 가장 크게 느낀 감정은 무엇일까?', hint: '감정 단어 하나부터. 여러 감정이 동시에 들었다면 모두 적어도 좋습니다.' },
      { key: 'q3', label: 'Q3. 내가 예상한 것과 다른 부분은 무엇일까?', hint: '' },
      { key: 'q4', label: 'Q4. 이 장면과 연결되는 내 경험이나 생각이 있을까?', hint: '' },
      { key: 'q5', label: 'Q5. 아직 이해되지 않거나 궁금한 것은 무엇일까?', hint: '답이 없어도 됩니다. 질문 그대로 남겨두세요.', question: true },
      { key: 'pick', label: '글로 발전시킬 하나', hint: '다섯 가지 중 가장 흥미로운 생각 하나', question: true },
    ],
    example: {
      scene: '니나가 자신의 고통을 이야기하던 장면',
      q1: '니나가 불행을 말하면서도 삶을 포기하지 않는 모습이 모순적으로 느껴졌기 때문이다.',
      q2: '안타까움과 존경심이 동시에 들었다.',
      q3: '나는 그녀가 고통을 극복했을 것이라고 예상했다. 하지만 고통은 여전히 남아 있었다.',
      q4: '나도 어려움을 완전히 해결해야 다음 단계로 나아갈 수 있다고 생각하곤 한다.',
      q5: '삶에서 고통을 받아들인다는 것은 체념일까, 아니면 성숙일까?',
      pick: '고통을 받아들이는 것은 체념일까 성숙일까',
    },
  },
  {
    id: 'why-three',
    stage: '발전시키기',
    title: "'왜?' 세 번 묻기",
    summary: '한 가지 생각을 깊게 파고듭니다. 대답이 실제 감정과 맞지 않으면 억지로 이어가지 말고 다른 질문을 던져도 좋습니다.',
    minutes: 10,
    fields: [
      { key: 'start', label: '출발점', hint: '예: 니나의 모습이 슬펐다.' },
      { key: 'why1', label: '왜 그렇게 느꼈을까?', hint: '' },
      { key: 'why2', label: '그건 또 왜일까?', hint: '' },
      { key: 'why3', label: '한 번 더, 왜?', hint: '작품보다 나의 생각·가치관에 가까워져도 괜찮습니다.' },
      { key: 'topic', label: '발견한 글의 소재 (질문 형태로)', hint: '예: 우리는 왜 성과를 얻지 못한 삶을 실패라고 생각할까?', question: true },
    ],
    example: {
      start: '니나의 모습이 슬펐다.',
      why1: '자신이 원했던 삶을 얻지 못한 것 같아서.',
      why2: '나는 노력한 사람은 그에 따른 보상을 얻어야 한다고 생각하기 때문에.',
      why3: '노력했지만 아무런 성과를 얻지 못하는 삶을 실패라고 생각해 왔기 때문에.',
      topic: '우리는 왜 성과를 얻지 못한 삶을 실패라고 생각할까?',
    },
  },
  {
    id: 'oei',
    stage: '기본기',
    title: '관찰 · 감정 · 해석 분리하기',
    summary: '세 문장만 적어도 하나의 작은 감상문이 됩니다. "슬펐다", "인상적이었다"에서 끝내지 마세요.',
    minutes: 5,
    fields: [
      { key: 'observe', label: '① 관찰 — 무엇을 보았는가?', hint: '평가하지 않고 기억에 남는 장면이나 표현을 구체적으로' },
      { key: 'feel', label: '② 감정 — 무엇을 느꼈는가?', hint: '감정이나 신체적 반응' },
      { key: 'interpret', label: '③ 해석 — 왜 그렇게 느꼈는가?', hint: '장면과 내 감정 사이의 관계' },
    ],
    example: {
      observe: '배우가 대사를 마친 뒤에도 한동안 무대 중앙에 서 있었다.',
      feel: '아무 말도 하지 않는 시간이 오히려 대사보다 더 불편하고 슬프게 느껴졌다.',
      interpret: '그 침묵이 인물의 고립감을 드러내는 것 같았다. 나 역시 비슷한 침묵을 경험했기 때문일지도 모른다.',
    },
  },
  {
    id: 'five-minute',
    stage: '기본기',
    title: '관람 직후 5분 기록',
    summary: '문장을 잘 쓰는 것보다 기억을 잃지 않는 것이 중요합니다. 메모해 두었다가 며칠 뒤 글로 이어 붙여도 좋습니다.',
    minutes: 5,
    fields: [
      { key: 'memorable', label: '1. 가장 오래 기억에 남을 장면이나 작품은?', hint: '특정한 대사, 배우의 표정, 그림의 색채, 공간의 분위기 등' },
      { key: 'emotion', label: '2. 그 장면에서 어떤 감정을 느꼈는가?', hint: '감동뿐 아니라 불편함, 지루함, 의문, 거부감도 좋습니다.' },
      { key: 'reason', label: '3. 왜 그런 감정을 느꼈다고 생각하는가?', hint: '작품의 표현 방식 또는 자신의 경험과 연결해 보기' },
      { key: 'newThought', label: '4. 이 경험으로 새롭게 생각하게 된 것은?', hint: '답을 찾지 못했다면 아직 남아 있는 질문을 기록하기', question: true },
    ],
  },
  {
    id: 'discovery',
    stage: '기본기',
    title: '감상 발견 연습장',
    summary: '완성된 문장이 아니어도 좋습니다. 떠오르는 단어부터 적어보세요.',
    minutes: 10,
    fields: [
      { key: 'scene', label: '1. 가장 기억에 남는 장면이나 대사(작품)는?', hint: '객관적으로 관찰한 것을 적어보세요.' },
      { key: 'unexpected', label: '2. 특이하거나 예상과 달랐던 점은?', hint: '작은 차이나 궁금증도 좋습니다.' },
      { key: 'emotion', label: '3. 어떤 감정이나 생각이 들었나요?', hint: '감정 단어 하나부터 시작해보세요.' },
      { key: 'reason', label: '4. 그 감정이 생긴 이유는?', hint: '확신이 없다면 추측이어도 괜찮습니다.' },
      { key: 'topics', label: '발전시킬 주제 (최대 세 가지)', hint: '위 네 답을 보며 감상문의 출발점이 될 만한 주제를 적어보세요.', question: true },
    ],
  },
  {
    id: 'observe',
    stage: '기본기',
    title: '객관적 묘사 다섯 문장',
    summary: '1주 차 훈련. 장면 하나를 골라 감상이나 해석 없이 보이는 것만 다섯 문장으로 묘사합니다.',
    minutes: 10,
    fields: [
      { key: 'target', label: '묘사할 장면·작품', hint: '일상의 장면도 좋습니다.' },
      { key: 's1', label: '문장 1', hint: '크기, 구도, 위치' },
      { key: 's2', label: '문장 2', hint: '색채, 빛' },
      { key: 's3', label: '문장 3', hint: '재료, 질감, 소리' },
      { key: 's4', label: '문장 4', hint: '움직임, 시간의 흐름' },
      { key: 's5', label: '문장 5', hint: '공간, 주변과의 관계' },
    ],
  },
];

// 감상 기록 구성에 따라 대상 종류별로 힌트를 바꿔 보여줄 때 쓰는 보조 힌트.
const TYPE_HINTS = {
  performance: '배우의 대사·표정·침묵·움직임, 조명, 음악, 무대 구성',
  exhibition: '색채, 재료, 형태, 작품의 배치, 유독 오래 바라본 작품',
  book: '밑줄 긋고 싶었던 문장, 멈춰 다시 읽은 대목, 인물의 선택',
  fair: '부스의 구성, 사람들의 반응, 가장 오래 머문 곳',
  etc: '가장 먼저 떠오르는 장면 하나',
};

const WORK_TYPES = [
  { id: 'performance', label: '공연' },
  { id: 'exhibition', label: '전시' },
  { id: 'book', label: '책' },
  { id: 'fair', label: '박람회' },
  { id: 'etc', label: '기타' },
];

// 짧은 감상문 구조: 도입 → 묘사 → 감상 → 마무리
const ESSAY_SECTIONS = [
  { key: 'intro', label: '도입', guide: '관람 전 기대 또는 관람 후 가장 크게 남은 인상', sentences: '1~2문장' },
  { key: 'describe', label: '묘사', guide: '기억에 남는 구체적인 장면과 표현', sentences: '2~3문장' },
  { key: 'reflect', label: '감상', guide: '그 장면이 불러온 감정과 해석', sentences: '3~5문장' },
  { key: 'closing', label: '마무리', guide: '작품을 보고 남은 생각이나 질문', sentences: '1~2문장' },
];

const ESSAY_TARGETS = [200, 300, 400, 500];

// 피상적 감상에서 끝나는 표현. 쓰는 중에 "무엇이?"를 되묻도록 표시한다.
const VAGUE_WORDS = [
  '좋았다', '인상적이었다', '인상깊었다', '인상 깊었다', '슬펐다', '아름다웠다',
  '재밌었다', '재미있었다', '감동적이었다', '감동받았다', '멋있었다', '멋졌다',
  '별로였다', '지루했다', '대단했다', '최고였다',
];

// 훈련이 제대로 되고 있는지 확인하는 기준
const SELF_CHECKS = [
  { key: 'concrete', label: '구체성', question: '"좋았다"에서 "어느 장면의 무엇이 좋았다"로 변했는가?' },
  { key: 'selfUnderstanding', label: '자기 이해', question: '작품 설명뿐 아니라 내가 왜 그렇게 느꼈는지 발견했는가?' },
  { key: 'newQuestion', label: '질문의 발견', question: '이전에는 하지 않았던 질문을 하나라도 떠올렸는가?' },
];

// 일주일 루틴 (getDay: 0=일 ~ 6=토)
const WEEKLY_ROUTINE = [
  { day: 1, label: '월요일', exercise: 'capture', goal: '관찰과 기억' },
  { day: 3, label: '수요일', exercise: 'five-questions', goal: '감상의 소재 찾기' },
  { day: 5, label: '금요일', exercise: 'why-three', goal: '생각의 깊이 확장' },
];

// 4주 루틴
const FOUR_WEEK_PLAN = [
  { week: 1, title: '관찰 기록', detail: "장면 하나를 골라 객관적인 묘사 다섯 문장 쓰기. 감상이나 해석은 넣지 않습니다.", exercise: 'observe' },
  { week: 2, title: '감정의 이유 찾기', detail: "기억에 남는 작품 세 개를 골라 각각 '무엇을 보았는가 → 무엇을 느꼈는가 → 왜 느꼈는가'를 기록합니다.", exercise: 'oei' },
  { week: 3, title: '200자 감상문', detail: '가장 인상적이었던 장면 하나로 도입·묘사·감상·마무리를 갖춘 짧은 글을 씁니다.', essayTarget: 200 },
  { week: 4, title: '500자 감상문', detail: '분량을 늘리되 작품의 내용과 자신의 경험을 연결합니다. 이전 글과 비교해 묘사가 구체적으로 변했는지 확인합니다.', essayTarget: 500 },
];

function getExercise(id) {
  return EXERCISES.find((e) => e.id === id) || null;
}

module.exports = {
  EXERCISES,
  TYPE_HINTS,
  WORK_TYPES,
  ESSAY_SECTIONS,
  ESSAY_TARGETS,
  VAGUE_WORDS,
  SELF_CHECKS,
  WEEKLY_ROUTINE,
  FOUR_WEEK_PLAN,
  getExercise,
};
