# Duel / A PLAYROOM 적용 및 검수

**후속 수정: 첫 화면부터 참가자 위치 유지 — 2026-11-05**

첫 진입의 안내 영역이 로비에서 사라지며 두 참가자가 위로 이동하던 문제를 수정했다. 동일한 GameHeading의 자연 높이를 로비에서도 확보하되 문구는 투명·접근성 숨김 처리한다. 고정 높이를 새로 넣지 않아 글자 크기와 줄바꿈 변화에 대응한다. 첫 화면·Remote·방 생성·친구 연결·Ready·게임 선택·준비 취소·재연결·나가기 복귀에서 두 참가자의 좌표를 유지한다. Join 입력 화면은 기존처럼 참가자를 숨기고, 참가 완료 시 같은 위치로 복원한다.

코드·QR과 Ready 버튼은 참가자 아래에서 남은 높이에 맞춰 배치한다. 일반 화면은 기존 세로 코드·QR 구성을 유지하고, 360px 이상이면서 세로 공간이 부족할 때는 왼쪽 코드·공유/복사, 오른쪽112px QR로 전환한다. 44px 터치 영역과 피드백 한 줄, 기존 Ready 버튼 위치를 유지한다. 좁은320px 화면과 큰 글자는 코드 폭을 확보하는 세로 배치 및 필요한 스크롤을 사용한다. 세로 배치의 높이만 측정해 가로/세로 전환이 반복되지 않도록 했다.

변경 파일: `DuelPlayroom.tsx`, `DuelLobbyPanels.tsx`. 실제 앱에서 위치·전환57개, compact 배치5개 확인을 통과했다. 390×844·390×763·360×640에서 참가자 좌표가 동일하고 기본 로비·선택 단계는 스크롤과 QR 잘림 없이 표시된다. 360×700·360×704에서도 코드 한 줄과 QR112px이 유지된다. 공유/복사 버튼44px, 실제 코드 복사, Join 및 직접 방 진입을 확인했다. 타입 검사·`git diff --check` 통과. Game main 관련6개 파일 SHA256은 기존과 동일하다. 네트워크 연결은 기존 로컬 시뮬레이션이며 실제 iPhone 검수는 포함하지 않았다. commit/push/merge/배포하지 않았다.

[첫 화면](qa/duel-playroom-2026-11-05/participant-anchor/390x844-01-entry.png) · [초대 로비](qa/duel-playroom-2026-11-05/participant-anchor/390x844-02-invite.png) · [둘 다 Ready](qa/duel-playroom-2026-11-05/participant-anchor/390x844-04-both-ready.png) · [작은 화면](qa/duel-playroom-2026-11-05/participant-anchor/360x640-compact-final.png) · [좌표 검수](qa/duel-playroom-2026-11-05/participant-anchor/checks.json) · [compact 검수](qa/duel-playroom-2026-11-05/participant-anchor/compact-checks.json).

**후속 수정: Duel 첫 화면 안내 — 2026-11-05**

Same place/Remote 선택 화면 상단에 `Play together` / `Side by side. Or find a match.`를 추가했다. `DuelPlayroom.tsx`에서 Challenge와 동일한 `GameHeading`을 재사용하며, 실제390px 렌더링에서 제목 좌표(x24,y76)·글자크기28px·줄높이31px이 Challenge와 같다. 첫 진입에만 표시하고 Join·로비에는 표시하지 않는다. 390×844와360×640에서 Same place/Remote 모두 스크롤 없이 표시되고, 기존 버튼 위치는 유지한다. 타입 검사 통과. Game main·Challenge는 수정하지 않았다. commit/push/merge/배포하지 않았다.

[Same place](qa/duel-playroom-2026-11-05/entry-heading/02-same-place-390.png) · [Remote](qa/duel-playroom-2026-11-05/entry-heading/03-remote-390.png) · [Challenge 위치 비교](qa/duel-playroom-2026-11-05/entry-heading/layout.json).

**후속 수정: Ready 이후 게임 선택 — 2026-11-05**

초대 로비의 `Choose a game` 카드와 선택 모달을 제거했다. 로비에는 기존 두 참가자와 코드·QR, `I’m ready`를 유지한다. 버튼 높이56px와 위 간격12px는 유지하고, room 전용 하단 여백을24px에서44px로 바꿔 버튼 위치만20px 위로 올렸다. Duel 첫 진입 및 Join 화면의 버튼 위치는 바꾸지 않았다.

