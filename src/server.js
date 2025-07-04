// server.js
import http from 'http';
import { WebSocketServer } from 'ws';
import app from './app.js';
import dotenv from 'dotenv';
import axios from 'axios';
import envConfigService from './services/envConfigService.js';
import bodyParser from 'body-parser';
// Load environment variables từ file .env
dotenv.config();

// Load và set các config từ JSON vào process.env
const envConfig = envConfigService.getAll();
Object.keys(envConfig).forEach(key => {
    process.env[key] = envConfig[key];
    console.log(`✓ Set ${key} = ${envConfig[key]}`);
});

const PORT = process.env.PORT || 3000;

console.log(`Server sẽ chạy trên cổng: ${PORT}`);

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Tạo HTTP server
const server = http.createServer(app);

// Tạo WebSocket server
const wss = new WebSocketServer({ server });

// Lưu trữ kết nối WebSocket
export const webSocketClients = new Set();

// Xử lý kết nối WebSocket
wss.on('connection', (ws) => {
  console.log('Có một kết nối WebSocket mới');
  webSocketClients.add(ws);
  
  ws.on('close', () => {
    console.log('Kết nối WebSocket đã đóng');
    webSocketClients.delete(ws);
  });
});

// Hàm gửi thông báo đến tất cả client WebSocket
export function broadcastMessage(message, data = null) {
  let loginUrlCallback = process.env.LOGIN_CALLBACK_URL;

  webSocketClients.forEach((client) => {
    data.message = message; // Gắn message vào data nếu có
    if (typeof data === 'object') {
      data = { ...data };
    } else {
      data = { message }; 
    }

    // Kiểm tra trạng thái kết nối trước khi gửi
    if (client.readyState === 1) { // 1 = OPEN
      client.send(data ? JSON.stringify(data) : message);
      if (data.message === 'login_success' && loginUrlCallback) {
        axios.post(loginUrlCallback, data)
          .then(response => {
            console.log('Thông tin đăng nhập đã được gửi đến callback URL:', response.data);
          })
          .catch(error => {
            console.error('Lỗi khi gửi thông tin đăng nhập đến callback URL:', error);
          });
      }
    }
  });
}

// Sử dụng HTTP server thay vì app để hỗ trợ WebSocket
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
