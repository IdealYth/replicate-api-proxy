import { routeRequest } from "./controllers.ts";
import { logDebug, logError } from "./utils.ts";

/**
 * 主请求处理函数
 * 接收所有传入的HTTP请求并将其路由到相应的处理函数
 * 
 * @param req - 传入的Request对象
 * @returns Promise<Response> - 响应对象
 */
async function handler(req: Request): Promise<Response> {
    try {
        // 将请求路由到合适的处理函数
        return await routeRequest(req);
    } catch (error) {
        // 全局错误处理，确保服务不会因为未处理的异常而中断
        logError("Unhandled error in main handler:", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
        });
    }
}

// 启动Deno服务器并监听传入请求
logDebug("Starting server...");
Deno.serve(handler); 