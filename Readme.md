[MVP]

Simple GOOGLE SMTP Proxy to bypass OAUTH2 requirements for "Unsafe App" that used only Username and Password;

This proxy requires Google Console Project setup and Service Account (see more below)

#### To run proxy:
- place `credentials.json` that you downloaded from your Google Cloud Console in root folder near `build`;
- We can use prebuilt file `build/smtp-proxy.js` and run it with node `node build/smtp-proxy.js`, or on Windows OS execute `run-proxy.cmd`;
- Also we can run this proxy as Windows Service (see section "Run as Windows Service below");

#### Development
- `npm install` - to install required dependencies;
- `npm run build` - to build project

#### Google Console Setup
to do

#### Run as Windows Service
to do
