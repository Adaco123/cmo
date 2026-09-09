import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escucha en la red local (0.0.0.0), no solo en localhost — necesario para que el celular acceda al escanear el QR
    https: {
      // Generados con: mkcert 192.168.101.7 localhost
      // (correr ese comando dentro de frontend/ — ver README o pedirle a Claude el detalle)
      key: fs.readFileSync('./192.168.101.7+1-key.pem'),
      cert: fs.readFileSync('./192.168.101.7+1.pem'),
    },
  },
})