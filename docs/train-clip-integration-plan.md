# Train 클립 통합 계획

작성: 2026-09-29. 기준 커밋: `6e6e0584b2803b225a6a562defd2164e89fb4257` (Major PAWS app update).
원격 main과 로컬 HEAD 일치 확인. 이 문서는 구현 계획이며 앱 코드·DB·영상 파일은 변경하지 않았다.

## 1. 확인 범위와 결론

- Expo/React Native 앱의 실제 route, 재생 컴포넌트, 데이터 서비스, SQL seed를 확인했다.
- 사용자 지정 영상 위치: `C:/Users/Minjae/Desktop/PAWS_vid/Actual`.
- `catalog.json`(2026-09-13), 현존 파일, manifest, 편집 타임라인 및 source list를 대조했다.
- 현행 패키지 폴더에서 MP4 161개 확인: 개별/후보 클립 133개, Level 편집본 25개, 전체 Skill 통합본 3개. 이전 버전·archives·AI-generated는 제외했다. 대안 편집본과 재사용 영상은 별도 파일로 집계하므로 고유 장면 수 또는 사용 확정 수가 아니다.
- catalog의 `total_clips: 144`는 패키지마다 데모와 소스 포함 방식이 달라 실제 파일 수와 일치하지 않는다. 가져오기 작업은 이 숫자 대신 실제 파일 목록을 사용한다.
- 파일별 경로·용도·MP4 컨테이너 길이는 `train-media-inventory-2026-09-29.csv`에 기록했다. 전체 영상을 새로 재생/청취 검수하거나 실행 중 앱 UI와 live DB를 확인한 결과는 아니다.

결론: 영상 URL만 입력해서는 요청한 UX가 완성되지 않는다. 현재 자막 타이머를 실제 player에 연결하고, Level별 영상 목록과 자막 타임코드를 추가해야 한다. 기존 curriculum/session 구조를 유지하며 진행한다.

## 2. 현재 코드 구조

| 영역 | 파일 | 확인 내용 |
|---|---|---|
| Roadmap 진입 | `app/(tabs)/train.tsx` | curriculum skill은 `/train/lesson/[skillId]`로 이동. 개인 day/샘플 fallback은 `/train/lesson-preview`로 이동 |
| 실제 lesson | `app/train/lesson/[skillId].tsx` | `resolveSkillSession`으로 Level 선택 → 준비 화면 → session 시작 → 카드 이동 → 결과 기록 |
| 준비 화면 | 같은 파일 | goal, 준비물, safety copy, Energy 및 시작 버튼. 기존 session은 resume 처리 |
| 상단 영상 | `src/features/train/components/TrainingLessonVideo.tsx` | Level의 `mediaUrl` 한 개를 expo-video로 재생. nativeControls 켜짐, `contentFit="cover"`. posterUrl은 아직 사용하지 않음 |
| 본문 카드 | `src/services/lessonCardSequence.ts` | orient / demo / guardian / additional_practice / completion. Level 2–5 등 카드가 없으면 orient / guardian / completion fallback 생성 |
| 자막 UI | `src/features/train/components/LessonNowPlaying.tsx` | timestamp·문장 클릭, 현재 문장 강조, 진행률 표시. 현재 문장 자체는 disabled라 다시 누를 수 없음 |
| 재생 상태 | `src/hooks/useLessonPlayback.ts` | 100ms setInterval 기반 가상 시계. 실제 영상 player와 연결 없음 |
| 데이터 로딩 | `src/services/trainingCurriculumService.ts` | Level별 media binding 하나 조회. `training_media_scenes`를 조회하지 않음 |
| 샘플 경로 | `app/train/lesson-preview.tsx` | `CURRENT_LESSON`의 Socialization 내용 고정, 영상은 빈 VideoSlot. 실제 curriculum 영상 연결의 주 대상은 아님 |

현재 자막은 `[body, tryIt, keyAction, harderPart, hint]`를 5초 간격으로 나열한 값이다. 자막 클릭, Pause/Resume, Watch again 모두 이 시계만 변경한다. 영상 재생 완료와 관계없이 이 시계가 끝나면 Continue 또는 결과 버튼이 열린다.

