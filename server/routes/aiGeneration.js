const express = require('express');
const router = express.Router();
const aiGenerationService = require('../services/aiGeneration');

// 生成国家信息
router.post('/generate-country-info', async (req, res) => {
    console.log('收到生成国家信息请求:', req.body);
    try {
        const { countryName } = req.body;
        if (!countryName) {
            console.log('缺少国家名称');
            return res.status(400).json({ error: 'Country name is required' });
        }

        console.log('开始生成国家信息...');
        // 生成文本信息
        const countryInfo = await aiGenerationService.generateCountryInfo(countryName);
        console.log('生成的国家信息:', countryInfo);
        
        // 生成图片
        console.log('开始生成图片...');
        const images = await aiGenerationService.generateCountryImages(countryName);
        console.log('生成的图片数据长度:', {
            flag: images.flag?.length || 0,
            currency: images.currency?.length || 0,
            animal: images.animal?.length || 0
        });

        // 合并结果
        const result = {
            ...countryInfo,
            images
        };

        console.log('请求处理成功');
        res.json(result);
    } catch (error) {
        console.error('生成国家信息时出错:', error);
        res.status(500).json({ error: 'Failed to generate country information', details: error.message });
    }
});

// 单独生成图片
router.post('/generate-image', async (req, res) => {
    console.log('收到生成图片请求:', req.body);
    try {
        const { prompt, type } = req.body;
        if (!prompt || !type) {
            console.log('缺少必要参数');
            return res.status(400).json({ error: 'Prompt and type are required' });
        }

        console.log('开始生成图片...');
        const result = await aiGenerationService.generateImage(prompt, type);
        console.log('生成的图片数据长度:', result.base64Data?.length || 0);

        console.log('请求处理成功');
        res.json(result);
    } catch (error) {
        console.error('生成图片时出错:', error);
        res.status(500).json({ error: 'Failed to generate image', details: error.message });
    }
});

module.exports = router; 