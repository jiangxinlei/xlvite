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