`Watch the whole sequence` 문구는 seed의 **demo 카드 제목**이다. 요청한 독립 재생 패널/전체 시퀀스 모드는 별도로 구현돼 있지 않다. 현재 STEP 번호는 영상의 장면 번호가 아니라 session 카드 번호이며 completion 및 additional_practice도 포함한다.

DB는 `section → skill → level → media binding → scene` 구조다. `training_media_bindings`는 Level당 하나로 unique이고, scenes에는 장면 목적과 순서만 있다. 장면 파일 URL·길이·재생 범위·자막은 없다. `training_lesson_cards.media_binding_id`는 DB에는 있지만 domain mapper에서 전달하지 않는다.

현재 seed의 media binding은 28개 Skill 각각의 L1에 정의돼 있으며 상태는 `not_produced`이고 URL은 없다. 이는 seed 기준이며 live DB 상태를 단정하지 않는다. scene ID와 설명은 AI mascot 제작안이므로 실사 파일명과 자동으로 1:1 대응시키면 안 된다.

## 3. 목표 화면과 동작

```text
Roadmap → 현재 Skill의 Level 선택 → 준비 화면 → Start/Resume
  ┌ 상단 player: 선택한 클립 또는 해당 Level 전체 시퀀스 ┐
  ├ Watch the whole sequence: 별도 패널, 길이, 재생/다시보기 ┤
  ├ Step 1: 목적 + 해당 클립의 시간/클릭 가능한 안내 문장 ┤
  ├ Step 2 ...                                          ┤
  └ 내 강아지와 연습 → Success / Not yet → 기존 진행 저장 ┘
```

- 상단 player 하나를 공유한다. 전체 시퀀스와 Step은 재생 모드만 바꾸며 동시에 소리가 나지 않는다.
- Step 클릭은 해당 클립을 선택한다. 문장 클릭은 `clipId + 클립 내부 초`로 이동한다. 현재 강조된 문장도 다시 눌러 재생할 수 있게 한다.
- 영상의 native scrubber 대신 문장 탐색과 앱의 재생/일시정지 버튼을 기본 조작으로 제공한다. 접근성 이름과 재생 상태도 동일 controller에 연결한다.
- Step 모드는 그 장면 끝에서 멈춘다. 전체 모드는 해당 Level의 장면들을 순서대로 재생한다. 변경 가능한 초기 UX 결정이다.
- 전체 시퀀스란 **현재 Level 전체**다. `PAWS_*_Master`는 L1–L5 통합본이므로 현재 Level의 기본 영상으로 연결하지 않는다.
- 준비물·실습 안내 등 영상에 없는 설명은 일반 텍스트로 표시한다. 임의의 5초 timestamp를 붙이지 않는다.
- STEP 번호는 영상의 teaching step에서 계산한다. 기존 session cardKey와 의미를 분리한다.
- 영상 종료는 시청 완료일 뿐이다. 실제 훈련 성공·Energy·Silver 처리는 기존 session/result 흐름이 담당한다. 재생이나 탐색이 추가 세션 또는 추가 비용을 만들지 않는다.
- 발·손·문턱 등 관찰 대상이 잘리지 않도록 영상은 기본 contain으로 표시한다. 기존 둥근 패널과 Hero 레이아웃은 유지한다.

## 4. 영상 패키지별 연결 방식

### A. Level 편집본이 이미 있는 5개 Skill

`1-4/v2`, `1-5`, `2-1/v2`, `2-2`, `2-3`: 각 L1–L5에 데모가 있으므로 총 25개 Level에 연결 가능하다.

- 전체 시퀀스 패널: 해당 `demos/*LvN*` 또는 `levels/*LvN*` 편집본.
- Step player: 원음 개별 클립. 기존 manifest의 Level별 등장 순서와 재사용 관계를 가져온다.
- 전체 편집본 재생 시 강조 위치: `demo_in_s/demo_out_s` 또는 `timeline_in/timeline_out`.
- 개별 클립 재생 시 강조 위치: 그 클립 안의 local time.
- 안내 카드가 영상에 구워진 구간은 별도 instruction segment로 표현한다. 원본 발화를 그대로 옮긴 자막인지, PAWS가 쓰는 동작 안내인지 구분한다.
- 기존 편집본을 그대로 사용하는 단계에서는 앱 안내와 중복되는 타이틀 카드가 있을 수 있다. 첫 통합 이후 화면 중복을 검토한다.

