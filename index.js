const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadContentFromMessage } = require('@whiskeysockets/baileys')
const pino = require('pino')
const fs = require('fs')
const { exec } = require('child_process')
const util = require('util')
const execAsync = util.promisify(exec)

const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000
app.get('/', (req, res) => res.send('Bot Render Online 🔥'))
app.listen(PORT, () => console.log('Server jalan'))

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true,
    browser: ['Render', 'Chrome', '20.0.04']
  })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if(qr) console.log('SCAN QR DI LOGS RENDER')
    if(connection === 'close') {
      let code = lastDisconnect?.error?.output?.statusCode
      if(code!== DisconnectReason.loggedOut) start()
    } else if(connection === 'open') console.log('BOT CONNECTED 🔥')
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if(!m.message) return
    const body = m.message.conversation || m.message.extendedTextMessage?.text || ''
    if(!body.startsWith('.')) return
    const cmd = body.slice(1).trim().split(' ')[0].toLowerCase()
    const chat = m.key.remoteJid

    if(cmd === 'ping') return sock.sendMessage(chat, { text: 'Pong! Render 24 Jam 🔥' }, { quoted: m })

    if(cmd === 's') {
      try {
        const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage
        if(!quoted?.imageMessage) return sock.sendMessage(chat, { text: 'Reply gambar pake.s' }, { quoted: m })

        await sock.sendMessage(chat, { text: '⏳ Bikin stiker...' }, { quoted: m })
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image')
        let buffer = Buffer.from([])
        for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk])

        const input = `/tmp/${Date.now()}.jpg`
        const output = `/tmp/${Date.now()}.webp`
        fs.writeFileSync(input, buffer)

        await execAsync(`apt-get update && apt-get install -y webp && cwebp -resize 512 512 "${input}" -o "${output}"`)

        const webp = fs.readFileSync(output)
        await sock.sendMessage(chat, { sticker: webp }, { quoted: m })

        fs.unlinkSync(input); fs.unlinkSync(output)
      } catch(e) {
        sock.sendMessage(chat, { text: 'Gagal: ' + e.message }, { quoted: m })
      }
    }
  })
}
start()
