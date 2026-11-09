# Challenge / Duel 뒤로가기 중복 수정

2026-11-05. Challenge와 Duel의 최상위 뒤로가기가 `router.replace("/(tabs)/game")`를 호출해, 기존 탭 화면을 남겨둔 채 현재 game 경로를 새 탭 화면으로 교체했다. 실제 앱의 탐색 상태를 관찰해 루트 화면이 `[(tabs), game] → [(tabs), (tabs)]`가 되는 것을 재현했다. Lucky는 `router.back()`으로 원래 탭으로 돌아가므로 중복이 없었다.

수정 파일은 `src/features/game/flow/SoloScreens.tsx`, `src/features/game/flow/DuelPlayroom.tsx` 두 곳이다. 최상위 뒤로가기에 `router.dismissTo("/(tabs)/game")`를 사용해 기존 탭 화면의 key를 보존하면서 game 하위 기록을 제거한다. 직접 링크로 들어와 기존 탭이 없는 경우에는 탭 화면 하나로 대체하는 Expo Router의 기본 fallback을 사용한다. Lucky, Game main 디자인, 화면 전환 애니메이션 설정은 변경하지 않았다. Duel의 참가 취소·게임 선택 닫기·나가기 확인은 기존 순서를 유지한다.

검수 결과:

- `npm run typecheck`: 통과.
- 실제 Expo 앱 브라우저에서 버튼 입력 후 설치된 Expo Router의 navigationRef 상태를 읽어 **16개 확인 통과**. 제품 상태나 라우팅 결과를 외부에서 주입하지 않았다.
- Challenge, Duel, Lucky 각각 3회 연속 진입·뒤로가기 후 탭 화면은 1개이고, 최초 탭의 key가 유지됐다.
- Challenge 상세 화면에서 단계별 복귀, Duel 참가 입력 취소·로비 유지 확인·나가기 후 복귀, Challenge/Duel 직접 링크 fallback을 확인했다.
- `git diff --check`: 통과. 네이티브 실기기의 스와이프 애니메이션 자체는 미검증이며, 중복의 원인인 실제 앱 탐색 상태를 검증했다.
- 검수 중 기존 지도 모듈의 미사용 웹 import만 임시 Metro shim으로 우회했다. 검수 후 임시 설정·shim·브라우저를 정리했다.
- commit, push, merge, 배포를 하지 않았다.

| 화면 | 수정 전 뒤로가기 후 탭 수 | 수정 후 | 기존 탭 key 유지 |
| --- | --- | --- | --- |
| Challenge | 2 | 1 | 예 |
| Duel | 2 | 1 | 예 |
| Lucky | 1 | 1 | 예 |

[수정 전 탐색 기록](qa/game-navigation-2026-11-05/before.json) · [수정 후 16개 확인과 탐색 기록](qa/game-navigation-2026-11-05/after.json) · [복귀한 Game main](qa/game-navigation-2026-11-05/game-main-after-390.png)
