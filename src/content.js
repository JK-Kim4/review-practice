// 화면 문구와 작성 단계 정의. 프런트엔드는 /api/meta 로 이 내용을 받아 그린다.

const CATEGORIES = [
  {
    id: 'performance',
    label: '공연',
    examples: '연극 · 뮤지컬 · 무용 · 콘서트',
    hints: ['대사', '표정', '침묵', '움직임', '조명', '무대 구성'],
  },
  {
    id: 'exhibition',
    label: '전시',
    examples: '미술관 · 갤러리 · 사진전',
    hints: ['색채', '재료', '형태', '크기', '배치', '빛'],
  },
  {
    id: 'book',
    label: '책',
    examples: '소설 · 에세이 · 희곡 · 비평',
    hints: ['밑줄 친 문장', '다시 읽은 대목', '인물의 선택', '장면', '제목'],
  },
  {
    id: 'fair',
    label: '박람회 · 기타',
    shortLabel: '박람회',
    examples: '도서전 · 아트페어 · 팝업',
    hints: ['공간', '사람들', '물건', '소리', '가장 오래 머문 곳'],
  },
];

const STAGES = [
  { id: 'capture', label: '포착하기' },
  { id: 'question', label: '질문하기' },
  { id: 'compose', label: '정리하기' },
];

const CAPTURE_FIELDS = [
  { key: 'scene1', label: '장면 1' },
  { key: 'scene2', label: '장면 2' },
  { key: 'scene3', label: '장면 3', optional: true, placeholder: '유독 오래 바라본 것, 보여주지 않았는데 크게 느껴진 것' },
];

const QUESTION_FIELDS = [
  { key: 'reason', label: '다른 장면보다 이것이 기억에 남은 이유는?', short: '기억에 남은 이유' },
  { key: 'emotion', label: '그때 가장 크게 느낀 감정은?', short: '느낀 감정', placeholder: '감정 단어 하나부터 시작해도 좋아요' },
  { key: 'unexpected', label: '예상과 달랐던 부분은?', short: '예상과 달랐던 부분', placeholder: '작은 차이나 궁금증도 좋아요' },
  { key: 'experience', label: '이 장면과 이어지는 내 경험이나 생각은?', short: '이어지는 내 경험', placeholder: '확신이 없다면 추측이어도 괜찮아요' },
  { key: 'remaining', label: '아직 남아 있는 질문은?', short: '남은 질문', placeholder: '답을 찾지 못했다면 질문 그대로 남겨두세요' },
];

const WHY_LABEL = '왜 그렇게 느꼈을까?';
const MAX_WHYS = 3;

const COMPOSE_SECTIONS = [
  { key: 'intro', label: '도입', guide: '1~2문장', placeholder: '가장 크게 남은 인상' },
  { key: 'describe', label: '묘사', guide: '2~3문장', placeholder: '기억에 남는 구체적인 장면' },
  { key: 'reflect', label: '감상', guide: '3~5문장', placeholder: '그 장면이 불러온 감정과 해석' },
  { key: 'closing', label: '마무리', guide: '1~2문장', placeholder: '작품을 보고 남은 생각이나 질문' },
];

const TARGET_LENGTH = 300;

// 피상적 감상에서 끝나는 표현
const VAGUE_WORDS = [
  '좋았다', '인상적이었다', '인상깊었다', '인상 깊었다', '슬펐다', '아름다웠다',
  '재밌었다', '재미있었다', '감동적이었다', '감동받았다', '멋있었다', '멋졌다',
  '별로였다', '지루했다', '대단했다', '최고였다',
];

// 포착하기 '예시 보기' (연극 〈갈매기〉)
const EXAMPLE = {
  scene1: '니나가 자신의 고통을 이야기하면서도 배우로 살아가겠다는 의지를 보였다.',
  scene2: '니나가 떠난 뒤 트레플레프에게 남겨진 시간이 길게 느껴졌다.',
  scene3: '마지막 장면에서 직접 보여주지 않은 사건이 오히려 크게 느껴졌다.',
};

module.exports = {
  CATEGORIES,
  STAGES,
  CAPTURE_FIELDS,
  QUESTION_FIELDS,
  WHY_LABEL,
  MAX_WHYS,
  COMPOSE_SECTIONS,
  TARGET_LENGTH,
  VAGUE_WORDS,
  EXAMPLE,
};
