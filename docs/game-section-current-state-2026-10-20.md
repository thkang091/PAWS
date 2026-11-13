# PAWS Game 섹션 현황 및 기획 전달 자료

기준일: 2026-10-20
기준 코드: `362e81e` — `Finalize Train with YouTube lessons and adaptive practice`

사용자 제공 프로젝트 상황: Train은 완료, Care는 동료가 개발 중이다. 이번 문서는 Game의 현재 상태를 정리하고 ChatGPT Pro에서 기획한 뒤 개발로 넘기기 위한 자료다.

조사 범위는 로컬 저장소의 화면, 서비스, 콘텐츠, SQL 마이그레이션, Edge Function이다. 앱을 기기에서 실행하거나 운영 DB·배포 서버를 조회한 결과는 아니다. 따라서 아래의 “구현”은 코드가 존재한다는 의미이며, 실제 서비스에서 검증됐다는 의미는 아니다.

## 1. 핵심 판단

**현재 Game은 모드 선택 화면과 일부 하위 화면, 기존 영상 인증 챌린지 및 상점 기반 코드가 준비된 단계다. 사용자가 게임을 시작해서 완료하고 보상을 받는 전체 흐름은 아직 연결되지 않았다.**

서로 다른 세 가지 게임 구상이 코드에 함께 존재한다.

1. 현재 화면: Find the Treat, Pattern Paws, Hidden Toy, Bubble Chase의 4개 게임.
2. 기존 콘텐츠: 반려견 행동 영상을 제출하고 PASS 판정을 받는 60개 챌린지.
3. 별도 경기 기반 코드: Fastest Sit, Longest Stay, Recall Race 등의 점수형 경기 정의와 참가 테이블.

기획의 첫 결정은 이 세 구조를 어떻게 사용할지다. 현재 화면의 네 게임을 실제로 만들 것인지, 기존 영상 챌린지를 중심으로 구성할 것인지, 두 종류를 명확히 나누어 제공할지 정해야 한다.

## 2. 현재 페이지 구성

| 페이지·경로 | 현재 표시 내용 | 구현 상태와 한계 |
| --- | --- | --- |
| Game 홈 — `/(tabs)/game` | “Choose your mode”, Challenge / Tournament / Duel / Lucky 카드 | 2열 일러스트 카드, 진입·누름 애니메이션, 모션 감소 대응이 있다. Challenge와 Lucky만 이동 경로가 있다. |
| Challenge — `/game/challenge` | Games 제목과 세로 진행선, 게임 4개 | 목록과 일러스트 UI가 있다. 첫 게임만 `open: true`, 나머지는 고정 잠금이다. 저장된 진행도에 따라 해금되는 구조가 아니다. |
| 공통 챌린지 상세 — `/game/[gameId]` | 설명, 촬영 안내, 참가비, 보상, 강아지 사진 준비 여부, 영상 선택, 판정 결과 | 기존 영상 인증 챌린지용 화면이다. 새 4개 게임을 플레이하는 화면은 아니다. 현재 목록과 ID가 연결되지 않는다. |
| Lucky → Shop — `/game/shop` | Pet Shop / Pet Pharmacy, 분류 필터, 상품 그리드, Gold 잔액, 장바구니와 구매 | DB 조회 및 구매 RPC 연결이 있다. Lucky라는 이름과 달리 현재 동작은 상품 상점이다. 추첨·룰렛·확률형 보상 로직은 없다. |
| 보상 상점 — `/rewards` | 쿠폰 목록, 보유 쿠폰, 구매 모달 | 별도의 기존 쿠폰 상점이다. 챌린지 PASS 화면의 “Spend Gold in Shop”은 `/game/shop`이 아니라 여기로 이동한다. |
| 아바타 상점 — `/avatar-shop` | Silver로 구매, 소유·착용 표시, 구매 확인 | 기존 구매·장착 흐름이 있다. 현재 Game 홈에서 직접 연결하지 않는다. |
| 인벤토리 — `/inventory` | 소유 아바타 아이템과 장착 상태 | 아바타용이다. `/game/shop`의 상품 배송·주문 내역 화면으로 구현된 것은 아니다. |
| Tournament / Duel | 홈 카드 | 전용 화면, 사용자 매칭, 경기 진행, 대진표, 순위표, 결과 정산 흐름은 현재 Game에서 연결되지 않았다. |

