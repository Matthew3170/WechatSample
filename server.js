const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;
const wssPort = 8080;
const timeout = 30000;  // 30 秒

app.use(bodyParser.json());

// 保存所有設備連接
const deviceSockets = new Map();  // deviceId -> ws

// 保存等待回覆的指令
const pendingResults = new Map(); // commandId -> resolve

// --- 1. WebSocket 伺服器（內網設備使用） ---
const wss = new WebSocket.Server({ port: wssPort });

wss.on('connection', (ws) => {
  console.log('新的設備連線進來');

  ws.on('message', (msg) => {
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.error('無效訊息格式');
      return;
    }

    if (data.type === 'register') {
      const deviceId = data.deviceId;
      deviceSockets.set(deviceId, ws);
      ws.deviceId = deviceId;
      console.log(`設備 ${deviceId} 註冊成功`);
    }

    if (data.type === 'result') {
      const { commandId, result = 'unknow', scanUrl = [], scanResult = 'unknow', machineStatus = 'unknow' } = data;
      if (pendingResults.has(commandId)) {
        pendingResults.get(commandId)({
          commandId,
          scanUrl,
          scanResult,
          machineStatus,
          result
        });
        pendingResults.delete(commandId);
      }
    }
  });

  ws.on('close', () => {
    if (ws.deviceId) {
      deviceSockets.delete(ws.deviceId);
      console.log(`設備 ${ws.deviceId} 已離線`);
    }
  });
});

// --- 2. HTTP API 給微信小程序或外部系統呼叫 ---
let commandCounter = 1;

app.post('/send-command', async (req, res) => {
  const { deviceId, type, command, wechatId, url, size, dpi, duplex, mode } = req.body;
  const ws = deviceSockets.get(deviceId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: '設備不在線' });
  }

  const commandId = `cmd-${commandCounter++}`;
  let payload = {};

  if (type === 'print') {
    payload = { type, commandId, wechatId, url };
  } else if (type === 'scan') {
    payload = { type, commandId, wechatId, size, dpi, duplex, mode };
  } else if (type === 'status') {
    payload = { type, commandId, wechatId };
  } else {
    payload = { type, commandId, wechatId, command };
  }

  ws.send(JSON.stringify(payload));

  try {
    const result = await new Promise((resolve, reject) => {
      pendingResults.set(commandId, resolve);
      setTimeout(() => {
        if (pendingResults.has(commandId)) {
          pendingResults.delete(commandId);
          reject(new Error('timeout'));
        }
      }, timeout);
    });

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`HTTP API 運行中 http://localhost:${port}`);
});
console.log(`WebSocket Server 運行中 ws://localhost:${wssPort}`);
