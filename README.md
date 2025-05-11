# Replicate API 代理服务

这是一个代理服务，用于将请求转发到 Replicate API，支持多个 API 密钥轮询以避免 QPS 限制。

## 功能特点

- 支持多个 Replicate API 密钥轮询
- 自动重试失败的请求
- 支持流式和非流式 API 调用
- 兼容 OpenAI API 格式

## 环境变量配置

可以通过环境变量配置以下参数：

- `REPLICATE_API_KEYS`: 多个 Replicate API 密钥，用逗号分隔
- `AUTH_KEY`: 认证密钥，用于验证客户端请求

## 使用方法

### 本地运行

1. 克隆仓库：

```bash
git clone https://github.com/yourusername/replicate-api-proxy.git
cd replicate-api-proxy
```

2. 配置环境变量：

```bash
export REPLICATE_API_KEYS="your_api_key_1,your_api_key_2,your_api_key_3"
export AUTH_KEY="your_auth_key"
```

3. 运行服务：

```bash
deno task start
```

### Deno Deploy 部署

1. Fork 本仓库到你的 GitHub 账户

2. 在 [Deno Deploy](https://dash.deno.com/) 上创建新项目

3. 选择 "Deploy from GitHub" 并连接到你 fork 的仓库

4. 在 Deno Deploy 项目设置中添加以下环境变量：
   - `REPLICATE_API_KEYS`: 你的 Replicate API 密钥（多个用逗号分隔）
   - `AUTH_KEY`: 你的认证密钥

5. 部署完成后，你的 API 就可以通过 `https://your-project-name.deno.dev` 访问了

## API 端点

### 获取可用模型列表

```
GET /v1/models
```

**请求头**：
- `Authorization: Bearer YOUR_AUTH_KEY`

**响应示例**：
```json
{
  "object": "list",
  "data": [
    {
      "id": "anthropic/claude-3.7-sonnet",
      "object": "model",
      "created": 0,
      "owned_by": "anthropic",
      "permission": [
        {
          "id": "modelperm-anthropic/claude-3.7-sonnet",
          "object": "model_permission",
          "created": 0,
          "allow_create_engine": false,
          "allow_sampling": true,
          "allow_logprobs": false,
          "allow_search_indices": false,
          "allow_view": true,
          "allow_fine_tuning": false,
          "organization": "*",
          "group": null,
          "is_blocking": false
        }
      ],
      "root": "anthropic/claude-3.7-sonnet",
      "parent": null
    }
    // ... 其他模型
  ]
}
```

### 聊天完成

```
POST /v1/chat/completions
```

**请求头**：
- `Authorization: Bearer YOUR_AUTH_KEY`
- `Content-Type: application/json`

**请求体示例**：
```json
{
  "model": "anthropic/claude-3.7-sonnet",
  "messages": [
    {
      "role": "system",
      "content": "你是一个有用的AI助手。"
    },
    {
      "role": "user",
      "content": "你好，请介绍一下自己。"
    }
  ],
  "stream": false
}
```

**响应示例**（非流式）：
```json
{
  "id": "chatcmpl-123456789",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "anthropic/claude-3.7-sonnet",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "你好！我是Claude，一个由Anthropic开发的AI助手。我被设计用来提供有用、真实和安全的回答。我可以帮助回答问题、提供信息、讨论各种话题，并尽我所能提供有价值的帮助。有什么我可以为你做的吗？"
      },
      "finish_reason": "stop",
      "logprobs": null
    }
  ],
  "usage": {
    "prompt_tokens": 30,
    "completion_tokens": 120,
    "total_tokens": 150
  }
}
```

对于流式响应，设置 `stream: true`，响应将以服务器发送事件 (SSE) 格式返回。

## 客户端使用示例

### JavaScript 示例

```javascript
async function callAPI() {
  const response = await fetch('https://your-deployment-url.deno.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer YOUR_AUTH_KEY'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3.7-sonnet',
      messages: [
        { role: 'user', content: '你好，请介绍一下自己。' }
      ]
    })
  });
  
  const data = await response.json();
  console.log(data.choices[0].message.content);
}

callAPI();
```

### Python 示例

```python
import requests

response = requests.post(
    'https://your-deployment-url.deno.dev/v1/chat/completions',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_AUTH_KEY'
    },
    json={
        'model': 'anthropic/claude-3.7-sonnet',
        'messages': [
            {'role': 'user', 'content': '你好，请介绍一下自己。'}
        ]
    }
)

data = response.json()
print(data['choices'][0]['message']['content'])
```

## 注意事项

1. 确保将你的 Replicate API 密钥和 AUTH_KEY 保密
2. 轮询机制会自动选择下一个可用的 API 密钥，实现真正的轮询分发
3. 自动重试机制会在 API 调用失败时切换到下一个 API 密钥并重试 