현재 Challenge 목록:

| 게임 | 표시하는 능력 | 상태 |
| --- | --- | --- |
| Find the Treat | Sniffing | “3 minutes · start here”. 탭하면 `/game/treat`로 이동한다. |
| Pattern Paws | Focus | 고정 잠금 |
| Hidden Toy | Memory | 고정 잠금 |
| Bubble Chase | Reaction | 고정 잠금 |

잠긴 항목은 경고 진동·흔들림 반응을 표시한다. 접근성 안내에는 앞 게임을 완료하면 열린다고 되어 있지만, 완료 기록이나 실제 해금 처리는 없다.

주요 근거: `app/(tabs)/game.tsx`, `app/game/challenge.tsx`, `app/game/[gameId].tsx`, `app/game/shop.tsx`, `app/rewards.tsx`.

## 3. 현재 진입이 끊기는 지점

현재 경로는 다음과 같다.

```text
Game
  ├─ Challenge
  │    ├─ Find the Treat → /game/treat
  │    │                    └─ 기존 challenge_games에서 id === "treat" 검색
  │    │                       → 저장소의 데이터·스키마 기준으로 일치 항목 없음
  │    │                       → "Challenge not found."
  │    └─ 나머지 3개 → 고정 잠금
  ├─ Tournament → 연결 경로 없음
  ├─ Duel → 연결 경로 없음
  └─ Lucky → /game/shop → Gold 상품 구매
```

상세 화면은 `getChallengeGamesForDog()`로 가져온 항목의 `id`를 그대로 비교한다.

- 로컬 콘텐츠 ID: `GAME_BH_001`, `GAME_CT_001` 등.
- 현재 SQL의 `challenge_games.id`: UUID.
- 새 목록의 ID: `treat`, `pattern`, `hidden`, `bubble`.
- 이 ID 체계 사이를 연결하는 slug·매핑 코드는 없다.

기존 로컬 카탈로그는 DB 조회가 비거나 테이블이 없으면 표시용 대체 데이터로 사용된다. 그러나 참가 RPC는 DB의 UUID와 실재 행을 요구한다. 따라서 로컬 콘텐츠가 보인다고 영상 제출과 보상이 동작하는 것은 아니다.

저장소에서는 `challenge_games` 생성과 기존 행의 판정 프롬프트 수정 SQL을 확인했다. 60개 로컬 콘텐츠 전체를 해당 UUID 테이블에 넣고 연결하는 seed는 확인되지 않았다. 실제 운영 DB의 콘텐츠는 별도 확인 대상이다.

## 4. 재사용 가능한 기존 콘텐츠와 기능

### 영상 인증 챌린지 콘텐츠 60개

`src/data/challengeGames/index.ts`에 6개 분야가 각각 10개씩 합쳐져 있다.

| 분야 | 수량 |
| --- | ---: |
| Better Behavior at Home — 집 안 생활 행동 | 10 |
| Safety and Obedience — 안전과 기본 지시 | 10 |
| Better Walks — 산책 행동 | 10 |
| Cool Tricks and Games — 트릭과 놀이 | 10 |
| Helpful Skills Around the House — 생활 보조 행동 | 10 |
| Calm Alone Time — 혼자 있는 상황의 행동 | 10 |
| 합계 | 60 |

예시: Go to Your Mat, Mat Stay Challenge, Doorway Wait, Drop the Toy, Spin Pop, Paw Tap, Nose Boop.

