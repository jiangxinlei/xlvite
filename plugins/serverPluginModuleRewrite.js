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
        id = `/@modules/${id}`;  // 在依赖包的前面加 @modules 前缀
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