const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

class AIGenerationService {
    constructor() {
        // 文本模型配置
        this.textApiKey = process.env.VOLCENGINE_API_KEY;
        this.modelId = process.env.DOUPACK_MODEL_ID;
        
        // 图片生成模型配置
        this.accessKeyId = process.env.VOLCENGINE_AK;
        this.secretKey = process.env.VOLCENGINE_SK;
        this.region = 'cn-north-1';
        
        // API 端点
        this.visualEndpoint = 'https://visual.volcengineapi.com';
        this.textEndpoint = 'https://ark.cn-beijing.volces.com';
    }

    // 生成HMAC-SHA256签名
    hmacSHA256(key, message) {
        return crypto.createHmac('sha256', key).update(message).digest();
    }

    // 生成签名
    getSignature(stringToSign, secretKey, date) {
        const kDate = this.hmacSHA256(secretKey, date);
        const kRegion = this.hmacSHA256(kDate, this.region);
        const kService = this.hmacSHA256(kRegion, 'cv');
        const kSigning = this.hmacSHA256(kService, 'request');
        return this.hmacSHA256(kSigning, stringToSign).toString('hex');
    }

    // 生成图片API的认证信息
    generateVisualAuth(method, canonicalUri, queryString, headers, hashedPayload) {
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
        const date = timestamp.substr(0, 8);

        // 构建规范请求
        const canonicalHeaders = Object.keys(headers)
            .sort()
            .map(key => `${key.toLowerCase()}:${headers[key]}`)
            .join('\n') + '\n';

        const signedHeaders = Object.keys(headers)
            .sort()
            .map(key => key.toLowerCase())
            .join(';');

        const canonicalRequest = [
            method,
            canonicalUri,
            queryString,
            canonicalHeaders,
            signedHeaders,
            hashedPayload
        ].join('\n');

        // 构建待签名字符串
        const credentialScope = `${date}/${this.region}/cv/request`;
        const stringToSign = [
            'HMAC-SHA256',
            timestamp,
            credentialScope,
            crypto.createHash('sha256').update(canonicalRequest).digest('hex')
        ].join('\n');

        // 计算签名
        const signature = this.getSignature(stringToSign, this.secretKey, date);

        // 构建授权头
        return {
            authorization: [
                'HMAC-SHA256',
                `Credential=${this.accessKeyId}/${credentialScope}`,
                `SignedHeaders=${signedHeaders}`,
                `Signature=${signature}`
            ].join(', '),
            timestamp,
            signedHeaders
        };
    }

