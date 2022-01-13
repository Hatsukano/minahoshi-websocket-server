//See https://github.com/elad/node-cluster-socket.io
const express = require("express");
const cluster = require("cluster");
const http = require("http");
const { Server } = require("socket.io");
// const helmet = require('helmet')
const socket_main = require("./socket_main");
const numCPUs = require("os").cpus().length;
const { setupMaster, setupWorker } = require("@socket.io/sticky");
const { createAdapter, setupPrimary } = require("@socket.io/cluster-adapter");
// const expressMain = require('./expressMain');
const port = 8181;
// Brew breaks for me more than it solves a problem, so I
// installed redis from https://redis.io/topics/quickstart
// have to actually run redis via: $ redis-server (go to location of the binary)
// check to see if it's running -- redis-cli monitor
const io_redis = require("socket.io-redis");
if (cluster.isMaster) {
	console.log(`Master ${process.pid} is running`);
	const httpServer = http.createServer();
	// setup sticky sessions
	setupMaster(httpServer, {
		loadBalancingMethod: "least-connection",
	});
	// setup connections between the workers
	setupPrimary();
	// needed for packets containing buffers (you can ignore it if you only send plaintext objects)
	// Node.js < 16.0.0
	// cluster.setupMaster({
	// 	serialization: "advanced",
	// });
	// Node.js > 16.0.0
	cluster.setupPrimary({
		serialization: "advanced",
	});
	httpServer.listen(port);
	for (let i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
	cluster.on("exit", (worker) => {
		console.log(`Worker ${worker.process.pid} died`);
		cluster.fork();
	});
} else {
	// Note we don't use a port here because the master listens on it for us.
	// let app = express();
	// app.use(express.static(__dirname + '/public'));
	// app.use(helmet());
	// Don't expose our internal server to the outside world.
	// const server = app.listen(0, "localhost");
	const httpServer = http.createServer();
	const io = new Server(httpServer,{
		cors: {
			origin: "*",
		},
	});

	console.log(`Worker ${process.pid} started`);
	// const io = socketio(server, {
	// 	cors: {
	// 		origin: "*",
	// 	},
	// });
	// Tell Socket.IO to use the redis adapter. By default, the redis
	// server is assumed to be on localhost:6379. You don't have to
	// specify them explicitly unless you want to change them.
	// redis-cli monitor
	io.adapter(io_redis({ host: "localhost", port: 6379 }));
	io.adapter(createAdapter());
	setupWorker(io);
	// Here you might use Socket.IO middleware for authorization etc.
	// on connection, send the socket over to our module with socket stuff
	io.on("connection", function (socket) {
		socket_main(io, socket);
		console.log(`connected to worker: ${cluster.worker.id}`);
	});
	// Listen to messages sent from the master. Ignore everything else.
	process.on("message", function (message, connection) {
		if (message !== "sticky-session:connection") {
			return;
		}
		// Emulate a connection event on the server by emitting the
		// event with the connection the master sent us.
		server.emit("connection", connection);
		connection.resume();
	});
}