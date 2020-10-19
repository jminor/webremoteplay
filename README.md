# Web Remote Play

WebRTC-based Remote Play - play local multi-player games when you're not local.

# Proof-of-concept

This is just a proof-of-concept. Hopefully it gives you an idea of how this could work.

# How Does This Work?

Player 1 runs a game in a canvas in their browser. Other players join by using a shared URL. Video of the canvas is streamed to the other players. Keyboard, mouse and gamepad inputs from all the players are routed to the game running in Player 1's browser.

Latency for the remote players could be an issue.

# Client-side Setup

Put a copy of `webremoteplay.js` in the same folder as your HTML, then add this to your HTML:
```
<script type="text/javascript" src="https://unpkg.com/peerjs@1.3.1/dist/peerjs.min.js"></script>
<script type="text/javascript" src="webremoteplay.js"></script>
```

You also need to have exactly one canvas with `id="canvas"` so that webremoteplay knows which thing to stream to the remote players.

See the included `index.html` demo for reference.

# Servers?

WebRTC works peer-to-peer but it still needs 3 servers to work properly. For small projects you can usually use someone else's servers for this, but for your own large scale projects you'll need your own.

- *STUN*: used to discover network routes between WebRTC peers.
- *TURN*: used to route traffic between peers behind restrictive NAT routers.
- *Signalling*: used to find the specific peers you're hoping to contact.

There are some well known freely available *STUN* servers. Very little traffic goes through these so some folks generously leave these open for general use.

*TURN* servers are harder to come by, because they need to be able to route all the traffic between peers that are behind restrictive networks. If you find that some peers are unable to connect with each other, you might need a TURN server, however, for many peers this isn't needed at all.

If you do need to run your own *STUN* or *TURN* server, I hear that [coturn](https://github.com/coturn/coturn) is a good choice for both.

This project uses [PeerJS](https://peerjs.com) for the *Signalling* server, and the client-side logic for talking to peers.

## Setting up your own PeerJS server

If you use PeerJS without configuring a server, it will default to run by the folks who make PeerJS. You might want to run your own though, in case theirs is down, or you want more control or customization. I have had good success running a PeerJS server on an "always free" Oracle Cloud VM.

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
