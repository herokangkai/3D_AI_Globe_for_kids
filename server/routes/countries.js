const express = require('express');
const router = express.Router();
const Country = require('../models/country');
const countryCodeMap = require('../config/countryCodeMap');

// 获取国家信息
router.get('/:code', async (req, res) => {
    try {
        const code = req.params.code;
        console.log('Received request for country code:', code);
        
        // 如果是数字ID，转换为alpha3代码
        const alpha3Code = code;
        
        console.log('Searching for country with code:', alpha3Code);
        const country = await Country.findOne({ alpha3Code });
        
        if (!country) {
            console.log(`Country not found for code: ${alpha3Code}`);
            return res.status(404).json({ 
                error: 'Country not found',
                code: alpha3Code
            });
        }
        
        console.log(`Found country: ${country.name}`);
        res.json(country);
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: req.params.code
        });
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            code: req.params.code
        });
    }
});

// 更新国家信息
router.put('/:code', async (req, res) => {
    try {
        const code = req.params.code;
        console.log('Received update request for country code:', code);
        
        // 如果是数字ID，转换为alpha3代码
        const alpha3Code = code;
        
        console.log('Updating country with code:', alpha3Code);
        console.log('Update data:', req.body);
        
        const country = await Country.findOneAndUpdate(
            { alpha3Code },
            req.body,
            { new: true, upsert: true }
        );
        
        console.log(`Country updated: ${country.name}`);
        res.json(country);
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: req.params.code,
            body: req.body
        });
        res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            code: req.params.code
        });
    }
});

// 获取国家基本信息
router.get('/:alpha3Code/basic', async (req, res) => {
    try {
        const country = await Country.findOne({ alpha3Code: req.params.alpha3Code });
        if (!country) {
            return res.status(404).json({ message: 'Country not found' });
        }
        // 只返回基本信息
        const basicData = {
            _id: country._id,
            name: country.name,
            alpha3Code: country.alpha3Code,
            capital: country.capital,
            population: country.population,
            area: country.area
        };
        res.json(basicData);
    } catch (error) {
        console.error('Error fetching basic country data:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// 获取国家图片信息
router.get('/:alpha3Code/images', async (req, res) => {
    try {
        const country = await Country.findOne({ alpha3Code: req.params.alpha3Code });
        if (!country) {
            return res.status(404).json({ message: 'Country not found' });
        }
        // 只返回图片相关信息
        const imagesData = {
            flag: country.flag,
            currency: country.currency,
            famousAnimal: country.famousAnimal
        };
        res.json(imagesData);
    } catch (error) {
        console.error('Error fetching country images:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router; 