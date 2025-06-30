import fs from 'fs';
import path from 'path';

class EnvConfigService {
    constructor() {
        this.configPath = path.join(process.cwd(), 'zalo_data', 'env-config.json');
        this.config = null;
        this.loadConfig();
    }

    // Load cấu hình từ file JSON
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = JSON.parse(data);
                console.log('✓ Đã load cấu hình environment từ JSON');
                
                // Tự động sync với process.env khi load
                this.syncToProcessEnv();
            } else {
                // Tạo file cấu hình mặc định nếu không tồn tại
                this.config = this.getDefaultConfig();
                this.saveConfig();
                this.syncToProcessEnv();
                console.log('✓ Đã tạo file cấu hình environment mặc định');
            }
        } catch (error) {
            console.error('❌ Lỗi khi load cấu hình environment:', error);
            this.config = this.getDefaultConfig();
            this.syncToProcessEnv();
        }
    }

    // Lưu cấu hình vào file JSON
    saveConfig() {
        try {
            // Đảm bảo thư mục tồn tại
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('❌ Lỗi khi lưu cấu hình environment:', error);
            return false;
        }
    }

    // Lấy cấu hình mặc định
    getDefaultConfig() {
        return {
            MESSAGE_WEBHOOK_URL: 'http://localhost:3001/api/webhook',
            GROUP_EVENT_WEBHOOK_URL: 'http://localhost:3001/api/webhook',
            REACTION_WEBHOOK_URL: 'http://localhost:3001/api/webhook',
            LOGIN_CALLBACK_URL: 'http://localhost:3001/api/webhook'
        };
    }

    // Lấy giá trị cấu hình theo key
    get(key) {
        return this.config && this.config[key] ? this.config[key] : null;
    }

    // Lấy tất cả cấu hình
    getAll() {
        return this.config || this.getDefaultConfig();
    }

    // Set giá trị cấu hình
    set(key, value) {
        if (!this.config) {
            this.config = this.getDefaultConfig();
        }
        this.config[key] = value;
        const success = this.saveConfig();
        
        // Tự động sync với process.env
        if (success) {
            process.env[key] = value;
        }
        
        return success;
    }

    // Update nhiều cấu hình cùng lúc
    update(newConfig) {
        this.config = { ...this.config, ...newConfig };
        const success = this.saveConfig();
        
        // Tự động sync với process.env
        if (success) {
            this.syncToProcessEnv();
        }
        
        return success;
    }

    // Sync config với process.env
    syncToProcessEnv() {
        Object.keys(this.config).forEach(key => {
            process.env[key] = this.config[key];
        });
        console.log('✓ Đã sync cấu hình với process.env');
    }

    // Reset về cấu hình mặc định
    reset() {
        this.config = this.getDefaultConfig();
        const success = this.saveConfig();
        
        // Tự động sync với process.env
        if (success) {
            this.syncToProcessEnv();
        }
        
        return success;
    }

    // Reload cấu hình từ file
    reload() {
        this.loadConfig();
    }

    // Validate URL format
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    // Validate cấu hình
    validate(config = null) {
        const configToValidate = config || this.config;
        const errors = [];

        const requiredFields = ['MESSAGE_WEBHOOK_URL', 'GROUP_EVENT_WEBHOOK_URL', 'REACTION_WEBHOOK_URL', 'LOGIN_CALLBACK_URL'];
        
        requiredFields.forEach(field => {
            if (!configToValidate[field]) {
                errors.push(`Thiếu trường bắt buộc: ${field}`);
            } else if (!this.isValidUrl(configToValidate[field])) {
                errors.push(`URL không hợp lệ: ${field}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // Lấy URL webhook cho message
    getMessageWebhookUrl() {
        return this.get('MESSAGE_WEBHOOK_URL');
    }

    // Lấy URL webhook cho group event
    getGroupEventWebhookUrl() {
        return this.get('GROUP_EVENT_WEBHOOK_URL');
    }

    // Lấy URL webhook cho reaction
    getReactionWebhookUrl() {
        return this.get('REACTION_WEBHOOK_URL');
    }

    // Lấy URL callback cho login
    getLoginCallbackUrl() {
        return this.get('LOGIN_CALLBACK_URL');
    }
}

// Tạo instance singleton
const envConfigService = new EnvConfigService();

export default envConfigService;
export { EnvConfigService };
