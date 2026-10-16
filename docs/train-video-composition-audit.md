# Training video composition audit — 2026-10-06

정리 **전** 로컬 앱에 연결된 28개 lesson / 140개 level을 조사한 스냅샷.
이후 적용한 14개 level의 정리 결과는 [train-video-focus.md](train-video-focus.md)에 기록했다.

## 집계 기준

- **원본 수**: level 안의 서로 다른 YouTube videoId 수. 같은 채널의 다른 영상도 각각 센다.
- **재생 구간 수**: 앱이 순서대로 불러오는 startSeconds–endSeconds 구간 수. 같은 원본을 여러 번 쓰면 여러 구간으로 센다.
- **원본 전환 수**: 재생 순서에서 서로 다른 videoId로 바뀌는 횟수. A→B→A는 원본 2개지만 전환 2회다.
- **길이**: 사용된 구간들의 1배속 합계. 0.5배속 시 시청 시간은 약 두 배이며 로딩 시간은 별도다.

## 전체 요약

- 서로 다른 원본 3개 이상: 5개 level.
- 서로 다른 원본 정확히 2개: 27개 level. 이 중 9개는 3개 이상 구간으로 분할돼 있다.
- 원본 1개, 여러 구간: 11개 level. 모두 2구간이다.
- 원본 1개, 구간 1개: 97개 level.
- 여러 구간을 쓰는 곳은 총 43개이며, 3구간 이상인 곳은 14개다.

| Section | 원본 3개 이상 | 원본 2개 | 같은 원본 2구간 |
|---|---:|---:|---:|
| 1. Rules & boundaries | 2 | 7 | 2 |
| 2. Clear communication | 0 | 5 | 1 |
| 3. Handling & grooming | 0 | 5 | 4 |
| 4. Calm everyday manners | 0 | 3 | 3 |
| 5. Potty & real-world skills | 1 | 0 | 0 |
| 6. Problem behaviors | 2 | 7 | 1 |

## 우선 정리 대상: 원본 3개 이상

| Lesson | Level | 원본 | 구간 | 원본 전환 | 길이 (1x) |
|---|---:|---:|---:|---:|---:|
| 1-5 Pause Unnecessary Barking | L1 | 4 | 4 | 3 | 14.5초 |
| 1-5 Pause Unnecessary Barking | L4 | 3 | 4 | 2 | 17.3초 |
| 5-2 Recover Calmly After Accidents | L5 | 3 | 3 | 2 | 14.8초 |
| 6-2 Choose Toys, Not Hands | L4 | 3 | 3 | 2 | 16.6초 |
| 6-4 Reduce Demand Barking | L4 | 3 | 3 | 2 | 12.3초 |

## 원본 2개지만 구간도 줄일 필요가 있는 대상

| Lesson | Level | 원본 | 구간 | 원본 전환 | 길이 (1x) |
|---|---:|---:|---:|---:|---:|
| 1-4 Start a Potty Routine | L2 | 2 | 3 | 1 | 23.1초 |
| 1-4 Start a Potty Routine | L3 | 2 | 3 | 2 | 39.9초 |
| 1-4 Start a Potty Routine | L4 | 2 | 5 | 1 | 49.3초 |
| 1-4 Start a Potty Routine | L5 | 2 | 4 | 1 | 43.6초 |
| 1-5 Pause Unnecessary Barking | L2 | 2 | 3 | 1 | 10.6초 |
| 1-5 Pause Unnecessary Barking | L3 | 2 | 4 | 2 | 21.3초 |
| 1-5 Pause Unnecessary Barking | L5 | 2 | 3 | 1 | 19.5초 |
| 2-4 Build a Reward Pattern | L4 | 2 | 3 | 1 | 21.5초 |
| 6-3 Redirect Destructive Chewing | L5 | 2 | 3 | 2 | 36.8초 |

## 원본 2개 / 구간 2개