각 콘텐츠에는 제목·설명·난이도, 촬영 준비, 사용자 안내, 영상 길이, 관련 훈련 ID, 안전 안내, PASS/FAIL/NEEDS_REVIEW 기준, Gemini 판정 프롬프트 등이 들어 있다. 이는 콘텐츠 자산이며, 60개의 개별 플레이 화면이 구현됐다는 뜻은 아니다.

기존 서비스는 선택한 훈련 목표에 따라 챌린지를 필터링·정렬한다. 관련 훈련의 완료 여부를 조회하는 훅도 있지만 현재 상세 화면에서 선수 훈련 조건을 실제로 적용하지 않는다.

### 공통 상세·제출 화면

현재 코드에 있는 기능:

- 난이도, Silver 참가비, Gold 보상, 영상 길이, 촬영·수행·안전 안내.
- 강아지 기준 사진 `DOG_PROFILE` 보유 여부 및 Silver 잔액 확인.
- 사진이 없으면 `/train/reference-setup/DOG_PROFILE`로 안내.
- 휴대폰 라이브러리에서 영상 선택.
- 제출 행 생성 → 영상 Storage 업로드 → 참가비 RPC → Gemini 검증 함수 호출.
- PASS / FAIL / NEEDS_REVIEW별 결과, 관찰 내용, 재시도 안내.

이 경로는 직접 게임을 플레이하는 엔진이 아니라 촬영한 행동 영상을 제출하는 흐름이다. 전용 게임 세션, 타이머, 점수 계산, 라운드, 진행 저장은 새 네 게임에 대해 구현되지 않았다.

### 경기·경제 기반 코드

- `game_catalog`, `game_instances`, `game_entries`: 게임 정의, 개최 기간, 참가 기록.
- `challenge_games`, `challenge_game_attempts`, `dog_training_video_submissions`: 챌린지와 시도·제출 기록.
- `enter_game`, `start_challenge_game_attempt`, `approve_challenge_submission`: 참가·판정용 RPC.
- 지갑 원장, Gold/Silver 잔액 조회, 상품·쿠폰·아바타 구매 처리.
- 점수형 정의 5개: Fastest Sit, Longest Stay, Recall Race, Sit Repetition Challenge, Trick Combo.
- 점수형 정의에는 시간·횟수·정확도 기준, 앱 내 촬영·서버 카운트다운·상위 점수 수동 검토 요구사항이 있다.

점수형 정의와 참가용 훅이 존재해도 Tournament·Duel 화면으로 연결된 것은 아니다. 별도 Python Dog AI 백엔드에도 고가치 보상·경기 심사 관련 기반 코드가 있으나, 현재 Game 상세가 직접 호출하는 경로는 Supabase의 `verify-training-video`다.

### 기존 참가비·보상 설정

아래는 `src/config/economy.ts`의 기존 설정값이며 새 기획의 확정안이 아니다. 원격 카탈로그가 있으면 상세 화면은 DB 값을 사용한다.

| 난이도 | 참가비 Silver | 성공 보상 Gold | 표시용 보너스 XP |
| --- | ---: | ---: | ---: |
| Easy | 10 | 2 | 10 |
| Medium | 20 | 5 | 20 |
| Hard | 35 | 10 | 35 |
| Featured | 50 | 20 | 50 |

## 5. 개발 전에 반영해야 할 연결 문제