친구가 연결되면 게임을 고르기 전에도 Ready할 수 있다. 두 사람 모두 Ready가 되면 같은 화면의 참가자 아래 영역이 게임 선택 단계로 자동 전환된다. 새 내비게이션 경로를 추가하지 않아 기존 참가자 위치와 나가기 보호를 유지한다. 호스트가 기존 PAWS Says를 선택하면 Start가 활성화되고 기존 플레이 화면으로 이동한다. 게스트도 같은 선택 단계를 보지만 선택·시작 권한은 호스트에게 있다. 준비 취소·연결 끊김·친구 이탈·라운드 복귀는 게임 선택을 초기화한다. 실제 네트워크 연결 기능은 기존과 동일하게 미연결이며, 두 참가자 이벤트는 개발 도구의 로컬 시뮬레이션으로 검수했다.

변경 파일: `DuelPlayroom.tsx`, `DuelLobbyPanels.tsx`, `duelRoomState.ts`, `src/__tests__/duelRoomState.test.ts`. 실제 앱 브라우저28개 확인, 상태 테스트17개, 타입 검사 및 `git diff --check` 통과. 390×844와360×640에서 로비·선택 단계 모두 불필요한 스크롤과 QR 잘림이 없고 참가자 좌표가 유지된다. 양쪽 Ready 순서, 선택 전 Start 차단, 선택 후 Ready 유지, 준비 취소·재연결·게스트 권한, 선택 화면의 Leave 확인과 기존 플레이 진입을 확인했다. Game main 관련6개 파일 SHA256은 원본과 동일하다. React best practices 기준의 파생 상태·이벤트 처리·접근성도 검토했다. 실제 iPhone 네이티브 화면은 이번 검수에 포함되지 않았다.

[연결 후 로비](qa/duel-playroom-2026-11-05/ready-first/02-connected-390.png) · [둘 다 Ready](qa/duel-playroom-2026-11-05/ready-first/04-both-ready-390.png) · [360×640](qa/duel-playroom-2026-11-05/ready-first/06-connected-360.png) · [28개 확인과 치수](qa/duel-playroom-2026-11-05/ready-first/checks.json) · [Game main 해시 비교](qa/duel-playroom-2026-11-05/ready-first/main-unchanged.json). commit/push/merge/배포하지 않았다.

**후속 수정: 참고 이미지 기반 Join 화면 — 2026-11-05**

사용자가 제공한 `Photo 1.jpg`의 코드 입력 → OR 구분선 → QR 스캔 구성을 기존 PAWS의 흰 배경·노란 강조색·공통 헤더와 버튼으로 옮겼다. 이름 입력은 추가하지 않았다. Join 중에는 참가자 영역을 숨겨 두 가지 참가 방법에 집중하고, 참가 성공 또는 Back 취소 시 기존 참가자 자리를 복원한다.

큰 중앙 정렬 코드 입력과 QR 카드, 하단 Join game 버튼 하나로 구성했다. 별도 Cancel 버튼은 제거하고 기존 상단 Back 취소를 유지했다. 자동 포커스를 제거해 진입하자마자 키보드가 QR 선택지를 가리지 않게 했다. 첫 진입 시 이전 스크롤을 초기화하고, 검증 실패 시 입력 오류가 보이도록 상단으로 이동한다. 기존 6자리 영숫자 정규화·키보드 제출·입력 옆 오류를 유지하고, 예시 코드는 placeholder로만 표시한다. 스캐너는 기존 미연결 상태여서 비활성이다.

변경 파일: `DuelLobbyPanels.tsx`, `DuelPlayroom.tsx`. 타입 검사와 `git diff --check` 통과. 실제 앱 브라우저 **29개 확인 통과**(기본27 + 스크롤 복원2): 390×844, 360×800, 390×763, 360×640에서 스크롤 없음; 320×568에서 하단 버튼과 QR 선택 접근 가능; 빈 코드·형식 오류·찾을 수 없는 코드·Return 제출·입력 수정·뒤로 취소·재진입 초기화·유효한 프리뷰 참가와 참가자 복원을 확인했다. Game main 관련6개 파일 SHA256은 원본과 동일하다. React best practices 기준으로 상태·이벤트 핸들러·접근성도 검토했다. 실제 OS 키보드·카메라 스캔은 미검증이다.

[Join 화면390px](qa/duel-playroom-2026-11-05/join-redesign/01-join-390.png) · [360×640](qa/duel-playroom-2026-11-05/join-redesign/05-join-360x640.png) · [입력 오류](qa/duel-playroom-2026-11-05/join-redesign/03-unknown-error-390.png) · [참가 후 로비](qa/duel-playroom-2026-11-05/join-redesign/04-joined-lobby-390.png) · [27개 확인과 치수](qa/duel-playroom-2026-11-05/join-redesign/checks.json) · [스크롤 복원2개](qa/duel-playroom-2026-11-05/join-redesign/scroll-checks.json). 임시 웹 검수 설정·서버·브라우저는 정리했고 commit/push/merge/배포하지 않았다.

