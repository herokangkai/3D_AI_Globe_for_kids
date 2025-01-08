const webpack = require('webpack');
const dotenv = require('dotenv');

module.exports = {
  // ...其他配置
  plugins: [
    new webpack.DefinePlugin({
      'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL)
    })
  ]
}; 