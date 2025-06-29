# Hướng dẫn sử dụng API Đăng nhập Zalo

## Tổng quan
API đăng nhập Zalo cho phép bạn đăng nhập tài khoản Zalo thông qua HTTP request. API hỗ trợ hai phương thức đăng nhập:
1. **Đăng nhập bằng QR Code**: Tạo mã QR để quét bằng ứng dụng Zalo
2. **Đăng nhập bằng Cookie**: Sử dụng credential đã lưu trước đó

## API Endpoints

### 1. Đăng nhập Zalo
```
POST /api/login-zalo
```

### 2. Check trạng thái login session
```
GET /api/login-session/:sessionId
```

### 3. Lấy thông tin credential
```
GET /api/credentials/:ownId
```

### 4. Cập nhật trạng thái credential
```
PUT /api/credentials/:ownId/status
```

## Cấu trúc File Credential

Từ phiên bản mới, file credential được lưu với cấu trúc mở rộng bao gồm:

```json
{
  "imei": "device-identifier",
  "cookie": {
    "version": "tough-cookie@5.1.2",
    "cookies": [...]
  },
  "userAgent": "Mozilla/5.0...",
  "userId": "719042314012359086",
  "profile": {
    "userId": "719042314012359086",
    "displayName": "Tên hiển thị",
    "phoneNumber": "0901234567"
  },
  "loginStatus": {
    "isLoggedIn": true,
    "lastLoginTime": "2025-06-29T08:27:27.000Z",
    "loginMethod": "cookie",
    "status": "online",
    "lastStatusUpdate": "2025-06-29T08:27:27.000Z"
  },
  "proxy": "http://proxy.example.com:8080",
  "createdAt": "2025-06-29T08:27:27.000Z",
  "updatedAt": "2025-06-29T08:27:27.000Z"
}
```

### Giải thích các trường mới:
- **userId**: ID người dùng Zalo
- **profile**: Thông tin cá nhân (tên, số điện thoại)
- **loginStatus**: Trạng thái đăng nhập chi tiết
  - `isLoggedIn`: true/false
  - `lastLoginTime`: Thời gian đăng nhập lần cuối
  - `loginMethod`: "cookie" hoặc "qr_code"
  - `status`: "online", "offline", "error", "expired"
  - `lastStatusUpdate`: Thời gian cập nhật trạng thái cuối
- **proxy**: Proxy được sử dụng (nếu có)
- **createdAt**: Thời gian tạo credential
- **updatedAt**: Thời gian cập nhật cuối

## API Parameters & Responses

### 1. POST /api/login-zalo

**Parameters:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| customProxy | string | URL proxy tùy chỉnh (http://host:port) | No |
| credentialId | string | ID của credential đã lưu (ownId) | No |

**Response Types:**
- **QR Code**: Khi cần quét mã QR
- **Login Success**: Khi đăng nhập thành công  
- **Error**: Khi có lỗi xảy ra

**Mọi response đều có `sessionId` để theo dõi trạng thái đăng nhập.**

**QR Code Response:**
```json
{
  "success": true,
  "type": "qr_code",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "message": "Vui lòng quét mã QR để đăng nhập"
  }
}
```

**Login Success Response:**
```json
{
  "success": true,
  "type": "login_success",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "message": "Đăng nhập thành công",
    "totalAccounts": 2
  }
}
```

### 2. GET /api/login-session/:sessionId

**Parameters:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| sessionId | string (URL param) | ID của login session | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "customProxy": null,
    "credentialId": "719042314012359086",
    "startedAt": "2025-06-29T10:30:00.000Z",
    "ownId": "719042314012359086",
    "displayName": "Tên hiển thị",
    "phoneNumber": "0901234567",
    "completedAt": "2025-06-29T10:31:15.000Z",
    "updatedAt": "2025-06-29T10:31:15.000Z"
  }
}
```

**Các trạng thái session:**
- `pending`: Đang khởi tạo
- `connecting`: Đang kết nối
- `generating_qr`: Đang tạo mã QR
- `qr_generated`: Đã tạo mã QR, chờ quét
- `waiting_qr_scan`: Đang chờ quét QR
- `connected`: Đã kết nối thành công
- `fetching_account_info`: Đang lấy thông tin tài khoản
- `saving_credentials`: Đang lưu credential
- `completed`: Hoàn thành thành công
- `success`: Đăng nhập thành công
- `error`: Có lỗi xảy ra

### 3. GET /api/credentials/:ownId

**Parameters:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| ownId | string (URL param) | ID tài khoản Zalo | Yes |

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "719042314012359086",
    "profile": {
      "userId": "719042314012359086",
      "displayName": "Tên hiển thị",
      "phoneNumber": "0901234567"
    },
    "loginStatus": {
      "isLoggedIn": true,
      "lastLoginTime": "2025-06-29T08:27:27.000Z",
      "loginMethod": "cookie",
      "status": "online",
      "lastStatusUpdate": "2025-06-29T08:27:27.000Z"
    },
    "proxy": "http://proxy.example.com:8080",
    "createdAt": "2025-06-29T08:27:27.000Z",
    "updatedAt": "2025-06-29T08:27:27.000Z"
  }
}
```

