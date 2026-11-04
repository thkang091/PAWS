# Solo · Duel 실제 페이지 흐름 — 2026-10-28

Game 메인의 **Challenge** 카드가 Solo 진입점이다. **Duel** 카드는 1대1 진입점이다.

이 문서는 현재 코드의 화면과 이동을 정리한 기획·개발 기준이다. 사용자가 말한 `dual`은 앱과 코드의 **Duel(1대1)**을 뜻한다. Tournament는 `TOURNAMENT_ENABLED = false`로 **진입 잠금 상태**다. 메인에는 Coming soon으로 표시하며, Tournament 주소에는 잠금 안내 화면을 보여준다. 아래 흐름에는 포함하지 않는다.

현재 구현은 **화면 흐름 미리보기**다. 카메라 권한 요청·녹화·재생·업로드, 실제 QR 생성·스캔, 두 기기 연결·동기화, AI 판독·점수 저장·보상 지급은 연결되지 않았다. 앱의 다른 부분에 AI API가 있더라도 아래 Game 화면에서 호출하지 않는다.

## 전체 순서

**Solo:** Game 메인 → Solo 게임 목록 → 게임 안내 → 촬영 준비 → 카운트다운 → 라운드 → 종료 → 영상 확인 → 검토 상태 → 결과 또는 재촬영 안내.

**Duel:** Game 메인 → Duel 시작/장소 선택 → 방 생성 또는 참여 → 대기방 → PAWS Says 선택 → 게임 안내 → 촬영 준비 → 카운트다운 → 라운드 → 종료 → 영상 확인 → 검토 상태 → 점수 비교 또는 재촬영 안내.

촬영 준비부터 표시되는 네 칸은 **준비 → 라운드 → 영상 검토 → 결과** 단계다. 게임 목록, 규칙과 대기방은 이 네 단계에 포함하지 않는다. 카운트다운과 종료는 라운드 페이지의 상태이며, 영상 확인과 검토 상태도 같은 페이지 안에서 바뀐다.

## 1. Solo: 페이지별 흐름

| 순서 · 페이지 | 현재 화면과 행동 | 다음 · 뒤로 · 재시도 |
| --- | --- | --- |
| 1. Solo 게임 목록 | `Solo games`. Longest Sit, Random Trick Combo, Spot Sprint 카드 세 개. 목적과 게임별 그림, 간단한 진행 정보를 보여준다. | 카드 선택 → 해당 게임 안내. 상단 뒤로 → Game 메인. |
| 2. 게임 안내 | 게임 그림·설명, 점수 기준, `How to play` 규칙 세 줄, `Bring along` 준비물. | `Set up camera` → 촬영 준비. 상단 뒤로 → 이전 페이지(일반 흐름에서는 게임 목록). |
| 3. 촬영 준비 | `Ready to play?`. 실제 영상이 아닌 카메라 프리뷰 영역. `Full body in frame`, `Phone steady, space clear`, `Ready to begin` 세 항목을 직접 체크한다. Spot Sprint에만 Mat/Low platform 선택이 추가된다. | 세 항목 모두 체크해야 `Start round` 활성화 → 라운드 페이지. 상단 뒤로 → 게임 안내. 이 페이지로 다시 돌아오면 체크는 초기화된다. Spot Sprint의 선택 목표물은 재시도 때 유지한다. |
| 4. 카운트다운 | `Get ready`, 3초 카운트다운. 명령 영역은 `Wait for the cue`. 이 동안 `End round`는 비활성화된다. | 3초 뒤 자동으로 라운드 시작. 닫기 → 이탈 확인 창. |
| 5. 라운드 진행 | 게임별 명령과 경과 시간. 촬영 영역은 여전히 프리뷰다. Combo만 `Next command`가 나타난다. | `End round` 또는 미리보기 제한시간 도달 → 종료 상태. 닫기 → 이탈 확인 창. 게임별 차이는 다음 표 참고. |
| 6. 라운드 종료 | `Round ended`, 경과 시간, 추후 영상 검토로 시간을 확정한다는 안내. | `Review round` → 영상 확인. 현재 세션 경과 시간을 넘기며, 파일은 넘기지 않는다. |
| 7. 영상 확인 | `Review your round`. `No recording attached`, 경과 시간, 촬영 범위·영상 연속성 안내. 체크 표시 두 개는 안내용이며 조작하는 체크박스가 아니다. | `Preview review` → 검토 상태. `Retake round` → 촬영 준비. 상단 뒤로 → Solo 게임 목록. |
| 8. 검토 상태 | `Review status`. Receive video 완료 / Check actions 현재 / Confirm score 대기라는 고정 예시. 자동 처리나 실제 업로드 대기가 아니다. | `View sample result` → 정상 예시 결과. `Preview an unclear video` → 재촬영 안내. 상단 뒤로 → 같은 페이지의 영상 확인 상태. |
| 9. 결과 | `Sample result`, `Not saved`. 게임별 고정 점수. Personal best·Previous round는 `—`. | `Play again` → 같은 게임의 촬영 준비. `Back to games` → Game 메인. 상단 뒤로 → Solo 게임 목록. |
| 10. 판독 불가 · 재촬영 | `Record another take`, `No score confirmed`. 프레임 밖에서 끝났다는 예시 사유와 휴대폰 거리·목표물·끊김 없는 촬영 안내. | `Record again` → 같은 게임의 촬영 준비. `Back to games` → Game 메인. 상단 뒤로 → Solo 게임 목록. |

