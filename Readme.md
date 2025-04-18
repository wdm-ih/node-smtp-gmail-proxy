[MVP]

Simple GOOGLE SMTP Proxy to bypass OAUTH2 requirements for "Unsafe App" that used only Username and Password;

This proxy requires Google Console Project setup and Service Account (see more below);

>**Important!**
This proxy requires `credentials.json` file in root. This file can contain as simple json object with data that downloaded from Google Cloud Console (see example in `credentials_template.json`), or for multiple instances this file can contain array of this objects (see example in `credentials_multi_template.json`).

#### To build project
*(if no `build` folder or build must be updated with new changes in source)*
- install `Node.js >= 18`;
- install required dependencies with npm `npm install`;
- run command `npm run build:bundle`

#### To run proxy:
*Node.js >= 18 and npm is required;*
- place `credentials.json` that you downloaded from your Google Cloud Console in root folder near `build`;
- We can use prebuilt file `build/smtp-proxy.js` and run it with node `node build/smtp-proxy.js`, npm command `npm run bundle:start`, or on Windows OS execute `run-proxy.cmd` (`run-proxy.cmd` runs only prebuilt script, so check if you have one in `build` folder before executing);
- Also we can install and run this proxy as Windows Service (see section "Run as Windows Service below");

#### Development
- `npm install` - to install required dependencies;
- `npm run dev` - to run tsc compiler in watch mode;

>*For other available commands see package.json*

#### Google Console Setup
1. Create a Google Cloud project;
2. Enable Gmail API;
3. Create a Service Account with "Domain-wide Delegation" enabled:
 - Go to: `Google Cloud Console → IAM & Admin → Service Accounts`, Find your service account in the list or create new; In Account details: `Enable Google Workspace Domain-wide Delegation` (can be enabled by default);
- On `Keys` tab in account details: `Create and download the JSON key`

>A file like your-service-account.json will download — **keep it safe and don`t post it anywhere.**
This file will be used by your Node.js app or SMTP proxy as `credentials.json`.
 - Share the service account's Client ID and scopes in your Google Admin Console;

2. Google Admin Console Setup:
 - Go to: `Admin Console → Security → API Controls → Domain-wide delegation`;
 - Add the Client ID (you can find it in JSON file downloaded before);
- Grant scopes like: `https://www.googleapis.com/auth/gmail.send, https://www.googleapis.com/auth/gmail.compose`;


#### Run as Windows Service
1. Download NSSM: https://nssm.cc/download;
2. Download the ZIP, extract it somewhere (e.g., C:\nssm);

>*Inside you'll find folders like win64 → use that if you're on 64-bit Windows*

3. Install your service using NSSM:
 - Open Command Prompt as Administrator and run: `C:\nssm\win64\nssm.exe install {YourServiceName, eg: smtp-proxy}`, A GUI window will appear.;
4. Configure NSSM service:
 - In the NSSM GUI: Path: `C:\Windows\System32\cmd.exe`;
 - Startup directory: `C:\{folder where your proxy-as-service.cmd placed}`;
 - Arguments: `/c proxy-as-service.cmd`;
5. Then go to the "Details" tab and give it a Display Name. It can be any name that will shown in Services
6. And optionally set "Start type" to Automatic.
7. Click Install service.
8. Start the service:
 - In your admin CMD: `nssm start smtp-proxy` or use the Services manager: `services.msc → find your service name that you set in p.5 → right-click → Start`

 To uninstall service:
 run `nssm remove YourServiceName confirm`
 >*for more details see `nssm` docs*
