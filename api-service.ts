import { replicate, DEFAULT_MODEL_ID, getNextReplicateClient, REPLICATE_API_KEYS } from "./config.ts";
import { ModelInput, ReplicateEvent } from "./types.ts";
import { logDebug, logError } from "./utils.ts";

/**
 * Replicate模型ID类型，格式为 `owner/model` 或 `owner/model:version`
 */
type ReplicateModelId = `${string}/${string}` | `${string}/${string}:${string}`;

/**
 * API服务类，封装与Replicate API的交互
 */
export class ApiService {
    /**
     * 模型ID
     */
    private modelId: ReplicateModelId;

    /**
     * 最大重试次数（不超过可用API密钥数量）
     */
    private maxRetries: number;

    /**
     * 构造函数
     * @param modelId - 模型ID，默认为DEFAULT_MODEL_ID
     */
    constructor(modelId: ReplicateModelId = DEFAULT_MODEL_ID as ReplicateModelId) {
        this.modelId = modelId;
        this.maxRetries = Math.min(REPLICATE_API_KEYS.length, 3); // 最多重试3次或API密钥数量
    }

    /**
     * 获取一个新的Replicate客户端实例（每次调用都会使用下一个API密钥）
     */
    private getReplicateClient(): typeof replicate {
        return getNextReplicateClient();
    }

    /**
     * 流式调用模型API，支持自动重试和API密钥轮询
     * @param input - 模型输入
     * @returns 异步迭代器，用于流式获取响应
     */
    async *streamModelResponse(input: ModelInput): AsyncIterable<ReplicateEvent> {
        let retries = 0;
        let lastError: Error | undefined = undefined;

        // 每次调用都获取新的客户端（使用下一个API密钥）
        let replicateClient = this.getReplicateClient();

        while (retries <= this.maxRetries) {
            try {
                logDebug(`尝试流式API调用 (尝试 ${retries + 1}/${this.maxRetries + 1})，模型: ${this.modelId}`);
                logDebug("输入:", input);

                // 调用Replicate流式API
                for await (const event of replicateClient.stream(this.modelId, { input })) {
                    yield event;
                }

                // 成功完成，退出循环
                return;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                logError(`流式API调用失败 (尝试 ${retries + 1}/${this.maxRetries + 1}):`, error);

                // 如果还有重试次数，切换到下一个API密钥
                if (retries < this.maxRetries) {
                    replicateClient = this.getReplicateClient();
                    logDebug("切换到下一个API密钥并重试");
                    retries++;
                } else {
                    // 已达到最大重试次数，抛出最后一个错误
                    break;
                }
            }
        }

        // 所有重试都失败，抛出最后一个错误
        throw lastError || new Error("所有API密钥调用都失败");
    }

    /**
     * 非流式调用模型API，支持自动重试和API密钥轮询
     * @param input - 模型输入
     * @returns 模型响应
     */
    async getModelResponse(input: ModelInput): Promise<string> {
        let retries = 0;
        let lastError: Error | undefined = undefined;

        // 每次调用都获取新的客户端（使用下一个API密钥）
        let replicateClient = this.getReplicateClient();

        while (retries <= this.maxRetries) {
            try {
                logDebug(`尝试非流式API调用 (尝试 ${retries + 1}/${this.maxRetries + 1})，模型: ${this.modelId}`);
                logDebug("输入:", input);

                // 调用Replicate非流式API
                const prediction = await replicateClient.run(this.modelId, { input });
                logDebug("API响应:", prediction);

                // 处理不同类型的返回值
                if (Array.isArray(prediction)) {
                    // 如果返回的是数组，拼接所有元素
                    return prediction.join("");
                } else {
                    // 如果返回的不是数组，转换为字符串
                    return String(prediction);
                }
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                logError(`非流式API调用失败 (尝试 ${retries + 1}/${this.maxRetries + 1}):`, error);

                // 如果还有重试次数，切换到下一个API密钥
                if (retries < this.maxRetries) {
                    replicateClient = this.getReplicateClient();
                    logDebug("切换到下一个API密钥并重试");
                    retries++;
                } else {
                    // 已达到最大重试次数，退出循环
                    break;
                }
            }
        }

        // 所有重试都失败，抛出最后一个错误
        throw lastError || new Error("所有API密钥调用都失败");
    }

    /**
     * 设置模型ID
     * @param modelId - 新的模型ID
     */
    setModelId(modelId: ReplicateModelId): void {
        this.modelId = modelId;
    }

    /**
     * 获取当前模型ID
     * @returns 当前模型ID
     */
    getModelId(): ReplicateModelId {
        return this.modelId;
    }
}

/**
 * 创建默认的API服务实例
 * @returns ApiService实例
 */
export function createApiService(modelId?: ReplicateModelId): ApiService {
    return new ApiService(modelId);
}

/**
 * 导出默认API服务实例
 */
export const defaultApiService = createApiService(); 