### 4. PUT /api/credentials/:ownId/status

**Parameters:**
| Field | Type | Description | Required |
|-------|------|-------------|----------|
| ownId | string (URL param) | ID tài khoản Zalo | Yes |
| status | string | Trạng thái mới: "online", "offline", "error", "expired" | Yes |
| additionalInfo | object | Thông tin bổ sung (tùy chọn) | No |

**Response:**
```json
{
  "success": true,
  "message": "Đã cập nhật trạng thái credential thành online"
}
```

### 1. QR Code Response
Khi cần quét mã QR để đăng nhập:
```json
{
  "success": true,
  "type": "qr_code",
  "data": {
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "message": "Vui lòng quét mã QR để đăng nhập"
  }
}
```

### 2. Login Success Response
Khi đăng nhập thành công:
```json
{
  "success": true,
  "type": "login_success",
  "data": {
    "message": "Đăng nhập thành công",
    "totalAccounts": 2
  }
}
```

### 3. Error Response
Khi có lỗi xảy ra:
```json
{
  "success": false,
  "type": "error",
  "error": "Chi tiết lỗi"
}
```

## Ví dụ sử dụng

### 1. Đăng nhập Zalo

#### Đăng nhập mới (tạo QR Code)
```bash
curl -X POST http://localhost:3000/api/login-zalo \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Đăng nhập với proxy tùy chỉnh
```bash
curl -X POST http://localhost:3000/api/login-zalo \
  -H "Content-Type: application/json" \
  -d '{
    "customProxy": "http://proxy.example.com:8080"
  }'
```

#### Đăng nhập bằng credential đã lưu
```bash
curl -X POST http://localhost:3000/api/login-zalo \
  -H "Content-Type: application/json" \
  -d '{
    "credentialId": "719042314012359086"
  }'
```

### 2. Lấy thông tin credential
```bash
curl -X GET http://localhost:3000/api/credentials/719042314012359086
```

### 3. Cập nhật trạng thái credential
```bash
# Đánh dấu tài khoản offline
curl -X PUT http://localhost:3000/api/credentials/719042314012359086/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "offline",
    "additionalInfo": {
      "reason": "Manual logout"
    }
  }'

# Đánh dấu tài khoản lỗi
curl -X PUT http://localhost:3000/api/credentials/719042314012359086/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "error",
    "additionalInfo": {
      "errorMessage": "Connection timeout",
      "errorCode": "TIMEOUT"
    }
  }'

# Đánh dấu credential hết hạn
curl -X PUT http://localhost:3000/api/credentials/719042314012359086/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "expired",
    "additionalInfo": {
      "reason": "Cookie expired"
    }
  }'
```

## Test Interface
Bạn có thể test API này thông qua giao diện web tại:
```
http://localhost:3000/zalo-login-test
```

## Lưu ý quan trọng

1. **QR Code Expiration**: Mã QR có thời hạn, thường là 2-3 phút. Nếu quá hạn, cần request lại.

2. **Credential Storage**: Khi đăng nhập thành công, credential sẽ được tự động lưu vào folder `./data/cookies/` với tên file `cred_{ownId}.json`.

3. **Proxy Management**: 
   - Nếu không cung cấp `customProxy`, hệ thống sẽ tự động chọn proxy từ danh sách có sẵn
   - Proxy tùy chỉnh sẽ được thêm vào danh sách proxy nếu chưa tồn tại

4. **Account Management**: Tài khoản đăng nhập thành công sẽ được thêm vào danh sách `zaloAccounts` để sử dụng cho các API khác.

## Frontend Integration Workflow

### JavaScript Example cho Frontend

```javascript
class ZaloLoginManager {
    constructor() {
        this.sessionId = null;
        this.checkInterval = null;
    }

