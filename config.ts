// @deno-types="../replicate/index.d.ts"
import Replicate from "replicate";

// --- 配置常量 ---
/**
 * Replicate API 密钥列表
 * 从环境变量中获取，如果不存在则使用默认值
 * 支持多个密钥，用逗号分隔
 */
const DEFAULT_API_KEYS: string[] = [];
export const REPLICATE_API_KEYS = Deno.env.get("REPLICATE_API_KEYS")
    ? Deno.env.get("REPLICATE_API_KEYS")!.split(",").map(key => key.trim())
    : DEFAULT_API_KEYS;

console.log("REPLICATE_API_KEYS:", REPLICATE_API_KEYS);

/**
 * 当前使用的API密钥索引
 */
let currentKeyIndex = 0;

/**
 * 获取下一个API密钥（轮询方式）
 * @returns 下一个可用的API密钥
 */
export function getNextApiKey(): string {
    const key = REPLICATE_API_KEYS[currentKeyIndex];
    console.log("当前使用的API密钥:", key);
    currentKeyIndex = (currentKeyIndex + 1) % REPLICATE_API_KEYS.length;
    return key;
}

/**
 * 认证密钥
 * 从环境变量中获取，如果不存在则使用默认值
 */
export const AUTH_KEY = Deno.env.get("AUTH_KEY") ?? "default_api_key_value";

/**
 * 代理服务返回的模型名称
 */
export const PROXY_MODEL_NAME = "anthropic/claude-3.7-sonnet";

/**
 * 默认模型 ID
 */
export const DEFAULT_MODEL_ID = "anthropic/claude-3.7-sonnet";

/**
 * 初始化 Replicate 客户端
 * @param apiKey 可选的API密钥，如果不提供则使用轮询方式获取下一个密钥
 */
export const initReplicate = (apiKey?: string): Replicate => {
    return new Replicate({
        auth: apiKey || getNextApiKey(),
    });
};

/**
 * 全局 Replicate 客户端实例
 */
export const replicate = initReplicate();

/**
 * 获取使用下一个API密钥的Replicate客户端
 * @returns 新的Replicate客户端实例
 */
export function getNextReplicateClient(): Replicate {
    return initReplicate(getNextApiKey());
}

/**
 * API 路径配置
 */
export const API_PATHS = {
    MODELS: "/v1/models",
    CHAT_COMPLETIONS: "/v1/chat/completions"
};

/**
 * 响应头配置
 */
export const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
};

/**
 * 错误代码配置
 */
export const ERROR_CODES = {
    MISSING_AUTH_HEADER: "missing_or_invalid_header",
    INVALID_AUTH_KEY: "invalid_auth_key",
    INVALID_JSON: "invalid_json",
    INVALID_MESSAGES: "invalid_messages",
    API_ERROR: "api_error",
    INTERNAL_ERROR: "internal_error"
};

/**
 * 模型配置
 */
export const MODELS = [
    {
        id: DEFAULT_MODEL_ID,
        object: "model",
        created: 0,
        owned_by: "anthropic",
        permission: [{
            id: `modelperm-${DEFAULT_MODEL_ID}`,
            object: "model_permission",
            created: 0,
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: false,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: "*",
            group: null,
            is_blocking: false,
        }],
        root: DEFAULT_MODEL_ID,
        parent: null,
    },
    {
        id: "anthropic/claude-3.5-sonnet",
        object: "model",
        created: 0,
        owned_by: "anthropic",
        permission: [{
            id: `modelperm-anthropic/claude-3.5-sonnet`,
            object: "model_permission",
            created: 0,
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: false,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: "*",
            group: null,
            is_blocking: false,
        }],
        root: "anthropic/claude-3.5-sonnet",
        parent: null,
    },
    {
        id: "anthropic/claude-3.5-haiku",
        object: "model",
        created: 0,
        owned_by: "anthropic",
        permission: [{
            id: `modelperm-anthropic/claude-3.5-haiku`,
            object: "model_permission",
            created: 0,
            allow_create_engine: false,
            allow_sampling: true,
            allow_logprobs: false,
            allow_search_indices: false,
            allow_view: true,
            allow_fine_tuning: false,
            organization: "*",
            group: null,
            is_blocking: false,
        }],
        root: "anthropic/claude-3.5-haiku",
        parent: null,
    },
]; 