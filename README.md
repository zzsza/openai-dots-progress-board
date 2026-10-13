# 파로 지금 뭐해?

OpenAI Dots에 맡긴 일의 마지막 소식, 기다리는 이유, 다음 행동과 결과를 보는 개인용 진행상황 보드입니다. 일반적인 칸반 대신 **내 응답이 필요한 일**과 **실제로 보고된 변화**를 먼저 보여줍니다.

## 포함한 기능

- 진행 중, 내 응답 필요, 계속 확인 중, 시작 전, 멈춰 있음, 완료
- 마지막 보고 시각, 30분 넘게 새 소식이 없는 진행 중 기록, 예정 시각을 넘긴 확인 업무
- 작업 검색, 기록 추가/업데이트, 최근 30건 이력, 보관과 복원
- 별도로 표시하는 4개의 브라우저 예시: 실제 저장소에는 넣지 않습니다
- D1 저장소, Sites의 로그인과 비공개 접근
- 원격 MCP: `list_activity`, `get_activity`, `report_activity`

**Dots 대화와 내부 실행 상태를 자동으로 읽지 않습니다.** Dots가 기록 도구를 호출하거나 사용자가 직접 기록해야 갱신됩니다. 화면은 20초마다 저장된 기록을 조회합니다. 보고된 상태를 실제 실행이 검증된 상태로 표현하지 않습니다. 기록을 보관해도 실제 Dots 작업은 중단되지 않습니다.

## 실행

Node.js 22.13 이상을 사용합니다. Node 22 LTS 또는 24 이상을 권장합니다.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yellow_iceman.sql
npm run dev -- --hostname 127.0.0.1 --port 5173
```

생성된 SQL 파일의 정확한 이름을 사용하고 같은 로컬 DB에 적용한 마이그레이션을 반복 실행하지 마세요. 로컬 미리보기는 `/signin-with-chatgpt?return_to=/`에서 테스트 사용자로 로그인합니다. 이 테스트 로그인은 운영 배포에 포함되지 않습니다.

```sh
node --test tests/*.test.mjs
```

## 파로 연결

Sites로 비공개 배포한 뒤 플랫폼이 만드는 사이트 플러그인을 설치하거나 연결하세요. **Plugins → Personal → Created by you**에서 찾을 수 있습니다. 파로 대화에서 이 플러그인을 사용하고 화면의 **파로 연결 안내**에 있는 안내문을 전달하세요.

작은 일을 맡겨 `report_activity`로 등록하고, 보드에 **파로의 보고**가 나타나는지 확인하세요. 사이트 배포 성공과 Dots 연결 성공은 별도의 확인입니다.

`report_activity`는 같은 목표에 동일한 `id`를 사용합니다. 이름, 상태, 실제 진행 내용을 담은 `summary`를 전달하고 대기 상태에는 `waitingFor`를 넣습니다. 반복 요청으로 같은 내용을 보고해도 시각이나 이력은 바뀌지 않습니다. 선택적 `expectedRevision`으로 오래된 기록의 덮어쓰기를 방지하며, 동시 갱신도 서버에서 확인합니다.

## 접근 경계

이 앱은 **소유자만 사용하는 비공개 보드**입니다. Sites가 MCP 서비스 요청과 브라우저 접근을 인증하며, 브라우저 API는 인증된 사용자 헤더도 요구합니다. 보드는 단일 소유자의 공유 저장소를 사용하므로 공개 배포나 다른 사용자 초대 전에 사용자별 데이터 분리가 필요합니다. 사이트의 인증을 우회해서 로컬 서버를 인터넷에 직접 노출하지 마세요. API 키나 채팅 인증값은 필요하지 않으며 저장하지 않습니다.

## 기존 도구와의 차이

[mcp-kanban](https://github.com/gablabelle/mcp-kanban)은 에이전트용 로컬 칸반입니다. 이 앱은 Dots 사용자가 대화 사이에서도 진행 중인 목표, 기다리는 이유와 다음 행동을 놓치지 않는 데 초점을 둡니다.
