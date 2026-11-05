# 아컴 기록실

아컴호러 카드게임의 솔로 플레이를 위한 비공식 브라우저 테이블입니다.

## 바로 시작

압축을 풀고 `index.html`을 브라우저로 여세요. 서버 설치나 로그인 없이 실행됩니다. 브라우저에서 파일을 직접 열었을 때 자동 저장이 제한되면 **저장 관리 → 저장 내보내기**로 진행을 보관할 수 있습니다.

- **자동 시나리오** — 독립 팬 시나리오 〈닫힌 서고의 밤〉을 바로 플레이합니다. 조사자 2명과 난이도 3종이 있습니다. 카드 효과, 적 행동, 능력 테스트와 결말을 앱이 처리합니다.
- **SCED 수동 테이블** — **SCED JSON 불러오기**에서 `Arkham.SCE.v4.9.3.json`을 선택합니다. 시나리오 카드는 Tabletop Simulator의 SCED에서 준비한 시나리오를 저장한 JSON이나 별도의 [SCED 커뮤니티 시나리오·캠페인 JSON](https://github.com/Chr1Z93/SCED-downloads/tree/main/downloadable)으로 가져옵니다. 카드 자료실에서 원하는 영역으로 카드를 추가하거나 ArkhamDB 덱 목록을 가져올 수 있습니다. 공식 카드의 효과와 시나리오 규칙은 직접 처리합니다.
- 원본 카드 그림은 **카드 이미지 켜기**에서 선택적으로 불러옵니다. 그림 호스트의 상태에 따라 표시가 달라질 수 있습니다.
- 두 모드의 진행 상황은 각각 현재 브라우저에 자동 저장됩니다. 다른 브라우저로 옮기려면 **저장 관리**에서 저장 파일을 내보낸 다음 불러오세요. 카드 자료실은 원본 SCED JSON으로 다시 채울 수 있습니다.

첨부된 SCED ZIP은 구조를 파악하는 참고 자료로 사용했습니다. 플레이에 쓰이는 것은 TTS JSON의 카드와 토큰 데이터입니다. 앱은 첨부 파일의 Lua 코드를 실행하지 않습니다.

## GitHub Pages 공개 배포

1. 본인 계정에 새 공개 저장소를 만듭니다.
2. 압축에서 꺼낸 파일을 저장소의 **루트**에 올립니다. `index.html`이 저장소 첫 화면에서 보여야 합니다. `.nojekyll` 파일도 포함합니다.
3. 저장소의 **Settings → Pages → Build and deployment**에서 **Deploy from a branch**를 선택합니다.
4. 브랜치 **main**, 폴더 **/(root)**를 선택하고 저장합니다. 배포 주소는 같은 Pages 설정 화면에서 확인합니다.

게임 페이지에는 `noindex, nofollow, noarchive`가 설정되어 있습니다. 이를 지원하는 검색엔진에 검색 결과 제외를 요청합니다. 공개 Pages 주소를 아는 사람은 접속할 수 있고, 공개 저장소는 GitHub 검색에 노출될 수 있습니다. [GitHub Pages 설정](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) · [Google 검색 색인 차단](https://developers.google.com/search/docs/crawling-indexing/block-indexing)

## 출처

- 보드 구성과 진행 흐름 참고 — [halogenandtoast/ArkhamHorror](https://github.com/halogenandtoast/ArkhamHorror)
- 카드 가져오기 형식 — [SCED](https://github.com/Chr1Z93/SCED)
- 카드게임 원작과 공식 규칙 — [Fantasy Flight Games](https://www.fantasyflightgames.com/product/arkham-horror-the-card-game/)

공개 배포 파일에는 앱과 독립 시나리오만 포함됩니다. SCED 카드 이미지와 첨부 원본은 플레이 중 사용자의 브라우저에서 별도로 불러옵니다.