| 문제 | 코드에서 확인한 사실 | 필요한 처리 |
| --- | --- | --- |
| 새 게임 목록과 기존 상세의 불일치 | `treat` 등과 로컬 문자열 ID·DB UUID가 연결되지 않는다. | 최종 게임 구조에 맞춘 ID, 데이터, 화면 연결을 정한다. |
| 잠금·진행도 미구현 | 목록의 `open`이 고정값이다. | 완료 조건, 단계별 해금, 재도전, 저장·복구 규칙을 구현한다. |
| 참가 시도와 제출 행의 연결 누락 | 클라이언트는 `challenge_attempt_id`를 함수 요청에 보내지만, 함수가 이를 제출 행에 저장·연결하지 않는다. 보상 RPC는 제출 행에 저장된 ID가 있어야 지급한다. | 시도·영상·판정·보상이 한 기록으로 연결되어야 한다. 현재 경로에서는 PASS 표시와 실제 Gold 지급이 어긋날 수 있다. |
| 보상 화면의 수치와 실제 지급 불일치 | 클라이언트는 PASS만 보고 시도에 적힌 Gold·XP를 보상으로 표시한다. 조사한 승인 RPC에는 Gold 지급 분기만 있고 XP 지급은 없다. | 지급 결과를 서버에서 반환하고 화면·지갑을 그 결과에 맞춘다. |
| 무료 재제출 문구와 동작 불일치 | NEEDS_REVIEW 화면은 추가 Silver 없이 재제출한다고 안내한다. 재시도는 새 시도 생성·과금 함수를 다시 실행한다. 무료 재제출 잔여 필드는 있지만 이 흐름에서 사용하지 않는다. | 같은 시도의 재제출·횟수 관리·차감 규칙을 정한다. |
| 사진 대조 안내와 모델 입력 불일치 | UI는 강아지 기준 사진이 필요하다고 설명하지만 현재 Gemini 호출에는 텍스트와 영상만 전달한다. | 기준 사진을 실제로 전달·검증하거나 안내와 참여 조건을 최종 방식에 맞춘다. |
| 오류·중단 복구 미완성 | 업로드 후 과금·검증으로 이어지며 검증 오류 시 자동 환불·이어하기 흐름이 없다. | 오류 단계별 재시도, 중복 방지, 환불 여부, 앱 재실행 후 상태 복원을 설계한다. |
| 두 Gold 상점의 동선 분리 | 홈 Lucky는 상품 상점, PASS 화면은 쿠폰 상점으로 연결된다. | 상점 역할과 이름, 보상 사용처를 통일한다. |
| 상점 구매 완료와 배송의 차이 | 구매 RPC는 Gold 차감과 `shop_purchases` 기록을 만든다. UI는 “Bought. It is on its way.”라고 표시하지만 이 흐름에 배송지·주문 추적·실제 배송 연동은 없다. | 실제 상품, 제휴 쿠폰, 앱 내 아이템 중 판매 대상을 확정하고 완료 안내를 맞춘다. |
| 장바구니 일부 성공 가능 | 상품별 RPC를 순서대로 호출한다. 후속 상품 구매가 실패해도 앞선 구매가 되돌아가는 장바구니 단위 처리는 없다. | 일괄 구매 또는 부분 성공·재시도 규칙을 구현한다. |

추가로 상점의 “See all” 버튼은 빈 핸들러다. 상품 수량을 늘리는 기능은 있으나 사용자에게 수량 감소·개별 삭제를 제공하는 장바구니 편집 화면은 확인되지 않았다.

상점에는 상품 8개, 쿠폰 20개, 아바타 8개의 seed가 있다. 이는 실제 공급업체 계약·배송·쿠폰 사용 연동을 증명하지 않는다.

## 6. ChatGPT Pro 기획에서 결정할 항목

1. **Game의 목적과 사용자 행동**
   - 보호자가 앱 안내를 보며 반려견과 실제로 노는가?
   - 보호자가 화면 안에서 플레이하는 미니게임인가?
   - 반려견 행동을 촬영해 인증하는 챌린지인가?
   - Train과 어떤 경험 차이를 만들 것인가?
2. **첫 출시 범위**
   - 4개 모드를 모두 노출할지, Challenge부터 출시할지.
   - 네 게임 중 첫 출시 게임 수와 각 게임의 규칙·완료 조건.
   - Tournament·Duel의 필요 시점 및 실시간/비동기 방식.
