# Webhook Setup Guide

This guide explains how to expose your local backend to the internet so Twilio (WhatsApp) and other webhook-based services can reach it.

---

## Why You Need ngrok

Your bot runs locally on `localhost:3000`. Services like **Twilio WhatsApp** need a public HTTPS URL to send incoming message webhooks. **ngrok** creates a secure tunnel from a public URL to your local machine.

```
Twilio WhatsApp → ngrok public URL → your laptop localhost:3000
```

---

## Install ngrok

### Option A — Global install
```bash
npm install -g ngrok
```

### Option B — Run without installing
```bash
npx ngrok http 3000
```

Both work. `npx` is fastest for one-off testing.

---

## Start ngrok

1. Make sure your backend is running:
   ```bash
   pnpm dev
   ```

2. In a **new terminal**, run:
   ```bash
   npx ngrok http 3000
   ```

3. You will see output like:
   ```
   Forwarding: https://abc123-def.ngrok-free.app -> http://localhost:3000
   ```

4. Copy the **HTTPS URL**.

---

## Configure Twilio WhatsApp Sandbox

1. Go to [Twilio Console → Messaging → Try it out → Send a WhatsApp message](https://console.twilio.com/us1/develop/sandbox)

2. Scroll to **Sandbox Settings**

3. Set **WHEN A MESSAGE COMES IN** to:
   ```
   https://abc123-def.ngrok-free.app/webhook/whatsapp
   ```

   ⚠️ **Use `/webhook/whatsapp`, NOT `/whatsapp/webhook`**

4. Leave **Status Callback URL** blank unless you need delivery receipts

5. Click **Save**

---

## Test WhatsApp

Send a message to your Twilio sandbox number. It usually looks like:
```
+1 415 523 8886
```

If this is your first time, send:
```
join <your-sandbox-code>
```

Then try:
```
hi
balance of xdcA7A0992f35Ef16E9bA2CD73e4fFD31Cef2602020
gas price
```

---

## Verify the Webhook is Working

Your backend terminal should show:
```json
{"message":"POST /webhook/whatsapp","userAgent":"TwilioProxy/1.1"}
```

If you see `POST /whatsapp/webhook` instead, your Twilio URL path is wrong.

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| No reply on WhatsApp | Twilio URL not set or wrong path | Check `/webhook/whatsapp` |
| "Tunnel not found" | ngrok stopped | Restart ngrok |
| URL changes every time | Free ngrok plan | Update Twilio URL after restart, or buy a static domain |
| Twilio 404 | Wrong route | Must be `/webhook/whatsapp` |
| Twilio 500 | Backend error | Check terminal stack trace |
| ngrok command not found | Not installed | Use `npx ngrok http 3000` |

---

## Pro Tips

- **Free ngrok URLs expire** when you close the terminal. For daily development, consider a [static domain](https://ngrok.com/pricing) or deploy to Render / Railway / VPS.
- Always start `pnpm dev` **before** ngrok so the tunnel has a service to forward to.
- If testing both Telegram and WhatsApp, only WhatsApp needs ngrok. Telegram uses polling by default.

---

## Quick Checklist

- [ ] Docker Desktop is running
- [ ] `docker-compose up -d` started MongoDB + Redis
- [ ] `pnpm dev` is running
- [ ] `npx ngrok http 3000` is running in a second terminal
- [ ] Twilio **WHEN A MESSAGE COMES IN** is set to `https://<ngrok>/webhook/whatsapp`
- [ ] Twilio changes are saved
- [ ] Phone message sent to the correct sandbox number
