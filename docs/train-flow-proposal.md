# Train flow 검토 및 제안 — 2026-10-01

## Implementation status — 2026-10-03

The real lesson route now includes rounds, persisted warmup feedback, Coach struggle capture, completion, and free rewatch. Activation is waiting for approval of the new remote migration. See [implementation and verification](train-rounds-implementation.md). The existing flow remains available while the server lacks the migration.

## 화면 설계 보완 — Level은 내부 진행 단위

사용자 결정: 보호자에게 L1/L2/L3, 2/5 같은 구분을 알리는 것이 목표가 아니다.
화면은 보호자가 자연스럽게 따라오도록 다음 행동을 안내한다.
아래 설계의 Level/회차 범위는 내부 로직 설명이며 사용자 화면에 표시하지 않는다.

- 물음표는 기존 Coach 챗봇을 그대로 사용한다. 별도 어려움 선택 시트는 폐기한다.
- 어려움 기록은 추후 Coach 진입/대화와 연결하며 성공 결과와 별도로 유지한다.
- 회차 완료는 앱의 기존 강아지 마스코트, 짧은 축하, Continue로 구성한다.
- 마지막 완료도 마스코트가 축하하고 영상 해금/다시보기를 안내한다.
- 이전 `Level complete!`, 번호별 진행 카드, 다음 Level 범위 안내는 사용하지 않는다.
- 준비/퀴즈/다시보기에서도 내부 Level 번호 대신 훈련명·행동명으로 안내한다.

## 2026-10-03 수정 설계: 훈련 묶음과 다음 회차의 맞춤 퀴즈

### 사용자 의도 — 이번 설계의 기준

- Energy 1회로 약 2–3개 Level을 진행하는 훈련 묶음을 시작한다.
- 묶음 안에서 보호자가 어려움을 겪은 부분을 기록한다.
- 다음 Energy를 사용해 시작할 때, 지난 어려움에 관한 짧은 퀴즈를 먼저 제시한다.
- 퀴즈는 다음 훈련 묶음의 도입부다. L5 이후 별도로 방문하는 Review 모드가 아니다.
- L5 성공 후 축하하고 해당 Lesson의 전체 영상을 해금하는 기존 요구는 유지한다.

아래는 이 의도를 구체화한 제안이며 아직 앱/DB에 구현하지 않았다.
이 절이 아래의 과거 설계보다 우선한다. 특히 10월 2일의 독립 Review 화면,
다음 날/7일 뒤 일정, 별도 무료 퀴즈 보상 제안은 이번 구조에서 채택하지 않는다.
과거의 Lesson 전체를 한 번에 진행하는 Energy 제안도 2–3개 Level 묶음으로 대체한다.

### 기본 흐름과 묶음 구성

로드맵 → 준비 → Start training(Energy 1회) → 지난 어려움 퀴즈(있을 때만) →
Level 2–3개 → 회차 완료 → 다음 회차에 필요한 어려움 기록 유지.

5개 Level인 Lesson의 기본 구성은 L1–L2 / L3–L5를 추천한다.
콘텐츠의 난이도와 길이에 따라 3+2도 가능하며, Lesson별로 미리 정한다.
단순히 개수를 맞추려고 서로 다른 Lesson을 한 묶음에 섞지 않는다.
2–3개는 목표 분량이다. 어려움이 지속되면 일찍 마무리할 수 있고 자동 성공 처리하지 않는다.

첫 회차 또는 이전 어려움이 없는 회차는 퀴즈 없이 훈련으로 들어간다.
다음 회차가 같은 날이어도 새 Energy를 사용하면 퀴즈 대상이 된다.
준비 화면에는 예상 Level 범위와 Energy 비용만 간결하게 표시한다.

### 어려움 기록

- 기존 물음표 사용을 명시적인 어려움 신호로 삼는다.
- 도움말에서 필요하면 한 번 탭으로 이유를 선택한다: 타이밍 / 신호 전달 /
  강아지 반응 / 설명 이해. 선택하지 않아도 해당 Level의 핵심 개념으로 연결한다.
- dogId, Lesson, Level, 회차, 도움말 항목/개념, 당시 자막 위치, 시각을 저장한다.
  현재 자막 위치는 참고 정보이며 그것만으로 어려움의 원인을 단정하지 않는다.