| Lesson | Level | 원본 | 구간 | 원본 전환 | 길이 (1x) |
|---|---:|---:|---:|---:|---:|
| 2-1 Mark the Right Choice | L4 | 2 | 2 | 1 | 13.1초 |
| 2-2 Pause Access to Rewards | L5 | 2 | 2 | 1 | 21.8초 |
| 2-3 Learn Clear Feedback Words | L3 | 2 | 2 | 1 | 8.6초 |
| 2-5 Practice a Calm Reset | L1 | 2 | 2 | 1 | 25.3초 |
| 3-1 Enjoy Everyday Touch | L4 | 2 | 2 | 1 | 26.4초 |
| 3-2 Prepare for Nail Care | L2 | 2 | 2 | 1 | 9.6초 |
| 3-3 Prepare for Hygiene Checks | L3 | 2 | 2 | 1 | 15.8초 |
| 3-3 Prepare for Hygiene Checks | L5 | 2 | 2 | 1 | 11.5초 |
| 3-4 Stay Calm for Bath and Towel | L5 | 2 | 2 | 1 | 15.6초 |
| 4-3 Recover From Everyday Sounds | L4 | 2 | 2 | 1 | 16.2초 |
| 4-4 Use Your Resting Space | L2 | 2 | 2 | 1 | 15.1초 |
| 4-4 Use Your Resting Space | L4 | 2 | 2 | 1 | 19.3초 |
| 6-1 Drop It on Cue | L4 | 2 | 2 | 1 | 12.7초 |
| 6-2 Choose Toys, Not Hands | L5 | 2 | 2 | 1 | 12.4초 |
| 6-3 Redirect Destructive Chewing | L3 | 2 | 2 | 1 | 22.4초 |
| 6-4 Reduce Demand Barking | L2 | 2 | 2 | 1 | 7.9초 |
| 6-4 Reduce Demand Barking | L5 | 2 | 2 | 1 | 8.1초 |
| 6-5 Manage Alert Barking | L3 | 2 | 2 | 1 | 17.8초 |

## 같은 원본의 2구간

| Lesson | Level | 원본 | 구간 | 원본 전환 | 길이 (1x) |
|---|---:|---:|---:|---:|---:|
| 1-3 Drop It | L2 | 1 | 2 | 0 | 19.6초 |
| 1-4 Start a Potty Routine | L1 | 1 | 2 | 0 | 17.2초 |
| 2-4 Build a Reward Pattern | L5 | 1 | 2 | 0 | 11.0초 |
| 3-1 Enjoy Everyday Touch | L2 | 1 | 2 | 0 | 8.3초 |
| 3-2 Prepare for Nail Care | L3 | 1 | 2 | 0 | 7.5초 |
| 3-4 Stay Calm for Bath and Towel | L1 | 1 | 2 | 0 | 13.6초 |
| 3-5 Comfortable With Another Handler | L5 | 1 | 2 | 0 | 16.3초 |
| 4-2 Notice Visual Triggers Calmly | L4 | 1 | 2 | 0 | 25.8초 |
| 4-4 Use Your Resting Space | L3 | 1 | 2 | 0 | 22.8초 |
| 4-5 Follow a Daily Routine | L3 | 1 | 2 | 0 | 16.9초 |
| 6-1 Drop It on Cue | L1 | 1 | 2 | 0 | 9.1초 |

## 정리 방향

권장 기준은 level당 **대표 원본 1개, 필요할 때만 두 번째 원본 1개**, 실제 재생도 **1–2개 연속 구간**으로 제한하는 것이다. 원본 수만 2개로 줄이고 여러 짧은 구간을 오가면 전환이 잦은 구조는 남는다.

1. 원본 3–4개인 5개 level부터 핵심 행동을 보여주는 대표 시연을 고른다.
2. 원본 2개 / 3–5구간인 9개 level도 함께 줄인다. 특히 1-4 전체와 1-5 전체를 일관된 흐름으로 검토한다.
3. 원본 2개 / 2구간인 18개 level은 두 번째 예시가 새로운 정보를 주는지 보고 유지 여부를 결정한다.
4. 같은 원본의 2구간인 11개 level은 개수 기준을 이미 충족한다. 두 구간의 연결이 꼭 필요한지만 검토하면 된다.

이 분류는 현재 매핑으로 확인한 구성이다. 어떤 시연을 남길지는 실제 영상과 훈련 목표를 함께 검토한 뒤 정해야 한다.

## 여러 구간 level의 원본과 재생 순서

### 1-3 L2 — Drop It

