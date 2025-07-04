// helpers.js
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getWebhookUrl as getConfigWebhookUrl } from '../services/webhookService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getWebhookUrl(key, ownId) {
    return getConfigWebhookUrl(key, ownId);
}

export async function triggerN8nWebhook(msg, webhookUrl) {
    if (!webhookUrl) {
        console.warn("Webhook URL is empty, skipping webhook trigger");
        return false;
    }

    console.log(webhookUrl);
    
    try {
        await axios.post(webhookUrl, msg, { headers: { 'Content-Type': 'application/json' } });
        console.log(`Webhook triggered successfully for ${webhookUrl}`);
        return true;
    } catch (error) {
        console.error("Error sending webhook request:", error.message);
        return false;
    }
}

export async function saveImage(url) {
    try {
        console.log(path.extname(url));
        const imgPath = './' + randomString(10) + path.extname(url);
        console.log(`Saving image to ${imgPath}`);

        const { data } = await axios.get(url, { responseType: "arraybuffer" });
        fs.writeFileSync(imgPath, Buffer.from(data, "utf-8"));

        return imgPath;
    } catch (error) {
        console.error(error);
        return null;
    }
}

export function removeImage(imgPath) {
    try {
        fs.unlinkSync(imgPath);
    } catch (error) {
        console.error(error);
    }
}

function randomString(length) {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}