**후속 수정: 나가기 확인 모션과 뒤로가기 제스처 보호 — 2026-11-05**

> 아래의 원본 POP 재개 방식은 [2026-11-06 버튼·스와이프 일치 수정](duel-back-navigation-2026-11-06.md)으로 대체됐다. 현재는 두 입력 모두 Leave 성공 후 Duel 첫 화면에 남는다.

방이 열린 Duel 로비가 현재 표시되는 동안 화면을 제거하려는 동작을 Expo Router의 `usePreventRemove`로 막고 기존 `Leave game?` 창을 연다. 이 보호는 Duel을 포함한 부모 game 스택 제거에도 전달된다. 게임·리뷰 화면을 볼 때는 해당 화면의 기존 나가기 흐름을 사용하며, 뒤에 있는 로비가 가로채지 않는다. 설치된 native-stack 구현에서 iOS의 `preventNativeDismiss`와 `onNativeDismissCancelled → POP` 연결을 확인했다. 제스처 자체를 비활성화하지 않았다.

차단된 원본 탐색 액션을 보관하고 Leave 승인 시 그대로 재개해 확인 반복이나 Game main 중복을 방지한다. Stay·닫기·모달 뒤로가기는 보관 액션을 취소하고 방 코드·선택 게임·Ready를 유지한다. 버튼으로만 연 나가기 창은 기존대로 방을 정리하고 Duel 첫 진입 상태로 돌아간다. 방이 없는 Duel은 확인 없이 복귀하고, Start의 새 화면 진입은 차단하지 않는다.

`PlayroomSheet.tsx`를 분리해 확인 창은 아래에서 260ms 동안 올라오고 닫힐 때 160ms 동안 내려가도록 했다. 배경은 별도 opacity 애니메이션이며 닫히는 중에도 제목과 버튼을 유지한다. Reduce Motion 설정에서는 즉시 표시·닫기를 사용한다. 이번 코드 변경은 `DuelPlayroom.tsx`와 새 `PlayroomSheet.tsx`다.

검수: 타입 검사·`git diff --check` 통과, 실제 앱 동작·모션 **22개 확인 통과**(탐색·모션20 + Reduce Motion2). 설치된 탐색기를 통해 네이티브 제스처와 같은 부모 POP 액션을 보내 차단·취소·재개를 검증했으며 탐색 상태를 직접 주입하지 않았다. 브라우저 렌더링 프레임에서 진입39프레임·퇴장12프레임을 기록해 transform·배경 opacity·닫는 중 내용 유지를 확인했다. iOS 개발 번들은 HTTP200, 30,340,499bytes로 생성됐다. **실제 iPhone 가장자리 스와이프와 네이티브 모션 자체는 실기기 미검증**이다.

[나가기 확인 캡처](qa/duel-playroom-2026-11-05/leave-guard/01-leave-confirmation-390.png) · [탐색·모션20개 확인과 프레임](qa/duel-playroom-2026-11-05/leave-guard/checks.json) · [Reduce Motion2개 확인](qa/duel-playroom-2026-11-05/leave-guard/reduced-motion.json). 임시 검수 설정·서버·브라우저·번들은 정리했으며 commit/push/merge/배포하지 않았다.

**현재 로비: 항상 펼쳐진 QR과 필요한 경우만 스크롤 — 2026-11-05**

QR 접기 상태와 자동 접기를 제거했다. 코드·QR은 참가자 바로 아래에서 항상 보이며 Ready는 하단에 유지된다. 접기 버튼 자리는 공유 버튼으로 바꿨다. `Local preview · Host/Guest`, `Room QR`, `Not active in this preview` 및 참가 화면의 스캐너 설명 문구는 화면에서 제거했다. QR은 기존 미연결 프레임으로 유지하며, 접근성 라벨과 기존 정보 창에서 기능 상태를 알 수 있다. 실제 초대 URL이나 가짜 QR을 만들지 않았다.

공유 버튼은 네이티브 시스템 공유창에 현재 방 코드 텍스트를 전달한다. 웹은 Web Share API를 사용하고 미지원이면 코드를 복사한다. 취소 시 오류를 띄우지 않고, 실패 시 복사를 안내한다. 복사·공유 피드백은 확보된 한 줄 공간을 사용한다. QR 크기는 남은 실제 높이에 맞춰 112~176px 안에서 조절하며, 글자가 커져 공간이 부족하면 내용에 접근할 수 있도록 스크롤을 허용한다.

참가자 이름·소유자 줄에 있던 불필요한 빈 높이를 줄였고, 첫 진입의 기존 Create/Join 버튼 위치는 유지했다. 개발 도구는 헤더로 통일했다. 게임 목록은 기존 선택 창으로 열어 로비 길이를 늘리지 않는다. 전체 내용 높이가 표시 영역 안에 들어오면 스크롤을 끄고, iOS bounce 및 Android overscroll도 끈다. 이 변경은 Duel 하위 화면에만 적용한다.

