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

'use strict';

const verbose = true;
const canvas = document.querySelector('canvas');
const video = document.querySelector('video');
const gameframe = document.getElementById('game-frame');

const servers = { 
    "iceServers": [
        // thanks for this Google :)
        // { "url": "stun:stun.1.google.com:19302" }
    ] 
};

var peerServer = {
    debug: 1, // 0=none, 1=errors, 2=warnings, 3=verbose
    // host: 'your-peerjs-server.example.com',
    // port: 9001,
    // path: '/remoteplay',
    // key: 'remoteplay'
};
if (peerServer.host) {
    console.log("Connecting to PeerJS: ", peerServer.host, peerServer.port);
}else{
    console.log("Connecting to default PeerJS server.");
}

var connectionID = window.location.search.substring(1);
var host_conn = null;
var client_conn = null;
var myID = null;
var me = null;
var call = null;
var stream = null;
var hosting = false;

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
            // console.log(event);
            host_conn.send({
                eventType: eventType,
                button: event.button,
                x: event.x,
                y: event.y
            });
            break;
    }

}

// TODO: Do we need this somewhere?
    // Heroku HTTP routing timeout rule (https://devcenter.heroku.com/articles/websockets#timeouts) workaround
    // function ping() {
    //     console.log(me);
    //     me.socket.send({
    //         type: 'ping'
    //     })
    //     setTimeout(ping, 16000);
    // }
    // ping();

function makeUniqueID() {
    return (Math.random().toString(36) + '0000000000000000000').substr(2, 10).toUpperCase();
}

function connectAsClient(hostID) {

    var newID = makeUniqueID();

    me = new Peer(newID, peerServer);

    me.on('open', function(id) {
        if (me.id == null) {
            // PeerJS examples do this stating that it is a
            // "workaround for reconnect issue"?
            me.id = myID;
        }else{
            myID = me.id;
        }
    });

    me.on('error', function(err) {
        console.log("ERROR:", err);
    });

    me.on('open', function() {
        console.log("CLIENT", me.id);

        // canvas.style.display === "none";
        // video.style.display === "block";
        canvas.remove();
        gameframe.remove();

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
            // TODO: mousemove events don't seem to dispatch properly?
            // document.addEventListener('mousemove', sendEventToHost);
        });
        host_conn.on('data', function(data) {
            // Ignored
        })
        host_conn.on('close', function() {
            console.log("ERROR: Host connection closed.");
        })
    });

    me.on('connection', function(conn) {
        // Disallow incoming connections
        conn.on('open', function() {
            conn.send("Incoming connections not allowed.");
            setTimeout(function() { conn.close(); }, 500);
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

    me.on('disconnected', function () {
        console.log('Connection to PeerJS server lost. Reconnecting...');
        // Note: our peer connection(s) may still be fine, we just can't
        // make new connections until we are reconnected to the PeerJS server.

        // Workaround for peer.reconnect deleting previous id
        me.id = myID;
        me._lastServerId = myID;
        me.reconnect();
    });

    me.on('close', function() {
        console.log('ERROR: Connection destroyed permanently. Reload the page to try again.');
    });
}

function startHosting(hostID) {

    hosting = true;

    if (hostID === undefined || hostID == null || hostID == "") {
        hostID = makeUniqueID();
    }

    me = new Peer(hostID, peerServer);

    me.on('open', function(id) {
        if (me.id == null) {
            // PeerJS examples do this stating that it is a
            // "workaround for reconnect issue"?
            me.id = myID;
        }else{
            myID = me.id;
        }
    });

    me.on('error', function(err) {
        // This is a really important part.
        // If we failed to HOST because that ID was already taken, then
        // it means we should connect as a client instead.
        if (err.type == 'unavailable-id') {
            console.log("Peer ID",hostID,"is taken, let's try connecting to it...");
            hosting = false;
            me.destroy();
            me = null;
            connectAsClient(hostID);
        }else{
            // Failed for some other reason...
            console.log("ERROR:", err);
        }
    });

    me.on('open', function() {
        console.log("HOST open", myID);

        // canvas.style.display === "block";
        // video.style.display === "none";
        video.remove();
        stream = canvas.captureStream();

        // window.location.hash = myID;
        if (window.history.replaceState) {
            var url = new URL(window.location.href);
            url.search = "?"+myID;
            window.history.replaceState(null, "", url);
        }
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
            call.on('stream', function(stream) {
                // Ignored
            });
            call.on('close', function() {
                console.log("ERROR: Incoming video stream closed.");
            });
            call.on('error', function(err) {
                console.log("ERROR:", err);
            });
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

    me.on('call', function(call) {
        // Disallow incoming calls
        // conn.on('open', function() {
        //     conn.send("Incoming connections not allowed.");
        //     setTimeout(function() { conn.close(); }, 500);
        // });
    });

    me.on('disconnected', function () {
        if (hosting) {
            console.log('Connection to PeerJS server lost. Reconnecting...');
            // Note: our peer connection(s) may still be fine, we just can't
            // make new connections until we are reconnected to the PeerJS server.
            me.reconnect();
        }
    });

    me.on('close', function() {
        if (hosting) {
            console.log('ERROR: Connection destroyed permanently. Reload the page to try again.');
        }
    });
}

// First try hosting with the connectionID given...
startHosting(connectionID);
