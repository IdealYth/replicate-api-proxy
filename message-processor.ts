import { Message, ContentItem, ModelInput, RequestBody } from "./types.ts";
import { logDebug, logError } from "./utils.ts";

/**
 * 处理消息并提取系统提示、图片URL和格式化对话内容
 * @param requestBody - 请求体
 * @returns 处理结果，包含用户内容、系统提示和图片URL
 */
export function processMessages(requestBody: RequestBody): {
    userContent: string | undefined;
    systemPrompt: string;
    imageUrls: string[];
} {
    let userContent: string | undefined;
    const imageUrls: string[] = [];
    let systemPrompt = "";

    if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        return { userContent: undefined, systemPrompt, imageUrls };
    }

    try {
        // 创建消息数组的深拷贝，以便安全地修改
        const messagesClone = JSON.parse(JSON.stringify(requestBody.messages));

        // 提取系统消息
        systemPrompt = extractSystemPrompt(messagesClone);

        // 提取图片URL
        extractImageUrls(messagesClone, imageUrls);

        // 将消息数组转换为对话格式
        userContent = formatMessagesToConversation(messagesClone);

        logDebug("Extracted image URLs:", imageUrls.length > 0 ? `Found ${imageUrls.length} images` : "No images found");

        return { userContent, systemPrompt, imageUrls };
    } catch (e) {
        logError("Failed to process 'messages' array:", e);
        return { userContent: undefined, systemPrompt, imageUrls };
    }
}

/**
 * 从消息数组中提取系统提示
 * @param messages - 消息数组
 * @returns 提取的系统提示
 */
function extractSystemPrompt(messages: Message[]): string {
    let systemPrompt = "";

    // 找出系统消息
    const systemMessages = messages.filter(msg => msg.role === "system");

    if (systemMessages.length > 0) {
        // 处理每个系统消息
        for (const sysMsg of systemMessages) {
            if (typeof sysMsg.content === "string") {
                systemPrompt += sysMsg.content + "\n";
            } else if (Array.isArray(sysMsg.content)) {
                // 如果是数组，只提取文本部分
                for (const item of sysMsg.content) {
                    if (item.type === "text" && item.text) {
                        systemPrompt += item.text + "\n";
                    }
                }
            }
        }

        // 从消息数组中移除系统消息
        const nonSystemMessages = messages.filter(msg => msg.role !== "system");
        messages.length = 0; // 清空原数组
        messages.push(...nonSystemMessages); // 添加非系统消息

        logDebug("System prompt extracted and added to input");
    }

    return systemPrompt.trim();
}

/**
 * 从消息中提取图片URL
 * @param messages - 消息数组
 * @param imageUrls - 存储图片URL的数组
 */
function extractImageUrls(messages: Message[], imageUrls: string[]): void {
    // 遍历消息，提取图片URL
    for (const message of messages) {
        if (message.role === "user" && Array.isArray(message.content)) {
            // 创建一个新的内容数组，只包含文本内容
            const textOnlyContent: ContentItem[] = [];

            for (const contentItem of message.content as ContentItem[]) {
                // 提取图片URL
                if (contentItem.type === "image_url" && contentItem.image_url && contentItem.image_url.url) {
                    imageUrls.push(contentItem.image_url.url);
                    // 不将图片添加到文本内容中
                } else if (contentItem.type === "text") {
                    // 保留文本内容
                    textOnlyContent.push(contentItem);
                }
            }

            // 替换原始内容为只包含文本的内容
            message.content = textOnlyContent;
        }
    }
}

/**
 * 将消息数组格式化为对话格式
 * @param messages - 消息数组
 * @returns 格式化后的对话内容
 */
function formatMessagesToConversation(messages: Message[]): string {
    let formattedContent = "";

    for (const message of messages) {
        if (message.role && (message.content || Array.isArray(message.content))) {
            // 添加角色前缀
            formattedContent += `${message.role}: `;

            // 处理内容
            if (Array.isArray(message.content)) {
                // 如果是数组，提取所有文本部分
                const textParts = (message.content as ContentItem[])
                    .filter(item => item.type === "text")
                    .map(item => item.text || "")
                    .join(" ");
                formattedContent += textParts;
            } else {
                // 如果是字符串，直接使用
                formattedContent += message.content;
            }

            // 添加换行
            formattedContent += "\n";
        }
    }

    // 添加特殊指示到对话末尾，防止模型自问自答
    if (formattedContent && messages.length > 0 && messages[messages.length - 1].role === "user") {
        formattedContent += "[请直接回答上述问题，提供完整详细的回答，然后停止。不要使用‘user：xxxx’模拟用户提问。严禁生成任何形式的'user:'等角色标记，不要模拟上下文中的‘user：xxxx，assistant：xxxx这种对话格式’，只需回答用户提出的问题即可。]\n";
    }

    logDebug("Formatted user content:", formattedContent);
    return formattedContent;
}

/**
 * 构建模型API输入
 * @param userContent - 用户内容
 * @param systemPrompt - 系统提示
 * @param imageUrls - 图片URL数组
 * @returns 模型输入对象
 */
export function buildModelInput(
    userContent: string,
    systemPrompt: string,
    imageUrls: string[]
): ModelInput {
    // 增强系统提示，防止模型自问自答
    let enhancedSystemPrompt = systemPrompt || "";
    
    // 添加防止自问自答的指令
    const antiSelfDialoguePrompt = 
        "请直接回答上述问题，提供完整详细的回答，然后停止。不要使用‘user：xxxx’模拟用户提问。严禁生成任何形式的'user:'等角色标记，不要模拟上下文中的‘user：xxxx，assistant：xxxx这种对话格式’，只需回答用户提出的问题即可。";
    
    // 如果原系统提示不为空，添加换行；否则直接使用增强提示
    if (enhancedSystemPrompt) {
        enhancedSystemPrompt = `${enhancedSystemPrompt}\n\n${antiSelfDialoguePrompt}`;
    } else {
        enhancedSystemPrompt = antiSelfDialoguePrompt;
    }
    
    // 记录增强后的系统提示
    logDebug("增强后的系统提示:", enhancedSystemPrompt);
    
    const input: ModelInput = {
        prompt: userContent,
        max_tokens: 64000,
        system_prompt: enhancedSystemPrompt, // 使用增强后的系统提示
        max_image_resolution: 0.5
    };

    // 如果有图片，添加到input中
    if (imageUrls.length > 0) {
        // 如果只有一张图片，直接设置 image 字段
        if (imageUrls.length === 1) {
            input.image = imageUrls[0];
        } else {
            // 如果有多张图片，使用最后一张
            const lastImage = imageUrls[imageUrls.length - 1];
            input.image = lastImage;
            logDebug("Multiple images found, using the last one");
        }
        logDebug("Added image to input");
    }

    return input;
} 