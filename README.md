# Web Remote Play

WebRTC-based Remote Play - play local multi-player games when you're not local.

# Proof-of-concept

This is just a proof-of-concept. Hopefully it gives you an idea of how this could work.

# How Does This Work?

Player 1 runs a game in a canvas in their browser. Other players join by using a shared URL. Video of the canvas is streamed to the other players. Keyboard, mouse and gamepad inputs from all the players are routed to the game running in Player 1's browser.

Latency for the remote players could be an issue.
