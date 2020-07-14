# 手写 vite

## 原理

vite 是基于原生模块系统 ESMdule 实现，是非打包开发服务器，本地快速开发启动，按需编译；生产环境使用 rollup。

vite 使用 ESModule 原生模块，每次 import 一个文件，都会发送一个请求。

## 实现

### 1、创建 xlvite 命令

使用 vite 进行编译构建，需要一个命令行，所以需要在 bin 目录下创建 vite 命令：

```js
// bin 目录创建 xlvite.js
#! /usr/bin/env node

const createServer = require('../index');
```

相应的在 package.json 里将命令注入，并执行 ```npm link``` 链接到全局：

```json
"bin": {
  "xlvite": "./bin/xlvite.js"
},
```

### 2、使用 koa 作为开发服务器

vite 使用 koa 作为开发服务器，只要执行 vite 命令就会启动服务器，所以在入口处添加：

```js
const createServer = require('../index');

createServer().listen(4000, () => {
  console.log(' server start 4000 port', 'http://localhost:4000 ');
});
```

在 ```index.js``` 文件里就去导出 koa 的 listen 方法：

```js
// index.js
const Koa = require('koa');

function createServer() {
  const app = new Koa();   // 创建一个 koa 实例
  const root = process.cwd();

  // 用户执行 yarn xlvite 时，会创建服务

  // koa 是基于中间件运行的，将必要的参数传给中间件
  const context = {
    app,
    root,  // 当前根位置
  };

  // resolvedPlugins 是插件的集合，所有中间件都在这里
  const resolvedPlugins = [

  ];

  // 这里执行中间件
  resolvedPlugins.forEach(plugin => plugin(context));

  return app;   // 返回一个 app 有 listen 方法
}

module.exports = createServer;
```

使用 koa，借用其洋葱模型，在开发中间件时很有用，如下：

