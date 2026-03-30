# Bot Data Sync Spec

woo.moi/ai 페이지의 데이터 소스.

## 파일 구조

```
data/
  skills.json       ← 통합 스킬 레지스트리 (마스터 목록)
  woovis.json       ← woovis가 push
  9oovis.json       ← 9oovis가 push
  pulmang.json      ← pulmang이 push
  SYNC.md           ← 이 스펙
```

## 봇별 JSON 스키마 (`{botId}.json`)

```json
{
  "persona": {
    "name": "봇 이름",
    "emoji": "이모지",
    "tone": "말투",
    "callUser": "우님 호칭",
    "role": "역할",
    "bio": "소개"
  },
  "memories": [
    { "id": "고유ID", "text": "기억 내용", "shared": true, "ts": "YYYY-MM-DD" }
  ],
  "skills": {
    "skill-id": true,
    "another-skill": false
  },
  "updatedAt": "ISO 8601"
}
```

### skills 필드 규칙

- **키는 반드시 `skills.json`의 skill ID 사용** (예: `"gh-cli"`, `"browser-automation"`)
- 임의의 스킬명 사용 금지 — 레지스트리에 없으면 무시됨
- `true` = 이 봇에서 해당 스킬 사용 가능/활성
- `false` = 비활성 (기능 구현돼있어도 사용 금지)
- 웹 UI에서 우님이 토글 변경 가능

### 스킬 활성화 흐름

1. 우님이 웹에서 봇A의 스킬X를 ON 전환
2. 봇A가 다음 sync 시 GET → skills에 `"skill-x": true` 확인
3. `skills.json`에서 해당 스킬의 `setup` + `manualSteps` 참조
4. `manualSteps`가 비어있으면: 자동 셋업 진행
5. `manualSteps`가 있으면: 자동 셋업 진행 + 수동 필요 부분만 우님에게 요청
6. 셋업 완료 후 `updatedAt` 갱신하고 push

### 스킬 비활성화 흐름

1. 우님이 웹에서 봇A의 스킬X를 OFF 전환
2. 봇A가 다음 sync 시 GET → skills에 `"skill-x": false` 확인
3. 해당 기능 사용 중단 (삭제할 필요 없음, 비활성만)

## 통합 스킬 레지스트리 (`skills.json`)

```json
{
  "skills": [
    {
      "id": "skill-id",
      "name": "표시명",
      "desc": "설명",
      "setup": "셋업 방법",
      "manualSteps": ["수동 필요 단계 (없으면 빈 배열)"]
    }
  ]
}
```

새로운 스킬 추가 시: skills.json에 먼저 등록 → 봇 JSON에서 참조.

## Push 방법

GitHub API로 `data/{botId}.json` 업데이트:

```bash
# GET (sha)
curl -H "Authorization: token {PAT}" \
  https://api.github.com/repos/lookgitme/woo.moi/contents/data/{botId}.json

# PUT
curl -X PUT -H "Authorization: token {PAT}" \
  https://api.github.com/repos/lookgitme/woo.moi/contents/data/{botId}.json \
  -d '{"message":"sync: {botId}","content":"{base64}","sha":"{sha}"}'
```

## 핵심 규칙

1. 각 봇은 **자기 파일만** 수정
2. push 전에 **반드시 GET** → 우님의 웹 변경사항 보존
3. skills 키는 **skills.json의 ID만** 사용
4. 스킬 ON 확인 시 → setup 참고해서 자동 셋업, manualSteps만 우님에게 요청
5. 스킬 OFF 확인 시 → 해당 기능 사용 중단
