# Solo 영상 판독 연결 설계안

작성: 2026-10-28. 상태: **설계 제안 / 기능 구현 전**.

이번 작업은 코드·Git 이력 조사와 설계 문서/구조도 작성이다. 앱 기능, DB, 배포, AI 호출은 변경하거나 실행하지 않았다.

후속 UI 변경: 같은 날 사용자 요청으로 Solo 준비·카운트다운·경기를 전체 화면 카메라 UI로 통합했다. 휴대폰 카메라 프리뷰는 연결했으나 녹화·AI·저장 설계는 여전히 구현 전이다. 현재 UI는 [전체 화면 카메라 변경 기록](./game-solo-camera-ui-2026-10-28.md)을 따른다.

## 1. 권장 방향

**Expo Camera + Supabase + 기존 Gemini API 호출 방식을 유지하고, Solo 전용 시도·영상·판독·점수 저장 계약을 추가한다.** 과거 Challenge의 훈련 성공/실패·참가비·보상 계약을 새 시간 게임에 직접 연결하지 않는다.

- 1차 범위: Solo 3종의 앱 내 녹화, 영상 확인, 실제 AI 판독, 결과·개인 기록 저장, 실패/재시도/복구.
- 출시 순서는 Longest Sit 한 종으로 실제 영상 측정을 검증한 뒤 같은 기반에 Combo와 Spot Sprint를 연결한다. 세 게임의 설계는 함께 준비한다.
- 첫 버전은 개인 기록 중심으로 제안한다. 참가비·Gold·XP는 별도 정책 확정 후 연결한다. 현재 새 UI도 이 값을 쓰지 않는다.
- Duel의 방/동기화는 후속 범위, Tournament는 현재 잠금을 유지한다.
- Train/Care의 저장 계약과 기존 AI endpoint는 그대로 두고 Game endpoint를 추가한다.

[제안 구조도](./solo-ai-architecture.proposed.html). 도식은 제출부터 결과 조회까지의 주 흐름을 나타낸다. Storage가 API를 호출하는 것은 아니며, 업로드 완료 후 앱이 제출 API를 호출한다. `판독 작업 실행`과 `서버 검증·점수 계산`은 같은 worker 내부의 단계다. 녹화 전 attempt 발급은 아래 상세 흐름을 따른다. 본문은 한국어이며 구조도의 고정 Viewer UI와 HTML 언어 설정은 영어 fallback이다.

## 2. 비교 기준과 확인 범위

| 기준 | 커밋 / 범위 |
|---|---|
| 요청한 변경점 | `6e6e0584b2803b225a6a562defd2164e89fb4257` — Major PAWS app update, 2026-09-28 |
| 구버전 | 바로 이전 부모 `180167c3cd53797317632d97654f9d60872a1335` (`6e6e058^`) — Initial PAWS setup, 2026-06-22 |
| 현재 | HEAD `362e81e` + 작업 트리의 새 Game UI |

구버전은 Git 객체를 읽어 확인했다. 체크아웃/리셋하지 않았다. 아래 역사 코드의 줄 번호는 `180167c3` 기준이며 현재 파일의 줄 번호와 다를 수 있다.

배포 상태는 별개다. 현재 앱 설정의 Supabase 프로젝트는 연결 도구 목록의 동명 PAWS 프로젝트와 다르다. 실제 앱 프로젝트에 대한 함수 목록 조회는 권한 부족으로 거절되었다. 따라서 **현재 배포 함수·DB·Gemini secret의 유효성은 미확인**이며, 동명 프로젝트의 상태를 실제 앱의 상태로 해석하지 않는다. 비밀값은 출력하지 않았다.

## 3. 구버전, 현재 코드, 제안 구조 비교

