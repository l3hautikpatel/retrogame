# 🎮 Retro Console

**Web-Based Cloud Gaming Platform** - Play retro video games using smartphones as wireless controllers

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- **Zero Latency**: WebRTC peer-to-peer connection (no server relay)
- **No App Required**: Runs entirely in browser
- **Universal Controller**: Any smartphone becomes a gamepad
- **Multi-Platform Support**: NES, SNES, Genesis, N64, GBA, PlayStation
- **Touch-Optimized**: Haptic feedback and responsive controls
- **Physical Gamepad Support**: Works with USB/Bluetooth controllers
- **Private Rooms**: Secure 4-digit room codes

## 🚀 Quick Start

### Local Development

1. **Clone or download this repository**

```bash
cd retro-console
```

2. **Start the development server**

```bash
python3 server.py
```

The server will start on `http://localhost:8000`

3. **Open the application**

- **Host**: Open `http://localhost:8000/host/` on your desktop/TV
- **Controller**: Open `http://localhost:8000/controllers/` on your phone

4. **Connect and play**

- Host displays a 4-digit room code and QR code
- On phone, scan QR code or enter room code manually
- Upload a ROM file or select from library
- Start playing!

## 📱 Network Testing (Same WiFi)

To test across devices on the same network:

1. **Find your local IP address**

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig | findstr IPv4
```

2. **Access from mobile device**

Replace `localhost` with your IP address:
- Host: `http://192.168.1.100:8000/host/`
- Controller: `http://192.168.1.100:8000/controllers/`

## 🎮 How to Play

### As Host (Desktop/TV)

1. Navigate to the host page
2. Note the 4-digit room code displayed
3. Click "Select Game" to choose a game or upload a ROM
4. Wait for controllers to connect
5. Press fullscreen for immersive gaming

### As Controller (Mobile)

1. Navigate to the controller page
2. Enter the room code OR scan the QR code
3. Click "Connect"
4. Use the touch gamepad to control the game
5. Only the active controller can send inputs
6. Click "Take Control" to become the active player

## 🗂️ Project Structure

```
retro-console/
├── index.html              # Landing page
├── host/
│   └── index.html          # Host interface
├── controllers/
│   └── index.html          # Controller interface
├── diagnostic.html         # Connection testing tool
├── src/
│   ├── js/
│   │   ├── utils.js        # Utility functions
│   │   ├── peer-manager.js # WebRTC connection manager
│   │   ├── emulator-bridge.js # Input translation
│   │   ├── game-manager.js # Game/emulator lifecycle
│   │   ├── controller-ui.js # Mobile UI
│   │   └── gamepad-manager.js # Physical gamepad
│   └── css/
│       ├── common.css      # Shared styles
│       ├── host.css        # Host styles
│       └── controller.css  # Controller styles
├── config/
│   ├── controller-mapping.json # Button mappings
│   └── games-library.json # Game metadata
└── assets/
    ├── roms/               # ROM files (user-provided)
    └── images/             # Cover art
```

## 🎯 Supported Systems

| System | Core | File Extensions |
|--------|------|-----------------|
| NES | `nes` | .nes |
| SNES | `snes` | .sfc, .smc |
| Genesis | `segaMD` | .bin, .md |
| N64 | `n64` | .n64, .z64 |
| GBA | `gba` | .gba |
| PlayStation | `psx` | .iso, .bin |

## 🔧 Configuration

### Controller Mapping

Edit `config/controller-mapping.json` to customize button mappings:

```json
{
  "nintendo": {
    "face_buttons": {
      "a": "x",
      "b": "z"
    },
    "dpad": {
      "up": "ArrowUp",
      "down": "ArrowDown"
    }
  }
}
```

### Game Library

Add games to `config/games-library.json`:

```json
{
  "games": [
    {
      "id": "game_001",
      "title": "Your Game",
      "system": "NES",
      "core": "nes",
      "romPath": "../assets/roms/your-game.nes",
      "mapping": "nintendo"
    }
  ]
}
```

## 🌐 Deployment

### GitHub Pages

1. Push code to GitHub repository
2. Go to Settings → Pages
3. Select branch and `/root` folder
4. Access at `https://username.github.io/retro-console`

### Netlify

1. Drag and drop project folder to Netlify
2. Or connect GitHub repository
3. Deploy automatically

### Vercel

```bash
npm install -g vercel
vercel
```

**Note**: Production deployment requires HTTPS for WebRTC to work.

## 🐛 Troubleshooting

### Connection Issues

- **"Host not found"**: Check room code is correct
- **Connection timeout**: Ensure both devices on same network or use HTTPS
- **WebRTC error**: Check browser compatibility (Chrome 56+, Firefox 44+, Safari 11+)

### Game Issues

- **Game won't load**: Verify ROM file format matches emulator core
- **No input response**: Check controller is active (green status)
- **Laggy controls**: Try reducing distance between devices or use wired connection

### Diagnostic Tool

Visit `/diagnostic.html` to test:
- Browser compatibility
- WebRTC support
- PeerJS connectivity
- System capabilities

## 📝 Legal Notice

**Important**: This application does NOT include any copyrighted ROM files. Users must provide their own legally obtained ROM files. Only use ROMs you own or that are in the public domain.

## 🛠️ Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Networking**: PeerJS (WebRTC abstraction)
- **Emulation**: EmulatorJS
- **QR Codes**: qrcode.js
- **Server**: Python HTTP Server (development)

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- [EmulatorJS](https://github.com/EmulatorJS/EmulatorJS) - Game emulation
- [PeerJS](https://peerjs.com/) - WebRTC library
- Retro gaming community for inspiration

---

**Made with ❤️ for retro gaming enthusiasts**
