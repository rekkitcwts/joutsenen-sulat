const { spawn } = require('child_process');
const express = require("express");
const tmp = require("tmp");
const fs = require("fs");
const app = express();
const path = tmp.fileSync().name; // Use this instead of hardcoding '/tmp/guide.xml'
const port = process.env.PORT || 3001;

// From Render AI assistant
const tmpFile = tmp.fileSync();
fs.writeFileSync(tmpFile.name, "temporary data");

const tmpDir = tmp.dirSync();

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get("/", (req, res) => res.type('html').send(html));
app.get("/health", (req, res) => res.type('html').send(html));

app.get("/epg.xml", (req, res) => {
  const tempFile = tmp.fileSync();
  console.log(`[EPG] Temp file: ${tempFile.name}`);

  let hasResponded = false;
  let channelCount = 0;
  let processedChannels = 0;
  let timeoutDuration = 30000; // Default 30s
  let timeout;

  const sendError = (message) => {
    if (!hasResponded) {
      hasResponded = true;
      try {
        const fallbackContent = fs.readFileSync('guide.xml', 'utf8');
        console.log('[EPG] Falling back to static guide.xml');
        res.setHeader('Content-Type', 'application/xml');
        res.send(fallbackContent);
      } catch (fallbackErr) {
        console.error('[EPG] Fallback failed:', fallbackErr);
        res.status(500).send(message);
      }
    }
  };

  const sendSuccess = (content) => {
    if (!hasResponded) {
      hasResponded = true;
      res.setHeader('Content-Type', 'application/xml');
      res.send(content);
    }
  };

  const resetTimeout = () => {
    if (timeout) clearTimeout(timeout);
    // Calculate timeout based on remaining channels (10s per channel + 30s buffer)
    const remainingChannels = channelCount - processedChannels;
    timeoutDuration = Math.max(30000, remainingChannels * 10000 + 30000);
    timeout = setTimeout(() => {
      if (!hasResponded) {
        console.error(`[EPG] Process timeout after ${timeoutDuration/1000}s`);
        grab.kill('SIGKILL');
        sendError('EPG generation timed out');
      }
    }, timeoutDuration);
    console.log(`[EPG] Timeout reset to ${timeoutDuration/1000} seconds`);
  };

  const args = ['run', 'grab', '--', '--channels=savedchannels.xml', `--output=${tempFile.name}`, `--maxConnections=2`];
  console.log(`[EPG] Command: npm ${args.join(' ')}`);

  const grab = spawn('npm', args, {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // Initial timeout
  resetTimeout();

  grab.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[EPG] stdout: ${output}`);

    // Detect channel count
    if (output.includes('found') && output.includes('channel(s)')) {
      const match = output.match(/found (\d+) channel\(s\)/);
      if (match) {
        channelCount = parseInt(match[1]);
        console.log(`[EPG] Detected ${channelCount} channels`);
        resetTimeout();
      }
    }

    // Track progress
    if (output.match(/\[\d+\/\d+\] .+ \(\d+ programs\)/)) {
      processedChannels++;
      resetTimeout();
    }

    // Detect completion
    if (output.includes('done in')) {
      clearTimeout(timeout);
    }
  });

  grab.stderr.on('data', (data) => {
    console.error(`[EPG] stderr: ${data.toString().trim()}`);
  });

  grab.on('close', (code) => {
    clearTimeout(timeout);
    console.log(`[EPG] Process exited with code ${code}`);

    if (hasResponded) return;

    if (code === 0) {
      try {
        const content = fs.readFileSync(tempFile.name, 'utf8');
        console.log(`[EPG] File content (first 200 chars): ${content.substring(0, 200)}...`);
        
        if (content.length < 100) {
          throw new Error('EPG file suspiciously small');
        }

        sendSuccess(content);
      } catch (err) {
        console.error('[EPG] File error:', err);
        sendError('EPG processing failed');
      }
    } else {
      console.error('[EPG] Generation failed, using fallback');
      sendError('EPG generation failed');
    }

    fs.unlink(tempFile.name, (err) => {
      if (err) console.error('[EPG] Cleanup failed:', err);
    });
  });

  grab.on('error', (err) => {
    console.error('[EPG] Spawn error:', err);
    clearTimeout(timeout);
    sendError('EPG process failed to start');
  });
});

const server = app.listen(port, () => console.log(`Example app listening on port ${port}!`));

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

const html = `
<!DOCTYPE html>
<html>
  <head>
    <title>Hello from Render!</title>
    <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.5.1/dist/confetti.browser.min.js"></script>
    <script>
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    </script>
    <style>
      @import url("https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css");
      @font-face {
        font-family: "neo-sans";
        src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"), url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
        font-style: normal;
        font-weight: 700;
      }
      html {
        font-family: neo-sans;
        font-weight: 700;
        font-size: calc(62rem / 16);
      }
      body {
        background: white;
      }
      section {
        border-radius: 1em;
        padding: 1em;
        position: absolute;
        top: 50%;
        left: 50%;
        margin-right: -50%;
        transform: translate(-50%, -50%);
      }
    </style>
  </head>
  <body>
    <section>
      Tervetuloa!
    </section>
  </body>
</html>
`
