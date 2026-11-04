# Solo 전체 화면 카메라 UI

최신 변경: 2026-11-03의 [Solo 제한 시간과 제출 흐름](./game-solo-timed-flow-2026-11-03.md)을 참고한다. 아래 내용은 2026-10-28 구현 당시의 기록이며, 종료 후 중간 화면과 검토 흐름은 후속 변경으로 대체되었다.

2026-10-28. 기존 Game UI의 Solo 촬영 준비·카운트다운·경기를 하나의 화면으로 통합했다.

## 화면 흐름

`게임 안내 → Set up camera → 전체 화면 준비 → 5초 카운트다운 → 경기 → 종료 → Review round`

준비·카운트다운·경기는 `/game/prepare` 안의 상태 전환이며, 이 세 단계 사이에서 카메라를 새로 마운트하지 않는다. 기존 `/game/session?mode=solo` 링크는 준비 화면으로 이동한다. Duel은 기존 준비/경기 흐름을 유지한다.

- 준비: 전신/경로를 위한 얇은 프레임 가이드, 짧은 안내, PAWS 노란 시작 버튼. 기존 체크박스 세 개 제거.
- 카운트다운: 중앙 숫자 5 → 0, 취소하면 준비로 복귀. 별도 페이지 이동 없음.
- 경기: 상단 명령·경과 시간, 하단 종료 버튼. 중앙 촬영 영역을 비워 둔다.
- Longest Sit: `Sit & stay`, 종료 안내.
- Combo: `1 Sit → 2 Paw → 3 Spin`을 함께 표시. Next command 조작 제거. 이번 단계의 명령은 기존 고정 예시이며 서버 무작위화는 미연결.
- Spot Sprint: Mat / Low platform 선택과 해당 목표에 맞는 명령. Review와 Retake 뒤에도 선택 유지. 가이드는 사용자 안내이며 AI가 목표를 인식했다는 표시는 아님.
- 종료: 경과 시간과 Review round / Set up again. Review는 기존의 예시 검토 화면으로 연결.

## 연결 범위

이번 변경은 카메라 UI와 로컬 화면 상태 전환이다. `SoloCameraSurface.tsx`는 휴대폰에서 사용자가 권한을 허용하면 Expo Camera의 실제 프리뷰를 보여준다. 준비 완료 전에는 시작할 수 없다. Settings 복귀 후 권한 재조회, 프리뷰 시작 실패/시간 초과의 재시도, 화면 이탈/백그라운드에서 카메라 해제를 처리한다.

브라우저는 `SoloCameraSurface.web.tsx`의 명시적인 카메라 자리표시자를 사용한다. 브라우저 카메라 권한을 요청하지 않는다. 모든 단계 상단에 `Preview · not recording`을 표시한다. 녹화 파일 생성, 오디오 시작 신호, AI 호출, 업로드, 점수 저장은 이번 변경에 포함하지 않는다. 앞선 AI 설계의 동기화·영상 판독 규칙은 후속 구현 범위다.

## 검증

- TypeScript `npx tsc --noEmit` 통과. `git diff --check` 오류 없음.
- 브라우저 390×844에서 세 게임의 준비→카운트다운→경기→종료 흐름 확인.
- 카운트다운 취소, 경기 중 나가기 확인/계속, Review 이동, Retake, Set up again 확인.
- Spot의 Low platform이 Review/Retake 뒤에도 유지되고 실제 radio `aria-checked=true`임을 확인.
- 320×568에서 Spot의 목표 선택과 시작 버튼이 잘리지 않으며 문서 가로/세로 넘침 없음.
- 기존 Solo session 링크의 setup 이동, Duel의 기존 체크리스트 준비 화면 유지 확인.
- iOS/Android 카메라 권한과 실제 프리뷰, 앱 중단/복귀는 실기기에서 추가 확인 필요. 브라우저 검증을 실제 촬영 검증으로 간주하지 않는다.

## 결과물

- 갤러리: http://127.0.0.1:8093/
- 핵심 네 화면: http://127.0.0.1:8093/board.html
- 앱 진입: http://127.0.0.1:8089/game/play/longest-sit?mode=solo
- 캡처·갤러리 소스: `C:/Users/Minjae/.codex/visualizations/2026/10/20/01a15a4b-d233-75d1-9798-e9b202dc000b/game-solo-camera`

이전 준비/경기 화면과 나란히 비교할 수 있다. 갤러리의 카메라 배경은 웹 프리뷰의 실제 캡처이며 촬영 영상이 아니다.