| 항목 | `6e6e058^` 구버전 | 현재 저장소 / 새 UI | 권장 구조 |
|---|---|---|---|
| Game 영상 입력 | 갤러리 영상 선택 | legacy 경로는 동일, 새 Solo는 카메라 자리표시자 | Solo 화면 안에서 실제 녹화·재생 |
| 실제 카메라 코드 | 별도 Activity 화면의 Expo Camera | 해당 패턴이 남아 있음 | 권한·준비·녹화·파일 처리 패턴 재사용 |
| 주 AI 경로 | Supabase Edge → Gemini | 간소화된 `verify-training-video`가 남아 있음 | Game 전용 endpoint + Gemini adapter |
| 다른 AI 경로 | Python 포즈/분류기 경로 | 코드 존재, 게임 점수 확정은 미구현 | 이번 1차 연결에는 사용하지 않음 |
| AI 결과 | PASS / FAIL / NEEDS_REVIEW와 관찰 | 현재 Edge도 시간 측정 필드 없음 | 동작 구간·순서·품질 근거 → 서버 점수 계산 |
| 점수 | 새 Solo 3종의 시간 점수 없음 | 예시 점수, URL의 elapsed는 화면 표시용 | 영상 시간축으로 계산한 서버 결과 |
| 저장 | 훈련 submission/result/progress와 Challenge 보상 혼합 | 새 UI는 저장 없음 | Game 시도/제출/결과/작업 상태 분리 |
| 재시도 | 다시 제출할 때 새 요청키·새 attempt | legacy 서비스의 같은 패턴 유지 | 통신 재시도는 동일 ID, 새 플레이는 새 attempt |
| 보상 | Silver 차감, PASS 시 Gold/XP 안내 | 연결·정산 불일치가 남아 있음 | 첫 버전은 기록만, 경제 정책은 별도 |

실제 기록: 구버전 `app/game/[gameId].tsx:75`, `src/services/gameService.ts:180`, `app/activity/[activityId].tsx:158`, `supabase/functions/verify-training-video/index.ts:189`.

현재 주요 코드: `src/features/game/flow/GameSessionScreen.tsx`, `GameReviewScreens.tsx`, `gameFlow.ts`; `src/services/gameService.ts:180`; `supabase/functions/verify-training-video/index.ts:114`.

### 그대로 재연결하면 안 되는 이유

1. **시도와 제출의 연결 누락(현재).** 클라이언트는 submission을 만든 뒤 attempt를 생성한다. `challenge_attempt_id`는 함수 요청에만 들어가며 현재 Edge는 이를 저장하지 않는다. 승인 SQL은 submission에 연결된 attempt가 있을 때만 보상한다. 앱은 실제 지급 확인 없이 PASS와 예정 보상액으로 안내한다.
   - `src/services/gameService.ts:195,226,251`
   - `supabase/functions/verify-training-video/index.ts:167,238`
   - `supabase/migrations/20260917082000_games_schema.sql:295`
2. **시간 점수 계약 부재(구/현재).** 실제 schema는 성공 여부와 문장 위주다. 프롬프트에 timestamps를 써도 구조화된 연속 구간/완료 시각이 생기지 않는다. 현재 Edge는 별도 Zod schema/normalizer도 호출하지 않는다.
   - 현재 Edge `:88,115`; `src/validation/verificationSchema.ts:32`; `src/services/verificationNormalizer.ts:37`
3. **훈련용 테이블과 게임의 충돌(구버전).** Challenge 결과를 쓰는 result/progress 테이블에는 training catalog FK가 남아 있었다. submission의 FK만 제거되어 Challenge-only ID의 저장이 실패할 수 있다. 과거 문서가 있다고 완성된 게임 저장 구조가 있는 것은 아니다.
   - 구 Edge `:277–347`; 구 migrations `0023_catalog_schema_v2.sql:53`, `0021_training_extended_schema.sql:77`, `0035_drop_submissions_activity_fkey.sql:1`
4. **재시도·중단 복구 취약(구/현재).** 매 호출 새 요청키, upload 이후 차감, 응답 유실 시 같은 작업 재개 부재. 현재 processing은 원자적 작업 선점이 아니므로 AI 중복 호출도 가능하다.
   - 현재 `serviceUtils.ts:244`, `gameService.ts:226`, Edge `:195,209`
5. **Python은 다른 프로젝트 수준의 복구가 필요하다.** 게임 score endpoint는 `not_implemented`, Sit의 stable duration은 마지막 프레임 구간 길이로 계산되어 연속 착석 기록이 아니다. 분석 요청 인증·저장 실패 처리도 별도 보완이 필요하다.
   - `paws-dog-ai/app/main.py:560,720`; `app/classifiers/sit_classifier.py:125`; `app/services/verification_persistence_service.py:25`