실제 예: `2-3` L1 편집본은 약 43.57초다. `C01`은 전체본 13.000–16.467초, `C02`는 23.467–28.567초에 등장한다. C01 파일의 0초는 원본 YouTube 205.1초 또는 전체본 13초와 다르다. 원본 source IN/OUT을 player seek 값으로 복사하지 않는다.

### B. 개별 클립만 있는 Skill

현재 Level에 필요한 클립을 ordered playlist로 선언한다. 각 Step은 해당 클립을 재생하고, 전체 시퀀스는 그 playlist를 연속 재생한다. 시작부터 합본을 새로 만들 필요는 없다. 실제 동작 사이의 설명은 UI 안내로 제공한다.

하나의 파일을 여러 Level에서 재사용할 수 있다. 파일 asset은 한 번 등록하고 Level마다 목적·순서·자막·관찰 범위를 다르게 연결한다. 별도 촬영 장면은 별도 예시로 표시한다.

### C. 부분 후보 / 목표 불일치 / 미확보

보유 파일과 사용 가능한 Level을 구분한다. partial clip은 해당 동작 설명에만 연결하며 완전한 전체 시퀀스로 표시하지 않는다. 미확보 Level은 텍스트/포스터 fallback을 제공한다. 이름이 비슷하다는 이유로 다른 Skill 영상이나 AI-generated 폴더 영상으로 자동 대체하지 않는다.

## 5. 전체 Skill 매핑 초안

아래는 파일·메타데이터와 현재 seed를 대조한 **연결 후보**다. 숫자 01/02 등은 해당 폴더 파일의 동작 번호, C01 등은 manifest/source list의 ID다. 여러 파일을 나열한 Level은 재생 순서 초안이며 최종 자막은 영상·음성 검수 후 확정한다.

