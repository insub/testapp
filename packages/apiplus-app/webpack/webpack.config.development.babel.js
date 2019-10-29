const webpack = require('webpack');
const baseConfig = require('./webpack.config.base.babel');
const pkg = require('../package.json');
const path = require('path');

const PORT = pkg.dev['dev-server-port'];

const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
  ...baseConfig,
  devtool: 'eval-source-map',
  mode: 'development',
  entry: [
    'react-hot-loader/patch',
    `webpack-dev-server/client?http://localhost:${PORT}`,
    'webpack/hot/only-dev-server',
    ...baseConfig.entry
  ],
  output: {
    ...baseConfig.output,
    publicPath: '/',
    globalObject: 'this' // insub
  },
  devServer: {
    host: 'localhost',
    port: PORT,
    publicPath: '/',
    proxy: {
      '/static': {
        target: 'http://localhost:3333',
        pathRewrite: {'^/static' : '/app/static'}
      }
    },
    hot: true,
    disableHostCheck: true,
  },
  plugins: [
    ...baseConfig.plugins,
    new webpack.LoaderOptionsPlugin({ debug: true }), // Legacy global loader option
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.DefinePlugin({
      __DEV__: true,
      'process.env.NODE_ENV': JSON.stringify('development'),
      'process.env.APIPLUS_ENV': JSON.stringify('development')
    }),
    // insub
    new webpack.ContextReplacementPlugin(
      /graphql-language-service-interface[\\/]dist$/,
      new RegExp(`^\\./.*\\.js$`)
    ),
    new BundleAnalyzerPlugin()
  ]
};
