import express from 'express';
import bodyParser from 'body-parser';
import { Printer, Image } from "@node-escpos/core";
import Serial from "@node-escpos/serialport-adapter";
import { join, dirname } from "path";
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import {createWriteStream, writeFileSync} from 'node:fs';
import {pipeline} from 'node:stream';
import {promisify} from 'node:util'
import fetch from 'node-fetch';
import sharp from 'sharp';

const streamPipeline = promisify(pipeline);

const app = express();
const PORT = process.env.PORT || 3000;
const SERIAL_PORT = process.env.SERIAL_PORT || '/dev/ttyACM0';

// JSON 요청 처리를 위한 미들웨어
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

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

// GitHub webhook 엔드포인트
app.post('/todo-webhook', async (req, res) => {
  try {
    const event = req.headers['x-todo-event'];
    const payload = req.body;
    console.log('--------------');
    console.log(`Received Todo Webhook: ${event} ${payload.action || ''}`);
    // console.log('Payload:', JSON.stringify(payload, null, 2));

    // Issues 이벤트 처리
    if (event === 'issues' && payload.action === 'opened' || payload.action === 'edited') {
      console.log('새로운 Todo 생성되었습니다:', payload.issue.title);
      
      // 프린터로 이슈 내용 출력
      await printTodo(payload.issue);
      
      res.status(200).send('Todo가 성공적으로 프린터에 출력되었습니다.');
    } else {
      res.status(200).send('처리되지 않은 이벤트입니다.');
    }
  } catch (error) {
    console.error('Todo Webhook 처리 중 오류 발생:', error);
    res.status(500).send('내부 서버 오류');
  }
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
          .text(printBody.replace(/<[^>]*>/g, '').replace(/(\r?\n){3,}/g, '\n\n').replace(/\n$/, "")) // HTML 태그 제거, 3개 이상의 줄바꿈을 2개로, 마지막 줄바꿈 제거
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

// 노트에 기록된 TODO 할일을 프린터로 출력하는 함수
async function printTodo(issue) {
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

        const tags = issue.body.match (/#[0-9a-zA-Z가-힣]+/g) || [];

        // 헤더 출력
        printer
          .font("a")
          .align("ct")
          .style("b")
          .size(2, 1)
          .text(`${issue.title} >`)
          .newLine();

        if (tags.length > 0) {
          printer
            .align("lt")
            .size(1, 1)
            .text(`프로젝트: ${tags.join(', ')}`)
        }

        printer
          .align("lt")
          .style("NORMAL")
          .size(1, 1)
          .text(`작성자: ${issue.user} `)
          .text(`작성일: ${new Date(issue.created_at).toLocaleString('ko-KR')}`)
        printer.drawLine().newLine();
        
        // 이슈 본문 출력 (태그 삭제, 너무 길면 잘라내기)
        const body = issue.body.replace(/#[0-9a-zA-Z가-힣]+/g, '').trim() || '내용 없음';
        const maxLength = 500; // 최대 출력 길이
        const printBody = body.length > maxLength 
          ? body.substring(0, maxLength) + '...(생략됨)' 
          : body;
        
        printer
          .size(2, 2)
          .lineSpace(140)
          .text(printBody)
          .lineSpace()
          .newLine()
          .newLine()
        
       // 마무리
        printer
          .cut()
          .close();

        console.log('TODO가 성공적으로 프린터에 출력되었습니다.');
        resolve();
      } catch (printErr) {
        console.error('프린터 출력 오류:', printErr);
        reject(printErr);
      }
    });
  });
}

async function printImage(base64Image) {
  const device = new Serial(SERIAL_PORT, { baudRate: 9600 });
  return new Promise((resolve, reject) => {
    device.open(async function(err) {
      if (err) {
        console.error('프린터 연결 오류:', err);
        return reject(err);
      }

      try {
        const options = { encoding: "EUC-KR" };
        let printer = new Printer(device, options);
        printer.align("ct");

        // 이미지 출력
        // Write the base64 data to a file
        const temporaryFilePath = join("/tmp", "image.png");
        const base64ImageString = base64Image.replace(/^data:image\/png;base64,/, "");
        const filePath = join("/tmp", "image_resized.png");
        // Save the base64 image to a temporary file
        writeFileSync(temporaryFilePath, base64ImageString, 'base64');

        await sharp(temporaryFilePath)
          .resize({ width: 590}) // Resize to fit the printer's width
          .grayscale()
          .linear(0.85, -30) // Optional: Increase contrast (adjust values as needed)
          .png({ colors: 2 }) // Reduce to 2 colors (black and white)
          .sharpen() // Apply sharpening
          .toFile(filePath);
        const image = await Image.load(filePath);
        printer = await printer.image(image, "d24");
        
        printer
          .newLine()
          .cut()
          .close();

        console.log('이미지가 성공적으로 프린터에 출력되었습니다.');
        resolve();
      } catch (printErr) {
        console.error('프린터 출력 오류:', printErr);
        reject(printErr);
      }
    });
  });
}

// Image webhook 엔드포인트
app.post('/image-webhook', async (req, res) => {
  try {
    const event = req.headers['x-image-event'];
    const payload = req.body;
    console.log('--------------');
    console.log(`Received Image Webhook: ${event} ${payload.action || ''}`);
    
    if (event === 'image' && payload.action === 'uploaded') {
      console.log('새로운 이미지가 업로드되었습니다:', payload.image.title);
      
      // 프린터로 이미지 출력
      await printImage(payload.image.base64);
      // console.log('이미지 데이터:', payload.image.base64);
      
      res.status(200).send('이미지가 성공적으로 프린터에 출력되었습니다.');
    } else {
      res.status(200).send('처리되지 않은 이벤트입니다.');
    }
  } catch (error) {
    console.error('Image Webhook 처리 중 오류 발생:', error);
    res.status(500).send('내부 서버 오류');
  }
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`GitHub Webhook URL: http://localhost:${PORT}/github-webhook`);
  console.log(`Todo Webhook URL: http://localhost:${PORT}/todo-webhook`);
  console.log(`Image Webhook URL: http://localhost:${PORT}/image-webhook`);
});