3. **검증과 기록**
   - 자기 완료 체크, 앱 기록, 영상 AI, 수동 검토 중 어떤 방식을 쓸지.
   - 점수, 별, 개인 최고 기록, 일일 목표, 단계 해금 중 필요한 것.
   - 영상 AI를 쓴다면 업로드 부담·판정 대기·불명확 판정 경험.
4. **보상 경제**
   - 무료 연습과 유료 참가를 나눌지.
   - Silver·Gold·XP를 언제, 얼마나, 몇 번 지급할지.
   - 실패·중단·판정 오류·재제출 시 참가비 처리.
   - 반복 성공과 같은 영상 재제출의 보상 규칙.
5. **Lucky와 상점의 역할**
   - Lucky를 Shop으로 명확히 바꿀지, 다른 별도 기능으로 기획할지.
   - 상품·쿠폰·아바타 중 첫 출시 보상 사용처.
   - Care의 Pharmacy와 Game 상점에 중복된 영역의 담당 경계.
6. **개발 전달 수준**
   - 화면 목록, 화면별 요소·문구·버튼·이동 대상.
   - 시작→진행→완료→기록→보상→다시 하기 전체 흐름.
   - 로딩·빈 데이터·잠금·실패·중단·재접속 상태.
   - 저장 데이터, 완료 조건, 검증 가능한 수용 기준.

## 7. 권장 개발 순서 — 제안, 확정 아님

**첫 단계:** Game의 핵심 경험을 하나로 정하고 첫 게임 한 개의 완결된 흐름을 만든다.

완료 기준은 “선택 → 규칙 확인 → 실제 수행/플레이 → 완료 판정 → 기록 저장 → 보상 반영 → 재방문”이 모두 이어지는 것이다. 현재 카드를 몇 개 더 만드는 것만으로는 달성되지 않는다.

**다음 단계:** 같은 구조로 나머지 솔로 콘텐츠, 실제 진행도·해금, 개인 기록을 확장한다. 기존 60개 영상 챌린지는 선택한 경험과 맞는 것부터 재사용한다.

**그다음:** 보상 사용처를 정리하고 오류·재시도·재접속 처리를 마무리한다. 상품 구매가 첫 출시 핵심이라면 이 작업은 첫 단계에 포함한다.

**후속 단계:** Tournament·Duel은 경쟁 규칙, 매칭, 마감 시간, 점수 검증, 순위, 동점, 보상 정산, 이탈 처리를 별도 범위로 개발한다.

## 8. ChatGPT Pro에 전달할 프롬프트

아래 프롬프트와 이 문서를 함께 전달한다.