이번 변경 파일은 `DuelPlayroom.tsx`, `DuelLobbyPanels.tsx`다. 타입 검사와 `git diff --check` 통과. 브라우저 검수 **39개 통과**(일반 동작35 + 스크롤·큰 글자4). 390×844, 360×800, 390×763에서 연결·게임 선택·Ready 상태까지 스크롤 없이 표시됐다. 360×640에서는 첫 진입·대기 화면이 스크롤 없이 표시됐다. 320×568과 1.8배 글자에서는 필요한 스크롤이 실제 입력으로 작동하며 Ready와 QR에 접근 가능했다. 이는 네이티브 Dynamic Type·safe area·키보드 실기기 검증을 대체하지 않는다.

웹 미지원 공유의 클립보드는 실제 값을 확인했다. Web Share 성공·취소·실패는 API 경계를 테스트 대역으로 검증했으며 외부 메시지는 보내지 않았다. 네이티브 시스템 공유창은 미검증이다. Game main 관련6개 파일 SHA256은 원본과 동일하다. 임시 웹 지도 import 우회와 검수 서버·브라우저는 정리했으며 commit/push/merge/배포하지 않았다.

최신 캡처: [첫 진입](qa/duel-playroom-2026-11-05/persistent-qr/01-entry-390.png) · [항상 펼친 QR](qa/duel-playroom-2026-11-05/persistent-qr/02-waiting-390.png) · [QR·선택 게임·Ready](qa/duel-playroom-2026-11-05/persistent-qr/03-game-selected-390.png) · [360×800](qa/duel-playroom-2026-11-05/persistent-qr/05-selected-360x800.png) · [높이763](qa/duel-playroom-2026-11-05/persistent-qr/05-selected-390x763.png) · [큰 글자 스크롤](qa/duel-playroom-2026-11-05/persistent-qr/09-large-text-scroll.png) · [35개 동작·치수 기록](qa/duel-playroom-2026-11-05/persistent-qr/checks.json) · [4개 접근성 확인](qa/duel-playroom-2026-11-05/persistent-qr/accessibility-checks.json).

**이전 구현: 큰 코드·QR과 화면 아래 Ready — 2026-11-05**

QR이 이전 고정 대기·나가기 영역에 가려지는 문제를 수정했다. 로비의 `Waiting for a friend` 상태 버튼과 `Leave game` 버튼을 제거하고, 화면 아래에는 준비/시작 버튼 하나만 둔다. 나가기는 상단 뒤로가기의 기존 확인 창으로 유지한다. 390×844에서 준비 버튼은 y=764, 높이56, 하단 여백24로 이전 개발 도구 위치에 가깝게 내려갔다. 개발 도구는 개발 빌드의 헤더 DEV 버튼으로 옮겼다.

친구를 기다릴 때 하단 절반에는 중앙 28px 코드와 복사, 156×156 QR 프레임을 크게 표시한다. QR 영역 전체는 y=508~716으로 준비 버튼 위에 보인다. 복사 안내는 메타 문구 자리를 사용해 QR을 밀지 않는다. 친구 입장 시 초대 정보가 접히고 게임 선택이 나타난다. 연결·게임 선택 전 Ready는 비활성이며, 준비 후 Ready 버튼 또는 본인 Ready 표시로 취소할 수 있다. 양측 준비 후 호스트만 Start로 바뀌고 게스트는 호스트를 기다린다.

참가자 자리는 생성·준비 전후 같은 위치와 크기를 유지한다. safe area를 제외한 높이가 800px 미만인 로비에서는 참가자 고정을 해제해 QR 전체에 스크롤로 접근할 수 있다. QR은 기존처럼 미연결 프리뷰이며 실제 스캔 가능한 코드로 가장하지 않는다.

이번 변경 파일: `DuelPlayroom.tsx`(로비 배치·준비 조작), `DuelLobbyPanels.tsx`(큰 초대 영역), `GameFlowUI.tsx`(선택적 headerAction). 타입 검사 통과. 실제 앱 브라우저 확인 **30개 통과**: 390×844/360×800에서 QR 전체 표시, 320×568 및 높이763에서 스크롤 접근, 코드 복사, 준비·취소·시작 권한, 재연결, 뒤로가기, 게스트 참가, Game main 기본 헤더를 확인했다. Game main 관련 6개 파일 SHA256은 원본과 동일하다. 상태 모델을 수정하지 않아 기존 상태 테스트를 추가하거나 반복하지 않았다. 실기기 safe area·키보드·터치는 미검증이다. 웹의 미사용 지도 import 우회는 검수 후 제거했으며 commit/push/merge/배포하지 않았다.