- 되감기, 일시정지, 영상 반복 시청만으로 어려움이나 실패를 판정하지 않는다.
- 물음표 이후 Continue로 성공해도 어려움 이력을 지우지 않는다.
  최종 수행 결과와 도움을 받았던 기록을 별개로 보존한다.
- 같은 개념의 반복 요청은 한 문제로 묶는다.

### 다음 회차 퀴즈

기본은 최대 3문제이며, 의미 있는 어려움이 하나면 1문제로 끝내는 것을 추천한다.
문항을 억지로 채우지 않는다. 한 화면에 2–3개 선택지와 짧은 상황 문장만 둔다.

선정 우선순위: 직전 회차의 아직 성공하지 못한 부분 → 반복된 어려움 →
도움 후 성공한 부분 → 이전 퀴즈 오답 중 관련 있는 개념.
같은 반려견의 기록만 사용한다. 다른 Lesson을 선택했더라도 직전 어려움은
‘지난 훈련: [Lesson 이름]’으로 문맥을 붙여 짧게 복습한다.
관련 문제은행이 없는 기록은 억지로 퀴즈를 생성하지 않고 유지한다.

정답이면 짧은 확인 후 다음으로 이동한다. 오답이면 올바른 행동과 이유 한 문장,
선택적인 관련 영상 구간 보기 후 다음으로 이동한다. 재시험을 강제하지 않는다.
첫 응답과 해설 열람은 따로 기록하며, 오답 개념은 다음 회차 후보로 유지한다.
해설 직후 선택을 바꿨다고 최초 정답으로 덮어쓰지 않는다.

퀴즈는 보호자가 다음 시도에서 할 행동을 묻는다. 정답을 맞혔다고 강아지의
실제 수행 문제까지 해결된 것으로 처리하지 않는다. 실제 수행이 미완료라면
퀴즈 뒤 해당 Level을 더 쉽게 재시도하고, 성공 이후 다음 Level로 이동한다.
이미 성공한 Level은 퀴즈 오답 때문에 강등하거나 다시 잠그지 않는다.

### Energy, 중단, 완료

- 퀴즈와 이어지는 실습을 합쳐 Energy 1회다. 오답이나 짧은 재시도에 추가 차감하지 않는다.
- 앱 종료/일시 중단은 같은 회차를 재개한다. 추가 Energy 없이 남은 퀴즈/Level부터 이어간다.
- 회차 시작 시 문제와 Level 계획을 고정하여 재접속 때 바뀌거나 중복 차감되지 않게 한다.
- 사용자가 회차를 명시적으로 끝내면 실제 성공한 Level만 보존한다.
  이후 새 회차는 Energy 1회로 미완료 Level부터 시작한다.
- 중간 묶음 완료는 간단한 회차 완료와 다음 범위 안내로 마무리한다.
- L5 성공은 `Level complete!` 축하와 L1–L5 영상 전체 해금으로 연결한다.
  다시보기는 무료이며 퀴즈 결과가 영상 해금이나 기존 진행도를 되돌리지 않는다.
- 퀴즈만으로 Level 성공, Checkpoint 통과, 별도 Coin 보상을 지급하지 않는다.
  회차 보상/Streak 정책과 기존 Checkpoint의 최종 역할은 후속 결정 사항이다.

### Wait at the Door 예시

| 회차 | Energy | 진행 | 다음 회차에 남길 정보 |
| --- | --- | --- | --- |
| 1 | 1 | 준비 → L1–L2 | L2에서 문손잡이를 움직일 때 강아지가 앞으로 나와 도움 요청 |
| 2 | 1 | 준비 → 해당 상황 퀴즈 → L3–L5 | 새로 어려웠던 개념 |

예시 문항: ‘문손잡이를 움직이자 강아지가 앞으로 나왔어요. 다음 시도에서는?’
정답 예: ‘손잡이 움직임을 줄여 더 쉬운 단계로 연습한다.’
실제 문항은 해당 영상/훈련 안내와 일치하는지 콘텐츠 검수 후 확정한다.
첫 회차 L2가 미완료였다면 두 번째 회차는 퀴즈 뒤 L2부터 재시도한다.

### 구현 경계

