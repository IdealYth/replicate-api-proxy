import { createSSEChunk, createErrorResponse, createAuthErrorResponse, logDebug, logError } from "./utils.ts";
import { API_PATHS, AUTH_KEY, CORS_HEADERS, ERROR_CODES, MODELS, PROXY_MODEL_NAME } from "./config.ts";
import { processMessages, buildModelInput } from "./message-processor.ts";
import { defaultApiService } from "./api-service.ts";
import { RequestBody, ChatCompletion, ModelInput } from "./types.ts";
// @deno-types="../gpt-tokenizer/encoding/o200k_base.d.ts"
import { encode } from "gpt-tokenizer/encoding/o200k_base";

/**
 * 处理CORS预检请求
 * @returns CORS预检请求响应
 */
export function handleCorsPreflightRequest(): Response {
    return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
    });
}

/**
 * 处理获取模型列表请求
 * @returns 模型列表响应
 */
export function handleModelsRequest(): Response {
    return new Response(
        JSON.stringify({
            object: "list",
            data: MODELS,
        }),
        {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                ...CORS_HEADERS,
            },
        }
    );
}

/**
 * 处理路径不匹配的请求
 * @returns 404错误响应
 */
export function handleNotFoundRequest(): Response {
    return createErrorResponse(
        "Not Found or Method Not Allowed",
        404,
        "invalid_request_error",
        ERROR_CODES.INVALID_JSON
    );
}

/**
 * 验证API密钥
 * @param authHeader - Authorization头部值
 * @returns 验证结果: { isValid: boolean, providedKey?: string, response?: Response }
 */
export function validateApiKey(authHeader: string | null): {
    isValid: boolean;
    providedKey?: string;
    response?: Response;
} {
    // 检查Authorization头部是否存在且格式正确
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
        logDebug("认证失败: 缺少或格式错误的 Authorization header");
        return {
            isValid: false,
            response: createAuthErrorResponse(
                "Unauthorized: Missing or invalid Authorization header. Use 'Bearer <YOUR_API_KEY>' format.",
                ERROR_CODES.MISSING_AUTH_HEADER
            )
        };
    }

    // 提取key部分
    const providedKey = authHeader.substring(7); // "Bearer ".length is 7
    logDebug("providedKey：" + providedKey);

    // 验证提供的key
    if (providedKey !== AUTH_KEY) {
        logDebug("认证失败: 无效的 API Key 提供");
        return {
            isValid: false,
            response: createAuthErrorResponse(
                "Unauthorized: Invalid API Key provided.",
                ERROR_CODES.INVALID_AUTH_KEY
            )
        };
    }

    return { isValid: true, providedKey };
}

/**
 * 处理聊天完成请求
 * @param req - Request对象
 * @returns Response对象的Promise
 */
export async function handleChatCompletionRequest(req: Request): Promise<Response> {
    // 验证API密钥
    const authValidation = validateApiKey(req.headers.get("Authorization"));
    if (!authValidation.isValid) {
        return authValidation.response!;
    }

    try {
        // 解析请求体
        let requestBody: RequestBody;
        try {
            requestBody = await req.json() as RequestBody;
            logDebug("requestBody", requestBody);
        } catch (e) {
            logError("Failed to parse request JSON:", e);
            return createErrorResponse(
                "Invalid JSON in request body",
                400,
                "invalid_request_error",
                ERROR_CODES.INVALID_JSON
            );
        }

        // 检查是否请求流式响应
        const isStream = requestBody.stream === true;

        // 处理消息并提取必要信息
        const { userContent, systemPrompt, imageUrls } = processMessages(requestBody);

        // 检查userContent是否成功生成
        if (!userContent) {
            logDebug("Request body must contain a non-empty 'messages' array.");
            return createErrorResponse(
                "Request body must contain a non-empty 'messages' array.",
                400,
                "invalid_request_error",
                ERROR_CODES.INVALID_MESSAGES
            );
        }

        // 构建模型输入
        const input: ModelInput = buildModelInput(userContent, systemPrompt, imageUrls);

        // 为本次交互生成唯一ID
        const chatCompletionId = `chatcmpl-${crypto.randomUUID()}`;
        // 确定模型名称
        const modelName = requestBody.model || PROXY_MODEL_NAME;

        // 根据是否流式决定调用方式
        if (isStream) {
            return handleStreamResponse(chatCompletionId, modelName, input);
        } else {
            return handleNonStreamResponse(chatCompletionId, modelName, input);
        }
    } catch (error) {
        // 全局错误处理
        logError("Unhandled error in handler:", error);
        return createErrorResponse(
            "Internal Server Error",
            500,
            "internal_error",
            ERROR_CODES.INTERNAL_ERROR
        );
    }
}