최신 실제 앱 캡처: [큰 코드·QR](qa/duel-playroom-2026-11-05/qr-layout/02-large-qr-390.png) · [360px](qa/duel-playroom-2026-11-05/qr-layout/03-large-qr-360.png) · [게임 선택·Ready](qa/duel-playroom-2026-11-05/qr-layout/05-game-selected-390.png) · [양측 준비](qa/duel-playroom-2026-11-05/qr-layout/06-both-ready-390.png) · [작은 화면 스크롤](qa/duel-playroom-2026-11-05/qr-layout/09-small-scroll-320.png) · [Game main](qa/duel-playroom-2026-11-05/qr-layout/13-game-main-390.png) · [27개 확인](qa/duel-playroom-2026-11-05/qr-layout/checks.json) · [3개 추가 확인](qa/duel-playroom-2026-11-05/qr-layout/short-height-checks.json).

**이전 구현: 한 화면의 로비 — 2026-11-05**

Create game은 바로 같은 화면의 로비로 들어가고, Join game은 아래 영역에 코드 입력을 연다. 상단 두 참가자와 하단 행동 영역은 유지하며 가운데만 스크롤한다. 390×844에서 참가자 y=119.9, 행동 영역 y=600, 주 버튼 y=620으로 생성·참가·연결·준비 전후 동일함을 확인했다. 작은 높이와 큰 글자에서는 참가자도 함께 스크롤되며, 키보드가 열리면 입력 공간을 확보한다.

- 로비 가운데에 Game code, 복사, QR 펼치기/접기를 배치했다. 친구 대기 중 QR 영역을 펼치고, 친구 입장 시 접는다. 사용자가 다시 펼친 QR은 준비 상태가 바뀌어도 유지된다.
- 게임 선택 행은 대기 중에도 남아 있고 연결 후 호스트만 선택할 수 있다. 선택 UI도 같은 영역에 펼쳐진다. 선택 후에는 게임 요약과 Change, 기존 영상 검토 안내를 표시한다.
- 하단은 대기 → I’m ready → 상대 대기 → 호스트 Start로 바뀐다. 게스트 시작 권한, 각자의 준비, 재선택·재연결 시 준비 초기화 정책은 유지했다. Remote는 별도 Find a match 진입이다.
- 기존 손그림·토큰·버튼·헤더를 재사용했다. 이번 변경 파일은 `DuelPlayroom.tsx`, 새 `DuelLobbyPanels.tsx`, `GameFlowUI.tsx`다. 공통 GameScreen에는 기본값이 true인 `scrollable` 옵션만 추가해 Duel에서 독립 스크롤을 사용하고, 다른 화면은 기존 동작을 유지한다.

현재 저장소에는 실제 방 연결·QR 초대·스캐너·매치메이킹 서비스가 없다. QR은 가짜 코드 대신 **Not active in this preview**로 명시하고 스캔 버튼도 비활성으로 표시한다. 웹 코드 복사는 실제 클립보드 값으로 검증했다. 네이티브에서는 기존 React Native 클립보드 모듈을 사용하며 사용할 수 없으면 선택 가능한 코드를 길게 눌러 복사하도록 안내한다. 이름·코드·Ready를 승인 이미지의 값으로 하드코딩하지 않았다.

검수: 타입 검사 통과, 상태 테스트 **13개 통과**, 실제 앱 브라우저 검증 **36개 통과**. 반복 복사 시 안내 타이머 갱신·안내 자동 해제·Game main 렌더링도 별도로 확인했다. 390×844, 360×800, 320×568에서 참가·오류·게스트 권한과 조작 접근성을 확인했다. Game main 관련 6개 파일 SHA256은 원본과 같다. iOS 개발 번들은 HTTP 200으로 생성됐으며, 실제 기기의 키보드·safe area·접근성·클립보드는 미검증이다. 웹 검수용 미사용 지도 import 우회는 아래 환경 한계와 동일하며 검수 후 제거했다. commit/push/merge/배포는 하지 않았다.

최신 실제 앱 캡처: [생성·QR 대기](qa/duel-playroom-2026-11-05/lobby/02-created-qr-390.png) · [게임 선택](qa/duel-playroom-2026-11-05/lobby/05-inline-game-choice-390.png) · [양측 준비](qa/duel-playroom-2026-11-05/lobby/08-both-ready-host-390.png) · [참가 입력](qa/duel-playroom-2026-11-05/lobby/10-inline-join-390.png) · [참가 오류](qa/duel-playroom-2026-11-05/lobby/11-join-error-390.png) · [작은 화면](qa/duel-playroom-2026-11-05/lobby/14-join-small-320.png) · [Game main](qa/duel-playroom-2026-11-05/lobby/15-game-main-390.png) · [36개 검수 기록](qa/duel-playroom-2026-11-05/lobby/checks.json) · [추가 검수](qa/duel-playroom-2026-11-05/lobby/final-checks.json).

