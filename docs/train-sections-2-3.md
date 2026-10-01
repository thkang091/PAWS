# Section 2·3 영상 연결

50개 Level **전체 연결**. 추가 확보 영상과 사용자 승인 재사용으로 남은 4개를 채웠다.
기존 훈련 화면·준비 화면·0.6배속·클릭 자막·자동 스크롤·Continue 완료 유지
동작을 그대로 사용한다. AI 영상, 원격 DB 변경, 진행도 초기화는 없다.

## 연결 범위

| Lesson | 연결 Level | 영상 구성 |
| --- | --- | --- |
| 2-1 Mark the Right Choice | 1–5 | 최신 `v2` 원본 클립. 마커, 시선, 숨긴 보상, 행동 비교, 문 앞 루틴 |
| 2-2 Pause Access to Rewards | 1–5 | 놀이 중단·재개, 간식 접근, 쉬운 대안, 실내 경계, 두 상황 비교 |
| 2-3 Learn Clear Feedback Words | 1–5 | Yes, This way, 신호 역할 비교, 먼 방해에서 방향 전환, 걷기·놀이 |
| 2-4 Build a Reward Pattern | 1–5 | 반복 보상, 제자리 보상, 숨긴 보상, 음식·쓰다듬기·놀이 비교 |
| 2-5 Practice a Calm Reset | 1–5 | 중단, 신발에서 이동·씹기 대안, 쉬운 재시도, 짧게 재시도 후 종료 |
| 3-1 Enjoy Everyday Touch | 1–5 | 어깨, 목·등, 가슴·어깨, 두 접촉 예시, 익숙한 성인의 짧은 등 접촉 |
| 3-2 Prepare for Nail Care | 1–5 | 다리, 발·발바닥, 발가락·발톱, 도구 소개, 자르지 않는 도구 접촉 |
| 3-3 Prepare for Hygiene Checks | 1–5 | 외부 귀, 볼, 입술 접촉·들기, 외부 뒤쪽 접촉, 두 검사 예시 |
| 3-4 Stay Calm for Bath and Towel | 1–5 | 마른 매트, 먼 물 자극, 젖은 천, 짧은 수건 접촉, 천·수건 예시 |
| 3-5 Comfortable With Another Handler | 1–5 | 자발적 접근·보상, 짧은 등 접촉, 목줄 바깥 접촉, 접근·접촉·자유로운 종료 예시 |

## 추가 연결한 부분 (2026-09-30)

| Lesson / Level | 사용 소스 | 적용 방식 |
| --- | --- | --- |
| 3-1 / 5 | 3-5의 04 Brief Back Stroke | 익숙한 성인의 짧은 등 접촉. 안내의 부위를 어깨 또는 등으로 확장 |
| 3-5 / 3 | 3-5의 04 Brief Back Stroke | 짧게 만지기 → 손 떼기에 집중하는 별도 자막 |
| 3-5 / 4 | 3-5의 05 Lv4 Collar Outside Touch and Withdrawal | 실제 목줄 바깥 접촉 → 손 떼기. 하네스 착용이나 보호자 교대 시범으로 주장하지 않음 |
| 3-5 / 5 | 3-5의 01 + 02 | 접근·보상과 등 접촉·자유로운 종료를 별도 시범으로 연결 |

이제 3-1과 3-5도 Level 1–5가 순서대로 연결된다. 접촉 부위 안내는
`handlingContent.ts`에서 앱에만 적용하며 Level ID·진행도·준비물·Checkpoint는 보존한다.
원격 DB를 변경하지 않았다.

## 영상 해석과 제한

- 자막은 원음 전사가 아닌 짧은 행동 안내다. 소리를 숨기고 0.6배속으로 재생하며
  클릭 시각은 원본 영상 시간으로 유지한다. 정확한 마커 발화 펄스를 인증하지 않는다.
- 여러 촬영을 연결한 곳은 `Another example` / `Separate example`로 구분한다.
  같은 개의 연속된 성공이나 다른 날의 수행으로 주장하지 않는다.
- 2-2·2-5의 플러트 폴은 중단·재개의 순서 예시다. 실제 연습은 더 작고 낮은
  움직임으로 하도록 자막에 안내한다. 활발한 놀이를 차분한 시범이라고 부르지 않는다.
- 2-3의 눈에 보이는 프리스비는 시각적 도움이며, 원본의 거리 표시는 보편적 기준이 아니다.
- 3-2 Level 5는 기존 curriculum의 쉬운 대안인 **자르지 않는 도구 접촉**이다.
  실제 발톱 절단 영상은 아니다. 원본의 자막·로딩 표시 같은 녹화 요소는 남아 있다.
- 3-4 Level 5는 기존 curriculum의 천·수건 대안이다. 전체 목욕 시범은 아니다.
- 3-5 원본 폴더는 변경하지 않았다. 추가 04·05를 검토해 앱 자산으로 변환했다.
  04에는 보상 전달이 나오지 않으므로 자막은 접촉·손 떼기·멈춤까지 안내한다.

## 재생성 및 코드

`scripts/training_sections23_content.py`: Level별 소스 순서, 행동 자막, 누락 이유.
`scripts/training-sections23-sources.json`: 읽기 전용 소스 목록.
`scripts/build-sections23-clips.py`: 영상 및 JSON/TS registry 생성.

실행: `python scripts/build-sections23-clips.py --source <Actual 폴더> --ffmpeg <ffmpeg 경로>`

원본을 수정하지 않고 앱의 `assets/training/section-2-*`, `section-3-*`에 내보낸다.
영상은 30fps H.264, 1280×720, 원본 비율을 유지하며 무음으로 생성한다.
컨테이너의 오디오 길이가 아닌 디코딩한 영상 프레임 수로 타임라인을 계산한다.
동일한 lesson 안에서 같은 소스 순서는 asset을 공유한다. 생성 JSON에는 50개 Level,
실제 MP4는 48개다. 기존 파일을 유지하며 일부 lesson만 다시 렌더하려면
`--render-skills 3-1 3-5`를 추가한다.

생성된 `sections23Coverage.generated.json`에 Level별 원본 경로와 프레임 수,
asset 공유 관계 및 누락 이유가 기록된다.

## 기존 검증 결과 (46개 연결 시점)

- TypeScript 검사와 관련 테스트 176개 통과.
- 46개 Level 모두 브라우저의 실제 player에서 파일 길이, 0.6배속, 무음,
  모든 자막 클릭 위치·재생 재개, 끝까지 재생한 후 Continue, 재시청·이전 자막
  이동 후 Continue 유지, 다음 확보 Level 연결 확인.
- 누락 Level의 null binding과 해당 Level을 자동 시작하지 않는 흐름 검증.
- Pixel 7에서 실제 2-1 준비 화면과 3-5 네이티브 영상·자막·완료 상태 확인.
- 검증 과정에서 훈련 결과를 기록하거나 Energy를 소모하지 않았다.

## 추가 연결 검증 (2026-09-30)

- TypeScript 검사 및 관련 6개 테스트 모음, 184개 테스트 통과.
- 3-1·3-5의 10개 Level을 실제 브라우저 플레이어로 검증: 파일 길이,
  0.6배속·무음, 모든 자막 탐색·재생 재개, 재시청 후 Continue 유지,
  Level 1→2→3→4→5 연결. 브라우저 실행 오류 없음.
- 생성 시 디코딩한 프레임 수와 자막 범위를 검사했다.
- Pixel 7의 설치된 PAWS에서 새 3-5 L4 영상·자막·완료 후 Continue 표시 확인.
  에뮬레이터에는 해당 Level 미리보기를 열어 두었다.
