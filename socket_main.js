// const mongoose = require("mongoose");
// mongoose.connect("mongodb://127.0.0.1/perfData", { useNewUrlParser: true });
// const Machine = require("./models/Machine");

const socket_main = (io, socket) => {

    socket.on('ping_from_client', () => {
        socket.emit('pong_from_server','ok');
    });
    socket.on('login', (data) => {
        if (!data.project_id || !data.uid) {
            socket.emit('loginFail!');
        } else {
            socket.emit('loginFail!',data.content);
        }
    });


};


module.exports = socket_main;