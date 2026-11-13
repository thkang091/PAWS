# Solo 촬영 준비: 중앙 유도와 대상 추적

2026-11-04. 촬영을 시작하기 전에 강아지가 화면에 보기 좋게 들어오는지 안내한다. 추적 상태나 구도 안내는 Start round를 막지 않으며, 발·관절·자세 검증을 요구하지 않는다.

## 화면 흐름

1. `Find a clear spot`에서 화면 중앙에 옅은 가이드와 `Bring your dog to the center`를 보여준다.
2. 중앙 부근에서 강아지 후보가 잡히면 해당 대상을 얇은 박스로 추적한다.
3. 버튼 위에 Distance / Visibility / Position을 표시한다. Visibility는 추적 상태의 안내이며 전신 가시성이나 최종 AI 판정을 의미하지 않는다.
4. 너무 작음·너무 큼·프레임 위아래 잘림·심한 치우침이 약 900ms 지속되면 우선순위가 높은 안내 하나를 표시한다. 안정되면 `Looks good`를 잠시 보여준 뒤 숨긴다.
5. 짧은 추적 누락에는 여유를 두고, 놓치면 중앙 가이드와 재진입 안내로 돌아간다. 작은 재설정 버튼으로 다시 중앙에서 대상을 잡을 수 있다.
6. Start round를 누르면 추적을 끄고 기존 3초 카운트다운·녹화·영상 확인으로 이어진다. 추적이 없어도 촬영할 수 있다.

## 구현 범위

- iPhone: Apple Vision `VNRecognizeAnimalsRequest`로 중앙 가까운 강아지 후보를 찾고 `VNTrackObjectRequest`로 추적한다. 처음에는 약 2.5fps 탐색, 추적 중 최대 8fps, 가끔 재인식으로 배경으로의 이탈을 확인한다.
- 영상 프레임은 기기 안에서만 분석한다. JavaScript에는 박스·추적 상태만 전달하며 서버 호출이나 사진 저장을 하지 않는다.
- Expo Camera 56.0.8의 같은 카메라 세션에 준비용 영상 분석 출력을 추가한다. 실제 녹화 요청 시 sessionQueue에서 분석 출력을 먼저 제거한다. 다른 화면에서는 기본적으로 비활성이고, QR 스캐너가 우선한다.
- 패치는 `patches/expo-camera+56.0.8.patch`에 보관한다. SDK 56의 `expo.autolinking.ios.buildFromSource` 설정으로 Expo Camera만 소스 빌드한다.
- 이전 iPhone 빌드·Android·웹에서는 자동 추적을 사용하지 않는다. 수동 중앙 가이드를 유지하며 상태를 확인 완료로 표시하지 않는다. Android 자동 추적은 별도 작업이다.
- `soloTrackingGeometry.ts`가 회전·미러링이 반영된 입력 박스를 aspect-fill 프리뷰 좌표로 변환한다. `soloFramingGuide.ts`가 부드러운 안내와 일시적인 인식 누락을 관리한다.

## 검증

좌표 변환과 안내 정책에 55개 테스트를 추가했다. 타입 검사 및 전체 78개 테스트 모음의 1,158개 테스트가 통과했다. iOS HTTPS 번들에서 중앙 안내, 좌표 변환, 이전 빌드 호환 가드를 확인했다.

실제 iPhone에서는 다음 항목을 확인한다.

- 중앙에서 강아지가 잡히고 박스가 대상을 따라가는지, 카메라 전환 시 이전 박스가 사라지는지.
- 조금 움직이거나 잠시 가려졌을 때 안내가 계속 깜빡이지 않는지.
- 작은 대상, 화면 가장자리, 프레임 위아래 잘림에 안내 하나만 나타나는지.
- 재설정 버튼이 카메라를 닫지 않고 중앙 탐색으로 돌아가는지.
- 강아지를 찾지 못해도 Start round가 작동하는지.
- 3초 카운트다운 뒤 실제 녹화·음성·재생이 유지되는지. Longest Sit 20초, Combo 12초, Spot 8초 및 수동 종료를 확인한다.
- 앱 백그라운드·복귀·카메라 권한 거부 및 다른 화면의 카메라·QR 동작이 유지되는지.

iPhone 개발 빌드 5가 2026-11-04 18:50:44 UTC에 완료됐다. IPA 내 `PawsObjectTracker`, `pawsTrackingVersion`, `onPawsTrackingUpdate`를 확인했고, 18개 바이너리의 필수 `@rpath` 참조 67개와 ExpoModulesJSI 포함 검증을 통과했다.

설치: https://expo.dev/accounts/tminjae1124/projects/paws/builds/7508d9fa-70d1-4830-8687-b3c2265eae6c

실제 감지 품질과 기기에서의 동작은 자동 테스트나 빌드 검증만으로 확인되지 않는다. 위 iPhone 점검 항목은 아직 기기 확인이 필요하다.