    async startLogin(customProxy = null, credentialId = null) {
        const requestBody = {};
        if (customProxy) requestBody.customProxy = customProxy;
        if (credentialId) requestBody.credentialId = credentialId;

        try {
            const response = await fetch('/api/login-zalo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();
            
            if (data.success && data.sessionId) {
                this.sessionId = data.sessionId;
                
                if (data.type === 'qr_code') {
                    this.displayQRCode(data.data.qrCode);
                    this.startPolling();
                } else if (data.type === 'login_success') {
                    this.handleLoginSuccess(data.data);
                }
            }
            
            return data;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async checkLoginStatus() {
        if (!this.sessionId) return;

        try {
            const response = await fetch(`/api/login-session/${this.sessionId}`);
            const data = await response.json();
            
            if (data.success) {
                const status = data.data.status;
                
                // Cập nhật UI dựa trên status
                this.updateStatusDisplay(status, data.data);
                
                // Nếu hoàn thành, dừng polling và chuyển trang
                if (status === 'completed' || status === 'success') {
                    this.stopPolling();
                    this.handleLoginSuccess(data.data);
                } else if (status === 'error') {
                    this.stopPolling();
                    this.handleLoginError(data.data);
                }
            }
        } catch (error) {
            console.error('Error checking session:', error);
        }
    }

    startPolling() {
        this.checkInterval = setInterval(() => {
            this.checkLoginStatus();
        }, 2000); // Check mỗi 2 giây
    }

    stopPolling() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    displayQRCode(qrCodeDataUrl) {
        // Hiển thị QR code trên UI
        const qrContainer = document.getElementById('qr-container');
        qrContainer.innerHTML = `
            <img src="${qrCodeDataUrl}" alt="QR Code" style="max-width: 300px;" />
            <p>Quét mã QR bằng ứng dụng Zalo để đăng nhập</p>
        `;
    }

    updateStatusDisplay(status, data) {
        const statusMessages = {
            'generating_qr': 'Đang tạo mã QR...',
            'qr_generated': 'Đã tạo mã QR, vui lòng quét',
            'waiting_qr_scan': 'Đang chờ quét mã QR...',
            'connected': 'Đã kết nối thành công!',
            'fetching_account_info': 'Đang lấy thông tin tài khoản...',
            'saving_credentials': 'Đang lưu thông tin...',
            'completed': 'Hoàn thành đăng nhập!'
        };
        
        const message = statusMessages[status] || `Trạng thái: ${status}`;
        document.getElementById('status').textContent = message;
    }

    handleLoginSuccess(data) {
        // Chuyển hướng trang hoặc cập nhật UI
        if (data.ownId) {
            // Lưu thông tin tài khoản vào localStorage hoặc session
            localStorage.setItem('zaloAccountId', data.ownId);
            
            // Chuyển hướng về trang chính
            window.location.href = '/dashboard';
            
            // Hoặc cập nhật UI
            // this.showDashboard(data);
        }
    }

    handleLoginError(data) {
        console.error('Login error:', data);
        document.getElementById('error').textContent = 
            data.error || 'Có lỗi xảy ra trong quá trình đăng nhập';
    }
}

// Sử dụng
const loginManager = new ZaloLoginManager();

// Đăng nhập mới
document.getElementById('login-btn').onclick = () => {
    loginManager.startLogin();
};

// Đăng nhập với credential
document.getElementById('login-with-cred-btn').onclick = () => {
    const credId = document.getElementById('cred-id').value;
    loginManager.startLogin(null, credId);
};
```

1. **Lần đầu đăng nhập**:
   - Gọi API không tham số → nhận QR Code
   - Quét QR Code bằng ứng dụng Zalo → đăng nhập thành công
   - Credential được lưu tự động

2. **Đăng nhập lần sau**:
   - Gọi API với `credentialId` → đăng nhập trực tiếp (nếu cookie còn hợp lệ)
   - Nếu cookie hết hạn → tự động chuyển sang QR Code

3. **Sử dụng tài khoản**:
   - Dùng các API khác với `ownId` hoặc `accountSelection`
   - Kiểm tra danh sách tài khoản qua `GET /api/accounts`
