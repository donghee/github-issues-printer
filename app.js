import express from 'express';
import bodyParser from 'body-parser';
import { Printer, Image } from "@node-escpos/core";
import Serial from "@node-escpos/serialport-adapter";
import { join, dirname } from "path";
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream';
import {promisify} from 'node:util'
import fetch from 'node-fetch';
import sharp from 'sharp';

const streamPipeline = promisify(pipeline);

const app = express();
const PORT = process.env.PORT || 3000;
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/ttyACM0';

// JSON 요청 처리를 위한 미들웨어
app.use(bodyParser.json());

// GitHub webhook 엔드포인트
app.post('/github-webhook', async (req, res) => {
  try {
    const event = req.headers['x-github-event'];
    const payload = req.body;
    console.log('--------------');
    console.log(`Received Github Webhook: ${event} ${payload.action || ''}`);
    // console.log('Payload:', JSON.stringify(payload, null, 2));

    // Issues 이벤트 처리
    if (event === 'issues' && payload.action === 'opened' || payload.action === 'edited') {
      console.log('새로운 이슈가 생성되었습니다:', payload.issue.title);
      
      // 프린터로 이슈 내용 출력
      await printIssue(payload.issue);
      
      res.status(200).send('이슈가 성공적으로 프린터에 출력되었습니다.');
    } else {
      res.status(200).send('처리되지 않은 이벤트입니다.');
    }
  } catch (error) {
    console.error('Github Webhook 처리 중 오류 발생:', error);
    res.status(500).send('내부 서버 오류');
  }
});

// 상태 확인 엔드포인트
app.get('/', (req, res) => {
  res.send('GitHub Webhook 서버가 실행 중입니다.');
});

// 이슈 내용을 프린터로 출력하는 함수
async function printIssue(issue) {
  const repository_name = issue.repository_url.split('/').slice(-2).join('/')

  // 프린터 설정
  const device = new Serial(SERIAL_PORT, { baudRate: 9600 });
  return new Promise((resolve, reject) => {
    device.open(async function(err) {
      if (err) {
        console.error('프린터 연결 오류:', err);
        return reject(err);
      }

      try {
        // 인코딩 설정
        const options = { encoding: "EUC-KR" };
        let printer = new Printer(device, options);
        printer.align("ct");

        // 로고 이미지 출력 (있는 경우)
        try {
          const filePath = join(__dirname, "github.png");
          const image = await Image.load(filePath);
          printer = await printer.image(image, "d24");
          printer.newLine();
        } catch (imgErr) {
          console.log('이미지 로드 건너뜀:', imgErr.message);
        }

        // 헤더 출력
        printer
          .font("a")
          .align("ct")
          .style("b")
          .size(2, 1)
          .text(`${repository_name} 새이슈!`)
          .size(1, 1)
          .drawLine()
          .newLine();

        // 이슈 정보 출력
        const user = issue.user || { login: '없음', avatar_url: '' };
        const assignee = issue.assignee || { login: '없음', avatar_url: '' };

        printer
          .align("lt")
          .style("b")
          .text(`저장소: ${repository_name}`)
          .text(`번  호: #${issue.number}`)
          .style("b")
          .size(1, 1)
          .text(`제  목: ${issue.title}`)
          .newLine()
          .style("NORMAL")
          .size(1, 1)
          .text(`작성자: ${user.login} `)
          .text(`작성일: ${new Date(issue.created_at).toLocaleString('ko-KR')}`)
          .pureText(`담당자: ${assignee.login} `)
        try {
          const assigneeIconfilePath = join("/tmp", "assigneeavatar.png");
          const response = await fetch(assignee.avatar_url);
          if (!response.ok) throw new Error(`unexpected response ${response.statusText}`);
          const temporaryFilePath = join("/tmp", "avatar.png");
          await streamPipeline(response.body, createWriteStream(temporaryFilePath));
          await sharp(temporaryFilePath)
            .resize({ width: 24, height: 24 })
            .toFile(assigneeIconfilePath);
          const assigneeIconImage = await Image.load(assigneeIconfilePath);
          printer = await printer.image(assigneeIconImage, "d24");
        } catch (imgErr) {
          console.log('이미지 로드 건너뜀:', imgErr.message);
          printer.newLine();
        }
        printer.drawLine().newLine();
        
        // 이슈 본문 출력 (너무 길면 잘라내기)
        const body = issue.body || '내용 없음';
        const maxLength = 500; // 최대 출력 길이
        const printBody = body.length > maxLength 
          ? body.substring(0, maxLength) + '...(생략됨)' 
          : body;
        
        printer
          .text(printBody)
          .align("ct")
        
        // QR 코드 출력 (이슈 URL)
        if (issue.html_url) {
          printer = await printer.qrimage(issue.html_url, { type:"png", mode: "dhdw", size: 4, margin: 4});
          printer
            .align("lt")
            .text(issue.html_url)
            .newLine();
        }

        // 마무리
        printer
          .drawLine()
          .text('바리바리 연구실 GitHub 알림 서비스')
          .newLine()
          .cut()
          .close();

        console.log('이슈가 성공적으로 프린터에 출력되었습니다.');
        resolve();
      } catch (printErr) {
        console.error('프린터 출력 오류:', printErr);
        reject(printErr);
      }
    });
  });
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`GitHub Webhook URL: http://localhost:${PORT}/github-webhook`);
});