아래 내용은 이전 단계의 기록이다. 현재 초대·참가·게임 선택은 위 로비 구조로 대체됐다.

**버튼 위치 보정 — 2026-11-05**

사용자의 의도는 버튼 크기나 내부 간격 조정이 아닌 화면 내 위치 비율이었다. 장소 선택과 행동 버튼을 하나의 조작 영역으로 묶고, 화면에 남는 높이를 그 위에 배분해 아래쪽에 배치했다. 390×844에서 Create game 시작 위치는 y=495.9(약 59%) → y=620(약 74%)으로 이동했다. Join game은 y=688이며, Remote의 Find a match도 y=620에 맞췄다. 버튼 높이 56px, 버튼 사이 12px, 장소 선택과 버튼 사이 44px는 그대로다. 참가자 위치와 크기도 동일하다.

변경 코드는 `DuelPlayroom.tsx`의 진입 조작부 래퍼와 배치 스타일뿐이다. 타입 검사와 실제 화면 검증 18개를 통과했다. 390×844, 360×800, 360×640에서는 두 버튼이 화면 안에 보이고, 320×568에서는 일반 스크롤로 두 버튼에 함께 접근할 수 있다. Game main 6개 파일의 SHA256은 원본과 동일하다. 스타일 수정이므로 상태 단위 테스트를 새로 추가하거나 반복 실행하지 않았다.

최신 캡처: [Same place](qa/duel-playroom-2026-11-05/button-position/same-place-390.png) · [Remote](qa/duel-playroom-2026-11-05/button-position/remote-390.png) · [360×640](qa/duel-playroom-2026-11-05/button-position/same-place-360x640.png) · [320×568 스크롤](qa/duel-playroom-2026-11-05/button-position/same-place-320x568.png) · [전후 좌표·검수 기록](qa/duel-playroom-2026-11-05/button-position/checks.json).

**후속 디테일 수정 — 2026-11-05**

- 플레이룸 최상단 Duel 제목과 `Choose a game after connecting.` 문구를 제거했다. 뒤로가기와 기존 도움말은 유지한다.
- Same place의 주 행동은 `Create game`, 보조 행동은 `Join game`이다. 생성·참가 시트와 코드·나가기 문구도 game 용어로 맞췄다.
- Remote는 `Opponent` 자리·검색 아이콘·`Find a match`만 표시한다. 방 코드 생성·참가·초대 행동을 숨기고, 상태 모델에서도 Remote의 create/join을 거부한다. 기존 `location=remote&action=create|join` 링크도 매치메이킹 진입으로 열린다.
- 매치메이킹 서비스는 아직 없다. Find a match를 누르면 `Matchmaking isn’t connected yet.`를 표시하며 검색 중·매칭 성공·가짜 상대를 만들지 않는다. 장소 전환 시 안내를 지운다.
- 두 참가자 위치와 버튼 시작 위치를 유지하면서 행동 블록 위 여백을 12px 줄였다. Remote에서 두 번째 버튼이 사라져도 블록의 최소 높이는 유지한다.
- 후속 검수: 상태 테스트 **13개**, 실제 앱 화면 검증 **18개** 통과. 360/390px 화면과 레거시 Remote 경로를 확인했고, Game main 관련 6개 파일 SHA256은 원본과 동일하다. 타입 검사도 통과했다.

현재 화면: [Same place](qa/duel-playroom-2026-11-05/refinement/same-place-390.png) · [Remote](qa/duel-playroom-2026-11-05/refinement/remote-390.png) · [매치메이킹 미연결 안내](qa/duel-playroom-2026-11-05/refinement/remote-unavailable-390.png) · [게임 생성](qa/duel-playroom-2026-11-05/refinement/create-game-390.png) · [참가](qa/duel-playroom-2026-11-05/refinement/join-game-390.png) · [연결·준비](qa/duel-playroom-2026-11-05/refinement/connected-ready-390.png) · [18개 검수 기록](qa/duel-playroom-2026-11-05/refinement/checks.json).

아래는 최초 A안 적용 당시의 구현·검수 기록이다. Remote의 코드방 동작과 초기 버튼 문구는 위 후속 수정으로 대체됐다. 기존 네이티브 기기 검증 한계는 동일하며, 후속 작업에서도 commit/push/merge/배포를 하지 않았다.

2026-11-05. Downloads의 `PAWS_Duel_A_Codex_Handoff` 프롬프트, 승인 이미지, 화면 명세, QA 체크리스트와 예시 상태를 확인하고 현재 Expo 앱의 Duel 하위 화면을 수정했다. 별도 HTML 시안이나 새 이미지·라이브러리는 만들지 않았다.