| Skill | 확보 파일/버전 | 앱 연결 초안 및 남은 작업 |
|---|---|---|
| 1-1 Wait at the Door | 후보 4개 | L1 PARTIAL, L2 HandleWait 후보, L3 SmallDoorOpening 후보, L4 PARTIAL. L5 미확보. L1·L4는 일부 동작 참고로만 연결 |
| 1-2 Stay Off the Furniture | 후보/참고 6개 | L1·L2 부분 참고. L3은 `OneAttempt_CANDIDATE_v3`를 우선 검토, 다른 L3 편집본과 동시 사용하지 않음. L4·L5 미확보. `NOT_LEVEL_DEMO`는 별도 참고 |
| 1-3 Choose Approved Items | Drop It 본편 4 + 보충 2 | **내용 불일치**. README에는 Drop It 대체 결정 기록이 있으나 현재 앱의 1-3 목표·Level은 원안. 대체안 반영 시 전체 curriculum 문구/성공 기준/6-1 관계를 함께 정리해야 함. 기존 번호대로 자동 투입하지 않음 |
| 1-4 Start a Potty Routine | `v2`: 데모 5 + 소스 11 | L1–L5 각각 기존 데모·timeline 활용. 장소 이동 장면을 실제 배변 장면으로 설명하지 않음 |
| 1-5 Pause Unnecessary Barking | 데모 5 + 소스 10 | L1–L5 각각 데모·timeline 활용. 별도 촬영·해제 예시의 구분 유지 |
| 2-1 Mark the Right Choice | `v2`: 데모 5 + 소스 5 + Master | L1–L5 level 데모 사용. v1은 제외. master는 기본 lesson 영상으로 사용하지 않음 |
| 2-2 Pause Access to Rewards | 데모 5 + 소스 5 + Master | L1–L5 level 데모 사용. checkpoint_binding은 기존 later-day 실습 조건과 대조 |
| 2-3 Learn Clear Feedback Words | 데모 5 + 소스 4 + Master | L1–L5 level 데모 사용. 첫 전체본/클립 간 timestamp 동기화 검증에 적합 |
| 2-4 Build a Reward Pattern | 클립 6 | L1 C01, L2 C02, L3 C03, L4 C04/C05/C06 보상 종류 비교, L5 동일 자료 적용 참고. L5 연속 완성 시범으로 표시하지 않음 |
| 2-5 Practice a Calm Reset | 클립 5 | L1 C01/C02, L2·L3 C03, L4 C04, L5 C05 중심. 놀이 재개와 Stay 재시도는 서로 다른 적용 예시임을 안내 |
| 3-1 Enjoy Everyday Touch | 현재 폴더 클립 3 | L1 01 어깨, L2 02 목/등, L3 03 가슴/어깨, L4 01–03 순서 예시. L5 다른 익숙한 사람과 실습은 재사용 안내이며 실제 촬영 증거는 아님. README의 과거 v2 데모 지시보다 현재 catalog/파일을 우선 |
| 3-2 Prepare for Nail Care | 클립 6 | L1 01, L2 02/03, L3 04, L4 05, L5 06은 자르지 않는 도구 접촉. 현재 L5 `Care for One Nail`의 실제 기준과 대조해 문구 범위 정합화 |
| 3-3 Prepare for Hygiene Checks | 클립 5 | L1 01, L2 02, L3 03/04, L4 05, L5 동작 조합. 볼 접촉↔눈 옆 확인, 뒤쪽 쓸기↔tail-base 확인의 차이를 본문·관찰 기준에 반영할 필요 |
| 3-4 Stay Calm for Bath and Towel | 클립 5 | L1 01/02, L2 03, L3 04, L4 05, L5 선택 조합. 승인 기록의 젖은 천 쓸기·보상과 현재 문구를 대조 |
| 3-5 Comfortable With Another Handler | `3-5 - need review`의 클립 3 | catalog 경로 `3-5/`는 존재하지 않음. L1·L2 01, L3 02 등 쓸기, L4 03 손 타깃, L5 재사용 초안. 앱은 L3 shoulder touch, L4 collar/harness touch이므로 내용 수정 검토 필요. 폴더 검토 상태 해소 전 ready 처리 금지 |
| 4-1 Respond to Your Name | 클립 5 | L1 C01, L2 C02, L3 C03, L4 C04, L5 C05. L4는 열린 인접 공간 예시여서 보이지 않는 다른 방의 수행으로 설명하지 않음. 개별클립 playlist 첫 적용 후보 |
| 4-2 Notice Visual Triggers Calmly | 클립 6 | L1 C01 정지 물체, L2 C02 이동 물체, L3 C03 성인, L4 C04 먼 개, L5 C05 공원 적용. C06은 보호자와 이동해 거리 확보하는 보충 Step 후보. 각 source_list 한계와 본문 대조 |
| 4-3 Recover From Everyday Sounds | 클립 7 | L1 C01, L2 C02, L3 C03, L4 C04/C05, L5 C06. C07은 거리 확보 보충 예시. 보호자와 동반 퇴장하는 정확한 연결 동작은 미확보 |
| 4-4 Use Your Resting Space | 클립 7 | L1 01, L2 02/03/04, L3 06 및 02 짧은 멈춤, L4 05, L5 07. 하나의 Level에 여러 관찰 Step 허용 |
| 4-5 Follow a Daily Routine | 클립 4 | L1 01, L2 02, L3 01→04, L4 03, L5 04 중심. 다른 반복을 한 연속 수행으로 설명하지 않음 |
| 5-1 Use an Indoor Potty Area | 클립 4 | L1 01, L2 04 설명·예시, L3 02, L4 03, L5 기존 동작 재사용. 04는 실제 배변 성공 증거가 아니므로 영상 설명/실습 기준 분리 |
| 5-2 Recover Calmly After Accidents | Actual에 없음 | 텍스트/포스터 fallback. 신규 영상 확보 대상 |
| 5-3 Use an Outdoor Potty Area | Actual에 없음 | 텍스트/포스터 fallback. 1-4 영상과 목표를 대조한 재사용은 별도 검토 가능하나 자동 연결하지 않음 |
| 6-1 Drop It on Cue | 클립 4 | L1 01, L2 02, L3 03, L4 승인된 장난감 선택 조건은 앱 안내, L5 04. 1-3 Drop It 대체안과 curriculum 중복 정리 |
| 6-2 Choose Toys, Not Hands | 클립 3 | L1 01, L2 02, L3 03, L4 01–03 적용, L5 익숙한 성인 실습 안내 + 재사용. 02를 피부 접촉 직후 반응까지 촬영한 장면으로 단정하지 않음 |
| 6-3 Redirect Destructive Chewing | 클립 3, `v1_approved_revision` | L1 01 관리된 공간, L2·L3 02 접근 관리/장난감 전환, L4·L5 03 활동 유지. catalog의 수정안과 앱의 독립 물건 선택·교환 기준을 먼저 정합화 |
| 6-4 Reduce Demand Barking | 클립 3 | L1 01, L2 02, L3 03, L4 02→03 별도 예시, L5 반복 보상 조건은 앱 실습 안내. 짖음→놀이 중단→재개의 한 연속 촬영으로 설명하지 않음 |
| 6-5 Manage Alert Barking | 클립 3 | L1·L2 01, L3 02, L4 03, L5 기존 동작 참고 + 자연 발생 상황 실습 안내. 통제된 노크 촬영을 자연 발생 알림으로 표기하지 않음 |