### Solo 세 게임의 실제 차이

| 게임 | 기획상 판정 기준 | 현재 라운드 동작 | 현재 결과 예시 |
| --- | --- | --- | --- |
| Longest Sit | **앉은 자세를 오래 유지할수록 좋은 기록.** 시작 버튼부터 흐른 시간과 실제 앉아 있던 시간은 구별해야 한다. | `Sit & stay` 한 명령. 보호자가 일어나는 시점에 `End round`를 누르는 안내. 현재는 앱 경과 시간만 재며, 앉기/일어서기 감지는 없다. | `00:24.8` 고정. 실제 경과 시간에서 계산하지 않는다. |
| Random Trick Combo | 세 동작을 순서대로 완료한 시간이 짧을수록 좋은 기록. | 이름과 달리 현재 명령은 **Sit → Paw → Spin 고정**이다. 첫 두 동작 뒤 보호자가 `Next command`를 눌러 다음 명령으로 넘긴다. 마지막 동작 뒤 `End round`. 중간에도 종료할 수 있고 완료 여부는 검사하지 않는다. | `00:18.6` 고정. 랜덤 선택·완료 판정은 없다. |
| Spot Sprint | 목표물로 이동해 앉기까지 걸린 시간이 짧을수록 좋은 기록. | 준비에서 **Mat 또는 Low platform** 선택. 기본값 Mat. `To your spot!` 한 명령 뒤 수동 종료. 시작 위치·거리·목표물 종류는 영상으로 검증하지 않는다. | `00:06.4` 고정. 실제 이동이나 앉기 시점을 검출하지 않는다. |

세 Solo 게임 모두 현재 라운드 미리보기 상한은 **120초**다. 시작 전 3초는 라운드 경과 시간에 포함하지 않는다. 화면 타이머는 `분:초` 정수 표시이고, 결과 예시의 소수점 기록은 이 타이머와 독립된 고정 데이터다.

## 2. Duel: 연결 전 페이지

| 순서 · 페이지 | 현재 화면과 행동 | 다음 · 뒤로 |
| --- | --- | --- |
| 1. Duel 시작 | PAWS Says 소개, 2 players. `Same place` 또는 `Remote` 선택. 초기값은 Same place. 두 경우 모두 강아지 한 마리당 휴대폰 한 대라는 안내를 보여준다. | `Create a room` → 호스트 초대 화면. `Join a room` → 참여 화면. 상단 뒤로 → Game 메인. |
| 2A. 방 생성 · 초대 | `Invite players`. 샘플 QR, 방 코드 **PAWS24**, 2 players, 선택 장소. 같은 장소는 각자 휴대폰으로 참여하도록, 원격은 코드를 공유하도록 안내한다. QR에는 `not scannable` 표시가 있다. | `Open demo room` → 대기방. 상단 뒤로 → Duel 시작. 실제 서버 방 생성, 공유·복사 기능은 없다. |
| 2B. 방 참여 | `Join a room`. 꺼진 스캐너 프리뷰, `Preview QR scan`, 방 코드 입력란. | `Preview QR scan` → 실제 스캔 없이 PAWS24로 대기방 진입. 코드 **PAWS24** 입력 후 `Join with code` 또는 키보드 제출 → 대기방. 다른 코드는 같은 화면에 오류 표시. 상단 뒤로 → Duel 시작. |
| 3. 대기방 | `Players`. 내 역할은 생성 경로에서 Host, 참여 경로에서 Guest. 처음에는 나 한 명과 상대 대기 슬롯. 준비 수는 로컬 상태다. | `My dog and I are ready` 체크와 `Add a demo opponent` 두 조건을 모두 만족해야 `Choose the game` 활성화 → 게임 선택. `Reset demo players`는 예시 상대를 지운다. 상단 뒤로 → 방 생성/참여 화면. |
| 4. 게임 선택 | `Choose a game`. 방 코드, `2 ready · demo`, **선택된 PAWS Says 하나**와 많이 완료한 쪽이 이긴다는 규칙. 다른 Duel 게임을 선택하는 기능은 없다. | `View rules` → PAWS Says 안내. 상단 뒤로 → 대기방. |

