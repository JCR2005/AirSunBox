import nodemailer from 'nodemailer'
import 'dotenv/config'

const from = process.env.SMTP_FROM || `Sanik <${process.env.SMTP_USER || 'no-reply@sanik.io'}>`

export function createMailer(log) {
  const host = process.env.SMTP_HOST

  let transport
  if (host) {
    transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined
    })
  } else {
    // Modo dev: sin SMTP configurado no lanzamos error, volcamos el correo al log
    transport = {
      sendMail: async (msg) => {
        log?.info('[mailer][dev] SMTP no configurado: correo volcado a log')
        log?.info(`  Para:    ${msg.to}`)
        log?.info(`  Asunto:  ${msg.subject}`)
        log?.info(`  Enlace:  ${msg.html?.match(/href="([^"]+)"/)?.[1] || msg.text}`)
      }
    }
  }

  return {
    async sendPasswordReset(email, token) {
      const url = `${process.env.FRONTEND_URL || 'http://localhost:80'}/reset-password?token=${token}`
      const text =
        'Hola,\n\n' +
        'Recibimos una solicitud para restablecer tu contraseña de la plataforma Sanik.\n' +
        'Hacé clic en el siguiente enlace para crear una nueva (válido por 60 minutos):\n\n' +
        `${url}\n\n` +
        'Si no solicitaste este cambio, podés ignorar este correo.\n\n— Sanik'
      const html =
        `<p>Hola,</p>` +
        `<p>Recibimos una solicitud para restablecer tu contraseña de la plataforma <b>Sanik</b>.</p>` +
        `<p>Hacé clic en el siguiente botón para crear una nueva (válido por 60 minutos):</p>` +
        `<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;">Restablecer contraseña</a></p>` +
        `<p>Si el botón no funciona, copiá este enlace: <code>${url}</code></p>` +
        `<p>Si no solicitaste este cambio, podés ignorar este correo.</p>` +
        `<p>— Sanik</p>`

      await transport.sendMail({ from, to: email, subject: 'Recuperación de contraseña — Sanik', text, html })
    },

    async sendAlert(to, subject, text) {
      const html =
        `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">` +
        text.replace(/\n/g, '<br/>') +
        `</p>`
      await transport.sendMail({ from, to, subject, text, html })
    }
  }
}