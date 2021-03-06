# Web Remote Play

WebRTC-based Remote Play - play local multi-player games when you're not local.

Some games support local multiplayer via keyboard, multiple gamepads, etc. but only if all the players are gathered around one computer and one screen. This project allows you to play these games with friends who are far away, sitting at a different computer.

This code was co-developed with Morgan McGuire: https://github.com/morgan3d/misc/tree/main/jsremotegame

# Proof-of-concept

This is just a proof-of-concept. Hopefully it gives you an idea of how this could work, so it could be incorporated directly into your web games, fantasy console, canvas art project, or whatever :)

Here are key features that are missing:
- Gamepad support
- Controller remapping (e.g. assign your keyboard to player 2, 3, 4, etc.)
- Mouse move events

# Working Demo

- Choose one of the demos here: http://pixelverse.org/experiments/webremoteplay/
- Click the text to start a demo game.
- Notice that the URL changed to include an ID number.
- Copy the full URL.
- Open a new browser window (even on a different computer).
- Paste the URL.
- An audio/video stream of the game should appear in the second browser window.
- Now press keys, or click the mouse in *either* window, and you should see the same thing in both windows.
- Open more browser windows with the same URL to add more players.

# How Does This Work?

Player 1 runs a game in their browser. Other players join by using a shared URL. Video and audio from the game is streamed to the other players over the network. Keyboard, mouse and gamepad inputs from all the players are routed to the game running in Player 1's browser.

In more detail: the game itself runs in a canvas within a web page. Other players connect via PeerJS, which relies on WebRTC, a cross-platform and cross-browser networking mechanism. WebRTC support audio/video streaming for video chats (similar to Zoom, Jitsi Meet, etc.) but this project uses it to stream only the game canvas & audio, not your whole screen. Web Remote Play uses WebRTC data channels to send keystrokes, mouse and gamepad events from all the other players back to the browser where the game is actually running.

# How *Well* Does This Work?

Latency for the remote players can be an issue. You can expect *at least* 2 frames of lag at 30 fps. For fast-paced games you will notice this more, but for many games it won't matter and you'll never notice.

# Client-side Setup

Put a copy of `webremoteplay.js` in the same folder as your HTML, then add this to your HTML:
```
<script type="text/javascript" src="https://unpkg.com/peerjs@1.3.1/dist/peerjs.min.js"></script>
<script type="text/javascript" src="webremoteplay.js"></script>
```

You also need to have:
- Exactly one `<canvas>` with `class="webremoteplay_canvas"` which is used as the source of the video stream on the hosting player's browser. This element is removed when joining as a remote player.
- Exactly one `<video>` with `class="webremoteplay_video"` which is used to display the game when playing remotely. This element is removed when hosting a game.

See the included demos for reference.

# Servers?

WebRTC works peer-to-peer but it still needs 3 servers to work properly. For small projects you can usually use the default servers provided by [PeerJS](https://peerjs.com), but for your own large scale projects you'll need your own.

- **STUN**: used to discover network routes between WebRTC peers.
- **TURN**: used to route traffic between peers behind restrictive NAT routers.
- **Signalling**: used to find the specific peers you're hoping to contact.

There are some well known freely available **STUN** servers. Very little traffic goes through these so some folks generously leave these open for general use.

**TURN** servers are harder to come by, because they need to be able to route all the traffic between peers that are behind restrictive networks. If you find that some players are unable to connect with each other, you might need a TURN server, however, for most people this isn't needed at all.

If you do need to run your own **STUN** or **TURN** server, I hear that [coturn](https://github.com/coturn/coturn) is a good choice for both.

This project uses [PeerJS](https://peerjs.com) for the **Signalling** server, and the client-side logic for talking to peers. PeerJS generously provides a shared infrastructure, which this demo uses. You can read more about that below.

## Setting up your own PeerJS server

If you use PeerJS without configuring a server, it will default to a server run by the folks who make PeerJS. You might want to run your own though, in case theirs is down, or you want more control or customization. I have had good success running a PeerJS server on an "always free" Oracle Cloud VM.

Here is more information about the PeerJS server: https://github.com/peers/peerjs-server

To install and test it, run something like this:
```
% ssh your-cloud-host
% mkdir peerjs
% cd peerjs
% sudo npm install peer -g
% sudo iptables -I INPUT 5 -i ens3 -p tcp --dport 9001 -m state --state NEW,ESTABLISHED -j ACCEPT
% peerjs --port 9001 --key remoteplay --path /remoteplay
```

If you want it to stay running, even after a reboot, try this `peerjs.service` file:
```
[Unit]
Description=PeerJS Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/peerjs
ExecStart=/usr/local/bin/peerjs --port 9001 --key remoteplay --path /remoteplay
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
