// api/zalo/zalo.js
import { Zalo, ThreadType } from 'zca-js';
import { getPROXIES, getAvailableProxyIndex } from '../../services/proxyService.js';
import { setupEventListeners } from '../../eventListeners.js';
import { HttpsProxyAgent } from "https-proxy-agent";
import nodefetch from "node-fetch";
import fs from 'fs';
import { saveImage, removeImage } from '../../utils/helpers.js';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const zaloAccounts = [];

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

export async function loginZaloAccount(customProxy, cred, userBEId = null) {
    let loginResolve;
    return new Promise(async (resolve, reject) => {
        console.log('Bắt đầu quá trình đăng nhập Zalo...');

        loginResolve = resolve;
        let agent;
        let proxyUsed = null;
        let useCustomProxy = false;
        let proxies = [];
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
            if (cred) {
                console.log('Đang thử đăng nhập bằng cookie...');
                try {
                    api = await zalo.login(cred);
                    console.log('Đăng nhập bằng cookie thành công');
                } catch (error) {
                    console.error("Lỗi khi đăng nhập bằng cookie:", error);
                    console.log('Chuyển sang đăng nhập bằng mã QR...');
                    // If cookie login fails, attempt QR code login
                    api = await zalo.loginQR(null, (qrData) => {
                        console.log('Đã nhận dữ liệu QR:', qrData ? 'có dữ liệu' : 'không có dữ liệu');
                        if (qrData?.data?.image) {
                            const qrCodeImage = `data:image/png;base64,${qrData.data.image}`;
                            console.log('Đã tạo mã QR, độ dài:', qrCodeImage.length);
                            resolve(qrCodeImage);
                        } else {
                            console.error('Không thể lấy mã QR từ Zalo SDK');
                            reject(new Error("Không thể lấy mã QR"));
                        }
                    });
                }
            } else {
                console.log('Đang tạo mã QR để đăng nhập...');
                api = await zalo.loginQR(null, (qrData) => {
                    console.log('Đã nhận dữ liệu QR:', qrData ? 'có dữ liệu' : 'không có dữ liệu');
                    if (qrData?.data?.image) {
                        const qrCodeImage = `data:image/png;base64,${qrData.data.image}`;
                        console.log('Đã tạo mã QR, độ dài:', qrCodeImage.length);
                        resolve(qrCodeImage);
                    } else {
                        console.error('Không thể lấy mã QR từ Zalo SDK');
                        reject(new Error("Không thể lấy mã QR"));
                    }
                });
            }

            api.listener.onConnected(() => {
                console.log("Zalo SDK đã kết nối");
                resolve(true);
            });

            console.log('Thiết lập event listeners');
            setupEventListeners(api, loginResolve, {
                userBEId: userBEId,
            });
            api.listener.start();

            // Nếu sử dụng proxy mặc định từ danh sách thì cập nhật usedCount
            if (!useCustomProxy && proxyUsed) {
                proxyUsed.usedCount++;
                proxyUsed.accounts.push(api);
                console.log(`Đã cập nhật proxy ${proxyUsed.url} với usedCount = ${proxyUsed.usedCount}`);
            }

            console.log('Đang lấy thông tin tài khoản...');
            const accountInfo = await api.fetchAccountInfo();
            console.log('Đã lấy thông tin tài khoản:', accountInfo);
            if (!accountInfo?.profile) {
                console.error('Không tìm thấy thông tin profile trong phản hồi');
                throw new Error("Không tìm thấy thông tin profile");
            }
            const { profile } = accountInfo;
            const phoneNumber = profile.phoneNumber;
            const ownId = profile.userId;
            const displayName = profile.displayName;
            const avatar = profile.avatar || null;
            console.log(`Thông tin tài khoản: ID=${ownId}, Tên=${displayName}, SĐT=${phoneNumber}`);

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
                    phoneNumber: phoneNumber,
                    avatar: avatar || null
                },
                loginStatus: {
                    isLoggedIn: true,
                    lastLoginTime: new Date().toISOString(),
                    loginMethod: cred ? 'cookie' : 'qr_code'
                },
                proxy: useCustomProxy ? customProxy : (proxyUsed?.url || null),
                user_BE: userBEId || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            const cookiesDir = './data/cookies';
            if (!fs.existsSync(cookiesDir)) {
                fs.mkdirSync(cookiesDir, { recursive: true });
                console.log('Đã tạo thư mục cookies');
            }
            const credFilePath = `${cookiesDir}/cred_${ownId}.json`;

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

            const finalData = {
                ...data,
                createdAt: existingData.createdAt || data.createdAt,
                updatedAt: data.updatedAt
            };
            
            fs.writeFile(credFilePath, JSON.stringify(finalData, null, 4), (err) => {
                if (err) {
                    console.error('Lỗi khi ghi file cookie:', err);
                } else {
                    console.log(`Đã cập nhật credential vào file cred_${ownId}.json`);

                }
            });

            console.log(`Đã đăng nhập vào tài khoản ${ownId} (${displayName}) với số điện thoại ${phoneNumber} qua proxy ${useCustomProxy ? customProxy : (proxyUsed?.url || 'không có proxy')}`);
        } catch (error) {
            console.error('Lỗi trong quá trình đăng nhập Zalo:', error);
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
            data: credInfo
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
        const { ownId } = req.body;
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        console.log(account)
        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }
        const userId = ownId;

        const result = await account.api.getUserInfo(userId);
        console.log(`Trạng thái tài khoản ${ownId}:`, result);
        res.json({ success: true, data: result });

    } catch (error) {
        console.error('Lỗi trong quá trình kiểm tra trạng thái tài khoản:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getAllFriends(req, res) {
    try {
        const { ownId } = req.body;
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }
        console.log('Lấy danh sách bạn bè cho tài khoản Zalo với OwnId:', ownId);
        console.log('Danh sách tài khoản Zalo hiện có:', zaloAccounts);

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const friends = await account.api.getAllFriends();
        res.json({ success: true, data: friends });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
    
}

export async function getAllGroups(req, res) {
    try {
        const { ownId } = req.body;
        if (!ownId) {
            return res.status(400).json({ error: 'ownId là bắt buộc' });
        }
        console.log('Lấy danh sách nhóm cho tài khoản Zalo với OwnId:', ownId);
        console.log('Danh sách tài khoản Zalo hiện có:', zaloAccounts);

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(404).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        const groups = await account.api.getAllGroups();
        res.json({ success: true, data: groups });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
}

export async function getStickerDetails(req, res) {
    try {
        const { ownId, stickerIds } = req.body;
        if (!ownId || !stickerIds) {
            throw new Error('ownId và stickerIds là bắt buộc');
        }

        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            throw new Error('Không tìm thấy tài khoản Zalo với OwnId này');
        }

        const stickerDetails = await account.api.getStickersDetail(stickerIds.slice(0, 5));
        console.log(`Đã lấy thông tin sticker cho stickerIds: ${stickerIds} từ tài khoản ${ownId}`);
        if (!stickerDetails) {
            throw new Error('Không tìm thấy thông tin sticker');
        }
        console.log('Thông tin sticker:', stickerDetails);
        return { success: true, data: stickerDetails };
    } catch (error) {
        console.error('Lỗi trong quá trình lấy thông tin sticker:', error);
        return { success: false, error: error.message };
    }
}

export async function sendMessageToZalo(req, res) {
    const { message, threadId, type, attachments, quote, mention, ownId } = req.body;

    console.log(attachments[0]['payload']);
    try {
        const account = zaloAccounts.find(acc => acc.ownId === ownId);
        if (!account) {
            return res.status(400).json({ error: 'Không tìm thấy tài khoản Zalo với OwnId này' });
        }

        let attachmentList = [];
        if (attachments && attachments.length > 0) {
            const files = Array.isArray(attachments) ? attachments : [attachments];

            for (const file of files) {
                if (file?.type === 'file' && file?.payload?.data) {
                const savedPath = await saveBufferAsFile(file.payload, file.payload.file_name);
                if (savedPath) {
                    attachmentList.push(savedPath);
                }
                }
            }
        }

        console.log(attachmentList);

        let data = {
            msg: message,
            quote: quote || null,
            attachments: attachmentList || []
        };

        console.log('Dữ liệu gửi:', data);

        const messageRes = await account.api.sendMessage(data, threadId, type || ThreadType.User);
        if (!messageRes) {
            return res.status(500).json({ success: false, error: 'Không thể gửi tin nhắn' });
        }
        return res.json({ success: true, data: messageRes });
    } catch(error) {
        console.error('Lỗi trong quá trình gửi tin nhắn:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

export async function saveBufferAsFile(payload, originalname) {
  const ext = path.extname(originalname || 'file.bin') || '.bin';
  const filename = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`;
  const uploadDir = path.join(process.cwd(), 'uploads');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, filename);

  const buffer =
    payload.data instanceof Buffer
      ? payload.data
      : Buffer.isBuffer(payload.data)
      ? payload.data
      : Buffer.from(payload.data); // Nếu là base64 hoặc Uint8Array

  fs.writeFileSync(filePath, buffer);
  return filePath;
}
