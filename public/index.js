// helper
function $(id) { return document.getElementById(id); }

// chart
let smoothie;
let time;
let app;

function render() {
  if (smoothie && smoothie.stop) smoothie.stop();
  $('chart').width = document.body.clientWidth;
  smoothie = new SmoothieChart();
  smoothie.streamTo($('chart'), 1000);
  time = new TimeSeries();
  smoothie.addTimeSeries(time, {
    strokeStyle: 'rgb(255, 0, 0)',
    fillStyle: 'rgba(255, 0, 0, 0.4)',
    lineWidth: 2
  });
}

// socket
if(window.socket){
  window.socket.disconnect()
}
window.socket = io("http://localhost:5002");
let last;
console.log('send')
function send() {
  last = new Date();
  socket.emit('ping_from_client');
  $('transport').innerHTML = socket.io.engine.transport.name;
}

function getList() {
  socket.emit('getOnlineList');
}


socket.on('connect', () => {
  console.log('%c 🥘 connect: ', 'font-size:20px;background-color: #465975;color:#fff;');
  if ($('chart').getContext) {
    render();
    window.onresize = render;
  }
  send();
  getList();
  let str = {
    // 测试
    uid: 'admin' + `${new Date().getTime()}`.substring(0,3),
    project_id: '管理员'
  };
  socket.emit('login', str)
});

socket.on('disconnect', () => {
  console.log('disconnected')
  if (smoothie && smoothie.stop) smoothie.stop();
  $('transport').innerHTML = '(disconnected)';
}); 

socket.on('pong_from_server', () => {
  const latency = new Date() - last;
  $('latency').innerHTML = latency + 'ms';
  if (time) time.append(+new Date(), latency);
  setTimeout(send, 100);
});

socket.on('receiveOnlineList', (list) => {
  let arr = []
  Object.keys(list).forEach(key => {
    arr.push(
      {
        project_id: key.split("_")[0],
        user_id: key.split("_")[1],
        socket_id: list[key]
      }
    )
  })
  app.onLine = arr
  setTimeout(getList, 1000);
});

socket.on('new_msg', (e) => {
  console.log('new_msg', e)
});

// vue
window.onload = function () {
  app = new Vue({
    el: "#app",
    data() {
      return {
        onLine: []
      }
    },
    methods: {

    },
    mounted() {

    },
    created() {

    }
  })
}