기존 Level별 training session 위에 TrainingRun(훈련 묶음)을 둔다.
TrainingRun은 dogId, skillId, bundle 정의 버전, 예정/완료 Level,
Energy 차감 식별자, phase(quiz/practice/completed), 중단 위치를 보존한다.
StruggleEvent는 실제 수행 결과와 분리하고, QuizAttempt는 연결된 어려움 ID,
문항 버전, 첫 응답, 피드백 열람, 재개 위치를 기록한다.
문제 선택은 검수된 문제은행과 결정적 규칙으로 시작한다. 실시간 생성은 필요 없다.
Energy 차감과 회차 생성은 원자적·중복 방지 방식으로 처리해야 한다.
기존 무료 Level 연속 진행 함수에도 회차 경계를 적용해야 한다.
다음 회차 계획과 과거 최고 진행도를 분리하여 재시도가 진행도를 낮추지 않게 한다.
새 DB 구조/함수 적용은 계속 보류한다. 현재 작업은 설계 문서 수정뿐이다.

---

## 2026-10-02 이전 제안 — 독립 Review 해석은 위 설계로 대체됨

사용자 결정: L5 성공 후 `Level complete!`로 축하하고 해당 Lesson의 L1–L5
영상 전체를 해금한다. 이어서 사용자가 구조 설계를 먼저 마무리하도록 요청했다.
축하/다시보기 컴포넌트 초안은 작성 중이며 실제 훈련 경로에 아직 연결하지 않았다.
구현 연결과 배포는 설계 논의 이후 이어간다. 아래 퀴즈 정책은 제안이며 확정 구현이 아니다.

### 세 가지 기록의 의미

| 기록 | 의미 | 변경 조건 |
| --- | --- | --- |
| Lesson 진행 | 보호자가 Continue로 성공 보고한 L1–L5 | 기존 훈련 결과 흐름 |
| 영상 해금 | 완료한 Lesson의 모든 영상을 자유롭게 다시 보기 | L5 성공 후 유지 |
| Review | 보호자가 훈련 원칙을 기억하는지 확인 | 짧은 3문제 퀴즈 완료 |

퀴즈 정답은 강아지 수행 성공으로 기록하지 않는다. 오답도 훈련 실패나 기존
Level 강등으로 기록하지 않는다. 기존 Checkpoint는 실제 일상 수행을 확인하는
개념이므로 퀴즈 점수로 통과 처리하지 않는다. MVP의 다음 방문 기본 추천은
3문제 Review 하나로 단순화하고, 별도 실습 Checkpoint를 유지할지와 노출 시점은
후속 설계 결정으로 남긴다. 실제 기존 서버 Checkpoint 동작은 아직 변경하지 않는다.

### 화면 연결 초안

로드맵 → 준비 → 현재 Level부터 순차 진행 → L5 성공 저장 →
Level complete! / 모든 영상 해금 → 로드맵.

완료한 노드 재방문 → 준비에서 영상 다시보기 또는 예정된 Review 진입.
Review → 1/3 → 2/3 → 3/3 → 짧은 완료 → 로드맵.
Review 중단 → 이후 남은 문제부터 재개. 3문제를 마쳐야 Review 완료로 기록.

Review는 다음 Lesson의 진입 조건으로 쓰지 않는다. 훈련 시작마다 강제 팝업으로
끼워 넣지 않고 완료한 노드와 다음 추천 영역에서 진입한다.

### 3문제 구성

1. **목표 행동**: 이 상황에서 강아지가 무엇을 하도록 돕는가?
2. **보호자의 타이밍**: 언제 보상하거나 신호를 주는가?
3. **어려울 때 대응**: 다음 시도에서 무엇을 쉽게 하거나 언제 마무리하는가?

객관식 2–3개 선택지, 한 화면 한 문제, 짧은 상황 문장. 목표 소요 시간 30–60초는
UX 가설이며 실제 사용으로 확인한다. 시간 제한/주관식/긴 해설을 넣지 않는다.
문제는 해당 Lesson에서 실제로 안내한 목표와 자막에 근거한다. 영상의 사람 이름,
색상, 장면 순서 같은 부수적인 기억을 묻지 않는다.

정답은 짧게 확인하고 Continue. 오답은 정답과 이유 한 문장을 보여주며 원할 때만
관련 영상의 해당 시간으로 이동한다. 읽고 다음으로 갈 수 있고 처음부터 재시험을
강제하지 않는다. 첫 응답의 정오답을 보존하며, 해설 후 수정한 답으로 3/3을 만들지 않는다.
총 문항 수는 끝까지 3개로 유지한다.

