const os = require('os');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/test', (req, res) => {
  res.json({ message: "Backend working correctly 🚀" });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/transport', require('./routes/transportRoutes'));

const PORT = process.env.PORT || 5000;

const getLocalIPs = () => {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['localhost'];
};

app.listen(PORT, '0.0.0.0', () => {
  const localIPs = getLocalIPs();
  const frontendPort = 3000; // Your frontend port from .env
  console.log(`\n=================================================`);
  console.log(`  Smart Travel Assistant - Connection Guide`);
  console.log(`=================================================`);
  console.log(`[BACKEND] Port: ${PORT}`);
  console.log(`[FRONTEND] Port: ${frontendPort}`);
  console.log(`-------------------------------------------------`);
  console.log(`Local (this PC):`);
  console.log(`  - http://localhost:${frontendPort}`);
  console.log(`-------------------------------------------------`);
  console.log(`Other devices (Phones/Tablets on same Wi-Fi):`);
  localIPs.forEach(ip => {
    console.log(`  - http://${ip}:${frontendPort}`);
  });
  console.log(`=================================================\n`);
});