### Same place / Remote의 현재 범위

- 선택값과 안내·장소 라벨은 이후 페이지까지 전달된다.
- **두 경우 모두** 생성 화면에는 샘플 QR과 코드가 있으며, 참여 화면에는 스캔 프리뷰와 코드 입력이 있다. 장소에 따라 한 방식을 제한하지 않는다.
- 실제 근거리 연결, 원격 초대 전달, 매칭, 서버 방 또는 두 휴대폰의 데이터 공유는 없다.
- 코드 입력은 영문·숫자만 남기고 대문자로 변환하며 최대 여섯 글자다. PAWS24와 일치하는지만 로컬에서 검사한다.
- 현재 Host와 Guest는 표시만 다르고 게임 선택·시작 권한은 동일하다. 상대 참가·준비 완료는 `Add a demo opponent`로 만든 예시 데이터다. 대기방을 한 단계 뒤로 갔다 돌아오는 동안 로컬 준비 상태는 자동으로 초기화되지 않는다.

## 3. Duel: 게임 시작 후 페이지

이후에는 Solo와 같은 공통 페이지를 사용하며 `mode=duel`과 장소 선택값을 유지한다.

| 순서 · 페이지 | Duel에서 달라지는 점 | 다음 · 뒤로 · 재시도 |
| --- | --- | --- |
| 5. PAWS Says 안내 | 두 참가자가 같은 명령을 따르고, 완료한 명령 수로 비교한다는 안내. Same place/Remote 라벨. | `Set up camera` → 촬영 준비. 상단 뒤로 → 대기방의 게임 선택 상태. |
| 6. 촬영 준비 | 공통 준비 체크 세 개. Spot Sprint가 아니므로 목표물 선택은 없다. | 모두 체크 후 `Start round` → 로컬 3초 카운트다운. 상단 뒤로 → 안내. 상대 기기의 준비·촬영 상태를 기다리지 않는다. |
| 7. 카운트다운 · 라운드 | **Sit → Paw → Stand → Spin → Sit** 다섯 명령 고정. 명령마다 **8초**씩 자동 전환되어 **40초**에 종료한다. 다음 명령까지 남은 초를 보여준다. | `End round`로 중간 종료 가능. 자동/수동 종료 뒤 `Review round` → 영상 확인. 두 기기 동시 출발이나 시간 동기화는 없다. |
| 8. 영상 확인 | 공통 파일 없는 프리뷰와 로컬 경과 시간. | `Preview review` → 검토 상태. `Retake round` → 촬영 준비. 상단 뒤로 → Duel 시작. |
| 9. 검토 상태 | 마지막 단계 이름이 Confirm score 대신 **Compare scores**. 다른 참가자 영상 검토 후 비교한다는 문구만 있고 실제 상대 업로드 대기는 없다. | `View sample result` → 점수 비교. `Preview an unclear video` → 재촬영 안내. 상단 뒤로 → 영상 확인. |
| 10. 점수 비교 | Your pup **4/5**, Player 2 **3/5**, Difference **1 command** 고정. 실제 행동·시간·명령 종료 시점과 무관하다. | `Play again` → 바로 촬영 준비. 현재는 로비로 돌아가 양쪽이 동의하는 재대결이 아니다. 상단 뒤로 → Duel 시작. `Back to games` → Game 메인. |
| 11. 재촬영 안내 | Solo와 같은 예시 판독 불가 화면. 상대의 처리 상태나 경기 무효 여부는 표시하지 않는다. | `Record again` → 촬영 준비. 상단 뒤로 → Duel 시작. `Back to games` → Game 메인. |

현재 PAWS Says는 **정해진 명령을 모두 따라 하는 미리보기**다. 고전 Simon Says의 “PAWS says” 접두어가 있는 명령만 따라야 하는 규칙, 접두어 없는 함정 명령, 잘못 따라 했을 때의 감점/탈락은 구현하지 않았다. 명령 랜덤화도 없다.

## 4. 공통 예외 · 뒤로가기