기존 `paws-real-gemini-verification-contract.md`와 `ai-verification-production-runbook.md`는 서로 다른 파이프라인을 설명하며 현재 Edge 구현과도 다르다. 이번 문서는 해당 문서를 그대로 구현 사실로 취급하지 않는다.

## 4. 권장 사용자 흐름과 책임

| 순서 / 화면 | 동작 | 실제 데이터·책임 |
|---|---|---|
| 1. 게임 선택·설명 | 규칙, 시간 상한, 준비물 확인 | 버전이 있는 게임 규칙 읽기 |
| 2. 준비 | 카메라 권한·프리뷰, 강아지/목표 확인 | 서버가 owner/dog를 확인하고 attempt·submission 발급; 규칙·명령 순서 고정 |
| 3. 녹화 | 준비 후 실제 파일 녹화, 시작/종료 안내 | 로컬 파일·capture metadata 보관. 화면 타이머는 최종 점수가 아님 |
| 4. 영상 확인 | 실제 재생, 다시 촬영 / AI 판독하기 | 재촬영은 기존 미제출 capture를 폐기. 제출 전에는 AI 호출 없음 |
| 5. 업로드 | 실제 업로드 진행률, 전송 재시도 | 비공개 bucket의 서버 지정 경로. 같은 제출의 전송 재시도는 같은 ID |
| 6. 판독 | 제출 완료 → 판독 대기 → 분석 중 | 서버가 영상·규칙 관계 확인 후 durable job 등록. 앱을 닫아도 작업은 서버 상태로 복구 |
| 7. 결과 | 측정 기록·판정 근거·다시 플레이 | 서버에 확정 저장된 결과를 ID로 조회. 성공 화면은 저장 완료 후에만 표시 |
| 8. 기록 | 최근 기록·비교 가능한 개인 최고 | 같은 dog/game/rules/설정 그룹의 유효 결과만 비교 |

라우트에는 `attemptId`/`submissionId`만 전달한다. URI, AI 결과, score를 URL 값에서 신뢰하지 않는다. session 상태와 로컬 파일 경로는 전용 store에 보관하고, 파일을 임시 cache에서 재시도 가능한 앱 저장 위치로 옮긴다. 앱 재진입 시 진행 중 시도를 조회한다.

카메라 권한 거부·mount 실패는 준비 화면에서 처리한다. 녹화 중 백그라운드 이동/전화 중단은 해당 촬영을 interrupted로 표시하며 조용히 유효 기록으로 제출하지 않는다. 이미 제출한 이후의 앱 종료는 서버 작업을 취소하지 않는다.

## 5. 게임별 판정 규칙 제안

다음 수치는 **초기 검증용 규칙**이며 실제 영상 평가 후 `rulesVersion`에 고정한다. 모델의 confidence 숫자 하나를 정확도 보증으로 쓰지 않는다.

| 게임 | 시작·끝·점수 | 불명확하거나 미완료인 경우 |
|---|---|---|
| Longest Sit | 서 있는 시작 자세를 영상으로 확인하고 **처음 앉은 한 번의 연속 구간** 측정. 착석을 1초 확인한 뒤 시작 시각을 최초 착석으로 되돌린다. 일어나거나 다른 자세로 전환한 첫 시점까지의 길이. 다시 앉은 구간은 합산하지 않는다. | 시작부터 앉아 있어 시작 경계가 없거나 경계가 가려지면 측정 불가. 녹화 종료까지 앉아 있으면 관측된 하한값과 `capped=true` 기록, “최소 N초 유지”로 표시 |
| Random Trick Combo | 서버가 선택한 3개 명령의 순서를 고정. 영상 속 시작 신호부터 마지막 동작의 완료까지. 각 동작 완료와 순서를 따로 확인한다. | 순서 위반/명령 미완료는 유효한 미완료 결과; 신호·동작이 안 보이면 측정 불가 |
| Spot Sprint | 프리뷰에서 목표 영역 지정, 출발 시 목표 밖에 있는지 확인. 영상 속 시작 신호부터 목표 위에 앉은 시점까지. 1초 안정 확인 후 최초 유효 착석으로 끝 시각을 되돌린다. | 출발·목표·전체 경로가 불명확하면 측정 불가. 이미 목표 위에서 시작한 영상은 유효 기록으로 만들지 않음 |