    async generateCountryInfo(countryName) {
        try {
            const prompt = `请以专业的语气，简明扼要地描述${countryName}的以下信息（每项内容不超过20字）：
1. 首都
2. 人口数量
3. 国土面积
4. 货币名称和简介
5. 代表性动物及其文化意义`;

            const response = await axios.post(`${this.textEndpoint}/api/v3/chat/completions`, {
                model: this.modelId,
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的地理和文化专家，擅长提供准确且简洁的国家信息。请确保每个回答都简明扼要，避免冗长描述。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.textApiKey}`
                }
            });

            const parsedInfo = this.parseCountryInfo(response.data.choices[0].message.content);
            
            // 限制每个字段的长度
            const truncateText = (text, maxLength = 20) => {
                return text.length > maxLength ? text.substring(0, maxLength) : text;
            };

            return {
                capital: truncateText(parsedInfo.capital),
                population: truncateText(parsedInfo.population),
                area: truncateText(parsedInfo.area),
                currency: {
                    name: truncateText(parsedInfo.currency.name),
                    description: truncateText(parsedInfo.currency.description, 30)
                },
                famousAnimal: {
                    name: truncateText(parsedInfo.famousAnimal.name),
                    description: truncateText(parsedInfo.famousAnimal.description, 30)
                }
            };
        } catch (error) {
            console.error('Error generating country info:', error.response?.data || error);
            throw new Error('Failed to generate country information');
        }
    }

    async generateImage(prompt, type) {
        try {
            console.log(`Generating ${type} image with prompt: ${prompt}`);
            
            const requestData = {
                req_key: "high_aes_general_v21_L",
                prompt: prompt,
                model_version: "general_v2.1_L",
                req_schedule_conf: "general_v20_9B_pe",
                llm_seed: -1,
                seed: -1,
                scale: 3.5,
                ddim_steps: 25,
                width: 768,
                height: 512,
                use_pre_llm: true,
                use_sr: true,
                sr_seed: -1,
                sr_strength: 0.4,
                sr_scale: 3.5,
                sr_steps: 20,
                is_only_sr: false,
                return_url: true,
                logo_info: {
                    add_logo: false,
                    position: 0,
                    language: 0,
                    opacity: 0.3,
                    logo_text_content: ""
                }
            };

            const method = 'POST';
            const canonicalUri = '/';
            const queryParams = new URLSearchParams({
                Action: 'CVProcess',
                Version: '2022-08-31'
            });

            const hashedPayload = crypto
                .createHash('sha256')
                .update(JSON.stringify(requestData))
                .digest('hex');

            const headers = {
                'Content-Type': 'application/json',
                'Host': new URL(this.visualEndpoint).host,
                'X-Content-Sha256': hashedPayload,
            };

            const { authorization, timestamp, signedHeaders } = this.generateVisualAuth(
                method,
                canonicalUri,
                queryParams.toString(),
                headers,
                hashedPayload
            );

            headers['X-Date'] = timestamp;
            headers['Authorization'] = authorization;

            console.log('Request headers:', headers);
            console.log('Request data:', JSON.stringify(requestData, null, 2));

            const response = await axios({
                method: method,
                url: `${this.visualEndpoint}/?${queryParams.toString()}`,
                headers: headers,
                data: requestData
            });

            console.log('Response:', response.data);

            if (response.data.code === 10000) {
                if (response.data.data.image_urls?.length > 0) {
                    const imageResponse = await axios.get(response.data.data.image_urls[0], {
                        responseType: 'arraybuffer'
                    });
                    const base64Data = Buffer.from(imageResponse.data).toString('base64');
                    return {
                        type,
                        base64Data
                    };
                }
            }
            
            throw new Error(`Invalid response format: ${JSON.stringify(response.data)}`);
        } catch (error) {
            console.error(`Error generating ${type} image:`, {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data,
                error: error.message
            });
            throw new Error(`Failed to generate ${type} image: ${error.message}`);
        }
    }

    // 添加延时函数
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async generateCountryImages(countryName) {
        const imagePrompts = {
            currency: `生成${countryName}的货币图片，展示最具代表性的纸币或硬币，照片风格`,
            animal: `生成${countryName}的代表性动物图片，要求真实自然的风格，照片风格`
        };

        const imageResults = {};
        let isFirst = true;
        for (const [type, prompt] of Object.entries(imagePrompts)) {
            try {
                if (!isFirst) {
                    console.log('等待2秒以符合QPS限制...');
                    await this.delay(2000); // 等待2秒
                }
                isFirst = false;

                console.log(`\nGenerating ${type} image for ${countryName}...`);
                const result = await this.generateImage(prompt, type);
                imageResults[type] = result.base64Data;
                console.log(`Successfully generated ${type} image`);
            } catch (error) {
                console.error(`Failed to generate ${type} image:`, error.message);
                imageResults[type] = null;
            }
        }

        return imageResults;
    }

    parseCountryInfo(content) {
        console.log('Raw content from API:', content);
        
        const info = {
            capital: '',
            population: '',
            area: '',
            currency: {
                name: '',
                description: ''
            },
            famousAnimal: {
                name: '',
                description: ''
            }
        };

        try {
            const lines = content.split('\n');
            lines.forEach(line => {
                console.log('Processing line:', line);
                
                if (line.includes('首都')) {
                    info.capital = line.split('：')[1]?.trim() || '';
                } else if (line.includes('人口')) {
                    info.population = line.split('：')[1]?.trim() || '';
                } else if (line.includes('面积')) {
                    info.area = line.split('：')[1]?.trim() || '';
                } else if (line.includes('货币')) {
                    const currencyInfo = line.split('：')[1]?.trim() || '';
                    const parts = currencyInfo.split('，');
                    info.currency.name = parts[0] || '';
                    info.currency.description = parts.slice(1).join('，') || '';
                } else if (line.includes('动物')) {
                    const animalInfo = line.split('：')[1]?.trim() || '';
                    if (animalInfo) {
                        const firstCommaIndex = animalInfo.indexOf('，');
                        if (firstCommaIndex !== -1) {
                            info.famousAnimal.name = animalInfo.substring(0, firstCommaIndex);
                            info.famousAnimal.description = animalInfo.substring(firstCommaIndex + 1);
                        } else {
                            info.famousAnimal.name = animalInfo;
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error parsing country info:', error);
        }

        console.log('Parsed info:', info);
        return info;
    }
}

module.exports = new AIGenerationService(); 