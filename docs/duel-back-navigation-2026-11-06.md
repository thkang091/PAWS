# Duel 버튼·스와이프 뒤로가기 일치

뒤로가기 버튼의 기존 동작을 기준으로 Create/Join 단계의 스와이프를 통일했다.

| 현재 화면 | 버튼 / 스와이프 공통 결과 |
| --- | --- |
| Join 코드 입력 | 입력·오류를 지우고 같은 Duel 경로의 첫 화면으로 복귀 |
| QR 스캐너 | 스캐너를 닫고 Join 화면 유지 |
| 생성·참가한 방 | 같은 `Leave game?` 확인창 표시 |
| 나가기 확인 → Stay/닫기 | 현재 방과 탐색 경로 유지 |
| 나가기 확인 → Leave 성공 | 방을 정리하고 같은 Duel 경로의 첫 화면으로 복귀 |
| 생성·참가·방 변경 요청 처리 중 | 버튼과 스와이프 모두 이동 차단 |
| 빈 Duel 첫 화면 | 기존 Game main 복귀 동작 유지 |

원인은 Join 입력 단계가 화면 제거 보호에서 빠진 점과, 방에서 스와이프의 원본 POP을 저장했다가 Leave 성공 후 재실행한 점이었다. 버튼은 상태만 초기화했기 때문에 두 입력의 목적지가 달랐다.

`src/features/game/flow/DuelPlayroom.tsx`의 `usePreventRemove`가 헤더·Android 뒤로가기와 동일한 `back()`을 호출하도록 바꾸고, Join·스캐너·확인창·Create/Join 요청 중 상태를 보호 대상에 포함했다. `pendingLeaveAction`과 Leave 성공 후 원본 탐색 액션 재실행은 제거했다. 게임 화면으로 push하거나 뒤에 있는 로비가 focus를 잃는 동작은 기존대로 유지한다. [React Navigation의 화면 제거 보호 동작](https://reactnavigation.org/docs/use-prevent-remove/)

2026-11-05의 기존 Leave guard 검수에서 “스와이프 확인 후 Game main으로 복귀”를 통과 조건으로 삼은 부분은 이번 버튼 기준에 따라 폐기했다. 당시 검수 자료는 이력이며 현재 기대 동작은 위 표다.

Game main·탭 레이아웃·모드 그림·탭 바·디자인 토큰 6개 파일은 기존 SHA-256과 동일하다. DB와 Remote/matchmaking은 변경하지 않았다. commit/push/merge/배포하지 않았다.

검수: 타입 검사와 `git diff --check`가 통과했다. 실제 앱을 격리된 브라우저와 로컬 SQL 방 서버에서 실행해 **18개 확인을 통과**했다. Join의 버튼/GO_BACK/부모 POP, 호스트·게스트의 버튼/스와이프 대응 나가기, Stay, 연결 실패 시 방·확인창·route key 유지, 재시도, 이후 Game main으로 복귀할 때 중복 탭이 생기지 않는 것을 확인했다. 탐색 상태나 React 방 상태를 주입하지 않고 실제 UI와 설치된 navigation ref를 사용했다.

[18개 검수 결과와 화면 기록](qa/duel-back-parity-2026-11-06/checks.json). 스와이프에 대응하는 native-stack 탐색 액션은 검증했으며 실제 iPhone에서 손으로 수행하는 제스처 애니메이션 자체는 미검증이다.

확인용 iPhone 개발 서버를 다시 실행했으며, 최신 코드의 iOS 번들 응답이 HTTP 200인 것을 확인했다. [iOS 번들 확인 기록](qa/duel-back-parity-2026-11-06/ios-bundle.json)
