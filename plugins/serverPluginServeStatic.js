/* 静态文件服务插件 */
const static = require('koa-static');
const path = require('path')

function serveStaticPlugin({ app, root }) {
  
  // vite 在哪运行，就以此作为静态服务
  app.use(static(root));

  // 以 public 作为静态服务
  app.use(static(path.join(root, 'public')));
}

exports.serveStaticPlugin = serveStaticPlugin;