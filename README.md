# 3D Globe for Kids (AI Version)

一个面向儿童的 3D 世界地图探索应用，集成了火山引擎 AI 大模型，提供丰富的国家信息和图片生成功能。

## ✨ 特性

- 🌏 基于 Three.js 的交互式3D地球展示
- 🤖 集成火山引擎 AI 大模型，自动生成国家信息
- 🎨 AI 图片生成功能，可生成国家特色图片
- 🗺️ 支持旋转、缩放和平移的地图控制
- 🏳️ 展示各国国旗和基本信息
- 💰 展示各国货币信息
- 📱 响应式设计，支持各种设备

## 🌍 地理政治实体覆盖

本应用包含了 284 个地理政治实体的映射：

### 标准国家和地区 (234)
- 所有联合国成员国
- 主要的自治领地
- 海外属地
- 特别行政区（如香港、澳门）
- 有争议地区
- 重要的岛屿国家和地区

### 特殊地理政治实体 (50)
- 历史国家（如前苏联、南斯拉夫）
- 地理区域（如北欧、中亚）
- 政治经济联盟（如欧盟、东盟）
- 文化区域（如阿拉伯世界、拉丁美洲）
- 跨国地理区域（如高加索地区、萨赫勒地区）

## 🛠️ 技术栈

### 前端
- Three.js - 3D渲染引擎
- D3.js - 地理数据处理
- TopoJSON - 地理数据格式

### 后端
- Express.js - Web 服务器框架
- MongoDB - 数据库
- Mongoose - MongoDB ODM

### AI 集成
- 火山引擎 AI 大模型
  - 文本生成：通过 `ep-20250107143140-b64cm` 模型
  - 图片生成：通过 `high_aes_general_v21_L` 模型

## 🔧 环境配置

### 必需的环境变量
```env
# MongoDB 配置
MONGODB_URI=your_mongodb_uri
MONGODB_DB_NAME=your_db_name
MONGO_USER=your_username
MONGO_PASS=your_password
MONGO_HOST_PORT=your_host:port

# 火山引擎 API 配置
VOLCENGINE_API_KEY=your_api_key
DOUPACK_MODEL_ID=ep-20250107143140-b64cm
VOLCENGINE_CV_ENDPOINT=https://visual.volcengineapi.com
VOLCENGINE_AK=your_access_key
VOLCENGINE_SK=your_secret_key
```

## 🚀 快速开始

1. 克隆仓库
```bash
git clone https://github.com/herokangkai/3D_AI_Globe_for_kids
```

2. 安装依赖
```bash
cd server
npm install
```

3. 配置环境变量
复制 `.env.example` 到 `.env` 并填写必要的配置信息

4. 启动服务器
```bash
npm start
```

## 📦 API 端点

### AI 生成接口
- `POST /api/ai/generate-country-info`
  - 生成国家基本信息
  - 包括：首都、人口、面积、货币、代表性动物等

- `POST /api/ai/generate-image`
  - 生成国家相关图片
  - 支持：国旗、货币、代表性动物等

### 国家信息接口
- `GET /api/countries/:code`
  - 获取特定国家的完整信息
- `GET /api/countries/:code/basic`
  - 获取国家基本信息
- `GET /api/countries/:code/images`
  - 获取国家相关图片

## 📂 项目结构
```
server/
├── routes/          # API 路由
├── models/          # 数据模型
├── services/        # 业务逻辑
├── scripts/         # 工具脚本
├── config/          # 配置文件
│   └── countryCodeMap.js  # 国家代码映射配置
└── server.js        # 主服务器文件
```

## 🤝 贡献指南

欢迎提交 issues 和 pull requests！

## 📝 许可证

MIT License

## 🙏 致谢

- [火山引擎](https://www.volcengine.com/)
- [Three.js](https://threejs.org/)
- [D3.js](https://d3js.org/)
- [MongoDB](https://www.mongodb.com/)

## 🔌 API 对接说明

### 火山引擎 AI 模型集成

#### 1. 文本生成模型
使用火山引擎豆包大模型进行国家信息生成。

```javascript
// 请求配置
const endpoint = 'https://ark.cn-beijing.volces.com';
const modelId = 'ep-20250107143140-b64cm';

// 请求示例
const response = await axios.post(`${endpoint}/api/v3/chat/completions`, {
    model: modelId,
    messages: [
        {
            role: "system",
            content: "你是一个专业的地理和文化专家，擅长提供准确且简洁的国家信息。"
        },
        {
            role: "user",
            content: `请简明扼要地描述${countryName}的以下信息：...`
        }
    ]
}, {
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${VOLCENGINE_API_KEY}`
    }
});
```

#### 2. 图片生成模型
使用火山引擎图像生成服务生成国家相关图片。

```javascript
// 请求配置
const endpoint = 'https://visual.volcengineapi.com';
const requestData = {
    req_key: "high_aes_general_v21_L",
    prompt: prompt,               // 图片生成提示词
    model_version: "general_v2.1_L",
    req_schedule_conf: "general_v20_9B_pe",
    width: 768,                  // 图片宽度
    height: 512,                 // 图片高度
    use_pre_llm: true,          // 使用 LLM 优化提示词
    use_sr: true,               // 使用超分辨率
    return_url: true            // 返回图片 URL
};

// 认证信息生成
const method = 'POST';
const canonicalUri = '/';
const queryParams = new URLSearchParams({
    Action: 'CVProcess',
    Version: '2022-08-31'
});

// 签名生成
const { authorization, timestamp } = generateVisualAuth(
    method,
    canonicalUri,
    queryParams.toString(),
    headers,
    hashedPayload
);

// 请求示例
const response = await axios({
    method: method,
    url: `${endpoint}/?${queryParams.toString()}`,
    headers: {
        'Content-Type': 'application/json',
        'Host': new URL(endpoint).host,
        'X-Content-Sha256': hashedPayload,
        'X-Date': timestamp,
        'Authorization': authorization
    },
    data: requestData
});
```

### API 响应示例

#### 1. 国家信息生成
```json
{
    "capital": "东京",
    "population": "1.26亿",
    "area": "37.8万平方公里",
    "currency": {
        "name": "日元",
        "description": "世界主要货币之一"
    },
    "famousAnimal": {
        "name": "日本猕猴",
        "description": "象征着日本的自然与文化传统"
    }
}
```

#### 2. 图片生成
```json
{
    "code": 10000,
    "data": {
        "image_urls": [
            "https://example.com/generated-image.jpg"
        ]
    }
}
```

### 注意事项

1. 火山引擎 API 访问限制
   - 文本生成：20 QPS
   - 图片生成：2 QPS
   - 建议实现请求队列和错误重试机制

2. 环境变量配置
   ```env
   # 必需的火山引擎配置
   VOLCENGINE_API_KEY=your_api_key    # 豆包大模型访问密钥
   VOLCENGINE_AK=your_access_key      # 火山引擎访问密钥
   VOLCENGINE_SK=your_secret_key      # 火山引擎密钥
   ```

3. 错误处理
   ```javascript
   try {
       const response = await generateContent();
   } catch (error) {
       if (error.response) {
           console.error('API Error:', error.response.data);
           // 处理 API 错误响应
       } else {
           console.error('Request Error:', error.message);
           // 处理网络或其他错误
       }
   }
   ```
