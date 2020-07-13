const fs = require('fs').promises;
const path = require('path');

const moduleReg = /^\/@modules\//;

function resolveReact(root) {
  const compilerPkgPath = path.join(root, 'node_modules');

  // 编译是在后端实现的，所以需要拿到的文件是 commonjs 规范

  const resolvePath = (name) => path.resolve(root, 'node_modules', `@pika/${name}/source.development.js`);
  const reactPath = resolvePath('react');
  const reactDOMPath = resolvePath('react-dom');

  // const runtimePath = require.resolve(
  //   'react-refresh/cjs/react-refresh-runtime.development.js'
  // );

  return {
    'react': reactPath,
    'react-dom': reactDOMPath
  }
}

function moduleResolvePlugin({ app, root }) {
  const reactResolve = resolveReact(root); // 根据当前运行 vite 的目录解析出一个文件表，包含 react 中所有的模块

  app.use(async (ctx, next) => {
    if (!moduleReg.test(ctx.path)) {  // 处理当前请求的路径，是否以 /@modules 开头的

      // 不是则交给下一个中间件去处理 moduleRewritePlugin
      return next();
    }

    // 将 /@modules 替换掉 /@modules/react
    const id = ctx.path.reaplce(moduleReg, ''); // 将 /@modules 替换成 ''，则 原文件的路径从  /@modules/react 又变成 react

    ctx.type = 'jsx';  // 设置响应类型，响应的结果 react 是 jsx 类型

    // 解析完应该去当前项目下查找 react 对应的真实的文件
    const content = await fs.readFile(reactResolve[id], 'utf8');

    ctx.body = content;

  })
}

exports.moduleResolvePlugin = moduleResolvePlugin;