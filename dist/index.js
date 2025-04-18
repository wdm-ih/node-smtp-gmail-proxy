"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const smtpGmailProxy_1 = require("./smtpGmailProxy");
node_fs_1.default.readFile(node_path_1.default.join(__dirname, "..", "/credentials.json"), "utf8", (err, data) => {
    if (err)
        throw err;
    const credentials = JSON.parse(data);
    if (Array.isArray(credentials)) {
        const baseSmtpPort = 2525;
        const basePop3Port = 1100;
        credentials.forEach((cred, index) => {
            const proxy = new smtpGmailProxy_1.SMTPGmailProxy({
                name: cred.project_id,
                credentials: cred,
                smtpPort: baseSmtpPort + index,
                pop3Port: basePop3Port + index,
            });
            proxy.run();
        });
    }
    else {
        const proxy = new smtpGmailProxy_1.SMTPGmailProxy({
            name: credentials.project_id,
            credentials: credentials,
            smtpPort: 2525,
            pop3Port: 1100,
        });
        proxy.run();
    }
});
//# sourceMappingURL=index.js.map