# Bot Data Sync Spec

이 디렉토리는 woo.moi/ai 페이지의 데이터 소스.
각 봇은 자기 JSON 파일 하나만 관리하면 됨.

## 파일 구조

```
data/
  woovis.json     ← woovis가 push
  9oovis.json     ← 9oovis가 push
  pulmang.json    ← pulmang이 push
  SYNC.md         ← 이 스펙
```

## JSON 스키마

각 봇의 `{botId}.json`:

```json
{
  "persona": {
    "name": "봇 이름 (한글)",
    "emoji": "대표 이모지",
    "tone": "말투 설명 (예: 캐주얼 반말)",
    "callUser": "우님을 뭐라 부르는지",
    "role": "역할 한 줄",
    "bio": "소개 한 줄"
  },
  "memories": [
    {
      "id": "고유ID (아무 문자열)",
      "text": "기억 내용",
      "shared": false,
      "ts": "YYYY-MM-DD"
    }
  ],
  "skills": {
    "스킬명": true
  },
  "updatedAt": "ISO 8601 타임스탬프"
}
```

## 봇이 해야 할 것

### 1. 자기 데이터 push (매일 또는 변경 시)

GitHub API로 `data/{botId}.json` 업데이트:

```bash
# 1. GET 현재 파일 (sha 필요)
curl -H "Authorization: token {PAT}" \
  https://api.github.com/repos/lookgitme/woo.moi/contents/data/{botId}.json

# 2. PUT 업데이트
curl -X PUT -H "Authorization: token {PAT}" \
  https://api.github.com/repos/lookgitme/woo.moi/contents/data/{botId}.json \
  -d '{"message":"sync: {botId}","content":"{base64}","sha":"{sha}"}'
```

### 2. 언제 push 해야 하는지

- 새로운 기억/사실/결정 발생 시 → memories에 추가
- 새로운 스킬/권한 획득 시 → skills에 추가
- 페르소나 변경 시 → persona 업데이트
- 최소 하루 1번 (cron sync)

### 3. 기억(memory) 규칙

- `shared: true` → woo.moi/ai 공유 브레인에 노출
- `shared: false` → 해당 봇 페이지에서만 보임
- 웹 UI에서 우님이 shared 토글 변경 가능
- 웹 UI에서 우님이 개별 삭제 가능
- 봇은 push할 때 기존 memories를 먼저 GET해서 우님의 변경(삭제/shared 변경)을 보존해야 함

### 4. 스킬(skills) 규칙

- key: 스킬명, value: true(활성)/false(비활성)
- 새 스킬 획득 시 `"스킬명": true` 추가
- 웹 UI에서 우님이 토글로 켜고 끌 수 있음
- 봇은 push할 때 기존 skills를 GET해서 우님의 변경을 보존해야 함

### 5. 페르소나 규칙

- 봇 고유 설정, 공유 안 됨
- IDENTITY.md나 SOUL.md에서 설정한 값과 동기화
- 웹 UI에서 우님이 수정 가능 → 봇은 pull해서 반영

## 충돌 방지

각 봇은 자기 파일만 수정. 다른 봇 파일 건드리지 않음.
웹 UI도 개별 봇 파일을 직접 수정.
→ 머지 충돌 없음.
