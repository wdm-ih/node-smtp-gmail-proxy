const { SMTPServer } = require('smtp-server');
const { JWT } = require('google-auth-library');
const axios = require('axios');
const winston = require('winston');
const net = require('net');
const path = require('path');

const credentials = require(path.join(__dirname, 'credentials.json'));
if (!credentials || !credentials?.['client_id']) {
   throw new Error('File credential.json is missing or it doesn`t valid. You need to provide valid service account credentials json')
 }

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/smtp-proxy.log' }),
    new winston.transports.Console(),
  ],
});

async function sendWithRetry(from, rawMessage, maxRetries = 3) {
  const userAuth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: from
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const token = await userAuth.authorize();
      const res = await axios.post(
        `https://gmail.googleapis.com/gmail/v1/users/${from}/messages/send`,
        { raw: rawMessage },
        { headers: { Authorization: `Bearer ${token.access_token}` } }
      );
      logger.info(`Email sent from ${from} (attempt ${attempt})`);
      return;
    } catch (err) {
      logger.error(`Attempt ${attempt} failed for ${from}: ${err.response?.data?.error?.message || err.message}`);
      if (attempt === maxRetries) throw err;
    }
  }
}

const server = new SMTPServer({
  authOptional: true,
  onAuth(auth, session, callback) {
    session.username = auth.username;
    callback(null, { user: auth.username });
  },
  onData(stream, session, callback) {
    let chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', async () => {
      const rawMessage = Buffer.concat(chunks).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const from = session.username;
      try {
        await sendWithRetry(from, rawMessage);
        callback();
      } catch (err) {
        logger.error(`Failed to send email from ${from}`);
        callback(new Error("Failed to send email"));
      }
    });
  },
  secure: false,
  disabledCommands: ['STARTTLS'],
});

const PORT = 2525;
server.listen(PORT, () => {
  logger.info(`SMTP proxy running on port ${PORT}`);
});

// Mock POP3 Server
const pop3Server = net.createServer((socket) => {
  socket.write('+OK POP3 mock server ready\r\n');

  socket.on('data', (data) => {
    const command = data.toString().trim();
    if (command.startsWith('USER')) {
      socket.write('+OK User accepted\r\n');
    } else if (command.startsWith('PASS')) {
      socket.write('+OK Pass accepted\r\n');
    } else if (command === 'STAT') {
      socket.write('+OK 0 0\r\n');
    } else if (command === 'LIST') {
      socket.write('+OK 0 messages\r\n.\r\n');
    } else if (command === 'QUIT') {
      socket.write('+OK Bye\r\n');
      socket.end();
    } else {
      socket.write('-ERR Command not supported\r\n');
    }
  });

  socket.on('error', (err) => {
    logger.error('POP3 socket error: ' + err.message);
  });
});

pop3Server.listen(1100, () => {
  logger.info('Mock POP3 server running on port 1100');
});