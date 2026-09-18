import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// Certificados generados con mkcert (correr dentro de frontend/):
//   mkcert 192.168.101.250 localhost
// Están en .gitignore (*.pem), así que solo existen en la PC de desarrollo.
// Si no están (build en CI/deploy, otra máquina), Vite arranca/compila sin HTTPS
// en vez de fallar con ENOENT.
const keyPath = './192.168.101.250+1-key.pem'
const certPath = './192.168.101.250+1.pem'
const tieneCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escucha en la red local (0.0.0.0), no solo en localhost — necesario para que el celular acceda al escanear el QR
    https: tieneCerts
      ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
      : undefined,
  },
})