Wait at the Door 예시:
- 문이 열렸을 때 언제 지나가나요? → 보호자의 해제 신호 뒤.
- 기다리기를 연습할 때 보상은 어디로 주나요? → 기다리는 자리의 강아지에게.
- 문을 열자 앞으로 나왔다면 다음 연습은? → 문을 여는 폭을 줄여 더 쉬운 단계로.

### 일정과 개인화 초안

- L5 완료 다음 날 첫 Review 추천.
- 3/3 정답이면 다음 추천은 7일 뒤.
- 오답이 있으면 다음 날 그 개념을 포함한 Review 추천.
- 이 간격은 제품 초기값이며 학습 효과가 검증된 수치라는 주장이 아니다.
- 물음표를 사용한 Level의 핵심 개념을 우선 포함하되 3문제 모두 같은 내용을 묻지 않는다.
- 반복 사용에는 Lesson당 6문제 정도의 검수된 문제은행에서 범주별 1문제씩 선택.
  먼저 1-1의 6문제로 흐름을 검증한 뒤 나머지 Lesson으로 확장한다.
- 앱에서 매번 생성하는 문제 대신 버전이 있는 검수된 문항을 사용한다.

### Energy와 보상 제안

기본 Lesson 시작은 현재 Energy 규칙 유지. 해금된 영상 다시보기와 짧은 퀴즈
Review는 무료를 권장한다. 유효한 Review 1회는 그날 Streak 활동으로 인정할 수 있으나,
같은 날 반복 풀이로 보상이 누적되지 않도록 한다. Coin 지급 여부/금액은 미확정.

### 구현 경계

Question: questionId, skillId, levelNumber, concept, prompt, options,
correctOptionId, explanation, clipLevelNumber, cueAt, version.

Review run: dogId, skillId, questionIds(시작 시 3개 고정), 각 문항 첫 응답,
currentQuestionIndex, startedAt, completedAt, firstAttemptScore, nextDueAt.

동일 사용자의 여러 반려견 진행을 구분한다. 재시도/재연결로 완료·보상이 중복되지 않도록
run ID로 정산한다. Review는 기존 report_training_result(success/not_yet)를 호출해
훈련 결과를 덮어쓰지 않는다. 새 DB 저장 구조는 기존 보류 요청에 따라 아직 적용하지 않는다.

---

상태: 논의용 제안. 앱 동작과 원격 DB를 변경하지 않았다. 현재 동작 분석은
로컬 클라이언트 코드와 저장소의 최신 함수 정의 기준이며, 원격 DB 함수와의
동일성까지 이번 검토에서 확인한 것은 아니다.

## 참고한 원래 기획과 이후 결정

원문: `C:/Users/Minjae/Documents/Codex/2026-09-08/new-chat-2/work/PAWS_Adaptive_Training_Curriculum_Sections_1-6_v1.1_Button_Flow.txt`
및 각 Section Production Detail v1.1 Button Flow.

- 6개 Section은 자유 탐색. 로드맵 노드 하나는 Skill 하나.
- Skill 안의 L1–L5는 순차 진행. 완료한 Level은 재방문 가능.
- 진입 시 Resume / Review / Bridge / 현재 Level / Checkpoint를 자동 결정.
- 원래 카드: Ready → Orient → Demo → Guardian instruction/실습/결과 →
  허용된 경우 추가 실습 최대 1회 → Completion.
- L5 뒤 다른 날 Checkpoint. 어려움이 있어도 기존 진행도는 유지.
- 기초가 부족하면 관련 Skill의 짧은 Bridge를 제공하되 선행 완료를 강제하지 않음.

이후 사용자가 정한 변경이 우선한다:

- 준비는 항상 먼저. 출처, 목적, 준비물 중심의 짧은 화면.
- 실제 영상 + 클릭 가능한 자막, 0.6배속. 재생 완료 이력 후 Continue 활성 유지.
- Continue는 성공 보고. 물음표는 해당 Level에서 어려움이 있었다는 기록.
- 진입 때 Energy를 사용하고 연속 Level마다 추가로 차감하지 않음.

구버전 AI 검증 activity/quest 문서도 저장소에 남아 있지만 현재 28개 Skill의
button-flow와 별도 체계다. 이를 현재 Train의 필수 촬영/AI 심사로 해석하지 않는다.

## 현재 구현

