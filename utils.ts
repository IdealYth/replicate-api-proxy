import { SSEChunk } from "./types.ts";

/**
 * 创建 SSE 数据块
 * @param id - 事件ID
 * @param model - 模型名称
 * @param content - 内容
 * @param role - 角色
 * @param finish_reason - 完成原因
 * @param usage - 使用情况统计
 * @returns SSE数据块字符串
 */
export function createSSEChunk(
  id: string, 
  model: string, 
  content: string | null, 
  role: string | null, 
  finish_reason: string | null,
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
): string {
  const now = Math.floor(Date.now() / 1000);
  const chunk: SSEChunk = {
    id: id,
    object: "chat.completion.chunk",
    created: now,
    model: model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finish_reason,
        logprobs: null,
      }
    ],
  };

  if (role) {
    chunk.choices[0].delta.role = role;
  }
  
  if (content) {
    chunk.choices[0].delta.content = content;
  }
  
  // 如果 delta 为空且有 finish_reason，确保 delta 是空对象
  if (!role && !content && finish_reason) {
    chunk.choices[0].delta = {};
  }

  // 如果提供了usage信息，添加到chunk中
  if (usage && finish_reason === "stop") {
    (chunk as any).usage = usage;
  }

  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/**
 * 创建错误响应
 * @param message - 错误消息
 * @param status - 状态码
 * @param type - 错误类型
 * @param code - 错误代码
 * @returns Response对象
 */
export function createErrorResponse(
  message: string, 
  status: number, 
  type: string = "invalid_request_error", 
  code: string = "error"
): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type,
        param: null,
        code
      }
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    }
  );
}

/**
 * 创建授权错误响应
 * @param message - 错误消息
 * @param code - 错误代码
 * @returns Response对象
 */
export function createAuthErrorResponse(message: string, code: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: "invalid_request_error",
        param: null,
        code
      }
    }),
    {
      status: 401, // Unauthorized
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "WWW-Authenticate": 'Bearer realm="API Access"'
      }
    }
  );
}

/**
 * 记录调试信息到控制台
 * @param label - 标签
 * @param data - 数据
 */
export function logDebug(label: string, data?: any): void {
  if (data !== undefined) {
    console.log(`${label}:`, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(label);
  }
}

/**
 * 记录错误信息到控制台
 * @param label - 标签
 * @param error - 错误
 */
export function logError(label: string, error: unknown): void {
  console.error(label, error instanceof Error ? error.message : String(error));
} 