```text
PAWS는 iOS 중심 Expo React Native 반려견 앱이며 Train / Care / Game / Profile 탭이 있다.
Train은 개발을 마쳤고 Care는 동료가 개발 중이다. 이제 Game을 기획해서 개발에 넘기려고 한다.
첨부한 “Game 섹션 현황”을 먼저 읽고, 확인된 구현 사실과 새 제안을 구분해서 답해 줘.

현재 Game 홈에는 Challenge, Tournament, Duel, Lucky가 있다.
Challenge에는 Find the Treat, Pattern Paws, Hidden Toy, Bubble Chase 목록 UI가 있으나 실제 플레이와 진행 저장은 없다.
기존 영상 인증 챌린지 콘텐츠 60개, 공통 영상 제출 화면, Silver/Gold 지갑과 상점 코드가 별도로 존재한다.
현재 목록과 상세의 ID가 연결되지 않으며, 과금·재제출·보상 처리에도 미완성 부분이 있다.
Lucky는 현재 Gold 상품 상점으로 연결된다.

다음 순서로 기획해 줘.
1. Train과 차별되는 Game의 핵심 목적과 반복 사용 동기.
2. 보호자 안내형 실제 놀이 / 화면 내 미니게임 / 영상 인증 챌린지의 적합성 비교와 추천안.
3. 첫 출시 범위와 후속 출시 범위. 기존 4개 모드를 유지해야 한다고 가정하지 말 것.
4. 첫 게임 하나의 구체적인 규칙, 준비물, 진행, 성공·실패·중단·다시 하기 흐름.
5. 화면 목록과 각 화면의 요소, 버튼, 문구, 이동 경로, 상태별 UX.
6. 기록·진행도·해금·개인 최고 기록의 필요 여부와 저장 규칙.
7. Silver/Gold/XP 보상, 반복 보상 제한, 재제출·환불·중복 처리 정책.
8. Lucky/Shop, 쿠폰, 아바타의 역할과 Care 개발 범위와의 경계.
9. 재사용할 기존 코드·콘텐츠와 새로 개발할 기능.
10. 개발자가 바로 작업할 수 있는 우선순위, 데이터 요구사항, 수용 기준.

처음부터 Tournament와 Duel 모두의 완성을 전제로 범위를 키우지 말고,
먼저 한 개 게임의 시작부터 기록·보상까지 완결되는 MVP를 제안해 줘.
현재 미연결인 기능을 완료된 것으로 가정하지 말고,
아직 정하지 않은 사항은 가정 또는 결정 필요 항목으로 표시해 줘.
기획 산출물은 한국어로, 실제 앱의 UI 문구는 영어로 작성해 줘.
```

## 9. 주요 개발 파일

| 영역 | 파일 |
| --- | --- |
| 모드 선택 | `app/(tabs)/game.tsx` |
| 새 4개 게임 목록 | `app/game/challenge.tsx` |
| 기존 영상 챌린지 상세·결과 | `app/game/[gameId].tsx` |
| Gold 상품 상점 | `app/game/shop.tsx` |
| 쿠폰 상점 | `app/rewards.tsx` |
| 아바타 상점·소유함 | `app/avatar-shop.tsx`, `app/inventory.tsx` |
| Game 일러스트 | `src/features/game/components/` |
| 챌린지 콘텐츠 | `src/data/challengeGames/` |
| 조회·참가·제출 | `src/services/gameService.ts` |
| 게임 데이터 훅 | `src/hooks/useGameCatalog.ts`, `src/hooks/useGameInstances.ts` |
| 상품 조회·구매 | `src/services/shopService.ts`, `src/hooks/useShopItems.ts` |
| 참가비·보상 설정 | `src/config/economy.ts` |
| 점수형 경기 정의 | `src/config/gameDefinitions.ts` |
| 영상 AI 판정 | `supabase/functions/verify-training-video/index.ts` |
| 게임 테이블·참가·판정 RPC | `supabase/migrations/20260917082000_games_schema.sql` |
| 상점·쿠폰·아바타 테이블과 RPC | `supabase/migrations/20260917083000_shop_schema.sql` |
| 상품·쿠폰·아바타·점수형 게임 seed | `supabase/migrations/20260917085000_seed_shop_coupons_avatar_game_catalog.sql` |

## 10. 검증 범위

- 현재 라우트와 해당 화면이 참조하는 서비스·콘텐츠·서버 코드를 대조했다.
- 60개 로컬 챌린지 정의를 파일별로 집계했다.
- 기존 챌린지 콘텐츠 테스트 3개 파일, 총 20개 테스트가 통과했다. 대상은 Better Behavior at Home, Better Walks, Helpful Skills Around the House이며 콘텐츠·참조·판정 프롬프트 검증이다. 게임 진입·과금·보상의 전체 흐름을 검증하는 테스트는 아니다.
- 실제 앱 클릭, 운영 DB 데이터, 배포 함수, Gemini 응답, 실물 보상 이행은 이번 조사에서 검증하지 않았다.
- 앱 기능 및 Train·Care 코드는 변경하지 않았다.