Checkpoint는 각 Skill의 기존 진도·다른 날 실습 조건을 유지한다. 동작 영상 재사용은 안내용이며 영상 재생 자체가 checkpoint 통과를 만들지 않는다.

## 6. 데이터와 재생 구현안

### 자산/Level/Step/자막 분리

1. 재사용 가능한 media asset: `assetKey`, 실제 재생 URL, poster, duration, version, 원본 출처와 원본 in/out 기록.
2. 기존 `training_media_bindings`: Level당 한 개 유지. 전체 Level demo 또는 playlist 방식을 지정. 기존 media_url은 호환 기간에 whole-sequence URL로 해석.
3. 기존 `training_media_scenes`: Level의 teaching step 목록으로 확장하거나 새 step 테이블과 명시적으로 연결. `assetId`, `startSeconds`, `endSeconds`, `title`, `sortOrder`, `coverageStatus` 추가. 과거 mascot scene을 실사 ID로 덮어쓰지 않고 버전/연결 관계 보존.
4. Step cue: `cueId`, `sceneId`, `atSeconds`, `endSeconds`, `text`, `locale`, `kind`(transcript/instruction). 시간은 **asset 내부 기준**으로 통일하고 segment 범위 내인지 검증.
5. 편집본이 따로 있을 때 sequence segment에 `sequenceStartSeconds`, `sequenceEndSeconds`, 대응 scene/cue를 기록. 같은 clip이 반복 등장할 수 있으므로 clipId만으로 매핑하지 않고 segment instance ID를 둔다.

실제 schema 확정은 두 파일 형식(2-3 편집본, 4-1 개별클립)을 구현하면서 정한다. 새 exposed 테이블에는 기존 curriculum 열람 정책과 맞는 RLS/권한을 설정한다. 업로드 경로는 버전을 포함한 `training/{skillCode}/{version}/{assetKey}.mp4` 형태로 두고 원본 폴더는 보존한다.

### 플레이어가 시간을 결정

- 설치된 `expo-video` 타입에서 `currentTime`, `timeUpdateEventInterval`, `timeUpdate`, `sourceLoad`, `playToEnd` 지원을 확인했다.
- player를 상위 controller에서 소유하고 영상, Pause/Resume, cue 강조, 진행률이 모두 같은 상태를 읽도록 변경한다.
- 새 소스 준비 완료 후 pending seek를 적용한다. 빠른 연속 탭은 마지막 요청만 적용한다.
- buffering 중에는 player 시간에 맞춰 자막도 멈춘다. source load/error/ended 상태를 별도로 처리한다.
- 다른 클립 또는 Level 전환 시 이전 이벤트·pending seek를 취소한다. 화면 이탈/도움말 이동에서는 실제 영상을 pause한다.
- `useLessonPlayback`은 실제 media 경로에서 제거/대체하되 별도 샘플 preview 사용처를 확인한다.
- 읽기 전용 session card position과 video cue position을 혼동하지 않는다. 첫 단계에서는 기존 card resume을 유지하고 클립 내 resume 저장은 후속 확장으로 둔다.

### 자막 작성 기준

- 보유 manifest/edit_list는 장면 경계다. 이것만으로 단어/문장 단위 정확한 자막이 생기지는 않는다.
- 기존 영어 발화를 그대로 표시할 때는 전사와 청취 검수가 필요하다. PAWS 동작 안내문을 쓸 때는 `instruction`으로 구분한다.
- 1차 연결은 검증된 동작 경계마다 안내 cue를 붙이고, 세밀한 문장 타임코드는 실제 클립을 재생하며 작성한다.
- source seconds / exported clip seconds / level demo seconds / skill master seconds를 별도 보관한다. fps 기반 반올림 차이는 frame 단위 허용 범위로 검증한다.

