const path = require('path');
const webpack = require('webpack');

module.exports = {
  entry: {
    root: ['babel-polyfill']
  },
  output: {
    path: path.join(__dirname, '_gh-pages'),
    filename: '[name].[chunkhash].js'
  },
  resolve: {
    extensions: ['.js'],
    alias: {
      'apier-react-tabtab/lib': path.resolve(__dirname, 'src/')
    }
  },
  externals: {
    react: 'React',
    'react-dom': 'ReactDOM'
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        NODE_ENV: JSON.stringify('production')
      }
    }),
    new webpack.optimize.CommonsChunkPlugin({
      name: 'common',
      filename: 'common.js',
      minChunk: 2
    }),
    new webpack.optimize.UglifyJsPlugin()
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/
      }
    ]
  }
};
