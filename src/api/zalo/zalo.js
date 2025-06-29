// api/zalo/zalo.js
import { Zalo, ThreadType } from 'zca-js';
import { getPROXIES, getAvailableProxyIndex } from '../../services/proxyService.js';
import { setupEventListeners } from '../../eventListeners.js';
import { HttpsProxyAgent } from "https-proxy-agent";
import nodefetch from "node-fetch";
import fs from 'fs';
import { saveImage, removeImage } from '../../utils/helpers.js';
import crypto from 'crypto';

export const zaloAccounts = [];

// Map để lưu trạng thái login sessions
const loginSessions = new Map();

// Hàm tạo login session ID
function generateLoginSessionId() {
    return crypto.randomUUID();
}

// Hàm cập nhật trạng thái login session
function updateLoginSession(sessionId, status, data = {}) {
    const session = loginSessions.get(sessionId) || {};
    loginSessions.set(sessionId, {
        ...session,
        status,
        ...data,
        updatedAt: new Date().toISOString()
    });
}

// Hàm lấy thông tin login session
function getLoginSession(sessionId) {
    return loginSessions.get(sessionId) || null;
}

// API để check trạng thái login session
export async function checkLoginSessionAPI(req, res) {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId là bắt buộc' });
        }
        
        const session = getLoginSession(sessionId);
        
        if (!session) {
            return res.status(404).json({ 
                success: false,
                error: 'Không tìm thấy session đăng nhập' 
            });
        }
        
        res.json({
            success: true,
            data: session
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API để lấy danh sách tài khoản đã đăng nhập
export async function getLoggedAccounts(req, res) {
    try {
        const accounts = zaloAccounts.map(acc => ({
            ownId: acc.ownId,
            phoneNumber: acc.phoneNumber,
            proxy: acc.proxy || 'Không có proxy',
            displayName: `${acc.phoneNumber} (${acc.ownId})`,
            isOnline: acc.api ? true : false
        }));

        res.json({
            success: true,
            data: accounts,
            total: accounts.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API để lấy thông tin chi tiết một tài khoản
export async function getAccountDetails(req, res) {
    try {
        const { ownId } = req.params;
        const account = zaloAccounts.find(acc => acc.ownId === ownId);

        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản' });
        }

        // Lấy thông tin profile từ API
        const accountInfo = await account.api.fetchAccountInfo();

        res.json({
            success: true,
            data: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber,
                proxy: account.proxy || 'Không có proxy',
                profile: accountInfo?.profile || {},
                isOnline: account.api ? true : false
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// ===== N8N-FRIENDLY WRAPPER APIs =====
// Các API này sử dụng account selection thay vì ownId

// Middleware để xử lý account selection
function getAccountFromSelection(accountSelection) {
    if (!accountSelection) {
        throw new Error('Vui lòng chọn tài khoản');
    }

    // Hỗ trợ cả ownId và phoneNumber
    let account = zaloAccounts.find(acc => acc.ownId === accountSelection);
    if (!account) {
        account = zaloAccounts.find(acc => acc.phoneNumber === accountSelection);
    }

    if (!account) {
        throw new Error(`Không tìm thấy tài khoản: ${accountSelection}`);
    }

    return account;
}

// API tìm user với account selection
export async function findUserByAccount(req, res) {
    try {
        const { phone, accountSelection } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Số điện thoại là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const userData = await account.api.findUser(phone);

        res.json({
            success: true,
            data: userData,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi tin nhắn với account selection
export async function sendMessageByAccount(req, res) {
    try {
        const { message, threadId, type, accountSelection } = req.body;

        if (!message || !threadId) {
            return res.status(400).json({ error: 'Tin nhắn và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const msgType = type || ThreadType.User;
        const result = await account.api.sendMessage(message, threadId, msgType);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi hình ảnh với account selection
export async function sendImageByAccount(req, res) {
    try {
        const { imagePath: imageUrl, threadId, type, accountSelection } = req.body;

        if (!imageUrl || !threadId) {
            return res.status(400).json({ error: 'Đường dẫn hình ảnh và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const imagePath = await saveImage(imageUrl);

        if (!imagePath) {
            return res.status(500).json({ success: false, error: 'Không thể lưu hình ảnh' });
        }

        const threadType = type === 'group' ? ThreadType.Group : ThreadType.User;
        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: [imagePath]
            },
            threadId,
            threadType
        );

        removeImage(imagePath);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API lấy thông tin user với account selection
export async function getUserInfoByAccount(req, res) {
    try {
        const { userId, accountSelection } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'UserId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const info = await account.api.getUserInfo(userId);

        res.json({
            success: true,
            data: info,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi lời mời kết bạn với account selection
export async function sendFriendRequestByAccount(req, res) {
    try {
        const { userId, message, accountSelection } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'UserId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const friendMessage = message || 'Xin chào, hãy kết bạn với tôi!';
        const result = await account.api.sendFriendRequest(friendMessage, userId);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API tạo nhóm với account selection
export async function createGroupByAccount(req, res) {
    try {
        const { members, name, avatarPath, accountSelection } = req.body;

        if (!members || !Array.isArray(members) || members.length === 0) {
            return res.status(400).json({ error: 'Danh sách thành viên là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const result = await account.api.createGroup({ members, name, avatarPath });

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API lấy thông tin nhóm với account selection
export async function getGroupInfoByAccount(req, res) {
    try {
        const { groupId, accountSelection } = req.body;

        if (!groupId || (Array.isArray(groupId) && groupId.length === 0)) {
            return res.status(400).json({ error: 'GroupId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const result = await account.api.getGroupInfo(groupId);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API thêm thành viên vào nhóm với account selection
export async function addUserToGroupByAccount(req, res) {
    try {
        const { groupId, memberId, accountSelection } = req.body;

        if (!groupId || !memberId || (Array.isArray(memberId) && memberId.length === 0)) {
            return res.status(400).json({ error: 'GroupId và memberId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const result = await account.api.addUserToGroup(memberId, groupId);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API xóa thành viên khỏi nhóm với account selection
export async function removeUserFromGroupByAccount(req, res) {
    try {
        const { memberId, groupId, accountSelection } = req.body;

        if (!groupId || !memberId || (Array.isArray(memberId) && memberId.length === 0)) {
            return res.status(400).json({ error: 'GroupId và memberId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const result = await account.api.removeUserFromGroup(memberId, groupId);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi hình ảnh đến user với account selection
export async function sendImageToUserByAccount(req, res) {
    try {
        const { imagePath: imageUrl, threadId, accountSelection } = req.body;

        if (!imageUrl || !threadId) {
            return res.status(400).json({ error: 'Đường dẫn hình ảnh và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const imagePath = await saveImage(imageUrl);

        if (!imagePath) {
            return res.status(500).json({ success: false, error: 'Không thể lưu hình ảnh' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: [imagePath]
            },
            threadId,
            ThreadType.User
        );

        removeImage(imagePath);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi nhiều hình ảnh đến user với account selection
export async function sendImagesToUserByAccount(req, res) {
    try {
        const { imagePaths: imageUrls, threadId, accountSelection } = req.body;

        if (!imageUrls || !threadId || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ error: 'Danh sách hình ảnh và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const imagePaths = [];

        for (const imageUrl of imageUrls) {
            const imagePath = await saveImage(imageUrl);
            if (!imagePath) {
                // Clean up any saved images
                for (const path of imagePaths) {
                    removeImage(path);
                }
                return res.status(500).json({ success: false, error: 'Không thể lưu một hoặc nhiều hình ảnh' });
            }
            imagePaths.push(imagePath);
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: imagePaths
            },
            threadId,
            ThreadType.User
        );

        for (const imagePath of imagePaths) {
            removeImage(imagePath);
        }

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi hình ảnh đến nhóm với account selection
export async function sendImageToGroupByAccount(req, res) {
    try {
        const { imagePath: imageUrl, threadId, accountSelection } = req.body;

        if (!imageUrl || !threadId) {
            return res.status(400).json({ error: 'Đường dẫn hình ảnh và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const imagePath = await saveImage(imageUrl);

        if (!imagePath) {
            return res.status(500).json({ success: false, error: 'Không thể lưu hình ảnh' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: [imagePath]
            },
            threadId,
            ThreadType.Group
        );

        removeImage(imagePath);

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API gửi nhiều hình ảnh đến nhóm với account selection
export async function sendImagesToGroupByAccount(req, res) {
    try {
        const { imagePaths: imageUrls, threadId, accountSelection } = req.body;

        if (!imageUrls || !threadId || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ error: 'Danh sách hình ảnh và threadId là bắt buộc' });
        }

        const account = getAccountFromSelection(accountSelection);
        const imagePaths = [];

        for (const imageUrl of imageUrls) {
            const imagePath = await saveImage(imageUrl);
            if (!imagePath) {
                // Clean up any saved images
                for (const path of imagePaths) {
                    removeImage(path);
                }
                return res.status(500).json({ success: false, error: 'Không thể lưu một hoặc nhiều hình ảnh' });
            }
            imagePaths.push(imagePath);
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: imagePaths
            },
            threadId,
            ThreadType.Group
        );

        for (const imagePath of imagePaths) {
            removeImage(imagePath);
        }

        res.json({
            success: true,
            data: result,
            usedAccount: {
                ownId: account.ownId,
                phoneNumber: account.phoneNumber
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function findUser(req, res) {
    try {
        const { phone, ownId } = req.body;
        if (!phone || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        const userData = await account.api.findUser(phone);
        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getUserInfo(req, res) {
    try {
        const { userId, ownId } = req.body;
        if (!userId || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        const info = await account.api.getUserInfo(userId);
        res.json({ success: true, data: info });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function sendFriendRequest(req, res) {
    try {
        const { userId, ownId } = req.body;
        if (!userId || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        const result = await account.api.sendFriendRequest('Xin chào, hãy kết bạn với tôi!', userId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function sendMessage(req, res) {
    try {
        const { message, threadId, type, ownId } = req.body;
        if (!message || !threadId || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        console.log('Sending message:', { message, threadId, type, ownId });
        console.log('Available accounts:', zaloAccounts);
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        const msgType = type || ThreadType.User;
        const result = await account.api.sendMessage(message, threadId, msgType);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function createGroup(req, res) {
    try {
        const { members, name, avatarPath, ownId } = req.body;
        // Kiểm tra dữ liệu hợp lệ
        if (!members || !Array.isArray(members) || members.length === 0 || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        // Gọi API createGroup từ zaloAccounts
        const result = await account.api.createGroup({ members, name, avatarPath });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getGroupInfo(req, res) {
    try {
        const { groupId, ownId } = req.body;
        // Kiểm tra dữ liệu: groupId phải tồn tại và nếu là mảng thì không rỗng
        if (!groupId || (Array.isArray(groupId) && groupId.length === 0)) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        // Gọi API getGroupInfo từ zaloAccounts
        const result = await account.api.getGroupInfo(groupId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function addUserToGroup(req, res) {
    try {
        const { groupId, memberId, ownId } = req.body;
        // Kiểm tra dữ liệu hợp lệ: groupId và memberId không được bỏ trống
        if (!groupId || !memberId || (Array.isArray(memberId) && memberId.length === 0)) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        // Gọi API addUserToGroup từ zaloAccounts
        const result = await account.api.addUserToGroup(memberId, groupId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function removeUserFromGroup(req, res) {
    try {
        const { memberId, groupId, ownId } = req.body;
        // Kiểm tra dữ liệu: groupId và memberId phải được cung cấp, nếu memberId là mảng thì không được rỗng
        if (!groupId || !memberId || (Array.isArray(memberId) && memberId.length === 0)) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
        }
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        // Gọi API removeUserFromGroup từ zaloAccounts
        const result = await account.api.removeUserFromGroup(memberId, groupId);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// Hàm gửi một hình ảnh đến người dùng
export async function sendImageToUser(req, res) {
    try {
        const { imagePath: imageUrl, threadId, ownId } = req.body;
        if (!imageUrl || !threadId || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ: imagePath và threadId là bắt buộc' });
        }


        const imagePath = await saveImage(imageUrl);
        if (!imagePath) return res.status(500).json({ success: false, error: 'Failed to save image' });

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: [imagePath]
            },
            threadId,
            ThreadType.User
        ).catch(console.error);

        removeImage(imagePath);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// Hàm gửi nhiều hình ảnh đến người dùng
export async function sendImagesToUser(req, res) {
    try {
        const { imagePaths: imageUrls, threadId, ownId } = req.body;
        if (!imageUrls || !threadId || !ownId || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ: imagePaths phải là mảng không rỗng và threadId là bắt buộc' });
        }


        const imagePaths = [];
        for (const imageUrl of imageUrls) {
            const imagePath = await saveImage(imageUrl);
            if (!imagePath) {
                // Clean up any saved images
                for (const path of imagePaths) {
                    removeImage(path);
                }
                return res.status(500).json({ success: false, error: 'Failed to save one or more images' });
            }
            imagePaths.push(imagePath);
        }

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: imagePaths
            },
            threadId,
            ThreadType.User
        ).catch(console.error);

        for (const imagePath of imagePaths) {
            removeImage(imagePath);
        }
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// Hàm gửi một hình ảnh đến nhóm
export async function sendImageToGroup(req, res) {
    try {
        const { imagePath: imageUrl, threadId, ownId } = req.body;
        if (!imageUrl || !threadId || !ownId) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ: imagePath và threadId là bắt buộc' });
        }


        const imagePath = await saveImage(imageUrl);
        if (!imagePath) return res.status(500).json({ success: false, error: 'Failed to save image' });

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: [imagePath]
            },
            threadId,
            ThreadType.Group
        ).catch(console.error);

        removeImage(imagePath);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// Hàm gửi nhiều hình ảnh đến nhóm
export async function sendImagesToGroup(req, res) {
    try {
        const { imagePaths: imageUrls, threadId, ownId } = req.body;
        if (!imageUrls || !threadId || !ownId || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ error: 'Dữ liệu không hợp lệ: imagePaths phải là mảng không rỗng và threadId là bắt buộc' });
        }


        const imagePaths = [];
        for (const imageUrl of imageUrls) {
            const imagePath = await saveImage(imageUrl);
            if (!imagePath) {
                // Clean up any saved images
                for (const path of imagePaths) {
                    removeImage(path);
                }
                return res.status(500).json({ success: false, error: 'Failed to save one or more images' });
            }
            imagePaths.push(imagePath);
        }

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const result = await account.api.sendMessage(
            {
                msg: "",
                attachments: imagePaths
            },
            threadId,
            ThreadType.Group
        ).catch(console.error);

        for (const imagePath of imagePaths) {
            removeImage(imagePath);
        }
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API đăng nhập tài khoản Zalo
export async function loginZaloAccountAPI(req, res) {
    try {
        const { customProxy, credentialId, userId } = req.body;

        console.log('API đăng nhập Zalo được gọi...');
        console.log('Custom proxy:', customProxy || 'không có');
        console.log('Credential ID:', credentialId || 'không có');
        console.log('User ID:', userId || 'không có');

        // Tạo session ID cho lần đăng nhập này
        const loginSessionId = generateLoginSessionId();
        console.log('Tạo login session ID:', loginSessionId);

        // Khởi tạo session với trạng thái pending
        updateLoginSession(loginSessionId, 'pending', {
            customProxy: customProxy || null,
            credentialId: credentialId || null,
            startedAt: new Date().toISOString(),
            user_BE_Id: userId || null
        });

        let cred = null;
        
        // Nếu có credentialId, đọc credential từ file
        if (credentialId) {
            try {
                const credPath = `./data/cookies/cred_${credentialId}.json`;
                if (fs.existsSync(credPath)) {
                    const credData = fs.readFileSync(credPath, 'utf8');
                    cred = JSON.parse(credData);
                    console.log('Đã đọc credential từ file:', credPath);
                    updateLoginSession(loginSessionId, 'loading_credential', {
                        user_BE_Id: userId || null
                    });
                } else {
                    console.log('File credential không tồn tại:', credPath);
                    updateLoginSession(loginSessionId, 'credential_not_found', {
                        user_BE_Id: userId || null
                    });
                }
            } catch (error) {
                console.error('Lỗi khi đọc credential:', error);
                updateLoginSession(loginSessionId, 'credential_error', { error: error.message, user_BE_Id: userId || null });
            }
        }

        // Cập nhật session trước khi gọi loginZaloAccount
        updateLoginSession(loginSessionId, 'connecting', {
            user_BE_Id: userId || null
        });

        const result = await loginZaloAccount(customProxy, cred, loginSessionId);
        
        // Kiểm tra kết quả trả về
        if (typeof result === 'string' && result.startsWith('data:image/png;base64,')) {
            // Trường hợp trả về QR code
            updateLoginSession(loginSessionId, 'waiting_qr_scan', {
                qrCode: result,
                message: 'Đang chờ quét mã QR',
                user_BE_Id: userId || null
            });
            
            res.json({
                success: true,
                type: 'qr_code',
                sessionId: loginSessionId,
                data: {
                    qrCode: result,
                    message: 'Vui lòng quét mã QR để đăng nhập'
                }
            });
        } else if (result === true) {
            // Trường hợp đăng nhập thành công
            updateLoginSession(loginSessionId, 'success', {
                message: 'Đăng nhập thành công',
                totalAccounts: zaloAccounts.length,
                completedAt: new Date().toISOString(),
                user_BE_Id: userId || null
            });
            
            res.json({
                success: true,
                type: 'login_success',
                sessionId: loginSessionId,
                data: {
                    message: 'Đăng nhập thành công',
                    totalAccounts: zaloAccounts.length,
                    user_BE_Id: userId || null
                }
            });
        } else {
            // Trường hợp khác
            updateLoginSession(loginSessionId, 'unknown', { result });
            
            res.json({
                success: true,
                type: 'unknown',
                sessionId: loginSessionId,
                data: result
            });
        }
    } catch (error) {
        console.error('Lỗi API đăng nhập Zalo:', error);
        
        // Cập nhật session với lỗi nếu có sessionId
        if (loginSessionId) {
            updateLoginSession(loginSessionId, 'error', {
                error: error.message,
                errorAt: new Date().toISOString(),
                user_BE_Id: userId || null
            });
        }
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            type: 'error',
            sessionId: loginSessionId || null,
            user_BE_Id: userId || null
        });
    }
}

export async function loginZaloAccount(customProxy, cred, sessionId = null, userId = null) {
    let loginResolve;
    return new Promise(async (resolve, reject) => {
        console.log('Bắt đầu quá trình đăng nhập Zalo...');
        console.log('Custom proxy:', customProxy || 'không có');
        console.log('Đang nhập với cookie:', cred ? 'có' : 'không');
        console.log('Session ID:', sessionId || 'không có');

        loginResolve = resolve;
        let agent;
        let proxyUsed = null;
        let useCustomProxy = false;
        let proxies = [];
        
        // Cập nhật session status nếu có
        if (sessionId) {
            updateLoginSession(sessionId, 'initializing', {
                user_BE_Id: userId || null
            });
        }
        
        try {
            const proxiesJson = fs.readFileSync('./data/proxies.json', 'utf8');
            proxies = JSON.parse(proxiesJson);
            console.log(`Đã đọc ${proxies.length} proxy từ file proxies.json`);
        } catch (error) {
            console.error("Không thể đọc hoặc phân tích cú pháp proxies.json:", error);
            console.log('Đang tạo file proxies.json trống...');
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }
            fs.writeFileSync('./data/proxies.json', '[]', 'utf8');
            proxies = [];
        }

        // Kiểm tra nếu người dùng nhập proxy
        if (customProxy && customProxy.trim() !== "") {
            try {
                // Sử dụng constructor URL để kiểm tra tính hợp lệ
                new URL(customProxy);
                useCustomProxy = true;
                console.log('Proxy nhập vào hợp lệ:', customProxy);

                // Kiểm tra xem proxy đã tồn tại trong mảng proxies chưa
                if (!proxies.includes(customProxy)) {
                    proxies.push(customProxy);
                    // Lưu mảng proxies đã cập nhật vào proxies.json
                    fs.writeFileSync('./data/proxies.json', JSON.stringify(proxies, null, 4), 'utf8');
                    console.log(`Đã thêm proxy mới vào proxies.json: ${customProxy}`);
                } else {
                    console.log(`Proxy đã tồn tại trong proxies.json: ${customProxy}`);
                }

            } catch (err) {
                console.log(`Proxy nhập vào không hợp lệ: ${customProxy}. Sẽ sử dụng proxy mặc định.`);
            }
        }

        if (useCustomProxy) {
            console.log('Sử dụng proxy tùy chỉnh:', customProxy);
            agent = new HttpsProxyAgent(customProxy);
        } else {
            // Chọn proxy tự động từ danh sách nếu không có proxy do người dùng nhập hợp lệ
            if (proxies.length > 0) {
                const proxyIndex = getAvailableProxyIndex();
                if (proxyIndex === -1) {
                    console.log('Tất cả proxy đều đã đủ tài khoản. Không thể đăng nhập thêm!');
                } else {
                    proxyUsed = getPROXIES()[proxyIndex];
                    console.log('Sử dụng proxy tự động:', proxyUsed.url);
                    agent = new HttpsProxyAgent(proxyUsed.url);
                }
            } else {
                console.log('Không có proxy nào có sẵn, sẽ đăng nhập không qua proxy');
                agent = null; // Không sử dụng proxy
            }
        }
        
        // Cập nhật session với thông tin proxy
        if (sessionId) {
            updateLoginSession(sessionId, 'proxy_configured', {
                proxy: useCustomProxy ? customProxy : (proxyUsed?.url || 'no_proxy'),
                user_BE_Id: userId || null
            });
        }
        
        let zalo;
        if (useCustomProxy || agent) {
            console.log('Khởi tạo Zalo SDK với proxy agent');
            zalo = new Zalo({
                agent: agent,
                // @ts-ignore
                polyfill: nodefetch,
            });
        } else {
            console.log('Khởi tạo Zalo SDK không có proxy');
            zalo = new Zalo({
            });
        }

        let api;
        try {
            if (sessionId) {
                updateLoginSession(sessionId, 'authenticating', {
                    user_BE_Id: userId || null
                });
            }
            
            if (cred) {
                console.log('Đang thử đăng nhập bằng cookie...');
                try {
                    api = await zalo.login(cred);
                    console.log('Đăng nhập bằng cookie thành công');
                    
                    if (sessionId) {
                        updateLoginSession(sessionId, 'cookie_login_success', {
                            user_BE_Id: userId || null
                        });
                    }
                } catch (error) {
                    console.error("Lỗi khi đăng nhập bằng cookie:", error);
                    console.log('Chuyển sang đăng nhập bằng mã QR...');
                    
                    if (sessionId) {
                        updateLoginSession(sessionId, 'cookie_failed_trying_qr', {
                            user_BE_Id: userId || null
                        });
                    }
                    
                    // If cookie login fails, attempt QR code login
                    api = await zalo.loginQR(null, (qrData) => {
                        console.log('Đã nhận dữ liệu QR:', qrData ? 'có dữ liệu' : 'không có dữ liệu');
                        if (qrData?.data?.image) {
                            const qrCodeImage = `data:image/png;base64,${qrData.data.image}`;
                            console.log('Đã tạo mã QR, độ dài:', qrCodeImage.length);
                            
                            if (sessionId) {
                                updateLoginSession(sessionId, 'qr_generated', {
                                    user_BE_Id: userId || null
                                });
                            }
                            
                            resolve(qrCodeImage);
                        } else {
                            console.error('Không thể lấy mã QR từ Zalo SDK');
                            
                            if (sessionId) {
                                updateLoginSession(sessionId, 'qr_generation_failed', {
                                    user_BE_Id: userId || null
                                });
                            }
                            
                            reject(new Error("Không thể lấy mã QR"));
                        }
                    });
                }
            } else {
                console.log('Đang tạo mã QR để đăng nhập...');
                
                if (sessionId) {
                    updateLoginSession(sessionId, 'generating_qr', {
                        user_BE_Id: userId || null
                    });
                }
                
                api = await zalo.loginQR(null, (qrData) => {
                    console.log('Đã nhận dữ liệu QR:', qrData ? 'có dữ liệu' : 'không có dữ liệu');
                    if (qrData?.data?.image) {
                        const qrCodeImage = `data:image/png;base64,${qrData.data.image}`;
                        console.log('Đã tạo mã QR, độ dài:', qrCodeImage.length);
                        
                        if (sessionId) {
                            updateLoginSession(sessionId, 'qr_generated', {
                                user_BE_Id: userId || null
                            });
                        }
                        
                        resolve(qrCodeImage);
                    } else {
                        console.error('Không thể lấy mã QR từ Zalo SDK');
                        
                        if (sessionId) {
                            updateLoginSession(sessionId, 'qr_generation_failed', {
                                user_BE_Id: userId || null
                            });
                        }
                        
                        reject(new Error("Không thể lấy mã QR"));
                    }
                });
            }

            api.listener.onConnected(() => {
                console.log("Zalo SDK đã kết nối");
                
                if (sessionId) {
                    updateLoginSession(sessionId, 'connected', {
                        user_BE_Id: userId || null
                    });
                }
                
                resolve(true);
            });

            console.log('Thiết lập event listeners');
            setupEventListeners(api, loginResolve);
            api.listener.start();

            // Nếu sử dụng proxy mặc định từ danh sách thì cập nhật usedCount
            if (!useCustomProxy && proxyUsed) {
                proxyUsed.usedCount++;
                proxyUsed.accounts.push(api);
                console.log(`Đã cập nhật proxy ${proxyUsed.url} với usedCount = ${proxyUsed.usedCount}`);
            }

            if (sessionId) {
                updateLoginSession(sessionId, 'fetching_account_info', {
                    user_BE_Id: userId || null
                });
            }

            console.log('Đang lấy thông tin tài khoản...');
            const accountInfo = await api.fetchAccountInfo();
            if (!accountInfo?.profile) {
                console.error('Không tìm thấy thông tin profile trong phản hồi');
                
                if (sessionId) {
                    updateLoginSession(sessionId, 'account_info_failed', {
                        user_BE_Id: userId || null
                    });
                }
                
                throw new Error("Không tìm thấy thông tin profile");
            }
            const { profile } = accountInfo;
            const phoneNumber = profile.phoneNumber;
            const ownId = profile.userId;
            const displayName = profile.displayName;
            console.log(`Thông tin tài khoản: ID=${ownId}, Tên=${displayName}, SĐT=${phoneNumber}`);

            if (sessionId) {
                updateLoginSession(sessionId, 'saving_account_info', {
                    ownId,
                    displayName,
                    phoneNumber,
                    user_BE_Id: userId || null
                });
            }

            const existingAccountIndex = zaloAccounts.findIndex(acc => acc.ownId === api.getOwnId());
            if (existingAccountIndex !== -1) {
                // Thay thế tài khoản cũ bằng tài khoản mới
                zaloAccounts[existingAccountIndex] = { api: api, ownId: api.getOwnId(), proxy: useCustomProxy ? customProxy : (proxyUsed && proxyUsed.url), phoneNumber: phoneNumber };
                console.log('Đã cập nhật tài khoản hiện có trong danh sách zaloAccounts');
            } else {
                // Thêm tài khoản mới nếu không tìm thấy tài khoản cũ
                zaloAccounts.push({ api: api, ownId: api.getOwnId(), proxy: useCustomProxy ? customProxy : (proxyUsed && proxyUsed.url), phoneNumber: phoneNumber });
                console.log('Đã thêm tài khoản mới vào danh sách zaloAccounts');
            }

            if (sessionId) {
                updateLoginSession(sessionId, 'saving_credentials', {
                    user_BE_Id: userId || null
                });
            }

            console.log('Đang lưu cookie...');
            const context = await api.getContext();
            const {imei, cookie, userAgent} = context;
            const data = {
                imei: imei,
                cookie: cookie,
                userAgent: userAgent,
                // Thêm thông tin mới
                userId: ownId,
                profile: {
                    userId: ownId,
                    displayName: displayName,
                    phoneNumber: phoneNumber
                },
                loginStatus: {
                    isLoggedIn: true,
                    lastLoginTime: new Date().toISOString(),
                    loginMethod: cred ? 'cookie' : 'qr_code'
                },
                proxy: useCustomProxy ? customProxy : (proxyUsed?.url || null),
                user_BE: userId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            const cookiesDir = './data/cookies';
            if (!fs.existsSync(cookiesDir)) {
                fs.mkdirSync(cookiesDir, { recursive: true });
                console.log('Đã tạo thư mục cookies');
            }
            
            const credFilePath = `${cookiesDir}/cred_${ownId}.json`;
            
            // Kiểm tra xem file đã tồn tại chưa để merge thông tin cũ (nếu có)
            let existingData = {};
            if (fs.existsSync(credFilePath)) {
                try {
                    const existingContent = fs.readFileSync(credFilePath, 'utf8');
                    existingData = JSON.parse(existingContent);
                    console.log(`Đã đọc dữ liệu cũ từ file cred_${ownId}.json`);
                } catch (error) {
                    console.error('Lỗi khi đọc file credential cũ:', error);
                }
            }
            
            // Merge dữ liệu mới với dữ liệu cũ (giữ lại createdAt nếu có)
            const finalData = {
                ...data,
                createdAt: existingData.createdAt || data.createdAt,
                updatedAt: data.updatedAt
            };
            
            // Luôn ghi đè file với thông tin mới nhất
            fs.writeFile(credFilePath, JSON.stringify(finalData, null, 4), (err) => {
                if (err) {
                    console.error('Lỗi khi ghi file cookie:', err);
                    
                    if (sessionId) {
                        updateLoginSession(sessionId, 'credential_save_failed', { error: err.message, user_BE_Id: userId || null });
                    }
                } else {
                    console.log(`Đã cập nhật credential vào file cred_${ownId}.json`);
                    
                    if (sessionId) {
                        updateLoginSession(sessionId, 'completed', {
                            ownId,
                            user_BE_Id: userId || null,
                            displayName,
                            phoneNumber,
                            completedAt: new Date().toISOString()
                        });
                    }
                }
            });

            console.log(`Đã đăng nhập vào tài khoản ${ownId} (${displayName}) với số điện thoại ${phoneNumber} qua proxy ${useCustomProxy ? customProxy : (proxyUsed?.url || 'không có proxy')}`);
        } catch (error) {
            console.error('Lỗi trong quá trình đăng nhập Zalo:', error);
            
            if (sessionId) {
                updateLoginSession(sessionId, 'error', {
                    error: error.message,
                    errorAt: new Date().toISOString(),
                    user_BE_Id: userId || null
                });
            }
            
            reject(error);
        }
    });
}

// Hàm cập nhật trạng thái credential
export function updateCredentialStatus(ownId, status, additionalInfo = {}) {
    const credFilePath = `./data/cookies/cred_${ownId}.json`;
    
    if (!fs.existsSync(credFilePath)) {
        console.error(`File credential không tồn tại: ${credFilePath}`);
        return false;
    }
    
    try {
        const existingContent = fs.readFileSync(credFilePath, 'utf8');
        const credData = JSON.parse(existingContent);
        
        // Cập nhật trạng thái
        credData.loginStatus = {
            ...credData.loginStatus,
            isLoggedIn: status === 'online',
            lastStatusUpdate: new Date().toISOString(),
            status: status, // 'online', 'offline', 'error', 'expired'
            ...additionalInfo
        };
        credData.updatedAt = new Date().toISOString();
        
        // Ghi lại file
        fs.writeFileSync(credFilePath, JSON.stringify(credData, null, 4));
        console.log(`Đã cập nhật trạng thái credential cho ${ownId}: ${status}`);
        return true;
    } catch (error) {
        console.error(`Lỗi khi cập nhật credential status cho ${ownId}:`, error);
        return false;
    }
}

// Hàm đọc thông tin credential
export function getCredentialInfo(ownId) {
    const credFilePath = `./data/cookies/cred_${ownId}.json`;
    
    if (!fs.existsSync(credFilePath)) {
        return null;
    }
    
    try {
        const content = fs.readFileSync(credFilePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`Lỗi khi đọc credential info cho ${ownId}:`, error);
        return null;
    }
}

// API để lấy thông tin credential
export async function getCredentialInfoAPI(req, res) {
    try {
        const { ownId } = req.params;
        
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }
        
        const credInfo = getCredentialInfo(ownId);
        
        if (!credInfo) {
            return res.status(404).json({ error: 'Không tìm thấy thông tin credential' });
        }
        
        // Loại bỏ thông tin nhạy cảm trước khi trả về
        const safeCredInfo = {
            userId: credInfo.userId,
            profile: credInfo.profile,
            loginStatus: credInfo.loginStatus,
            proxy: credInfo.proxy,
            createdAt: credInfo.createdAt,
            updatedAt: credInfo.updatedAt,
            // Không trả về imei, cookie, userAgent
        };
        
        res.json({
            success: true,
            data: safeCredInfo
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

// API để cập nhật trạng thái credential
export async function updateCredentialStatusAPI(req, res) {
    try {
        const { ownId } = req.params;
        const { status, additionalInfo } = req.body;
        
        if (!ownId || !status) {
            return res.status(400).json({ error: 'ownId và status là bắt buộc' });
        }
        
        const validStatuses = ['online', 'offline', 'error', 'expired'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                error: `Status không hợp lệ. Cho phép: ${validStatuses.join(', ')}` 
            });
        }
        
        const success = updateCredentialStatus(ownId, status, additionalInfo);
        
        if (success) {
            res.json({
                success: true,
                message: `Đã cập nhật trạng thái credential thành ${status}`
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Không thể cập nhật trạng thái credential'
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function logoutAccount(req, res) {
    try {
        const { ownId } = req.body;
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }

        const accountIndex = zaloAccounts.findIndex(acc => acc.ownId === ownId);
        if (accountIndex === -1) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        // Xóa tài khoản khỏi danh sách zaloAccounts
        zaloAccounts.splice(accountIndex, 1);

        // Xóa file credential nếu có
        const credFilePath = `./data/cookies/cred_${ownId}.json`;
        if (fs.existsSync(credFilePath)) {
            fs.unlinkSync(credFilePath);
            console.log(`Đã xóa file credential cho tài khoản ${ownId}`);
        }

        res.json({ success: true, message: 'Đăng xuất thành công' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function checkSessionAccount(req, res) {
    try {
        const { ownId, userId } = req.body;
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        console.log(account)
        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const result = await account.api.getUserInfo(userId);
        console.log(`Trạng thái tài khoản ${ownId}:`, result);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error('Lỗi trong quá trình kiểm tra trạng thái tài khoản:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}