## 7. 작업 순서와 완료 기준

1. **자산 목록 고정**: CSV를 기준으로 현재 버전·후보·reference를 구분한다. 3-5 경로 오류, 1-3·3-5·6-3 등 목표 차이를 기록하고 명확한 lesson부터 진행한다.
2. **두 Level로 재생 연결**: 2-3 L1(전체본/개별클립 매핑) + 4-1 L1(클립 기반 재생)에 controller, 자막 seek, 별도 전체보기 패널을 구현한다. 이후 4-1의 여러 Level 및 동일 Level의 다중 클립으로 확장한다.
3. **메타데이터 importer**: 형식이 다른 manifest/demo_timeline/edit_list/source_list를 공통 manifest로 변환한다. 파일 누락, 중복 ID, cue 범위, 정렬, duration, 미연결 Level을 자동 검사한다. DB UUID 대신 curriculum version + skillCode + stage/level을 찾아 연결한다.
4. **준비된 25개 Level 연결**: 1-4, 1-5, 2-1, 2-2, 2-3의 현재 데모를 등록하고 모든 Step cue를 대조한다. 재생 목록은 순차로 노출한다.
5. **개별클립 Skill 확장**: 4-1 및 명확한 목표부터 시작해서 표의 순서·재사용 규칙을 확정한다. 여러 클립만으로 구성된 Level 전체보기 동작도 검증한다.
6. **내용 차이와 빈 Level 처리**: 부분 후보와 goal mismatch를 curriculum 내용과 함께 정리하고, 5-2/5-3은 fallback 유지 또는 신규 확보한다.

주요 수정 파일: `TrainingLessonVideo.tsx`, `[skillId].tsx`, `LessonNowPlaying.tsx`, `lessonScript.ts`, `lessonCardSequence.ts`, `trainingCurriculumService.ts`, domain/database types. 신규 파일 후보: media controller hook, whole-sequence panel, manifest parser/validator, media metadata migration/importer.

완료 검증:

- 준비 화면 → 실제 훈련 → 실습 결과 → Roadmap 진도가 유지된다.
- 문장 탭으로 같은 클립의 앞/뒤 및 다른 클립으로 이동하고, 실제 player 시간이 목표 cue와 맞는다.
- pause/resume/replay, 버퍼링, 클립 끝, 전체 시퀀스 끝에서 영상·자막·버튼 상태가 일치한다.
- 전체본과 Step 간 전환 시 같은 장면을 가리키며, instruction segment에서도 엉뚱한 동작 cue가 강조되지 않는다.
- clip-only Level의 playlist 순서, end boundary, 빠른 연속 탭, 오류/미디어 없음 fallback을 확인한다.
- 세로·가로 영상에서 발/손/대상 물체가 잘리지 않고 원음과 안내가 충돌하지 않는다.
- Level 전환/도움말/복귀/백그라운드에서 이전 영상이 계속 재생되지 않는다.
- 시청·seek·다시보기로 session이 중복 시작되거나 Success가 자동 기록되지 않는다.
- typecheck, cue/sequence 매핑의 의미 있는 단위 테스트, Android/iOS 실제 재생 검증을 수행한다.

## 8. 구현 전 남아 있는 확인

- live DB가 seed 이후 별도로 수정됐는지 확인. 특히 approved revision과 현행 DB 목표 비교.
- 실제 화면 실행 및 각 클립의 시청/청취 검수. 이번 분석은 코드·파일·메타데이터 기반이다.
- 1-3 Drop It 대체안의 적용 범위, 3-5 need review 상태, 6-3 수정 목표를 현재 curriculum에 반영할 범위 확정.
- 앱 안내 언어 및 실제 발화 자막/동작 안내 구분. 현재 앱 영어를 기본으로 두되 영상에 이미 포함된 한국어 카드도 검토.

첫 구현 단위는 **2-3 L1과 4-1 L1에서 실제 영상·자막 탐색·전체보기까지 끝까지 동작하도록 만드는 것**이다. 이후 같은 데이터 계약으로 확보된 영상들을 확장한다.
