# woo.moi — 우님의 개인 커맨드센터

이 문서는 프로젝트의 방향성·컨셉·설계원칙이다. 피드백 반영 등 모든 자동 작업은 이 맥락 안에서 판단할 것.
방향성 자체를 바꾸는 결정이 생기면 이 문서를 함께 갱신한다.

## 컨셉
- 개인 허브. 우님(단일 사용자) 전용 — 할일·브리핑·아이디어·프로젝트·재무·건강·AI사용량을 앱을 거치지 않고 이곳에서 처리하는 것이 장기 비전.
- 랜딩은 미니멀: 픽셀 알(Egg) + "woo.moi" 워드마크 + 하단 커맨드바뿐. 심심하지 않되 요소를 늘리지 않는다. 알은 "이제 막 생겨난 존재"라는 컨셉(숨쉬기·꿈틀·깜빡임 애니메이션).
- 조작은 커맨드바 타이핑 중심(help로 목록, 명령=이동). 버튼을 늘려 해결하지 않는다.

## 구조 원칙
- 개인/히든 페이지 = 하위경로 (/dashboard /memory /ai /server /bots /ideas /projects). 독립 서비스 = 서브도메인.
- 히든 페이지는 미로그인 시 404로 은닉(존재 자체를 숨김). proxy.ts가 담당.
- 인증: 커맨드바에 비밀번호 입력 → HMAC 서명 httpOnly 쿠키. 구글로그인 등 외부 OAuth 금지.
- 데이터는 서버사이드에서만 호출(woo-memory MCP, GitHub/Vercel API). 토큰·시크릿 값을 클라이언트에 절대 노출하지 않는다. 시크릿은 이름/코멘트만 표시, 값은 표시 금지.
- /ai = 메모리+시크릿+스킬+자동화+봇 통합 뷰.

## 모바일 (아이폰 실사용 — 매우 중요)
- 홈에서 확대/스크롤 금지. 키보드가 떠도 알은 화면 중앙 고정(fixed + 50lvh), 입력창만 키보드 위로.
- 입력 font-size 16px 유지(iOS 자동확대 방지). PWA standalone 설치 사용 중.

## 기술
- Next.js 16 App Router(미들웨어는 proxy.ts), Tailwind v4, Neon Postgres(@vercel/postgres), Vercel 배포(push→자동).
- 빌드 검증: `npm run build`. 로컬 확인: `PORT=3999 npm run start`.

## 피드백 자동반영 시스템 (이 repo와 연동)
- /projects/[name]의 피드백 폼 → Neon project_feedback → 집맥 러너(~/projects/_feedback-runner)가 5분마다 claude -p로 구현·빌드검증·커밋 → push → 자동배포.
- 지금은 우님 본인 피드백만 → 무조건 반영. 외부 피드백을 받게 되면 검토 게이트 추가 예정.
