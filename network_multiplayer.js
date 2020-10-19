// Network Multiplayer
//
// Strategy:
// - Use WebRTC to connect to peers
// - Use WebRTC video streaming to capture the game canvas and stream it to other players
// - One player chooses to "host" the game.
// - The host runs TIC-80 in a canvas.
// - Other players join, viewing a video stream from the host.
// - Capture inputs from all non-host players and route them to the host.
// - TIC-80 receives all inputs from all players, thinking they are all local.
// - Controller remapping?

// Server Setup:
//
// ssh your-cloud-host (I recommend Oracle Cloud VM over Amazon EC2)
// mkdir peerjs
// cd peerjs
// sudo npm install peer -g
// sudo iptables -I INPUT 5 -i ens3 -p tcp --dport 9001 -m state --state NEW,ESTABLISHED -j ACCEPT
// peerjs --port 9001 --key peerjs --path /multiplay

'use strict';

const verbose = true;
const canvas = document.querySelector('canvas');
const video = document.querySelector('video');
// const gameFrame = document.getElementById('game-frame');

const servers = { 
    "iceServers": [
        { "url": "stun:stun.1.google.com:19302" }
        // { "url": "turn:meet-jit-si-turnrelay.jitsi.net:443" },
        // { "url": "stun:meet-jit-si-turnrelay.jitsi.net:443" },
        // { "url": "turns:meet-jit-si-turnrelay.jitsi.net:443?transport=tcp" }
    ] 
};

var peerServer = {
    debug: 1, // 0=none, 1=errors, 2=warnings, 3=verbose
    host: 'peer.pixelverse.org',
    port: 9001,
    path: '/multiplay',
    key: 'multiplay'
};
console.log("Connecting to PeerJS: ", peerServer.host, peerServer.port);

var connectionID = window.location.search.substring(1);
var host_conn = null;
var client_conn = null;
var myID = null;
var me = null;
var call = null;

function sendEventToHost(event) {
    var eventType = event.type;
    switch (eventType) {
        case 'keydown':
        case 'keyup':
            host_conn.send({
                eventType: eventType,
                keyCode: event.keyCode,
                which: event.which
            });
            break;
        case 'mousedown':
        case 'mouseup':
        case 'mousemove':
            console.log(event);
            host_conn.send({
                eventType: eventType,
                button: event.button,
                x: event.x,
                y: event.y
            });
            break;
    }

}

function initialize() {
    var newID = (Math.random().toString(36) + '0000000000000000000').substr(2, 10).toUpperCase();
    me = new Peer(newID, peerServer);
    me.on('open', function(id) {
        myID = id
    });
    me.on('error', function(err) {
        console.log("ERROR:", err);
    });

    // Heroku HTTP routing timeout rule (https://devcenter.heroku.com/articles/websockets#timeouts) workaround
    // function ping() {
    //     console.log(me);
    //     me.socket.send({
    //         type: 'ping'
    //     })
    //     setTimeout(ping, 16000);
    // }
    // ping();
}

function connectAsClient(hostID) {
    console.log("CLIENT", me.id);

    canvas.remove();
    gameFrame.remove();

    me.on('open', function() {
        host_conn = me.connect(hostID, { reliable: true });
        host_conn.on('error', function(err) {
            console.log("ERROR:", err);
        })
        host_conn.on('open', function(){
            console.log("Connected to HOST", host_conn.peer);
            document.addEventListener('keydown', sendEventToHost);
            document.addEventListener('keyup', sendEventToHost);
            document.addEventListener('mousedown', sendEventToHost);
            document.addEventListener('mouseup', sendEventToHost);
            document.addEventListener('mousemove', sendEventToHost);
        });
    });
    me.on('call', function(call) {
        console.log("Got a call...");
        call.on('stream', function(remoteStream) {
            console.log("Got a stream");
            // Show stream in some video/canvas element.
            video.srcObject = remoteStream;
        });
        // Respond, but provide no stream.
        call.answer();
    });
}

function startHosting() {

    video.remove();
    const stream = canvas.captureStream();

    me.on('open', function() {
        console.log("HOST open", myID);
        window.location.hash = myID;
        // if (window.history.replaceState) {
        //     var url = new URL(window.location.href);
        //     url.search = "?"+myID;
        //     window.history.replaceState(url);
        // }
    });

    me.on('connection', function(conn) {
        console.log("Incoming connection...", conn.peer);
        if (client_conn) {
            client_conn.close();
        }

        client_conn = conn;

        client_conn.on('error', function(err) {
            console.log("ERROR:", err);
        });
        client_conn.on('close', function() {
            console.log("Client closed connection", client_conn.peer);
        });

        client_conn.on('open', function() {
            console.log("Connected:", client_conn.peer);
            // Send them our video stream
            console.log("Calling", client_conn.peer, "with stream");
            call = me.call(client_conn.peer, stream);
        });

        client_conn.on('data', function(data) {
            // console.log(data);
            var event = null;
            switch(data.eventType) {
                case 'keydown':
                case 'keyup':
                    event = new KeyboardEvent(data.eventType, {'keyCode':data.keyCode, 'which':data.which, 'bubbles':true});
                    break;
                case 'mousedown':
                case 'mouseup':
                case 'mousemove':
                    event = new MouseEvent(data.eventType, {'button':data.button, 'x':data.x, 'y':data.y, 'bubbles':true});
                    break;
                default:
                    console.log("WARNING: Unrecognized peer event:", data);
                    return;
            }
            canvas.dispatchEvent(event);
        });
    });
}

initialize();
if (connectionID) {
    connectAsClient(connectionID);
}else{
    startHosting();
}