첫 진입과 친구 연결 후 화면은 같은 `ParticipantSpot` 두 개를 유지한다. 현재 사용자가 항상 왼쪽이고, 오른쪽 빈자리만 연결된 참가자로 바뀐다. 참가자 영역의 바깥 카드나 큰 마스코트 패널은 없다. 이름은 현재 반려견 데이터에서 읽고, 데이터가 없을 때만 `Your dog`를 표시한다. 같은 장소가 기존 기본값이며 Remote도 선택할 수 있다.

| 이번 작업의 코드 파일 | 변경 내용 |
| --- | --- |
| `app/game/duel.tsx` | 기존 Duel 경로에서 실제 플레이룸 렌더링 |
| `app/game/room.tsx` | 기존 방 경로의 Duel만 플레이룸에 연결; Tournament 분기 유지 |
| `src/features/game/flow/DuelPlayroom.tsx` | 두 자리, 장소 선택, 초대/참가/게임/나가기 시트, 준비 조작, 개발 도구 |
| `src/features/game/flow/duelRoomState.ts` | 기존 로컬 프리뷰의 표시 상태를 분리하고 준비·권한·재연결 경계 정의 |
| `src/__tests__/duelRoomState.test.ts` | 상태 전이와 시작 조건 검증 11개 |

`GameScreen`, `GameButton`, `TextAction`, `PressScale`, 공통 `ui` 스타일, 디자인 토큰과 기존 Modal 패턴을 재사용했다. 작은 강아지 그림은 `src/features/profile/components/ProfileDog.tsx`와 기존 `profileDogPaths.ts`다. 현재 Dog 모델에는 사진 필드가 없어 새 사진 기능을 만들지 않았다. 승인 이미지의 이름·방 코드·준비 상태를 제품 기본값으로 쓰지 않았다.

방 생성, 참가, 친구 연결, 게임 선택, 자신의 준비, 상대의 준비는 각각 독립적인 이벤트다. 연결 직후에는 게임 미선택·양측 Not ready이고, 선택은 두 명이 연결된 뒤 호스트만 가능하다. `I’m ready`는 자신의 상태만 바꾼다. 양측 준비 후 호스트의 명시적 Start가 기존 `/game/play/paws-says` → 준비·촬영·검토 경로로 이어진다. 게스트는 Waiting for host 상태로 남는다. 게임 재선택·연결 손실·상대 이탈·경기 화면에서 복귀하면 준비 상태가 해제된다. 이 시작 정책은 로컬 프리뷰의 표시 정책이며 서버 경기 정책을 새로 확정한 것이 아니다.

초대 시트를 닫거나 다시 열어도 같은 방 코드가 유지된다. 나가기는 별도 확인으로 처리한다. 참가 코드는 기존 6자리 영숫자 입력 방식을 유지하고 입력 옆에 오류를 표시한다. 실제 원인이 없는 full/expired 오류는 만들어내지 않는다. 키보드 대응은 Duel 시트 안의 KeyboardAvoidingView와 ScrollView로 처리했다.

현재 저장소의 Duel은 실제 방 서버가 연결되지 않은 프리뷰였다. 새 네트워크·QR·공유·촬영·판독 기능을 추가하지 않았다. 생성 코드는 매번 만드는 **로컬 프리뷰 코드**로 명시하고, QR/Share는 미연결 상태로 표시한다. 예시 참가자 추가·상대 준비·연결 복구·게스트 호스트 이벤트·긴 이름 검수는 `__DEV__`의 Development tools에서만 조작한다. 일반 Retry를 눌러 연결 성공을 가장하지 않는다.

A 승인 이미지와의 차이는 기존 작은 ProfileDog 손그림, 공통 헤더·버튼의 원래 크기, 실제 데이터가 없는 경우의 일반 이름, Local preview 표시와 개발 도구 진입점이다. 새 캐릭터나 예시 QR을 제품 자산으로 가져오지 않기 위한 선택이다. 프로필 이름은 두 줄까지 표시하고 전체 이름을 접근성 라벨로 제공한다.

검수 결과:

