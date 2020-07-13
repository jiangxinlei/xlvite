#! /usr/bin/env node

const createServer = require('../index');

createServer().listen(4000, () => {
  console.log(' server start 4000 port', 'http://localhost:4000 ');
});

// 默认采用 es6 原生模块 （import 语法在 es6 中默认会发生一个请求）