1. [Happy Hounds Dog Training — How to Train Your Dog to DROP It: Step-by-Step Tutorial](https://www.youtube.com/watch?v=4sDCPXcZkEM&t=377s): 377.233–386.833초
2. [Happy Hounds Dog Training — How to Train Your Dog to DROP It: Step-by-Step Tutorial](https://www.youtube.com/watch?v=4sDCPXcZkEM&t=533s): 533.100–543.100초

### 1-4 L1 — Start a Potty Routine

1. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=151s): 151.500–162.100초
2. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=175s): 175.200–181.800초

### 1-4 L2 — Start a Potty Routine

1. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=181s): 181.800–190.850초
2. [Zak George — How To Teach Your Dog To Go To Their Bed When Asked](https://www.youtube.com/watch?v=XY3Pl2Td-7I&t=218s): 218.750–229.100초
3. [Zak George — How To Teach Your Dog To Go To Their Bed When Asked](https://www.youtube.com/watch?v=XY3Pl2Td-7I&t=192s): 192.800–196.550초

### 1-4 L3 — Start a Potty Routine

1. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=203s): 203.650–211.200초
2. [Zak George's Dog Training Revolution — How to Potty Train your Puppy EASILY! Everything you need to know!](https://www.youtube.com/watch?v=7vOXWCewEYM&t=385s): 385.667–400.217초
3. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=247s): 247.300–265.150초

### 1-4 L4 — Start a Potty Routine

1. [Zak George — My New Puppy: The First Day Home! (NEW SERIES: The Dog Training Experience Episode 2)](https://www.youtube.com/watch?v=0c-IjjzmS0E&t=255s): 255.350–265.150초
2. [Zak George — My New Puppy: The First Day Home! (NEW SERIES: The Dog Training Experience Episode 2)](https://www.youtube.com/watch?v=0c-IjjzmS0E&t=275s): 275.000–280.700초
3. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=203s): 203.650–211.200초
4. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=211s): 211.200–219.650초
5. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=247s): 247.300–265.150초

### 1-4 L5 — Start a Potty Routine

