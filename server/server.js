const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8000;

// 连接 MongoDB
const mongoUrl = process.env.MONGODB_URI || `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_HOST_PORT}/${process.env.MONGODB_DB_NAME}?authSource=admin&directConnection=true`;
mongoose.connect(mongoUrl)
    .then(() => {
        console.log('Successfully connected to MongoDB');
        console.log('Connection URL:', mongoUrl.replace(/:[^:\/]+@/, ':****@')); // 隐藏密码
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        console.error('Attempted connection URL:', mongoUrl.replace(/:[^:\/]+@/, ':****@')); // 隐藏密码
    });

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 路由
const aiGenerationRoutes = require('./routes/aiGeneration');
const countriesRoutes = require('./routes/countries');

// 创建一个主路由
const apiRouter = express.Router();

// 注册子路由
apiRouter.use('/ai', aiGenerationRoutes);
apiRouter.use('/countries', countriesRoutes);

// 调试路由
apiRouter.get('/debug/routes', (req, res) => {
    const routes = [];
    
    // 获取 apiRouter 中的路由
    apiRouter.stack.forEach(middleware => {
        if (middleware.route) {
            // 直接注册在 apiRouter 上的路由
            routes.push({
                path: `/api${middleware.route.path}`,
                methods: Object.keys(middleware.route.methods)
            });
        } else if (middleware.handle && middleware.handle.stack) {
            // 子路由中的路由
            const prefix = middleware.regexp.source
                .replace('^\\/','')
                .replace('\\/?(?=\\/|$)','');
                
            middleware.handle.stack.forEach(handler => {
                if (handler.route) {
                    routes.push({
                        path: `/api/${prefix}${handler.route.path}`,
                        methods: Object.keys(handler.route.methods)
                    });
                }
            });
        }
    });
    
    res.json(routes);
});

// 注册主路由
app.use('/api', apiRouter);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });
    
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        path: req.path
    });
});

// 404 处理
app.use((req, res) => {
    console.log('404 Not Found:', {
        method: req.method,
        url: req.url,
        body: req.body,
        query: req.query
    });
    res.status(404).json({
        error: 'Not Found',
        path: req.url
    });
});

app.get('/', (req, res) => {
    res.render('index', {
        API_BASE_URL: process.env.API_BASE_URL
    });
});

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log('Available routes:');
    console.log('- /api/ai');
    console.log('- /api/countries');
    console.log('- /debug/routes');
}); 