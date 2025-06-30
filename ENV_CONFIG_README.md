# Hệ thống quản lý cấu hình Environment

Hệ thống này cho phép quản lý các cấu hình environment (webhook URLs) thông qua giao diện web và lưu trữ trong file JSON. **Tự động sync với process.env** để không cần sửa code ở nhiều chỗ.

## ✨ Tính năng chính

- ✅ **Auto-sync với process.env**: Tự động set các biến environment từ JSON
- ✅ **Giao diện web hiện đại**: Quản lý cấu hình qua web
- ✅ **Real-time validation**: Kiểm tra URL format ngay lập tức
- ✅ **Hot-reload**: Cập nhật cấu hình mà không cần restart server
- ✅ **Backup & Restore**: Khôi phục cấu hình mặc định dễ dàng

## 🚀 Cách hoạt động

Khi server khởi động:
1. EnvConfigService load cấu hình từ `zalo_data/env-config.json`
2. Tự động set các giá trị vào `process.env`
3. Code existing có thể tiếp tục sử dụng `process.env.MESSAGE_WEBHOOK_URL` như bình thường
4. Không cần sửa code ở nhiều chỗ!

```javascript
// server.js
import envConfigService from './services/envConfigService.js';

// Load và set các config từ JSON vào process.env
const envConfig = envConfigService.getAll();
Object.keys(envConfig).forEach(key => {
    process.env[key] = envConfig[key];
    console.log(`✓ Set ${key} = ${envConfig[key]}`);
});
```

## Cấu trúc files

```
src/
├── services/
│   └── envConfigService.js      # Service chính để quản lý cấu hình
├── routes/
│   ├── api.js                   # API endpoints cho cấu hình
│   └── ui.js                    # Route giao diện
└── views/
    └── setting-manager.ejs      # Giao diện quản lý cấu hình

zalo_data/
└── env-config.json             # File lưu trữ cấu hình
```

## Các cấu hình được quản lý

- `MESSAGE_WEBHOOK_URL`: URL nhận thông báo tin nhắn mới
- `GROUP_EVENT_WEBHOOK_URL`: URL nhận thông báo sự kiện nhóm
- `REACTION_WEBHOOK_URL`: URL nhận thông báo phản ứng tin nhắn
- `LOGIN_CALLBACK_URL`: URL callback cho đăng nhập

## Giao diện web

### Truy cập
- URL: `http://localhost:3000/setting-manager`
- Yêu cầu đăng nhập admin

### Tính năng
- ✅ Load cấu hình từ file JSON
- ✅ Lưu cấu hình vào file JSON
- ✅ Khôi phục cấu hình mặc định
- ✅ Xem trước JSON real-time
- ✅ Validate URL format
- ✅ Giao diện responsive và hiện đại

## API Endpoints

### GET `/api/config/env`
Lấy cấu hình hiện tại
```json
{
  "MESSAGE_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "GROUP_EVENT_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "REACTION_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "LOGIN_CALLBACK_URL": "http://localhost:3001/api/webhook"
}
```

### POST `/api/config/env`
Lưu cấu hình mới
```json
{
  "MESSAGE_WEBHOOK_URL": "http://localhost:3002/api/webhook",
  "GROUP_EVENT_WEBHOOK_URL": "http://localhost:3002/api/webhook",
  "REACTION_WEBHOOK_URL": "http://localhost:3002/api/webhook",
  "LOGIN_CALLBACK_URL": "http://localhost:3002/api/webhook"
}
```

### POST `/api/config/env/reset`
Khôi phục cấu hình mặc định

## Sử dụng EnvConfigService

### Import service
```javascript
import envConfigService from './services/envConfigService.js';
```

### Các phương thức chính

```javascript
// Lấy tất cả cấu hình
const config = envConfigService.getAll();

// Lấy một cấu hình cụ thể
const messageUrl = envConfigService.getMessageWebhookUrl();
const groupUrl = envConfigService.getGroupEventWebhookUrl();
const reactionUrl = envConfigService.getReactionWebhookUrl();
const loginUrl = envConfigService.getLoginCallbackUrl();

// Lấy theo key
const value = envConfigService.get('MESSAGE_WEBHOOK_URL');

// Cập nhật một giá trị
envConfigService.set('MESSAGE_WEBHOOK_URL', 'http://localhost:3002/api/webhook');

// Cập nhật nhiều giá trị
envConfigService.update({
    MESSAGE_WEBHOOK_URL: 'http://localhost:3002/api/webhook',
    GROUP_EVENT_WEBHOOK_URL: 'http://localhost:3002/api/group'
});

// Validate cấu hình
const validation = envConfigService.validate();
if (!validation.isValid) {
    console.error('Errors:', validation.errors);
}

// Reset về mặc định
envConfigService.reset();

// Reload từ file
envConfigService.reload();
```

## Tích hợp vào ứng dụng

### Ví dụ sử dụng trong webhook
```javascript
import envConfigService from '../services/envConfigService.js';

export function sendWebhookNotification(type, data) {
    let webhookUrl;
    
    switch (type) {
        case 'message':
            webhookUrl = envConfigService.getMessageWebhookUrl();
            break;
        case 'group_event':
            webhookUrl = envConfigService.getGroupEventWebhookUrl();
            break;
        case 'reaction':
            webhookUrl = envConfigService.getReactionWebhookUrl();
            break;
    }
    
    if (webhookUrl) {
        // Gửi webhook request
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    }
}
```

## Bảo mật

- ✅ Yêu cầu quyền admin để truy cập
- ✅ Validate URL format
- ✅ Validate required fields
- ✅ Error handling toàn diện

## File cấu hình

File `zalo_data/env-config.json` sẽ được tạo tự động với cấu hình mặc định:

```json
{
  "MESSAGE_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "GROUP_EVENT_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "REACTION_WEBHOOK_URL": "http://localhost:3001/api/webhook",
  "LOGIN_CALLBACK_URL": "http://localhost:3001/api/webhook"
}
```

## Lưu ý

1. File cấu hình sẽ được tạo tự động nếu không tồn tại
2. Service sử dụng singleton pattern, chỉ có một instance duy nhất
3. Cấu hình được load ngay khi service khởi tạo
4. Tất cả thay đổi được lưu vào file ngay lập tức
5. Giao diện có real-time preview cho JSON
