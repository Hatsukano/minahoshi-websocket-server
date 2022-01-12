const express = require('express');
const fs = require('fs');
const util = require('util')
const dayjs = require('dayjs')
const FileStreamRotator = require('file-stream-rotator');
const logPath = __dirname + '/logs/upgrade.log'
const logger = require('morgan');
const app = express();
const logFile = fs.createWriteStream(logPath, { flags: 'a' })
const port = process.env.PORT || 5002;
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*"
  }
});


// 修改console
console.log = function() {
  if (typeof(arguments[0]) == 'string') {
    arguments[0] = `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ` + arguments[0]
  }
  logFile.write(util.format.apply(null, arguments) + '\n')
  process.stdout.write(util.format.apply(null, arguments) + '\n')
}
console.error = function() {
  if (typeof(arguments[0]) == 'string') {
    arguments[0] = `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ` + arguments[0]
  }
  logFile.write(util.format.apply(null, arguments) + '\n')
  process.stderr.write(util.format.apply(null, arguments) + '\n')
}


//日志
//设置日志文件目录
var logDirectory = __dirname + '/logs';
//确保日志文件目录存在 没有则创建
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);

//创建一个写路由
var accessLogStream = FileStreamRotator.getStream({
  filename: logDirectory + '/accss-%DATE%.log',
  frequency: 'daily',
  verbose: false
})

app.use(logger('combined', { stream: accessLogStream }));//写入日志文件
app.use(express.static(__dirname + '/public'));


let onlineList = {}
io.on('connection', socket => {
  socket.on('ping_from_client', () => {
    socket.emit('pong_from_server');
  });
  socket.on('login', (data) => {
    if (!data.project_id || !data.uid) {
      console.log(`<<失败的登录>> ${socket.id}`)
      socket.emit('loginFail!');
    } else {
      console.log('<<用户登录成功>>', `${data.project_id}_${data.uid}:${socket.id}`)
      onlineList[`${data.project_id}_${data.uid}`] = socket.id
      console.log('<<在线人数更新>>', onlineList)
    }
  });
  socket.on('sendto', (data) => {

  });
  socket.on('disconnect', () => {
    let user = findKey(onlineList,socket.id)
    console.log(`<<用户已离线>> ${user}`);

    delete onlineList[socket.id]
  });
});

http.listen(port, () => console.log(`server listening on port ${port}`));


// other functions
function findKey (obj,value, compare = (a, b) => a === b) {
  return Object.keys(obj).find(k => compare(obj[k], value))
}
