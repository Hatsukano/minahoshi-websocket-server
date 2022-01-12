const express = require('express');
const fs = require('fs');
const util = require('util')
const dayjs = require('dayjs')
const FileStreamRotator = require('file-stream-rotator');
const logPath = __dirname + '/logs/upgrade.log'
const logger = require('morgan');
const app = express();
const bodyParser = require('body-parser')
const jsonParser = bodyParser.json()
const logFile = fs.createWriteStream(logPath, { flags: 'a' })
const formidable = require('express-formidable')
const port = process.env.PORT || 5002;
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: true,
    credentials: true
  }
});
const { v4: uuidv4 } = require('uuid');


// 修改console
console.log = function () {
  if (typeof (arguments[0]) == 'string') {
    arguments[0] = `[${dayjs().format('YYYY-MM-DD HH:mm:ss')}] ` + arguments[0]
  }
  logFile.write(util.format.apply(null, arguments) + '\n')
  process.stdout.write(util.format.apply(null, arguments) + '\n')
}
console.error = function () {
  if (typeof (arguments[0]) == 'string') {
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
app.use(formidable());  // 中间件

let onlineList = {}
io.on('connection', socket => {
  socket.on('ping_from_client', () => {
    socket.emit('pong_from_server');
  });
  socket.on('getOnlineList', () => {
    socket.emit('receiveOnlineList', onlineList);
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
  socket.on('disconnect', () => {
    let user = findKey(onlineList, socket.id)
    console.log(`<<用户已离线>> ${user}`);
    delete onlineList[user]
  });
  socket.on('connect_error', () => {
    let user = findKey(onlineList, socket.id)
    console.log(`<<用户已离线>> ${user}`);
    delete onlineList[user]
  });
});

// API发送信息接口
app.post("/", (req, res, next) => {
  var begin = new Date();
  let uuid = uuidv4();
  console.log("<<新的发送消息请求>>", uuid)
  let data = req.fields
  if (Object.keys(data) == 0) {
    res.json({
      "code": 2,
      "msg": `消息[${uuid}]发送结果：data解析错误`,
      "decodedData": data
    })
  }
  let user = onlineList[`${data.project_id}_${data.receive_uid}`]
  if (user) {
    io.to(onlineList[`${data.project_id}_${data.receive_uid}`]).emit("new_msg", data.content, (err) => {
      if (err) {
        var end = new Date();
        var cost = end - begin;
        res.json({
          "code": 2,
          "cost": `${cost}ms`,
          "msg": `消息[${uuid}]发送结果：发送超时`
        })
        return
      }
    })
    console.log(`消息[${uuid}]发送结果：成功`)
    var end = new Date();
    var cost = end - begin;
    res.json({
      "code": 1,
      "cost": `${cost}ms`,
      "msg": `消息[${uuid}]发送结果：成功送达用户[${[`${data.project_id}_${data.receive_uid}`]}]`
    })
  } else {
    console.log(`失败的查询用户[${[`${data.project_id}_${data.receive_uid}`]}]`)
    var end = new Date();
    var cost = end - begin;
    res.json({
      "code": 2,
      "cost": `${cost}ms`,
      "msg": `消息[${uuid}]发送结果：未查询到用户[${[`${data.project_id}_${data.receive_uid}`]}]`
    })
  }
})

app.get("/onlineList", (req, res) => {
  res.json({
    code: 1,
    data: onlineList,
    msg: "获取在线用户列表"
  })
})
http.listen(port, () => console.log(`<<Socket服务运行>> http://localhost:${port}`));


// other functions
function findKey(obj, value, compare = (a, b) => a === b) {
  return Object.keys(obj).find(k => compare(obj[k], value))
}