1. [Zak George — My New Puppy: The First Day Home! (NEW SERIES: The Dog Training Experience Episode 2)](https://www.youtube.com/watch?v=0c-IjjzmS0E&t=255s): 255.350–265.150초
2. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=203s): 203.650–211.200초
3. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=211s): 211.200–219.650초
4. [Kikopup — Housetraining 101](https://www.youtube.com/watch?v=gZ0XEr4DGfs&t=247s): 247.300–265.150초

### 1-5 L1 — Pause Unnecessary Barking

1. [Kikopup — The Calm Settle - for dogs and puppies](https://www.youtube.com/watch?v=yr1olzgidMw&t=75s): 75.900–80.400초
2. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to Train ANY Dog to STOP Barking, Calm Down & Stay! (EP: 7)](https://www.youtube.com/watch?v=4wBApkKuEVI&t=955s): 955.700–960.400초
3. [Cold Nose College, Space Coast, FLA — Teaching a Dog to Stop Barking with a "Quiet" Cue](https://www.youtube.com/watch?v=RsqdKr_vzJY&t=42s): 42.000–44.800초
4. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=179s): 179.300–181.800초

### 1-5 L2 — Pause Unnecessary Barking

1. [Cold Nose College, Space Coast, FLA — Teaching a Dog to Stop Barking with a "Quiet" Cue](https://www.youtube.com/watch?v=RsqdKr_vzJY&t=75s): 75.000–78.350초
2. [Cold Nose College, Space Coast, FLA — Teaching a Dog to Stop Barking with a "Quiet" Cue](https://www.youtube.com/watch?v=RsqdKr_vzJY&t=105s): 105.000–109.800초
3. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=179s): 179.300–181.800초

### 1-5 L3 — Pause Unnecessary Barking

1. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=175s): 175.200–181.800초
2. [Cold Nose College, Space Coast, FLA — Teaching a Dog to Stop Barking with a "Quiet" Cue](https://www.youtube.com/watch?v=RsqdKr_vzJY&t=105s): 105.000–109.800초
3. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=181s): 181.800–189.200초
4. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=179s): 179.300–181.800초

### 1-5 L4 — Pause Unnecessary Barking

1. [Kikopup — Stop barking at the door - Dog Training](https://www.youtube.com/watch?v=bpzvqN9JNUA&t=249s): 249.150–251.800초
2. [Cold Nose College, Space Coast, FLA — Teaching a Dog to Stop Barking with a "Quiet" Cue](https://www.youtube.com/watch?v=RsqdKr_vzJY&t=105s): 105.000–109.800초
3. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=181s): 181.800–189.200초
4. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=179s): 179.300–181.800초

### 1-5 L5 — Pause Unnecessary Barking

1. [cold nose college — The Quiet Cue - Finished Behavior, How to Teach Your Dog to Stop Barking](https://www.youtube.com/watch?v=mVvfY9BlMKA&t=7s): 7.500–17.100초
2. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=181s): 181.800–189.200초
3. [Kikopup — The EASIEST way to train your puppy to go to his bed - Dog training](https://www.youtube.com/watch?v=U2c5EkytNU0&t=179s): 179.300–181.800초

### 2-1 L4 — Mark the Right Choice

1. [Zak George — How To Quickly Train Any Dog With 1 word (and it isn’t “No”)](https://www.youtube.com/watch?v=XrORQkNe2lM&t=145s): 145.500–153.100초
2. [Zak George — How to Get Your Dog to Stop Doing ANYTHING](https://www.youtube.com/watch?v=4V6k4sD_Rak&t=342s): 342.350–347.850초

### 2-2 L5 — Pause Access to Rewards

1. [Pupford — How to Use a Flirt Pole with Puppies & Dogs for Exercise](https://www.youtube.com/watch?v=PX_c5jJELQ0&t=42s): 42.400–53.300초
2. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to Train ANY Dog to STOP Barking, Calm Down & Stay! (EP: 7)](https://www.youtube.com/watch?v=4wBApkKuEVI&t=309s): 309.500–320.400초

### 2-3 L3 — Learn Clear Feedback Words

1. [Zak George — How to Teach The First 7 Things To Your Dog: Sit, Leave it, Come, Leash walking, Name...)](https://www.youtube.com/watch?v=FG9xSgN86BM&t=205s): 205.100–208.567초
2. [Zak George — Train Your Dog to Heel in 1 Day - NO LEASH REQUIRED!](https://www.youtube.com/watch?v=grHN_MIexVo&t=320s): 320.040–325.140초

### 2-4 L4 — Build a Reward Pattern

1. [Simpawtico Dog Training — How to Phase Out Treats and Fade Lures - Get Your Dog to Listen](https://www.youtube.com/watch?v=yZ74wVgoEzY&t=108s): 108.400–113.700초
2. [Simpawtico Dog Training — How to Phase Out Treats and Fade Lures - Get Your Dog to Listen](https://www.youtube.com/watch?v=yZ74wVgoEzY&t=309s): 309.000–314.700초
3. [Zak George — How to Reward your Dog with TOYS Instead of Food!](https://www.youtube.com/watch?v=gDnJ7dwnSwo&t=105s): 105.600–116.100초

### 2-4 L5 — Build a Reward Pattern

1. [Simpawtico Dog Training — How to Phase Out Treats and Fade Lures - Get Your Dog to Listen](https://www.youtube.com/watch?v=yZ74wVgoEzY&t=108s): 108.400–113.700초
2. [Simpawtico Dog Training — How to Phase Out Treats and Fade Lures - Get Your Dog to Listen](https://www.youtube.com/watch?v=yZ74wVgoEzY&t=309s): 309.000–314.700초

### 2-5 L1 — Practice a Calm Reset

1. [Pupford — How to Use a Flirt Pole with Puppies & Dogs for Exercise](https://www.youtube.com/watch?v=PX_c5jJELQ0&t=42s): 42.400–53.300초
2. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to Train ANY Dog to STOP Barking, Calm Down & Stay! (EP: 7)](https://www.youtube.com/watch?v=4wBApkKuEVI&t=579s): 579.200–593.600초

### 3-1 L2 — Enjoy Everyday Touch

1. [Kikopup — Handling and Grooming for PUPPIES - Step by Step Guide](https://www.youtube.com/watch?v=AoM9tis3t2c&t=155s): 155.400–159.600초
2. [Kikopup — Handling and Grooming for PUPPIES - Step by Step Guide](https://www.youtube.com/watch?v=AoM9tis3t2c&t=163s): 163.200–167.300초

### 3-1 L4 — Enjoy Everyday Touch

1. [Terrie Hayward — Dog Nail Trims Without Drama: Teach Calm Paw Handling Force Free](https://www.youtube.com/watch?v=cwJEiyZvzZk&t=85s): 85.000–97.200초
2. [The Social Pup — Touch and Treat](https://www.youtube.com/watch?v=oE9LRDvE4Vo&t=11s): 11.050–25.200초

### 3-2 L2 — Prepare for Nail Care

1. [Terrie Hayward — Dog Nail Trims Without Drama: Teach Calm Paw Handling Force Free](https://www.youtube.com/watch?v=cwJEiyZvzZk&t=235s): 235.000–239.800초
2. [Cooperative Care with Deb Jones — Cooperative Care with Deb Jones - General Body Handling: Zen Klimb zen bowl foot and leg handling](https://www.youtube.com/watch?v=DwuDEzWIovA&t=37s): 37.000–41.800초

### 3-2 L3 — Prepare for Nail Care

1. [Zak George — My Puppy’s First Bath, Nail Trimming & More! (New Series: The Dog Training Experience Ep. 7)](https://www.youtube.com/watch?v=koOCGuRFF0I&t=67s): 67.250–71.150초
2. [Zak George — My Puppy’s First Bath, Nail Trimming & More! (New Series: The Dog Training Experience Ep. 7)](https://www.youtube.com/watch?v=koOCGuRFF0I&t=81s): 81.650–85.300초

### 3-3 L3 — Prepare for Hygiene Checks

1. [Carol Milner — Preparation for tooth brush - Sweep 090618](https://www.youtube.com/watch?v=pdmX3xK1p58&t=92s): 92.400–99.850초
2. [Cooperative Care with Deb Jones — Cooperative Care with Deb Jones - Handling the Head: Helo pillow chin rest muzzle lip lift gel](https://www.youtube.com/watch?v=u3qcRiu-0jE&t=95s): 95.750–104.100초

### 3-3 L5 — Prepare for Hygiene Checks

1. [Benevolent Beasts / Toronto Dog Trainer — Teach your dog to enjoy body handling](https://www.youtube.com/watch?v=fEVVeKv5VCo&t=31s): 31.650–34.850초
2. [Cooperative Care with Deb Jones — Cooperative Care with Deb Jones - Handling the Head: Helo pillow chin rest muzzle lip lift gel](https://www.youtube.com/watch?v=u3qcRiu-0jE&t=95s): 95.750–104.100초

### 3-4 L1 — Stay Calm for Bath and Towel

1. [Pupford — Teach Dog to Go to Place or Mat](https://www.youtube.com/watch?v=QF9e_A_8v0c&t=58s): 58.400–64.600초
2. [Pupford — Teach Dog to Go to Place or Mat](https://www.youtube.com/watch?v=QF9e_A_8v0c&t=232s): 232.400–239.800초

### 3-4 L5 — Stay Calm for Bath and Towel

1. [Zak George — How To NOT Totally Screw Up Your Puppy’s First Bath! (EP 15)](https://www.youtube.com/watch?v=5b45wihv3co&t=936s): 936.800–947.650초
2. [Polite Paws — Introduction to towel drying your dog](https://www.youtube.com/watch?v=rWjjmE8uo0k&t=19s): 19.250–24.000초

### 3-5 L5 — Comfortable With Another Handler

1. [Pupford — Teach Lay Down & Introduce Your Dog to New Objects & Sounds [Week 2 Train Your Dog With Me Series]](https://www.youtube.com/watch?v=OpACzloijlU&t=58s): 58.000–68.100초
2. [Pupford — Teach Lay Down & Introduce Your Dog to New Objects & Sounds [Week 2 Train Your Dog With Me Series]](https://www.youtube.com/watch?v=OpACzloijlU&t=1640s): 1640.000–1646.200초

### 4-2 L4 — Notice Visual Triggers Calmly

1. [Zak George — How to Train Your Dog to STOP BARKING at EVERYTHING That Moves!!](https://www.youtube.com/watch?v=GTi71Je1g_I&t=731s): 731.900–742.500초
2. [Zak George — How to Train Your Dog to STOP BARKING at EVERYTHING That Moves!!](https://www.youtube.com/watch?v=GTi71Je1g_I&t=378s): 378.500–393.700초

### 4-3 L4 — Recover From Everyday Sounds

1. [Kikopup — Stop Barking at Noises - Professional Dog Training](https://www.youtube.com/watch?v=vhc2jlc6dmc&t=868s): 868.533–875.900초
2. [Zak George — How To Easily STOP Barking And Jumping](https://www.youtube.com/watch?v=HZxjAk8t4Jw&t=410s): 410.700–419.550초

### 4-4 L2 — Use Your Resting Space

1. [Pupford — Teach Dog to Go to Place or Mat](https://www.youtube.com/watch?v=QF9e_A_8v0c&t=232s): 232.400–239.800초
2. [Pupford — Teach Your Dog the "Place" Cue  – A Simple Guide](https://www.youtube.com/watch?v=JFHcE72GvUU&t=246s): 246.750–254.400초

### 4-4 L3 — Use Your Resting Space

1. [Pupford — Teach Dog to Go to Place or Mat](https://www.youtube.com/watch?v=QF9e_A_8v0c&t=174s): 174.300–189.700초
2. [Pupford — Teach Dog to Go to Place or Mat](https://www.youtube.com/watch?v=QF9e_A_8v0c&t=232s): 232.400–239.800초

### 4-4 L4 — Use Your Resting Space

1. [Dogkind — Mat Training Part 2! Adding distractions](https://www.youtube.com/watch?v=2O0T7FijIEE&t=617s): 617.100–626.250초
2. [Pupford — Teach Your Dog the "Place" Cue  – A Simple Guide](https://www.youtube.com/watch?v=JFHcE72GvUU&t=263s): 263.100–273.300초

### 4-5 L3 — Follow a Daily Routine

1. [Pupford — How to STOP Your Dog From Running Out the Front Door](https://www.youtube.com/watch?v=s0gz8sOZsWw&t=38s): 38.400–48.000초
2. [Pupford — How to STOP Your Dog From Running Out the Front Door](https://www.youtube.com/watch?v=s0gz8sOZsWw&t=181s): 181.850–189.150초

### 5-2 L5 — Recover Calmly After Accidents

1. [Samy & the Snow Dogs — How I Clean Up Potty Accident Messes (Foster Dog Update)](https://www.youtube.com/watch?v=ijT16-8BPNQ&t=145s): 145.400–149.400초
2. [Happy With Dogs — Potty Training SECRETS](https://www.youtube.com/watch?v=K5gCY0uMFp0&t=157s): 157.900–161.900초
3. [랜선 볶음이 — 강아지 배변장소 바꾸는 법(feat.배변판 훈련)](https://www.youtube.com/watch?v=BMC7PcE2BvE&t=100s): 100.450–107.300초

### 6-1 L1 — Drop It on Cue

1. [Kikopup — How to train DROP IT](https://www.youtube.com/watch?v=gZvkyAFi7tc&t=33s): 33.300–39.000초
2. [Kikopup — How to train DROP IT](https://www.youtube.com/watch?v=gZvkyAFi7tc&t=53s): 53.900–57.300초

### 6-1 L4 — Drop It on Cue

1. [Kikopup — How to train DROP IT](https://www.youtube.com/watch?v=gZvkyAFi7tc&t=88s): 88.340–95.600초
2. [Zak George — 3 Easy Things to Teach Any Dog That Most People Think Are Hard (Teeth brushing, let go of toys...)](https://www.youtube.com/watch?v=E1PmzjSNEx4&t=341s): 341.640–347.060초

### 6-2 L4 — Choose Toys, Not Hands

1. [Zak George — How to Train a PUPPY to STOP BITING](https://www.youtube.com/watch?v=LLZ2jNO5LQM&t=198s): 198.550–207.250초
2. [Kikopup — TROUBLESHOOTING for training a dog to DROP a TOY](https://www.youtube.com/watch?v=_afpSZlHw5g&t=480s): 480.500–484.750초
3. [Pupford — Does Tug Cause Aggression in Dogs? With Emily Fitzpatrick, VSA, CDT](https://www.youtube.com/watch?v=b4g1Ep4BN94&t=330s): 330.450–334.100초

### 6-2 L5 — Choose Toys, Not Hands

1. [Zak George — How to Train a PUPPY to STOP BITING](https://www.youtube.com/watch?v=LLZ2jNO5LQM&t=198s): 198.550–207.250초
2. [Pupford — Does Tug Cause Aggression in Dogs? With Emily Fitzpatrick, VSA, CDT](https://www.youtube.com/watch?v=b4g1Ep4BN94&t=330s): 330.450–334.100초

### 6-3 L3 — Redirect Destructive Chewing

1. [Pupford — Teach Your Dog to Leave Holiday Decorations Alone](https://www.youtube.com/watch?v=nUKEloF-cEI&t=184s): 184.300–197.720초
2. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to EASILY STOP These 4 Puppy Problems NOW! (Ep 6)](https://www.youtube.com/watch?v=wlzp3ewCHKg&t=699s): 699.080–708.080초

### 6-3 L5 — Redirect Destructive Chewing

1. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to EASILY STOP These 4 Puppy Problems NOW! (Ep 6)](https://www.youtube.com/watch?v=wlzp3ewCHKg&t=677s): 677.500–691.900초
2. [Pupford — Teach Your Dog to Leave Holiday Decorations Alone](https://www.youtube.com/watch?v=nUKEloF-cEI&t=184s): 184.300–197.720초
3. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to EASILY STOP These 4 Puppy Problems NOW! (Ep 6)](https://www.youtube.com/watch?v=wlzp3ewCHKg&t=699s): 699.080–708.080초

### 6-4 L2 — Reduce Demand Barking

1. [Kikopup — TROUBLESHOOTING for training a dog to DROP a TOY](https://www.youtube.com/watch?v=_afpSZlHw5g&t=480s): 480.500–484.750초
2. [Pupford — Does Tug Cause Aggression in Dogs? With Emily Fitzpatrick, VSA, CDT](https://www.youtube.com/watch?v=b4g1Ep4BN94&t=330s): 330.450–334.100초

### 6-4 L4 — Reduce Demand Barking

1. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to Train ANY Dog to STOP Barking, Calm Down & Stay! (EP: 7)](https://www.youtube.com/watch?v=4wBApkKuEVI&t=802s): 802.980–807.430초
2. [Kikopup — TROUBLESHOOTING for training a dog to DROP a TOY](https://www.youtube.com/watch?v=_afpSZlHw5g&t=480s): 480.500–484.750초
3. [Pupford — Does Tug Cause Aggression in Dogs? With Emily Fitzpatrick, VSA, CDT](https://www.youtube.com/watch?v=b4g1Ep4BN94&t=330s): 330.450–334.100초

### 6-4 L5 — Reduce Demand Barking

1. [Zak George — NEW PUPPY SURVIVAL GUIDE: How to Train ANY Dog to STOP Barking, Calm Down & Stay! (EP: 7)](https://www.youtube.com/watch?v=4wBApkKuEVI&t=802s): 802.980–807.430초
2. [Pupford — Does Tug Cause Aggression in Dogs? With Emily Fitzpatrick, VSA, CDT](https://www.youtube.com/watch?v=b4g1Ep4BN94&t=330s): 330.450–334.100초

### 6-5 L3 — Manage Alert Barking

1. [Zak George — 4 Annoying Dog Habits you can Stop with a Simple Crate Pad](https://www.youtube.com/watch?v=gRW1PVHeQhY&t=241s): 241.800–250.700초
2. [Zak George — How To Easily STOP Barking And Jumping](https://www.youtube.com/watch?v=HZxjAk8t4Jw&t=410s): 410.700–419.550초

## 확인한 앱 파일

- `src/features/train/media/trainingYouTube.ts`의 실제 getTrainingYouTubeSegments 반환값
- `src/features/train/media/section1YouTube.generated.json`
- `src/features/train/media/sections2to6YouTube.generated.json`
- lesson 이름: `docs/train-basic-rules-clips.md`, 각 section의 `*Coverage.generated.json`