Longest Sit은 반응 속도를 재지 않으므로 GO 신호의 정확한 시각에 의존하지 않는다. 서 있는 시작과 첫 착석 전환이 기준이다. 자세 변화 확인에 필요한 최소 지속시간은 검증 영상으로 조정하며, 실제 자세 이탈을 짧다는 이유로 무조건 이어 붙이지 않는다.

Combo는 현재의 `Next command` 버튼을 없애고 시작 신호 이후 세 명령을 한 번에 보여주는 구성을 권한다. 촬영 중 휴대폰을 누르는 동작을 줄일 수 있으며, 버튼을 누른 시각을 수행 완료로 오인하지 않는다. 첫 버전은 Sit/Paw/Spin의 순서 무작위화로 제한하고, 사용자가 세 동작을 익혔음을 확인한다. 향후 명령 풀을 늘릴 때 규칙 버전도 바꾼다.

Combo의 동작은 GO 이후 새로 수행한 것만 인정한다. 초기 완료 기준은 Sit=명확한 착석을 1초 확인, Paw=한쪽 앞발을 들어 보호자 손과 접촉한 한 번의 동작, Spin=몸이 한 바퀴 회전해 출발 방향으로 돌아온 한 번의 동작으로 제안한다. Paw/Spin에 Sit과 같은 1초 정지 조건을 일괄 적용하지 않는다. 첫 명령과 같은 자세로 이미 멈춰 있던 경우 새 수행이 관측되지 않으면 완료로 세지 않는다. 이 기준은 준비 화면의 짧은 안내와 AI/서버 규칙에 동일하게 반영한다.

Spot Sprint의 Mat/Low platform 선택만으로 대상 식별은 충분하지 않다. 프리뷰의 목표 영역과 기준 이미지를 함께 보관한다. 촬영 도중 카메라 이동·여러 유사 목표로 대상이 모호하면 재촬영을 안내한다. 목표물/배치가 다른 기록을 공정한 순위로 비교하지 않는다. 초기 기록은 개인용이며 목표 설정을 함께 표시한다.

### 영상 시간축이 핵심이다

- 저장소의 Expo Camera 버전은 `recordAsync()`가 끝난 뒤 URI를 반환한다. 설치 타입에는 최신 문서에 보이는 `onRecordingProgress`가 없다. `recordAsync()` 호출 직전의 JS 시각을 영상 0초로 단정하지 않는다.
- Combo/Spot은 녹화가 준비된 뒤 카운트다운·시작 신호를 내보내고, **영상에 실제 담긴 시작 신호**를 기준으로 한다. 음성/효과음 표식과 단조 시계 이벤트를 함께 기록하되, JS 이벤트는 보조 검증값이다.
- 앱의 소리가 해당 기기의 녹음에 실제 포착되는지 iOS/Android 파일로 먼저 검증한다. 이 조건을 충족하지 못하면 native recorder 시각 연동 등 캡처 방식을 보완해야 한다. 동기화를 확인하기 전 Combo/Spot의 시간을 확정 기록으로 출시하지 않는다.
- Longest Sit은 이 동기화 문제 없이 먼저 전체 파이프라인을 검증할 수 있다.
- AI는 동작·시작/끝 구간을 반환하고, 서버가 시간 범위·순서·길이·가림·규칙을 검사한 뒤 계산한다. `elapsed`나 모델이 제안한 최종 점수를 그대로 저장하지 않는다.

