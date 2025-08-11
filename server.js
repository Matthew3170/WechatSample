const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const wssPort = 8080;

// JWT密鑰（務必換成安全的長字串，且保密）
const JWT_SECRET = 'your_very_secret_key_here';

app.use(bodyParser.json());

const deviceSockets = new Map();  // deviceId -> ws
const pendingResults = new Map(); // commandId -> resolve

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
      // 產生30分鐘有效Token
      const token = jwt.sign(
        { deviceId },
        JWT_SECRET,
        { expiresIn: '30m' }
      );

      deviceSockets.set(deviceId, ws);
      ws.deviceId = deviceId;

      // 回傳 token 給裝置
      ws.send(JSON.stringify({
        type: 'token',
        token,
        expiresIn: 1800 // 30分鐘秒數
      }));

      console.log(`設備 ${deviceId} 註冊成功，已發送 Token`);
    }

    if (data.type === 'result') {
      const { commandId, result } = data;
      if (pendingResults.has(commandId)) {
        pendingResults.get(commandId)(result);
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

let commandCounter = 1;

app.post('/send-command', async (req, res) => {
  const { deviceId, command, token } = req.body;

  // 檢查token是否有效
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.deviceId !== deviceId) {
      return res.status(401).json({ error: 'Token 無效或不匹配' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Token 驗證失敗' });
  }

  const ws = deviceSockets.get(deviceId);

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return res.status(404).json({ error: '設備不在線' });
  }

  const commandId = `cmd-${commandCounter++}`;
  const payload = {
    type: 'command',
    commandId,
    command
  };

  ws.send(JSON.stringify(payload));

  const result = await new Promise(resolve => {
    pendingResults.set(commandId, resolve);
    // 可加入timeout機制
  });

  res.json({ result });
});

app.listen(port, () => {
  console.log(`HTTP API 運行中 http://localhost:${port}`);
});
console.log(`WebSocket Server 運行中 ws://localhost:${wssPort}`);