- **라운드 닫기:** 상단 닫기 또는 Android 하드웨어 뒤로 → `Leave this round?`. `Keep playing`은 창만 닫고, `Leave round`는 해당 모드 시작 화면으로 돌아간다. 창이 열린 동안 타이머를 일시정지하는 처리는 없다.
- **앱 비활성화:** 카운트다운/진행 중 앱이 비활성 상태가 되면 `Round interrupted`. `Restart round`는 시간·명령 순서를 초기화하고 3초 카운트다운부터 다시 시작한다. 중단된 시점에서 이어 하기 기능은 없다.
- **재촬영/재시도:** 준비 페이지로 돌아간다. 게임·모드·장소·목표물은 전달하고 준비 체크는 다시 하도록 초기화한다. 실제 영상 파일이나 기록은 보존하지 않는다.
- **검토할 라운드 없음:** 검토 URL의 경과 시간이 없거나 유효하지 않으면 `No round to review`. `Set up camera`로 준비 화면에 진입한다.
- **잘못된 게임:** Solo에서 지원하지 않는 게임 식별자는 `Game not found`와 `Choose a game`으로 처리한다. Duel에서는 전달된 게임 식별자와 무관하게 PAWS Says를 사용한다.
- **정보 버튼:** 모든 공통 페이지의 정보 버튼은 녹화·연결·AI가 아직 미연결이며 점수 저장이나 코인 소비가 없다는 미리보기 안내를 연다.
- 위 표의 **뒤로**는 화면 상단 버튼 기준이다. 방의 내부 단계와 라운드에는 Android 하드웨어 뒤로 처리가 별도로 있으며, 브라우저 뒤로·iOS 제스처까지 모든 경우에 동일한 이동을 강제하는 구현은 아니다.

## 5. 실제 기능 연결 전 정할 규칙

| 항목 | 현재 미리보기와 아직 정하지 않은 범위 |
| --- | --- |
| 시간·완료 판정 | 영상에서 시작/종료 프레임을 잡는 기준, Longest Sit의 앉기 인정과 자세 이탈, Combo 순서 오류, Spot Sprint 출발·목표물 도착·앉기 완료 기준. 120초가 정식 제한인지도 별도 결정 대상이다. |
| 명령 구성 | Combo의 랜덤 후보와 강아지가 아는 동작 범위, 중복 허용 여부. PAWS Says를 모든 명령 수행 방식으로 할지, 접두어/함정이 있는 Simon Says 방식으로 할지. |
| Duel 경기 운영 | Host/Guest 권한, 두 기기의 동시 시작 방식, 8초 제한, 중도 종료·연결 끊김·한쪽 업로드 실패·재촬영·동점·재대결 처리. |
| 판독 신뢰도 | 실패와 영상 불명확의 구분, 재촬영 가능 횟수, 결과 확정 전 사용자 확인, 실제 기록 저장 시점. 현재 모든 결과는 고정 샘플이다. |

## 코드 위치

- `src/features/game/flow/SoloScreens.tsx`: Solo 목록, 안내, 준비 체크와 목표물.
- `src/features/game/flow/MultiplayerScreens.tsx`: Duel 시작, 생성/참여, 로비, 게임 선택.
- `src/features/game/flow/GameSessionScreen.tsx`: 카운트다운, 명령 전환, 종료·중단·이탈 확인.
- `src/features/game/flow/GameReviewScreens.tsx`: 영상 확인, 검토 예시, 결과·재촬영.
- `src/features/game/flow/gameFlow.ts`: 게임 데이터, 고정 명령, 제한시간, 샘플 점수.
- `src/features/game/flow/GameFlowUI.tsx`: 공통 페이지 프레임, 정보 창, 네 단계 표시.
- 라우트: `/game/challenge`, `/game/duel`, `/game/room`, `/game/play/[gameId]`, `/game/prepare`, `/game/session`, `/game/review`, `/game/result`.

## 이번 변경 검증

- 메인 Tournament 버튼의 disabled 상태와 잠금 표시 확인.
- Tournament 대기방·촬영 준비·경기·결과 직접 주소가 잠금 안내로 이동함을 확인.
- 잠금 안내에서 Game 메인으로 돌아온 뒤 Solo 진입 가능, Duel 준비·경기·검토 진행 가능함을 확인.
- TypeScript 검사와 `git diff --check` 통과. 실제 네이티브 기기와 외부 서비스 연결은 검증하지 않았다.
- 화면별 가이드: `http://127.0.0.1:8092/` (로컬 서버 실행 중). 파일은 `C:/Users/Minjae/.codex/visualizations/2026/10/20/01a15a4b-d233-75d1-9798-e9b202dc000b/game-solo-duel-flows/`에 보관한다.