/**
 * 处理流式响应
 * @param chatCompletionId - 聊天完成ID
 * @param modelName - 模型名称
 * @param input - 模型输入
 * @returns 流式响应
 */
function handleStreamResponse(
    chatCompletionId: string,
    modelName: string,
    input: ModelInput
): Response {
    logDebug("Processing stream response...");

    // 计算提示token数量
    const promptTokens = encode(input.prompt).length;
    const systemPromptTokens = input.system_prompt ? encode(input.system_prompt).length : 0;
    const totalPromptTokens = promptTokens + systemPromptTokens;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // 处理流式输出
                let isFirstEvent = true; // 标记是否是第一个事件
                let completionContent = ""; // 用于收集完整的回复内容以计算token

                for await (const event of defaultApiService.streamModelResponse(input)) {
                    // 在收到第一个事件时发送角色信息
                    if (isFirstEvent) {
                        // 块 1: 发送角色信息
                        controller.enqueue(encoder.encode(
                            createSSEChunk(chatCompletionId, modelName, null, "assistant", null)
                        ));
                        isFirstEvent = false;
                    }

                    // 只处理输出事件
                    if (event.event === "output" && typeof event.data === "string") {
                        // 收集完整内容以计算token
                        completionContent += event.data;

                        // 发送内容块
                        controller.enqueue(encoder.encode(
                            createSSEChunk(chatCompletionId, modelName, event.data, null, null)
                        ));
                        await new Promise(resolve => setTimeout(resolve, 5)); // 短暂延迟
                    } else if (event.event === "done") {
                        // 计算完成token数量
                        const completionTokens = encode(completionContent).length;
                        const totalTokens = totalPromptTokens + completionTokens;

                        // 添加token使用信息到最后一个事件
                        const usageInfo = {
                            prompt_tokens: totalPromptTokens,
                            completion_tokens: completionTokens,
                            total_tokens: totalTokens
                        };

                        // 发送结束信号
                        controller.enqueue(encoder.encode(
                            createSSEChunk(chatCompletionId, modelName, null, null, "stop", usageInfo)
                        ));

                        // 发送 [DONE] 标记
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));

                        // 只记录最终返回的完整内容
                        logDebug("Stream response completed. Final content length: " + completionContent.length);
                        logDebug("Usage info: " + JSON.stringify(usageInfo));
                    }
                }

                // 关闭流
                controller.close();
            } catch (error) {
                logError("Error during stream processing:", error);
                controller.error(error); // 通知流出错了
            }
        }
    });

    return new Response(stream, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive', // 建议 SSE 使用
            ...CORS_HEADERS
        },
    });
}

/**
 * 处理非流式响应
 * @param chatCompletionId - 聊天完成ID
 * @param modelName - 模型名称
 * @param input - 模型输入
 * @returns 非流式响应
 */
async function handleNonStreamResponse(
    chatCompletionId: string,
    modelName: string,
    input: ModelInput
): Promise<Response> {
    logDebug("Processing non-stream response.");

    try {
        // 调用非流式 API 并等待结果
        const assistantContent = await defaultApiService.getModelResponse(input);

        // 计算token使用情况
        const promptTokens = encode(input.prompt).length;
        const systemPromptTokens = input.system_prompt ? encode(input.system_prompt).length : 0;
        const completionTokens = encode(assistantContent).length;
        const totalTokens = promptTokens + systemPromptTokens + completionTokens;

        // 构建最终响应
        const finalResponse: ChatCompletion = {
            id: chatCompletionId,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
                {
                    index: 0,
                    message: {
                        role: "assistant",
                        content: assistantContent,
                    },
                    finish_reason: "stop",
                    logprobs: null,
                }
            ],
            usage: {
                prompt_tokens: promptTokens + systemPromptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens
            },
        };

        logDebug("No stream response:", finalResponse);

        return new Response(JSON.stringify(finalResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...CORS_HEADERS
            },
        });
    } catch (error) {
        logError("Error calling API:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return createErrorResponse(
            `Failed to get response from API: ${errorMessage}`,
            500,
            "api_error",
            ERROR_CODES.API_ERROR
        );
    }
}

/**
 * 路由请求到相应的处理函数
 * @param req - Request对象
 * @returns Response对象的Promise
 */
export async function routeRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);

    // CORS预检请求处理
    if (req.method === "OPTIONS") {
        return handleCorsPreflightRequest();
    }

    // 模型列表接口
    if (url.pathname === API_PATHS.MODELS && req.method === "GET") {
        return handleModelsRequest();
    }

    // 聊天完成接口
    if (url.pathname === API_PATHS.CHAT_COMPLETIONS && req.method === "POST") {
        return await handleChatCompletionRequest(req);
    }

    // 处理其他路径或方法
    return handleNotFoundRequest();
} 