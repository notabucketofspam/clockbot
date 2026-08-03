import {Duplex } from 'node:stream';
import http from 'node:http';
import {WebSocketServer, type ServerOptions, WebSocket as WsWebSocket, RawData} from 'ws';

let wss: WebSocketServer;

export function initWSS (server : ServerOptions["server"]) {
	wss = new WebSocketServer({
		server,
		host: 'localhost',
		clientTracking: true,
		autoPong: true,
		path: '/msnbc'
	});
	wss.on('wsClientError', wss_onwsClientError);
	wss.on('connection', wss_onconnection);
}

function wss_onwsClientError (err : Error, socket: Duplex, request: http.IncomingMessage){
	console.error(err, socket, request);
}

function wss_onconnection (wsConn: WsWebSocket, req: http.IncomingMessage) {
	wsConn.on('message', ws_onmessage);
	wsConn.once('close', ws_onceclose);
}

import {parseUrlQuery} from './app.js';
async function ws_onmessage (this: WsWebSocket, message: RawData, isBinary: boolean){
	const wsConn = this;
  try {
		if (isBinary) {
			// probs just ping-ponging
		} else {
			parseUrlQuery(message.toString());
		}
  } catch(err) {
		console.error(err);
  }
}

function ws_onceclose (this: WsWebSocket, code: number, reason: Buffer) {
	const wsConn = this;
	wsConn.off('message', ws_onmessage);
}

