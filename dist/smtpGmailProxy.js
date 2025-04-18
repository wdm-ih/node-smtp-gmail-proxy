"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMTPGmailProxy = void 0;
const axios_1 = __importDefault(require("axios"));
const google_auth_library_1 = require("google-auth-library");
const node_net_1 = __importDefault(require("node:net"));
const smtp_server_1 = require("smtp-server");
const winston_1 = __importDefault(require("winston"));
const ERRORS = {
    credentialNotValid: "File credential.json is missing or it's not valid. You need to provide valid service account credentials json",
};
/**
 * SMTP Gmail Proxy class that handles email forwarding through Gmail API
 * using Google Cloud Service Account credentials
 */
class SMTPGmailProxy {
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
    constructor({ name, credentials, maxSendRetries = 3, enableLogs = true, enablePOP3Mocking = true, pop3Port = 1100, smtpPort = 2525 }) {
        /** Number of attempts to send email before throwing an error */
        this.maxSendRetries = 3;
        /** Logger instance for recording operations and errors */
        this.logger = null;
        /** Whether to enable POP3 server mocking */
        this.enablePOP3Mocking = true;
        /** Port number for the POP3 server */
        this.pop3Port = 1100;
        /** Port number for the SMTP server */
        this.smtpPort = 2525;
        this.name = name;
        this.credentials = credentials;
        this.maxSendRetries = maxSendRetries;
        this.logger = enableLogs ? this.createLogger() : null;
        this.enablePOP3Mocking = enablePOP3Mocking;
        this.pop3Port = pop3Port;
        this.smtpPort = smtpPort;
    }
    /**
     * Creates a Winston logger instance for the proxy
     * @private
     * @returns {winston.Logger} Configured logger instance with file and console transports
     */
    createLogger() {
        return winston_1.default.createLogger({
            level: "info",
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.printf(({ timestamp, level, message }) => {
                return `${timestamp} [${level.toUpperCase()}] ${message}`;
            })),
            transports: [new winston_1.default.transports.File({ filename: `logs/${this.name}-smtp-proxy.log` }), new winston_1.default.transports.Console()],
        });
    }
    /**
     * Validates if the provided credentials are valid
     * @private
     * @returns {boolean} True if credentials contain required fields
     */
    isCredentialsValid() {
        return !!this.credentials && !!this.credentials.client_id;
    }
    /**
     * Sends an email through Gmail API with retry mechanism
     * @private
     * @param {string} from - Email address of the sender
     * @param {string} rawMessage - Base64 encoded email message
     * @returns {Promise<void>}
     * @throws {Error} When all retry attempts fail
     */
    sendWithRetry(from, rawMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const userAuth = new google_auth_library_1.JWT({
                email: this.credentials.client_email,
                key: this.credentials.private_key,
                scopes: ["https://www.googleapis.com/auth/gmail.send"],
                subject: from,
            });
            for (let attempt = 1; attempt <= this.maxSendRetries; attempt++) {
                try {
                    const token = yield userAuth.authorize();
                    yield axios_1.default.post(`https://gmail.googleapis.com/gmail/v1/users/${from}/messages/send`, { raw: rawMessage }, { headers: { Authorization: `Bearer ${token.access_token}` } });
                    (_a = this.logger) === null || _a === void 0 ? void 0 : _a.info(`[${this.name}] Email sent from ${from} (attempt ${attempt})`);
                    return;
                }
                catch (err) {
                    (_b = this.logger) === null || _b === void 0 ? void 0 : _b.error(`[${this.name}] Attempt ${attempt} failed for ${from}: ${((_e = (_d = (_c = err.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.message) || err.message}`);
                    if (attempt === this.maxSendRetries)
                        throw err;
                }
            }
        });
    }
    /**
     * Creates and configures SMTP server instance
     * @private
     * @returns {SMTPServer} Configured SMTP server instance
     */
    createSmtpServer() {
        return new smtp_server_1.SMTPServer({
            authOptional: true,
            onAuth: (auth, session, callback) => {
                session.user = auth.username;
                callback(null, { user: auth.username });
            },
            onData: (stream, session, callback) => {
                let chunks = [];
                stream.on("data", (chunk) => chunks.push(chunk));
                stream.on("end", () => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const rawMessage = Buffer.concat(chunks).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
                    const from = session.user;
                    try {
                        yield this.sendWithRetry(from, rawMessage);
                        callback();
                    }
                    catch (err) {
                        (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(`[${this.name}] Failed to send email from ${from}`);
                        callback(new Error(`[${this.name}] Failed to send email`));
                    }
                }));
            },
            secure: false,
            disabledCommands: ["STARTTLS"],
        });
    }
    /**
     * Creates a mock POP3 server for testing purposes
     * @private
     * @returns {net.Server} Configured POP3 mock server
     */
    createMockPOP3Server() {
        return node_net_1.default.createServer((socket) => {
            socket.write("+OK POP3 mock server ready\r\n");
            socket.on("data", (data) => {
                const command = data.toString().trim();
                if (command.startsWith("USER")) {
                    socket.write("+OK User accepted\r\n");
                }
                else if (command.startsWith("PASS")) {
                    socket.write("+OK Pass accepted\r\n");
                }
                else if (command === "STAT") {
                    socket.write("+OK 0 0\r\n");
                }
                else if (command === "LIST") {
                    socket.write("+OK 0 messages\r\n.\r\n");
                }
                else if (command === "QUIT") {
                    socket.write("+OK Bye\r\n");
                    socket.end();
                }
                else {
                    socket.write("-ERR Command not supported\r\n");
                }
            });
            socket.on("error", (err) => {
                var _a;
                (_a = this.logger) === null || _a === void 0 ? void 0 : _a.error(`[${this.name}] POP3 socket error: ` + err.message);
            });
        });
    }
    /**
     * Starts the SMTP proxy and optional POP3 mock server
     * @public
     * @throws {Error} When credentials are invalid
     */
    run() {
        if (!this.isCredentialsValid()) {
            throw new Error(ERRORS.credentialNotValid);
        }
        const smtpServer = this.createSmtpServer();
        const pop3MockServer = this.enablePOP3Mocking ? this.createMockPOP3Server() : null;
        smtpServer.listen(this.smtpPort, () => {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.info(`[${this.name}] SMTP proxy running on port ${this.smtpPort}`);
        });
        pop3MockServer === null || pop3MockServer === void 0 ? void 0 : pop3MockServer.listen(this.pop3Port, () => {
            var _a;
            (_a = this.logger) === null || _a === void 0 ? void 0 : _a.info(`[${this.name}] Mock POP3 server running on port ${this.pop3Port}`);
        });
    }
}
exports.SMTPGmailProxy = SMTPGmailProxy;
//# sourceMappingURL=smtpGmailProxy.js.map