![洋葱模型](https://cdn.nlark.com/yuque/0/2020/png/222232/1594625813580-b09c03d6-4916-49f7-8949-c3a67dc956b5.png)

```js
const Koa = require('koa');

app.use(async (ctx, next) => {
  console.log('1、这是第一个中间件');  
  
  await next();
  
  console.log('6、执行第一个中间件的 next');
});

app.use(async (ctx, next) => {
  console.log('2、这是第二个中间件');
  
  await next();
  
  console.log('5、执行第二个中间件的 next');
});

app.use(async (ctx, next) => {
  console.log('3、这是第三个中间件');
  
  await next();
  
  console.log('4、执行第三个中间件的 next');
});
```

如上，中间件的执行顺序是以 next 为界，每次中间件都会执行两次。

### 3、中间件的开发

#### 3.1、静态资源服务

创建了本地服务器之后，就需要拿到静态资源展示页面，所以创建第一个中间件：

```js
// index.js
const { serveStaticPlugin } = require('./plugins/serverPluginServeStatic');

// resolvedPlugins 是插件的集合，所有中间件都在这里
const resolvedPlugins = [
  // 1、实现静态服务的功能
  serveStaticPlugin,   // 功能是读取文件
];
```

创建 `plugins` 目录，新建 `serverPluginServeStatic` js 文件：

```js
// serverPluginServeStatic.js
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
```

#### 3.2、重写 import 路径

获取静态资源后，就需要解析 js 文件里的 import 语法，注意 vite 里对 react 是解析 jsx 文件；

添加第二个插件：

```js
// index.js
const { moduleRewritePlugin } = require('./plugins/serverPluginModuleRewrite');

// resolvedPlugins 是插件的集合，所有中间件都在这里
const resolvedPlugins = [
  // 2、解析 import 重写路径
  moduleRewritePlugin,

  // 1、实现静态服务的功能
  serveStaticPlugin,   // 功能是读取文件
];
```

流程是这样的：

- 1、判断 `serveStaticPlugin` 插件返回的流数据，并判断是不是 jsx 文件，是就去读取流数据
- 2、对流数据进行解析，这一步相当于是拦截 import 语法
  - 使用 `es-module-lexer` 解析 import，`magic-string` 用于将字符串转成对象
  - 将 `import React from 'react'` 进行重写，在 `react` 包加 `/@modules` 前缀
  - 将加前缀的包名替换原来的包名，如：`import React from '/@modules/react'`
- 3、再将替换后的 import 返回展示在浏览器中

```js
// serverPluginModuleRewrite.js
const { parse } = require('es-module-lexer');  // 解析 import 语法
const MagicString = require('magic-string');   // 因为字符串具有不变性，所有用这个转成对象

const { readBody } = require('./utils');

function rewriteImports(source) {
  let imports = parse(source)[0];  // 获取第一个值，才是 import 语句
  let magicString = new MagicString(source); // 将字符串转成对象，例如 overwrite() 方法

  // 这里相当于对 import 语法进行拦截
  if (imports.length) {
    // 说明有多个 import

    for (let i = 0; i < imports.length; i++) {
      // 例如 import React from 'react' 或者 import App from './app'， s 和 e 就是 react 开始和结束的位置
      let { s, e } = imports[i];  

      let id = source.substring(s, e); // 将上述 import 语句的 react ./app 截取出来

      // 如果开头是 react 和 react-dom，即从 node_modules 里依赖的包，就重写；开头是 \ 或者 . ，即 ./app 则不需要重写
      if (/^[^\/\.]/.test(id)) {
        id = `/@modules/${id}`;  // 在依赖包的前面加 /@modules 前缀
        magicString.overwrite(s, e, id);  // 再用 magicString 的 overwrite 方法重写到 from '' 中
      }
    }
  }

  // 将替换后的结果 magicString 对象转成字符串返回
  // 增加 /@modules 浏览器会再次发送请求，服务器要拦截带有 /@modules 前缀的请求，进行处理
  return magicString.toString();
}

function moduleRewritePlugin({ app, root }) {
  app.use(async (ctx, next) => {
    await next();

    // 在这完成逻辑，洋葱模型

    // ctx.body 返回的是文件流，获取流中的数据
    if (ctx.body && ctx.response.is('jsx')) {
      // 这里需要判断，不需要处理 html 文件，需要拿到 js 文件，如果是 react ，那需要拿到 jsx 文件，ctx.body && ctx.response.is('jsx')

      let content = await readBody(ctx.body);

      // 重写内容，将重写后的结果返回，拿到的就是静态文件中的代码
      // 重写的是 import 语法，这里拿到替换后的结果，再映射到 ctx.body 上
      const result = rewriteImports(content);

      // 将内容重写并返回，
      // 现在在浏览器的 network 里看，就可以看到 import React from '/@modules/react'; import ReactDOM from '/@modules/react-dom';
      ctx.body = result;  
    }
  })
}

exports.moduleRewritePlugin = moduleRewritePlugin;
```

`readBody` 方法在 utils 文件中：

```js
// utils.js
const Stream = require('stream');

async function readBody(stream) {
  // koa 中要求所有异步方法必须包装成 promise

  if (stream instanceof Stream) {  // 只对流文件进行处理
    return new Promise((resolve, reject) => {
      let res = '';
  
      stream.on('data', data => {
        res += data;
      });

      stream.on('end', () => {
        resolve(res);  // 将内容解析完成抛出去，moduleRewritePlugin 插件中就可以拿到 content
      })
    })
  } else {
    return stream.toString();
  }
}

exports.readBody = readBody;
```

#### 3.3、解析以 /@modules 文件开头的内容，找到对应的内容

这里需要再去解析所有带 `/@modules` 前缀的的 import，再去 `node_modeles` 找到 import 依赖的包文件，将包文件的路径映射到 import 中。

因为 import 会发送请求，所有每次 import 浏览器都会去找文件的路径，从而获取包的内容。

添加第三个插件：

```js
// index.js
const { moduleResolvePlugin } = require('./plugins/serverPluginModuleResolve');

// resolvedPlugins 是插件的集合，所有中间件都在这里
const resolvedPlugins = [
  // 3、解析以 /@modules 文件开头的内容，找到对应的内容
  moduleResolvePlugin,

  // 2、解析 import 重写路径
  moduleRewritePlugin,

  // 1、实现静态服务的功能
  serveStaticPlugin,   // 功能是读取文件
];
```

实现如下，这里实现的是解析 react 路径，有些不对，vite 对 vue 解析的是 @vue 目录下的文件，还要再看下对 react 是怎么解析的，但大致逻辑如下：

```js
const fs = require('fs').promises;
const path = require('path');

const moduleReg = /^\/@modules\//;

function resolveReact(root) {

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
```

#### 3.4、html 中注入脚本

例如环境变量，热更新，添加第四个插件：

```js
// index.js
const { htmlRewritePlugin } = require('./plugins/serverPluginHtml')

// resolvedPlugins 是插件的集合，所有中间件都在这里
const resolvedPlugins = [

  // 4、处理解析 html
  htmlRewritePlugin,

  // 3、解析以 /@modules 文件开头的内容，找到对应的内容
  moduleResolvePlugin,

  // 2、解析 import 重写路径
  moduleRewritePlugin,

  // 1、实现静态服务的功能
  serveStaticPlugin,   // 功能是读取文件
];
```

代码如下：

```js
const { readBody } = require('./utils');

function htmlRewritePlugin({ app, root }) {
  const inject = `
    <script>
      window.process = {};
      process.env = { NODE_ENV: 'development' }
    </script>
  `;
  
  // 这里可以给前端注入热更新脚本
  app.use(async (ctx, next) => {
    await next();

    if (ctx.response.is('html')) {
      const html = await readBody(ctx.body);

      ctx.body = html.replace(/<head>/, `$&${inject}`)
    }
  })
}

exports.htmlRewritePlugin = htmlRewritePlugin;
```
