#!/bin/bash

# TODO 생성 webhook 이벤트를 시뮬레이션하는 스크립트

# 서버 URL
SERVER_URL="http://localhost:3000/todo-webhook"
USER_NAME=donghee
ISSUE_NUMBER=1

# TODO 이슈 webhook 페이로드 예시
#read -r -d '' PAYLOAD << EOM
#{
#  "action": "opened",
#  "issue": {
#    "number": ${ISSUE_NUMBER},
#    "title": "은파산업",
#    "body": "할일을 열감지 프린터로 출력되는지 확인합니다.",
#    "user": "${USER_NAME}",
#    "created_at": "$(date -Iseconds)"
#  }
#}
#EOM

# webhook 요청 보내기
# echo "Webhook 요청을 보내는 중..."
#curl -X POST \
#  -H "Content-Type: application/json" \
#  -H "X-Todo-Event: issues" \
#  -d "$PAYLOAD" \
#  $SERVER_URL

# FleetingNotes 파일에서 TODO 항목을 추출하여 페이로드 생성
TODO_FILE="$HOME/src/github.com/donghee/notes/FleetingNotes/$(date +%Y-%m-%d).md"
PAYLOADS=$(cat $TODO_FILE | grep -E "\- \[ \]|\- \[\]" | jq -R -s -c --arg title "$(date -Idate) 할일" --arg seconds "$(date -Iseconds)" 'split("\n") | map(select(length > 0)) | map({
  "action": "opened",
  "issue": {
    "title": $title ,
    "body": . ,
    "user": "donghee",
    "created_at": $seconds
   }
})')

#echo "Generated payloads: $PAYLOADS"
echo "Sending payloads to the server..."
# JSON 배열을 순회하며 각 항목을 개별 요청으로 전송
echo "$PAYLOADS" | jq -c '.[]' | while read -r payload; do
  echo "Sending payload: $payload"
  curl -X POST \
    -H "Content-Type: application/json" \
    -H "X-Todo-Event: issues" \
    -d "$payload" \
    $SERVER_URL
  echo ""
  # 요청 간 짧은 지연 시간 추가
  sleep 0.5
done

echo "요청 완료. 프린터를 확인하세요."