Gemini 기본 영상 샘플링은 1 FPS이므로 빠른 동작 경계가 빠질 수 있다. 초기 평가에서는 지원되는 custom FPS(예: 4 FPS)를 실험하되 FPS만으로 정확도를 보장하지 않는다. 결과에는 내부 ms와 경계 불확실성·model/prompt/rules version을 저장하고, 첫 UI는 초 단위 추정 기록을 보여준다. 0.1초 경쟁 순위는 실제 오차 검증 이후 범위다. [Google 영상 이해 문서](https://ai.google.dev/gemini-api/docs/video-understanding)

## 6. 저장 모델과 API 경계

새 이름은 제안이며 migration은 아직 만들지 않았다.

| 테이블 | 핵심 데이터 / 제약 |
|---|---|
| `game_play_attempts` | owner, dog, game, mode=solo, rules_version, config_snapshot(sequence/target/limit), client_request_key, retry_of, status. 서버가 규칙을 고정 |
| `game_video_submissions` | attempt, capture_id, 고정 storage_path, MIME/실측 duration/size/hash, capture metadata, upload 상태. attempt당 제출된 영상은 하나 |
| `game_verification_jobs` | submission, stage, queued/running/retry_wait/completed/error, lease_token/lease_until, next_run_at, retry_count, provider file ID, 검증된 AI response checkpoint |
| `game_verification_results` | attempt UNIQUE, submission UNIQUE, outcome, score_ms nullable, capped, uncertainty/evidence, model/prompt/rules versions, created_at. 서버만 쓰기 |

최고 기록은 결과에서 조회한다. 초기에는 별도 leaderboard/집계 테이블 없이 동일 조건의 최근 기록과 최고 기록을 계산한다. Combo는 동일 명령 구성/순서를 비교 키에 포함하며 규칙 변경 전후 기록을 무조건 합치지 않는다. Longest Sit의 `capped` 값은 정확한 최종 지속시간으로 취급하지 않고 하한값임을 유지한다.

API 제안:

1. `prepare-game-attempt`: 인증 사용자와 dog 소유권 검증, 규칙·순서 고정, stable request key로 attempt/submission과 업로드 경로 반환.
2. `submit-game-attempt`: ID로 서버 관계를 조회, 업로드된 객체 확인, submission 잠금 + job 등록을 같은 DB transaction으로 처리. 동일 요청은 기존 상태를 반환.
3. `get-game-attempt`: 소유자에게 진행 상태 또는 저장된 결과 반환. 앱은 일정 간격 polling하고 다시 열 때 재조회.
4. 내부 `process-game-verification`: 제한된 시간 동안 작업 선점 → 파일 준비 → Gemini 상태 확인 → 판독 → 검증 → 결과 확정.
5. 내부 `finalize_game_result`: attempt 잠금, unique 제약과 job lease token 검사, 결과 저장·attempt 완료·job 완료를 원자적으로 확정. 실패하면 “저장 완료”를 반환하지 않음.

클라이언트는 owner ID·점수·보상·임의 storage_path를 정하는 권한을 가지지 않는다. endpoint는 인증에서 owner를 얻고 attempt→dog→submission→object의 연결을 검증한다. result/job 테이블은 클라이언트 직접 쓰기를 금지한다. 내부 확정 함수의 실행 권한은 PUBLIC/anon/authenticated에서 명시적으로 제거한다.

### 영상 저장

현재 private Storage 기술은 재사용하되 **Game 전용 비공개 bucket**을 권한다. 기존 bucket에는 owner UPDATE 정책이 있어 DB 행만 고정해도 영상 교체가 가능하기 때문이다.

- 서버 지정 `{user}/{attempt}/{submission}/clip` 경로에 최초 업로드만 허용. 클라이언트 overwrite/update는 금지하고 삭제는 서버의 취소/정리 경로로 처리한다.
- 제출된 객체를 불변으로 고정한 다음 metadata/hash와 묶어 판독한다. TUS 재개는 같은 업로드를 이어가는 것이며 기존 완료 객체를 덮어쓰지 않는다.
- 720p, 최대 120초 플레이를 초기 상한으로 제안. 사전 녹화 구간은 별도 metadata로 구분한다. 기기 bitrate는 목표 약 3 Mbps, 파일 상한 약 60 MiB를 검증 후보로 두며 실제 기기에서 초과/조기 종료를 처리한다.
- 파일 크기 제한은 client/server가 같은 byte 상수를 사용한다. 120초는 플레이 창이며 사전 3초 녹화를 쓰는 게임의 파일 제한은 이를 포함해 별도로 계산한다. Longest Sit의 관측 유지 시간은 첫 착석이 늦을수록 짧아지므로 상한 종료를 무조건 120초 기록으로 만들지 않는다.
- MIME·파일 크기·컨테이너 duration은 서버에서 확인한다. `fileSize=undefined` 또는 client duration만으로 통과시키지 않는다. MP4/MOV metadata 파서와 streaming 전달의 Edge 자원 사용도 첫 기술 검증 대상이다.
- 영상은 전체 Blob/base64 복사를 기본 경로로 삼지 않는다. 재개 가능한 업로드와 진행률을 사용하고, 서버는 Gemini Files API로 전달한 파일 참조를 사용한다. [Supabase TUS](https://supabase.com/docs/guides/storage/uploads/resumable-uploads), [Gemini 파일 입력](https://ai.google.dev/gemini-api/docs/video-understanding)
- 원본 영상은 예를 들어 7일 보관 후 삭제하고 점수·근거 기록은 유지하는 정책을 제안한다. 이는 제품 정책 확정 전 기본안이다. 사용자가 “판독하기”를 누르기 전에 AI 분석용 전송을 짧게 안내한다.

## 7. AI 계약, 작업 복구, 실패 처리

AI 출력은 작은 versioned schema로 제한한다: `quality`, `observations[]`(종류·시작/끝·경계 불확실성·근거), `missingEvidence`, `reasonCodes`. 명령 순서·목표·규칙은 서버 snapshot을 프롬프트에 전달한다. 모델이 만든 activity/attempt ID는 권한 판단에 쓰지 않는다. 현재 Gemini transport와 인증 패턴을 활용하되 새 schema·normalizer를 서버에서도 실제 실행한다.

현재 코드의 기본 모델은 `gemini-2.5-flash`다. 이것을 비교 기준으로 삼되 실제 프로젝트의 모델 가용성을 확인하고 영상 평가 결과로 고정한다. 기능 연결을 이유로 모델을 자동 변경하지 않는다. 다른 모델로 바꾸면 기존 기록과의 측정 차이도 평가한다.

최종 결과의 의미:

- `scored`: 충분한 근거가 있고 규칙에 맞는 기록. 서버가 score 계산.
- `not_completed`: 영상은 판단 가능하지만 목표 미완료/순서 위반. 점수 없음.
- `unscorable`: 가림·신호 누락·불명확한 시간 경계 등. 점수 없음, 구체적인 재촬영 안내. 운영자 수동 검토가 자동 예약됐다는 뜻이 아니다.
- 기술 오류는 job의 `error`이며 게임 실패와 분리한다. 가짜 점수나 0점으로 저장하지 않는다.

재시도와 복구:

- 앱 요청 재전송: 같은 request key/attempt/submission. 같은 결과가 있으면 그대로 반환.
- 제출 전 다시 촬영: 이전 draft capture 폐기, 새 capture/submission 경로. 업로드·판독된 영상 교체 금지.
- 제출 후 다시 플레이: 새 attempt (`retry_of`로 이전 연결). 이전 결과를 덮어쓰지 않음.
- 서버 작업: DB 작업 행을 원자적으로 선점하고 lease token으로 중복 worker의 확정을 차단. 만료된 작업은 scheduler가 재개한다.
- 모든 checkpoint/확정 쓰기에 현재 lease token을 대조하고, provider timeout은 lease 기간보다 짧게 둔다. 만료된 worker의 뒤늦은 응답은 새 worker의 상태를 덮어쓰지 못한다.
- provider 파일 processing의 정상 poll은 오류 retry 수에 포함하지 않는다. 전체 처리 deadline과 stage별 timeout을 둔다. 일시 오류의 backoff 재시도는 초기 최대 3회로 제한하고, 잘못된 입력은 재시도하지 않는다.
- Gemini 응답을 저장한 후 DB 확정이 실패했다면 저장된 응답으로 확정을 재시도한다. 다만 provider 응답 직후 DB 저장 전 서버가 죽은 경우까지 외부 AI 호출 exactly-once를 보장할 수는 없다. 결과 확정은 unique 제약으로 한 번만 허용한다.
- raw 응답과 schema/의미 검증을 마친 evidence를 분리해 보관한다. 수동 “판독 재시도”도 기존 제출을 복구하며 새 플레이/재촬영 버튼과 구분한다. provider 파일 업로드 후 ID 저장 전에 중단되는 orphan도 만료/정리 대상으로 관리한다.
- 구현 규모는 Postgres job 테이블 + 예정된 Edge consumer 정도로 제한한다. 기존 queue extension이 실제 프로젝트에 확인되면 이를 활용할 수 있다. 별도 Redis/Python 모델 서버는 첫 단계에 요구하지 않는다.
- 업로드·파일 준비·분석·확정을 짧은 단계로 나누고 상태를 저장한다. `waitUntil`만으로 작업 내구성을 보장한다고 가정하지 않는다. [Edge 제한](https://supabase.com/docs/guides/functions/limits), [Background Tasks](https://supabase.com/docs/guides/functions/background-tasks)

JSON 형식이 맞아도 타임스탬프·순서·의미는 별도 검증한다. `0 <= start < end <= verified_duration`, 명령 순서, 같은 영상/규칙 관계, 가림과 경계의 불확실성을 확인한다. 부족한 evidence를 높은 confidence로 덮지 않는다. [Google Structured Outputs](https://ai.google.dev/gemini-api/docs/structured-output)

## 8. 구현 순서와 완료 기준

1. **판정 기술 검증:** 실제 Longest Sit 영상으로 사람이 표시한 착석 시작·이탈 시점과 Gemini 관측을 비교. 정상·짧은 이탈·재착석·가림·시작부터 착석·상한 종료를 포함한다. 최소 게임당 20개 정도의 대표 clip을 시작점으로 제안한다. 95% 기록 오차가 1초 안이라는 초기 목표도 실제 결과로 검증하며, 실패하면 정밀도/판정 범위를 조정한다.
2. **저장 기반:** 현재 실제 Supabase 프로젝트의 schema·권한·함수·secret 상태 확인. 새 migration/API/job/scoring schema와 서버 검증 작성. 동일 제출 동시 요청, 다른 owner 접근, 저장 실패, lease 만료를 검증한다.
3. **Longest Sit 연결:** native 녹화→재생→전송→Gemini→저장→결과 재조회. 두 모바일 플랫폼에서 정상/취소/권한거부/업로드 단절/앱 재실행까지 확인한다.
4. **Combo·Spot 연결:** 녹화 속 GO 신호와 목표 식별 검증, 게임별 동작 계약 추가. sequence mismatch·조기 출발·목표 오인 영상을 포함한다.
5. **기록 UX:** 최근 기록·개인 최고, capped 표시, 재촬영 안내. 결과 저장이 확인되기 전 완료 UI를 띄우지 않는다. 새 Game의 기존 스타일은 유지한다.

Expo Camera의 `recordAsync`는 iOS/Android 경로다. 현재 브라우저 미리보기만으로 실제 녹화 완료를 판정하지 않는다. 첫 기능 범위는 모바일이며 웹 녹화는 필요할 때 MediaRecorder adapter를 별도로 구현한다. [Expo SDK 56 Camera](https://docs.expo.dev/versions/v56.0.0/sdk/camera/)

## 9. 선택지 평가

| 선택지 | 장점 | 비용 / 판단 |
|---|---|---|
| 구버전 그대로 복원 | 일부 기존 화면·서비스를 바로 호출 가능 | 시간 계약 부재, 과거 FK·정산·재시도 문제까지 복구해야 하므로 비추천 |
| **기존 기반 + Game 전용 판정/저장** | 익숙한 Expo/Supabase/Gemini 사용, 현재 UI와 연결, Train 영향 축소 | 새 게임 계약·job·규칙 검증은 필요. **추천** |
| Python 포즈 모델 중심 재구축 | 향후 세밀한 자세·프레임 처리에 유리할 수 있음 | 모델·인증·운영·저장·게임 endpoint까지 보완해야 함. 초기 범위에 비해 큼 |

현재 결정이 필요한 제품 정책은 참가비/보상, 원본 영상 보관 기간, 정밀한 경쟁 기록 지원 시점이다. 위 기본안은 **무과금 개인 기록, 짧은 영상 보관, 초 단위 추정 기록**이며 최종 승인된 정책으로 간주하지 않는다. 모델 정확도와 녹화 신호 동기화는 사용자 취향 문제가 아니라 실제 기기·영상으로 확인해야 하는 구현 검증 항목이다.
