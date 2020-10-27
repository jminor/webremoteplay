// Web Remote Play
//
// Copyright 2020, Joshua Minor
// SPDX-License-Identifier: MIT

'use strict';

function startRemotePlay() {

    const verbose = true;
    const video = document.querySelector('.webremoteplay_video');
    const iframe = document.querySelector('.webremoteplay_iframe');
    var canvas = document.querySelector('.webremoteplay_canvas');
    if (!canvas && iframe) {
        canvas = iframe.contentWindow.document.getElementsByTagName("canvas")[0];
    }

    const servers = {
        "iceServers": [
            // Note: PeerJS provides some default STUN and/or TURN servers
            // (Collectively ICE servers) so you probably don't need to
            // put anything here.
            // However, if that stops working someday, you can try this one from Google:
            // { "url": "stun:stun.1.google.com:19302" }
            // or you can run your own (see for example https://github.com/coturn/coturn )
        ]
    };

    var peerServer = {
        debug: 1, // 0=none, 1=errors, 2=warnings, 3=verbose
        // Note: PeerJS provides a default signaling server, so you probably
        // don't need to put anything here. However, if that stops working, or
        // you want to run your own, then see https://github.com/peers/peerjs-server
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
    var myID = null;
    var me = null;
    var call = null;
    var stream = null;
    var hosting = false;

    function sendEventToHost(event) {
        var eventType = event.type;
        switch (eventType) {
            case 'keydown':
            case 'keypress':
            case 'keyup':
                host_conn.send({
                    eventType: eventType,
                    key: event.key,
                    code: event.code,
                    location: event.location,
                    ctrlKey: event.ctrlKey,
                    shiftKey: event.shiftKey,
                    altKey: event.altKey,
                    metaKey: event.metaKey,
                    repeat: event.repeat,
                    isComposing: event.isComposing,
                    charCode: event.charCode,
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
        // Note: If you're using the default shared PeerJS signaling server,
        // then these IDs could possibly conflict with some other project that
        // also uses PeerJS, but if you're using your own PeerJS server, then
        // you will only conflict with your own users, and could use a shorter ID.
        const length = 6;
        return (Math.floor(Math.random()*(36**length))).toString(36).toUpperCase();
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
            console.log("ERROR:", err.type, err);
        });

        me.on('open', function() {
            console.log("CLIENT", me.id);

            // canvas.style.display === "none";
            // video.style.display === "block";
            canvas.remove();

            host_conn = me.connect(hostID, { reliable: true });
            host_conn.on('error', function(err) {
                console.log("ERROR:", err);
            })
            host_conn.on('open', function(){
                console.log("Connected to HOST", host_conn.peer);
                document.addEventListener('keydown', sendEventToHost);
                document.addEventListener('keypress', sendEventToHost);
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
                console.log("Got a stream with tracks:", remoteStream.getTracks());
                video.onclick = function() {
                    // optional, only useful for debugging audio issues
                    const viz_canvas = document.querySelector(".webremoteplay_audioviz");
                    if (viz_canvas) {
                        const viz = new StreamVisualizer(remoteStream, viz_canvas);
                        viz.start();
                    }

                    // Show stream in some video/canvas element.
                    video.srcObject = new MediaStream(remoteStream);

                    video.onloadedmetadata = function() {
                        video.volume = 1;
                        video.muted = false;
                        video.play();
                    };

                    var els = document.getElementsByClassName("webremoteplay_hostonly");
                    Array.prototype.forEach.call(els, function(el) {
                        el.remove();
                    });

                    video.onclick = null;
                };
                // video.muted = false; // Not working? I don't hear anything :(
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
            // ********************************
            // This is a really important part.
            //
            // If we failed to HOST because that ID was already taken, then
            // it means we should connect as a client instead.
            // This fallback is what allows both the host and the client to
            // use the same URL. Everyone using that URL first attempts to
            // host, but only the 1st browser will succeed. The rest will fall
            // back to being clients.
            // ********************************
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

            // window.location.hash = myID;
            if (window.history.replaceState) {
                var url = new URL(window.location.href);
                url.search = "?"+myID;
                window.history.replaceState(null, "", url);
            }
        });

        me.on('connection', function(conn) {
            console.log("Incoming connection...", conn.peer);

            // Note that we don't need to hold onto the connection here.
            // All we're going to do is call them back with the video
            // stream (see `me.call` below). We don't need to send them
            // any messages or anything.

            conn.on('error', function(err) {
                console.log("ERROR:", err);
            });

            conn.on('close', function() {
                console.log("Client closed connection", conn.peer);
            });

            conn.on('open', function() {
                console.log("Connected:", conn.peer);

                // Wait until the actually need the stream
                // so that we are more likely to have the game running
                // including sound. If we do this too early then SDL
                // or SDL2 hasn't set up its audio stuff yet.
                if (stream == null) {
                    const videoStream = canvas.captureStream();
                    if (window.pico8_audio_context) {
                        console.log("Trying to get PICO-8 audio stream...");
                        const audioStreamDestination = pico8_audio_context.createMediaStreamDestination();
                        pico8_audio_context.final_audio_node.connect(audioStreamDestination);
                        stream = new MediaStream(videoStream.getTracks().concat(audioStreamDestination.stream.getTracks()));
                    }else if (window.SDL) {
                        console.log("Trying to get SDL audio stream...");
                        SDL.openAudioContext();
                        const audioStreamDestination = SDL.audioContext.createMediaStreamDestination();
                        SDL.destination = audioStreamDestination;
                        // TODO: Connect an audio node to audioStreamDestination?
                        stream = new MediaStream(videoStream.getTracks().concat(audioStreamDestination.stream.getTracks()));
                    }else if (Module && Module.SDL2) {
                        console.log("Trying to get SDL2 audio stream...");
                        const audioStreamDestination = Module.SDL2.audioContext.createMediaStreamDestination();
                        Module.SDL2.audio.scriptProcessorNode.connect(audioStreamDestination);
                        stream = new MediaStream(videoStream.getTracks().concat(audioStreamDestination.stream.getTracks()));
                    }else{
                        console.log("Only found video stream.");
                        stream = videoStream;
                    }

                    // optional, only useful for debugging audio issues
                    const viz_canvas = document.querySelector(".webremoteplay_audioviz");
                    if (viz_canvas) {
                        const viz = new StreamVisualizer(stream, viz_canvas);
                        viz.start();
                    }
                }

                // Send them our video stream
                console.log("Calling", conn.peer, "with stream");
                call = me.call(conn.peer, stream);
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

            conn.on('data', function(data) {
                // console.log(data);
                var event = null;
                switch(data.eventType) {
                    case 'keydown':
                    case 'keypress':
                    case 'keyup':
                        event = new KeyboardEvent(data.eventType, {
                            key: data.key,
                            code: data.code,
                            location: data.location,
                            ctrlKey: data.ctrlKey,
                            shiftKey: data.shiftKey,
                            altKey: data.altKey,
                            metaKey: data.metaKey,
                            repeat: data.repeat,
                            isComposing: data.isComposing,
                            charCode: data.charCode,
                            keyCode: data.keyCode,
                            which: data.which,
                            bubbles: true
                        });
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
}

startRemotePlay();

