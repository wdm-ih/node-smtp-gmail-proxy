import fs from "node:fs"
import path from "node:path"
import { SMTPGmailProxy } from "./smtpGmailProxy"

fs.readFile(path.join(__dirname, "..", "/credentials.json"), "utf8", (err, data) => {
  if (err) throw err
  const credentials = JSON.parse(data) as Credentials | Credentials[]
  if (Array.isArray(credentials)) {
    const baseSmtpPort = 2525
    const basePop3Port = 1100

    credentials.forEach((cred, index) => {
      const proxy = new SMTPGmailProxy({
        name: cred.project_id,
        credentials: cred,
        smtpPort: baseSmtpPort + index,
        pop3Port: basePop3Port + index,
      })
      proxy.run()
    })
  } else {
    const proxy = new SMTPGmailProxy({
      name: credentials.project_id,
      credentials: credentials,
      smtpPort: 2525,
      pop3Port: 1100,
    })
    proxy.run()
  }
})
