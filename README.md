# OpenAI Dots Progress Board

OpenAI Dots에 맡긴 일의 진행상황과 반복 예약을 확인하는 개인용 보드입니다.

## 볼 수 있는 내용

- 지금 하는 일, 마지막으로 한 일, 다음 행동과 결과
- 내 답변이나 외부 조건을 기다리는 이유
- 기존 cron과 반복 예약의 주기, 기준 시간대, 활성 여부, 다음 실행과 마지막 실행 시각
- 마지막 보고 시각과 오래 갱신되지 않은 기록
- 검색, 직접 기록과 수정, 최근 변경 이력, 보관과 복원

보드는 Dots가 `report_activity`로 전달한 내용이나 직접 작성한 기록을 저장합니다. 기존 대화와 예약을 자동 수집하지 않습니다. 화면의 예시 4건은 실제 저장소에 넣지 않습니다.

## 다른 사람이 사용하는 방법

**각자 자신의 계정에 새로운 비공개 Sites 인스턴스를 배포해서 사용합니다.** 인스턴스마다 저장소와 플러그인이 별도로 만들어집니다. 다른 사람의 보드 주소나 플러그인을 함께 사용하지 않습니다.

1. 이 저장소를 복제하거나 포크합니다. 비공개 저장소라면 먼저 접근 권한이 필요합니다.
2. ChatGPT Work 또는 Codex에서 복제한 프로젝트를 열고 다음과 같이 요청합니다.

   > 이 프로젝트를 내 계정의 새로운 비공개 Sites로 배포해줘. `.openai/hosting.json`에 `project_id`가 없으면 새 Site를 만들고 그 ID를 저장해. D1 저장소와 기존 마이그레이션을 적용하고 MCP 플러그인도 연결할 수 있게 준비해줘. 다른 사람의 Site ID, 데이터, 인증값을 복사하지 마.

3. 배포된 사이트의 플러그인을 자신의 ChatGPT 계정에 설치하거나 연결합니다.
4. Dots 대화에서 해당 플러그인을 선택하고 보드의 **Dots 연결 안내**를 전달합니다.
5. Dots에게 작은 일 하나를 기록해달라고 요청해 실제 연결을 확인합니다.

GitHub 배포용 소스의 `.openai/hosting.json`에는 개인 Site ID를 포함하지 않습니다. `.openai/hosting.example.json`은 새 인스턴스에 사용할 설정입니다. 자신의 배포가 끝난 뒤 실제 `project_id`는 그 인스턴스의 배포 소스에 보관합니다.

## 기존 예약 가져오기

플러그인을 연결한 뒤 Dots에게 다음과 같이 요청하세요.

> 이미 저장된 cron과 반복 예약 목록을 조회해서 이 보드에 기록해줘. 실제 예약을 새로 만들거나 변경하지 말고, 예약 ID별로 고정 작업 ID를 사용해. `kind: schedule`, 실제 저장된 `schedule`, `timezone`, `scheduleEnabled`, `sourceScheduleId`와 알려진 `nextRunAt`, `lastRunAt`을 전달해. 모르는 실행 시각은 비워두고 예약의 활성 상태와 마지막 결과도 기록해줘.

새로운 예약을 만들거나, 다음 실행 시각을 추측해서 보드를 채우지 않습니다. 보드에 기록을 추가하거나 수정해도 Dots의 실제 예약은 바뀌지 않습니다. 실제 예약 확인과 변경은 Dots의 **Scheduled**에서 진행합니다.

## 로컬 실행

Node.js 24 이상을 권장합니다. Node.js 22.13 이상도 지원합니다.

```sh
git clone https://github.com/zzsza/openai-dots-progress-board.git
cd openai-dots-progress-board
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yellow_iceman.sql
npm run dev -- --hostname 127.0.0.1 --port 5173
```

로컬 미리보기에서 `/signin-with-chatgpt?return_to=/`를 열면 테스트 사용자로 로그인합니다. 이 테스트 로그인은 운영 배포에 포함되지 않습니다. 이미 로컬 DB에 적용한 마이그레이션은 다시 실행하지 마세요.

```sh
npm test
npm run typecheck
npm run build
```

## 도구

- `list_activity`: 등록된 진행상황과 예약 목록을 읽습니다.
- `get_activity`: 한 기록과 최근 이력을 읽습니다.
- `report_activity`: 같은 목표에 같은 ID를 사용해 새 소식을 남깁니다. 같은 내용의 반복 요청은 이력과 보고 시각을 바꾸지 않습니다. `expectedRevision`으로 오래된 기록의 덮어쓰기를 방지할 수 있습니다.

예약 보고 예시:

```json
{
  "id": "morning-check",
  "kind": "schedule",
  "title": "평일 아침 일정 확인",
  "status": "watching",
  "summary": "저장된 반복 예약 정보를 확인했습니다.",
  "schedule": "0 9 * * 1-5",
  "timezone": "Asia/Seoul",
  "scheduleEnabled": true,
  "nextRunAt": "",
  "lastRunAt": "",
  "sourceScheduleId": "실제 예약 ID"
}
```

## 데이터와 접근

이 앱은 인스턴스당 한 소유자를 위한 비공개 보드입니다. Sites가 브라우저와 MCP 요청을 인증합니다. 브라우저 API는 인증된 사용자 헤더와 같은 사이트의 요청도 확인합니다.

한 인스턴스를 여러 사람이 공유하는 서비스로 운영하려면 사용자별 데이터 분리가 먼저 필요합니다. 각자의 비공개 인스턴스를 사용하는 설치 방식에서는 데이터와 플러그인이 각각 분리됩니다. 저장소와 배포 소스에 API 키, 인증값, 사용자 작업 데이터는 포함하지 않습니다.