- `npm run typecheck`: 통과.
- `npm test -- --runInBand src/__tests__/duelRoomState.test.ts src/__tests__/soloRoundController.test.ts src/__tests__/soloRecording.test.ts`: 3 suites, **44 tests 통과**.
- 실제 Expo 웹 앱에서 CDP 입력으로 **35개 확인 통과**: 호스트 21개, 게스트·접근성 13개, 작은 높이의 참가 시트 1개. 제품 상태를 외부에서 주입하지 않고 화면의 버튼·입력·명시적인 개발 도구를 사용했다.
- 360×800, 390×844, 참가 시트 390×480에서 확인. 긴 이름의 가로 넘침 없음. 브라우저 텍스트를 200% 확대해 줄바꿈과 준비 버튼 접근 가능 확인. 확대 화면은 네이티브 Dynamic Type 검증을 대체하지 않는다.
- 내 참가자 자리의 x/y/width가 첫 진입과 연결 후 동일함을 DOM 좌표로 확인.
- iOS 개발 번들 HTTP 200 생성 성공. 실제 iPhone의 화면·카메라·오디오 검증은 아니다.
- `git diff --check`: 통과. 프로젝트에 lint 명령은 없어 별도 lint는 실행하지 않았다. 전체 테스트 스위트 결과를 주장하지 않는다.

Game main의 소스·탭 레이아웃·ModeIllustration·modePaths·PawsTabBar·디자인 토큰 **6개 파일 SHA256이 시작 때와 동일**하다. 메인 전후 캡처에서 카드 이름, 그림, 색상, 탭, 배치를 확인했다. 첫 캡처에는 진입 모션 시점 차이가 있어 PNG 바이트 단위 동일성은 검증 기준으로 삼지 않았다. Tournament의 Coming soon 정책도 유지된다.

작업 중 별도 Solo/Red Light, Green Light 변경이 공유 작업 폴더에 추가됐다. 이 작업은 해당 `SoloCameraScreen.tsx`, `GameFlowUI.tsx`, `gameFlow.ts`, `redGreenLight.ts` 및 관련 테스트를 수정하거나 되돌리지 않았다.

실제 렌더링 캡처는 [QA 폴더](qa/duel-playroom-2026-11-05/)에 저장했다. 아래는 주요 상태다.

| 화면 | 캡처 |
| --- | --- |
| Game main 전 / 후 | [전](qa/duel-playroom-2026-11-05/game-main-before-390.png) · [후](qa/duel-playroom-2026-11-05/game-main-after-390.png) |
| 첫 진입 / Remote | [Same place](qa/duel-playroom-2026-11-05/01-entry-390.png) · [Remote](qa/duel-playroom-2026-11-05/02-entry-remote-390.png) |
| 초대 / 친구 대기 | [초대](qa/duel-playroom-2026-11-05/03-invite-390.png) · [대기](qa/duel-playroom-2026-11-05/04-waiting-390.png) |
| 연결 후 게임 미선택 | [연결됨](qa/duel-playroom-2026-11-05/05-connected-unselected-390.png) |
| 게임 선택·상대만 Ready | [390px](qa/duel-playroom-2026-11-05/07-friend-ready-390.png) · [360px](qa/duel-playroom-2026-11-05/11-friend-ready-360.png) |
| 양측 Ready | [호스트](qa/duel-playroom-2026-11-05/08-both-ready-host-390.png) · [게스트](qa/duel-playroom-2026-11-05/18-both-ready-guest-390.png) |
| 나만 Ready | [상대 대기](qa/duel-playroom-2026-11-05/09-self-ready-390.png) |
| 재연결 / 상대 이탈 | [재연결](qa/duel-playroom-2026-11-05/10-reconnecting-390.png) · [이탈](qa/duel-playroom-2026-11-05/12-friend-left-390.png) |
| 참가 오류 / 작은 높이 | [오류](qa/duel-playroom-2026-11-05/16-join-unknown-error-390.png) · [390×480](qa/duel-playroom-2026-11-05/22-join-short-viewport-390.png) |
| 긴 이름 / 200% 글자 | [긴 이름](qa/duel-playroom-2026-11-05/19-long-names-360.png) · [확대](qa/duel-playroom-2026-11-05/20-text-200-percent-360.png) · [확대 후 준비 조작](qa/duel-playroom-2026-11-05/21-text-200-percent-action-360.png) |

검수 환경의 한계: 기존 `PlannerMap.tsx`의 `react-native-maps` import가 웹 초기화를 막아, 검수 중에만 임시 Metro 설정으로 **미사용 지도 import**를 우회했다. 지도 화면을 실제 렌더링하면 오류를 내는 shim이므로 Care 화면을 대체 렌더링한 것이 아니다. Duel/Game main은 현재 앱의 실제 컴포넌트이며 별도 HTML이 아니다. 이 임시 설정과 shim은 검수 후 제거했다. 네이티브 해석에는 이 우회가 적용되지 않는다.

네이티브 iOS/Android에서 실제 키보드, safe area, OS 뒤로가기, 스크린리더 포커스 복귀와 실기기 큰 글자 설정은 미검증이다. 실시간 다중 기기 연결은 기존 미구현 기능이다. commit, push, merge, 배포는 수행하지 않았다.
