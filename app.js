const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const express = require("express");
const path = require('path'); // Add this with other requires
const tmp = require("tmp");
const fs = require("fs");
const app = express();
const tempFilePath = tmp.fileSync().name; // Use this instead of hardcoding '/tmp/guide.xml'
const port = process.env.PORT || 3001;

// From Render AI assistant
const tmpFile = tmp.fileSync();
fs.writeFileSync(tmpFile.name, "temporary data");

const tmpDir = tmp.dirSync();

// Add this right after your tmpDir initialization
// Clear old cache files on startup
try {
  const files = fs.readdirSync(tmpDir.name);
  files.forEach(file => {
    if (file.endsWith('_cache.xml')) {
      fs.unlinkSync(path.join(tmpDir.name, file));
    }
  });
} catch (e) {
  console.log('[Startup] No cache files to clean');
}

// Add near your other requires
const { parseString } = require('xml2js');

// Utility functions
const getCurrentDateString = () => {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
};

const extractXMLDate = (xmlContent) => {
  try {
    const match = xmlContent.match(/<tv[^>]*date=["']([^"']+)["']/i);
    return match ? match[1] : null;
  } catch (e) {
    return null;
  }
};

const checkFileFreshness = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const content = fs.readFileSync(filePath, 'utf8');
    const xmlDate = extractXMLDate(content);
    return xmlDate === getCurrentDateString();
  } catch (e) {
    return false;
  }
};

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Initialize DB connection
let db;
try {
  db = new Database(process.env.MUUMIMAMMAN_KASILAUKKU, {
    password: process.env.ANTIMERKKI,
    readonly: true // Extra security
  });
} catch (err) {
  console.error('Database connection failed:', err);
  process.exit(1);
}

let currentdate;
let last_tempfile;

app.get("/", (req, res) => res.type('html').send(html));
app.get("/health", (req, res) => res.type('html').send(html));
app.get("/epg.xml", (req, res) => {
  // First check if we have a fresh cached file
  const cachedFile = path.join(tmpDir.name, 'epg_cache.xml');
  
  if (fs.existsSync(cachedFile) && checkFileFreshness(cachedFile)) {
    console.log('[EPG] Serving cached file');
    res.setHeader('Content-Type', 'application/xml');
    return fs.createReadStream(cachedFile).pipe(res);
  }

  // If no fresh cache, proceed with generation
  const tempFile = tmp.fileSync();
  console.log(`[EPG] Temp file: ${tempFile.name}`);

  let hasResponded = false;
  let channelCount = 0;
  let processedChannels = 0;
  let timeoutDuration = 30000;
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
      // Cache the successful response
      fs.writeFileSync(cachedFile, content);
      console.log(`[EPG] Cached response to ${cachedFile}`);
      
      res.setHeader('Content-Type', 'application/xml');
      res.send(content);
    }
  };

  const resetTimeout = () => {
    if (timeout) clearTimeout(timeout);
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

  const args = ['run', 'grab', '--', '--channels=savedchannels.xml', `--output=${tempFile.name}`];
  console.log(`[EPG] Command: npm ${args.join(' ')}`);

  const grab = spawn('npm', args, {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  resetTimeout();

  grab.stdout.on('data', (data) => {
    const output = data.toString().trim();
    console.log(`[EPG] stdout: ${output}`);

    if (output.includes('found') && output.includes('channel(s)')) {
      const match = output.match(/found (\d+) channel\(s\)/);
      if (match) {
        channelCount = parseInt(match[1]);
        console.log(`[EPG] Detected ${channelCount} channels`);
        resetTimeout();
      }
    }

    if (output.match(/\[\d+\/\d+\] .+ \(\d+ programs\)/)) {
      processedChannels++;
      resetTimeout();
    }

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
