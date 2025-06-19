# GitHub Webhook 프린터 알림 서비스

이 서비스는 GitHub Issues가 생성될 때마다 webhook을 통해 알림을 받아 열감지 프린터로 출력하는 서비스입니다.

## 설치 및 실행

1. 필요한 패키지 설치:
```bash
npm install
```

2. 서버 실행:
```bash
npm start
```

## 프린터 설정

기본적으로 이 서비스는 `/dev/ttyACM0` 포트에 연결된 열감지 프린터를 사용합니다. 다른 포트를 사용하는 경우 `app.js` 파일의 다음 부분을 수정하세요:

```javascript
// 프린터 설정
const device = new Serial('/dev/ttyACM0', { baudRate: 9600 });
```

## GitHub Webhook 설정

1. GitHub 레포지토리에서 **Settings** > **Webhooks** > **Add webhook** 선택
2. Webhook 설정:
   - **Payload URL**: `http://your-server-address:3000/webhook`
   - **Content type**: `application/json`
   - **Secret**: (선택 사항) 보안을 위한 비밀키 설정
   - **Which events would you like to trigger this webhook?**: `Issues` 선택
   - **Active**: 체크 표시

3. **Add webhook** 버튼 클릭

## 테스트

서버가 실행 중일 때 테스트 스크립트를 실행하여 프린터 출력을 테스트할 수 있습니다:

```bash
./test-webhook.sh
```

## 보안 고려사항

1. 공개 서버에서 실행할 경우 HTTPS 및 webhook 시크릿을 사용하는 것이 좋습니다.
2. 네트워크 보안을 위해 방화벽 설정을 확인하세요.

## 문제 해결

1. 프린터 연결 오류:
   - 프린터가 올바르게 연결되어 있는지 확인
   - 프린터 포트 설정이 올바른지 확인
   - 권한 문제가 있는 경우 `sudo` 권한으로 실행

2. Webhook 이벤트가 수신되지 않는 경우:
   - GitHub Webhook 설정이 올바른지 확인
   - 서버가 외부에서 접근 가능한지 확인
   - 방화벽 설정 확인

