const Koa = require('koa');
const { serveStaticPlugin } = require('./plugins/serverPluginServeStatic');
const { moduleRewritePlugin } = require('./plugins/serverPluginModuleRewrite');
const { moduleResolvePlugin } = require('./plugins/serverPluginModuleResolve');

const { htmlRewritePlugin } = require('./plugins/serverPluginHtml')

function createServer() {
  const app = new Koa();   // 创建一个 koa 实例
  const root = process.cwd();

  // 用户执行 yarn xlvite 时，会创建服务

  // koa 是基于中间件运行的

  const context = {
    app,
    root,  // 当前根位置
  };

  // resolvedPlugins 是插件的集合
  const resolvedPlugins = [
    // 4、处理解析 html
    htmlRewritePlugin,

    // 2、解析 import 重写路径
    moduleRewritePlugin,

    // 3、解析以 /@modules 文件开头的内容，找到对应的内容
    moduleResolvePlugin,

    // 1、实现静态服务的功能
    serveStaticPlugin,   // 功能是读取文件，将文件的结果放到了 ctx.body

    
  ];

  resolvedPlugins.forEach(plugin => plugin(context));

  return app;   // 返回一个 app 有 listen 方法
}

module.exports = createServer;