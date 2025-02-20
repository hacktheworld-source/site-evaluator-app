const webpack = require('webpack');

module.exports = {
  resolve: {
    fallback: {
      "stream": require.resolve("stream-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "path": require.resolve("path-browserify"),
      "os": require.resolve("os-browserify/browser"),
      "https": require.resolve("https-browserify"),
      "http": require.resolve("stream-http"),
      "querystring": require.resolve("querystring-es3"),
      "zlib": require.resolve("browserify-zlib"),
      "fs": false,
      "net": false,
      "tls": false,
      "child_process": false,
    }
  },
  module: {
    rules: [
      {
        test: /vfs_fonts.*\.js$/,
        use: ["script-loader"]
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
        process: 'process/browser',
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.NoParse(/vfs_fonts/)
  ],
  // ... other configurations
};