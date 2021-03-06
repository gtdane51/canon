const HardSourceWebpackPlugin = require("hard-source-webpack-plugin"),
      appDir = process.cwd(),
      commonLoaders = require("./config/loaders"),
      hotMiddlewareScript = "webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000&reload=true&noInfo=true",
      path = require("path"),
      progress = require("./progress"),
      webpack = require("webpack"),
      yn = require("yn");

const assetsPath = path.join(appDir, process.env.CANON_STATIC_FOLDER || "static", "assets");
const publicPath = "/assets/";
const appPath = path.join(appDir, "app");

process.traceDeprecation = true;

module.exports = {
  devtool: "eval",
  name: "client",
  mode: "development",
  context: path.join(__dirname, "../src"),
  entry: {
    app: ["./client", hotMiddlewareScript]
  },
  output: {
    path: assetsPath,
    filename: "[name].js",
    publicPath
  },
  module: {
    rules: commonLoaders({build: "client"})
  },
  resolve: {
    modules: [path.join(appDir, "node_modules"), appDir, appPath, path.join(__dirname, "../src")],
    extensions: [".js", ".jsx", ".css"]
  },
  plugins: [
    new webpack.ProgressPlugin(progress),
    new HardSourceWebpackPlugin({
      cacheDirectory: path.join(appDir, "node_modules/.cache/hard-source/[confighash]"),
      info: {level: "warn"}
    }),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.DefinePlugin(Object.keys(process.env)
      .filter(e => e.startsWith("CANON_CONST_"))
      .reduce((d, k) => {
        d[`__${k.replace("CANON_CONST_", "")}__`] = JSON.stringify(process.env[k]);
        return d;
      }, {__DEV__: true, __SERVER__: false, __LOGREDUX__: yn(process.env.CANON_LOGREDUX || true)}))
  ]
};
