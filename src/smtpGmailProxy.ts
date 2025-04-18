import axios from "axios"
import { JWT } from "google-auth-library"
import net from "node:net"
import { SMTPServer } from "smtp-server"
import winston from "winston"

const ERRORS = {
  credentialNotValid: "File credential.json is missing or it's not valid. You need to provide valid service account credentials json",
}

/**
 * SMTP Gmail Proxy class that handles email forwarding through Gmail API
 * using Google Cloud Service Account credentials
 */
export class SMTPGmailProxy {
  /** Name of the proxy instance */
  private readonly name: string
  /** Google Cloud Service Account Credentials */
  private readonly credentials: Credentials
  /** Number of attempts to send email before throwing an error */
  private readonly maxSendRetries: number = 3
  /** Logger instance for recording operations and errors */
  private readonly logger: winston.Logger | null = null
  /** Whether to enable POP3 server mocking */
  private readonly enablePOP3Mocking: boolean = true
  /** Port number for the POP3 server */
  private readonly pop3Port: number = 1100
  /** Port number for the SMTP server */
  private readonly smtpPort: number = 2525

  /**
   * Creates an instance of SMTPGmailProxy
   * @param {SMTPGmailProxyConfig} config - Configuration object for the proxy
   * @param {string} config.name - Name of the proxy instance
   * @param {Credentials} config.credentials - Google Cloud Service Account Credentials
   * @param {number} [config.maxSendRetries=3] - Maximum number of email send retries
   * @param {boolean} [config.enableLogs=true] - Whether to enable logging
   * @param {boolean} [config.enablePOP3Mocking=true] - Whether to enable POP3 server mocking
   * @param {number} [config.pop3Port=1100] - Port for POP3 server
   * @param {number} [config.smtpPort=2525] - Port for SMTP server
   */
  constructor({
    name,
    credentials,
    maxSendRetries = 3,
    enableLogs = true,
    enablePOP3Mocking = true,
    pop3Port = 1100,
    smtpPort = 2525
  }: SMTPGmailProxyConfig) {
    this.name = name
    this.credentials = credentials
    this.maxSendRetries = maxSendRetries
    this.logger = enableLogs ? this.createLogger() : null
    this.enablePOP3Mocking = enablePOP3Mocking
    this.pop3Port = pop3Port
    this.smtpPort = smtpPort
  }

  /**
   * Creates a Winston logger instance for the proxy
   * @private
   * @returns {winston.Logger} Configured logger instance with file and console transports
   */
  private createLogger() {
    return winston.createLogger({
      level: "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level.toUpperCase()}] ${message}`
        })
      ),
      transports: [new winston.transports.File({ filename: `logs/${this.name}-smtp-proxy.log` }), new winston.transports.Console()],
    })
  }

  /**
   * Validates if the provided credentials are valid
   * @private
   * @returns {boolean} True if credentials contain required fields
   */
  private isCredentialsValid() {
    return !!this.credentials && !!this.credentials.client_id
  }

  /**
   * Sends an email through Gmail API with retry mechanism
   * @private
   * @param {string} from - Email address of the sender
   * @param {string} rawMessage - Base64 encoded email message
   * @returns {Promise<void>}
   * @throws {Error} When all retry attempts fail
   */
  private async sendWithRetry(from: string, rawMessage: string) {
    const userAuth = new JWT({
      email: this.credentials.client_email,
      key: this.credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/gmail.send"],
      subject: from,
    })

    for (let attempt = 1; attempt <= this.maxSendRetries; attempt++) {
      try {
        const token = await userAuth.authorize()
        await axios.post(
          `https://gmail.googleapis.com/gmail/v1/users/${from}/messages/send`,
          { raw: rawMessage },
          { headers: { Authorization: `Bearer ${token.access_token}` } }
        )
        this.logger?.info(`[${this.name}] Email sent from ${from} (attempt ${attempt})`)
        return
      } catch (err) {
        this.logger?.error(`[${this.name}] Attempt ${attempt} failed for ${from}: ${err.response?.data?.error?.message || err.message}`)
        if (attempt === this.maxSendRetries) throw err
      }
    }
  }

  /**
   * Creates and configures SMTP server instance
   * @private
   * @returns {SMTPServer} Configured SMTP server instance
   */
  private createSmtpServer() {
    return new SMTPServer({
      authOptional: true,
      onAuth: (auth, session, callback) => {
        session.user = auth.username
        callback(null, { user: auth.username })
      },
      onData: (stream, session, callback) => {
        let chunks = []
        stream.on("data", (chunk) => chunks.push(chunk))
        stream.on("end", async () => {
          const rawMessage = Buffer.concat(chunks).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
          const from = session.user
          try {
            await this.sendWithRetry(from, rawMessage)
            callback()
          } catch (err) {
            this.logger?.error(`[${this.name}] Failed to send email from ${from}`)
            callback(new Error(`[${this.name}] Failed to send email`))
          }
        })
      },
      secure: false,
      disabledCommands: ["STARTTLS"],
    })
  }

  /**
   * Creates a mock POP3 server for testing purposes
   * @private
   * @returns {net.Server} Configured POP3 mock server
   */
  private createMockPOP3Server() {
    return net.createServer((socket) => {
      socket.write("+OK POP3 mock server ready\r\n")

      socket.on("data", (data) => {
        const command = data.toString().trim()
        if (command.startsWith("USER")) {
          socket.write("+OK User accepted\r\n")
        } else if (command.startsWith("PASS")) {
          socket.write("+OK Pass accepted\r\n")
        } else if (command === "STAT") {
          socket.write("+OK 0 0\r\n")
        } else if (command === "LIST") {
          socket.write("+OK 0 messages\r\n.\r\n")
        } else if (command === "QUIT") {
          socket.write("+OK Bye\r\n")
          socket.end()
        } else {
          socket.write("-ERR Command not supported\r\n")
        }
      })

      socket.on("error", (err) => {
        this.logger?.error(`[${this.name}] POP3 socket error: ` + err.message)
      })
    })
  }

  /**
   * Starts the SMTP proxy and optional POP3 mock server
   * @public
   * @throws {Error} When credentials are invalid
   */
  public run() {
    if (!this.isCredentialsValid()) {
      throw new Error(ERRORS.credentialNotValid)
    }

    const smtpServer = this.createSmtpServer()
    const pop3MockServer = this.enablePOP3Mocking ? this.createMockPOP3Server() : null

    smtpServer.listen(this.smtpPort, () => {
      this.logger?.info(`[${this.name}] SMTP proxy running on port ${this.smtpPort}`)
    })

    pop3MockServer?.listen(this.pop3Port, () => {
      this.logger?.info(`[${this.name}] Mock POP3 server running on port ${this.pop3Port}`)
    })
  }
}