| 항목 | 로컬 코드에서 확인한 동작 |
| --- | --- |
| 콘텐츠 | 6개 curriculum Section, 28개 Skill, 140개 Level clip. Skill별 Checkpoint는 별도 단계 |
| 로드맵 | checkpoint passed만 done. 첫 미완료 항목이 current. 다른 curriculum 항목도 선택 가능 |
| 준비 | 진입할 때 항상 표시. 시작할 대상 Level은 서버 resolver가 결정 |
| Level | Continue → success 저장 → 같은 Skill의 다음 clip이 있으면 자동 시작 |
| L5 끝 | 다음 clip이 없으면 화면 종료. 전용 lesson 완료 요약/다음 lesson 연결이 없음 |
| 도움말 | not_yet 기록 후 코치 화면. 추가 실습 허용 시 같은 세션 유지 |
| Checkpoint | 다음 날 조건 이후 별도 카드 흐름. clip 경로와 달리 Success / Not yet UI가 남아 있음 |
| Energy | 새 세션 진입 1, active resume 0, 같은 Skill의 연속 Level 0. Section 전체 1회 이용권은 아님 |
| History | Skill별 현재 Level 및 checkpoint 표시. 현재 계산은 L5 완료 후에도 4/5처럼 보일 수 있음 |
| Personal plan | 별도 generate-roadmap/day 체계. curriculum Section이 있으면 표시에서 우선되어 단일 추천 흐름이 아님 |
| 추가 주제 | Social/Walks/Tricks는 6개 curriculum 매핑 밖의 별도 day/샘플 경로 |

주요 근거:
`app/(tabs)/train.tsx`, `app/train/lesson/[skillId].tsx`,
`src/services/trainingClipFlow.ts`, `src/services/lessonCardSequence.ts`,
`app/training/history.tsx`, `src/constants/trainingCurriculumMapping.ts`.

## 권장 제품 흐름

용어는 Section → Lesson(현재 DB Skill) → Level로 통일한다. Session은 내부 기록 단위.
로드맵 노드를 140개 Level로 펼치지 않고 현재의 28개 Lesson 노드를 유지한다.

1. 로드맵은 자유 선택을 유지하고 다음 추천 하나를 강조한다.
2. Lesson을 누르면 항상 준비 화면. 시작 버튼 근처에 이번 목적만 한 줄 표시한다:
   `Level 3 of 5`, `Quick review`, `Check-in` 등.
3. 처음이면 L1, 중간이면 이어서, L5를 끝냈으면 완료 상태에 맞는 방문 화면으로 간다.
4. 영상·짧은 자막과 같은 화면에서 직접 시도한 뒤 Continue를 누르게 한다.
   재생 종료 자체는 성공이 아니고 Continue가 보호자의 성공 보고라는 원칙을 유지한다.
   별도의 긴 설명이나 결과 설문을 추가하지 않는다.
5. L1–L4 성공 후 다음 Level로 연결. 5개를 한 번에 끝내는 것은 선택이며
   중간 종료 시 다음 방문에서 이어갈 수 있다.
6. L5 성공 시 짧은 Lesson 완료 화면. `5/5 complete`와 다음 추천 Lesson을 보여준다.
   다음 Lesson은 준비 → 명시적인 시작으로 연결하며 자동으로 Energy를 차감하지 않는다.
7. Checkpoint는 다음 날 추천. 완료한 Lesson의 5/5는 유지하고 `Check-in due`를 별도로 표시.
8. Checkpoint 성공 후 주기적 복습, 어려우면 해당 부분만 복습. 전체 초기화하지 않는다.

진행률 두 가지를 분리한다:

- **학습 진행**: L1–L5 중 완료한 개수. L5 완료면 Lesson 코스는 5/5.
- **다른 날 확인/복습 상태**: Checkpoint 대기·통과·복습 필요. 코스 완료를 지우지 않음.

이는 기존의 'Checkpoint 통과만 로드맵 완료' 정책을 바꾸자는 제안이다.
제품이 검증된 숙련도라고 주장하는 표시는 Checkpoint 의미와 구분해야 한다.

## Lesson 사이 연결

같은 Section에서는 기본 순서의 다음 미완료 Lesson을 추천하되 잠그지 않는다.
Section 밖의 기초 Skill은 필요한 경우만 짧게 연결한다. 예:

