#!/bin/bash

# TODO 생성 webhook 이벤트를 시뮬레이션하는 스크립트

# 서버 URL
SERVER_URL="http://localhost:3000/todo-webhook"
USER_NAME=donghee
ISSUE_NUMBER=1

# TODO 이슈 webhook 페이로드 예시
read -r -d '' PAYLOAD << EOM
{
  "action": "opened",
  "issue": {
    "number": ${ISSUE_NUMBER},
    "title": "은파산업",
    "body": "할일을 열감지 프린터로 출력되는지 확인합니다.",
    "user": "${USER_NAME}",
    "created_at": "$(date -Iseconds)"
  }
}
EOM

# webhook 요청 보내기
echo "Webhook 요청을 보내는 중..."
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Todo-Event: issues" \
  -d "$PAYLOAD" \
  $SERVER_URL

echo ""
echo "요청 완료. 프린터를 확인하세요."