- Wait at the Door에서 보호자에게 주의를 돌리기 어려움 → Name Response 기초 → 원래 Level 복귀.
- 여러 Lesson에서 보상 전달이 어려움 → marker/reward timing 기초 → 원래 Lesson 복귀.
- 실내 배변 Lesson 후 → 사고 대응 Lesson 또는 실외 배변 Lesson을 생활환경에 맞게 추천.

Bridge는 도움을 위한 선택지다. 관련 Lesson 전체 5개 Level을 다시 강제하지 않으며,
Bridge만 했다고 원래 목표나 다른 Lesson 전체를 성공 처리하지 않는다.

Personal plan은 새 커리큘럼을 별도로 생성하는 대신, 같은 Skill ID들 중 오늘 할 대상을
고르는 추천 계층으로 통합하는 것이 좋다. 추천 우선순위 초안:
진행 중인 Lesson → 미뤄진 어려운 부분/기초 복습 → 도래한 Checkpoint → 다음 새 Lesson.
사용자는 추천을 건너뛰고 다른 Lesson을 자유롭게 선택할 수 있다.

## 도움말·복습·재화

- 물음표: 어려웠던 Level과 이유 기록 → 짧은 도움 → 허용된 경우 최대 1회 추가 시도.
- 해결 후 Continue: 성공 진행. 도움을 받았던 이력은 보존해 이후 가벼운 복습 추천에 활용.
- 미해결 또는 즉시 재시도 불가: 마무리 → 대상 복습 예약. 다음 Level 자동 성공 금지.
- 유지 복습은 최초 완료/최고 진행도를 낮추지 않는다.
- 이미 완료한 영상 다시 보기는 무료, 진행·보상 중복 지급 없음이라는 정책을 권장.
- Energy는 Lesson 새 시작 단위, 내부 Level/도움/재시도/active resume 추가 차감 없음 유지.
- Streak는 그날 유효한 훈련 마무리 1회로 하루 1번 반영하는 방식을 권장.
- Coin은 완료 이벤트와 중복 방지 정책을 먼저 통합한 후 결정. 영상 재생 횟수로 지급하지 않음.

## 구현 전 해결할 코드 불일치

1. L5 완료 후 resolver가 같은 L5로 돌아오는 상태와 로드맵 current 선택을 분리.
2. Review가 due_at 대신 eligible_at만 확인한다. 30일 뒤 maintenance review를
   생성해도 즉시 선택될 가능성이 있다. 실제 적용 함수 확인 후 날짜 계약 통일 필요.
3. Checkpoint 실패 시 targeted_level_review의 level_id가 여전히 Checkpoint를 가리킨다.
   일반 Level로 내려가는 복습 대상 및 재시험 유예 규칙을 명시해야 한다.
4. 일반 Level 복습 성공 시 current_level_number를 level+1로 대입하므로 이미 높은
   진행도를 가진 경우 낮아질 수 있다. 최고 진행도와 이번 연습 대상을 분리해야 한다.
5. 추가 실습 불가 Level의 물음표는 세션을 not_yet으로 종료할 수 있는데 clip Continue는
   completed success만 이어갈 수 있다. 도움 후 복귀/마무리 UI 분기가 필요하다.
6. 성공 처리 시 review_soon이 false가 되므로 도움 요청 이력과 다음 복습 추천의 연결이 약함.
7. Energy의 사용자 날짜와 Checkpoint의 current_date/UTC 기준을 통일해야 한다.
8. 상단 Streak/Wallet 및 Personal plan과 새로운 training_sessions 완료 경로가
   같은 이벤트를 쓰는지 통합 검증 필요. 버튼 표시만으로 지급 연결을 단정할 수 없음.

서버 관련 근거:
`20260915000004_training_rpc_functions.sql`,
`20260917073000_fix_checkpoint_review_self_cancel.sql`,
`20260929165234_training_course_energy_continuation.sql`.

## 제안하는 구현 순서

1. L5 완료 요약, 5/5 표시, 다음 Lesson의 준비 화면 연결, 재방문 상태 정리.
2. 도움말 → 추가 시도/마무리 → 대상 복습 흐름과 Checkpoint UX 통일.
3. 날짜·진행도 보존·중복 방지 서버 규칙 정리 및 흐름 테스트.
4. Personal plan의 추천 통합, 하루 활동/Streak/Coin 정산 통합.

원격 DB 변경은 기존 보류 요청을 유지한다. 이번 문서는 변경 제안만 기록한다.
