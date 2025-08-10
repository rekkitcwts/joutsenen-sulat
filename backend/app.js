// Core dependencies
const Database = require('better-sqlite3');
const { spawn } = require('child_process');
const express = require('express');
const next = require('next');
const path = require('path');
const tmp = require('tmp');
const fs = require('fs');

// Configuration
const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT || 3001;

// =============================================
// 1. Initialize Next.js App
// =============================================
const nextApp = next({
dev,
dir: path.join(__dirname, '../frontend') // Point to frontend directory
});
const handle = nextApp.getRequestHandler();

// =============================================
// 2. Setup Temporary Files System
// =============================================
const tmpDir = tmp.dirSync();
const tempFilePath = tmp.fileSync().name;
const lockFile = path.join(tmpDir.name, 'epg_generation.lock');
let isGenerating = false;

// Clean old cache files on startup
const cleanTempFiles = () => {
try {
const files = fs.readdirSync(tmpDir.name);
files.forEach(file => {
if (file.endsWith('_cache.xml') || file.endsWith('.lock')) {
fs.unlinkSync(path.join(tmpDir.name, file));
}
});
} catch (e) {
console.log('[Startup] No temp files to clean');
}
};
cleanTempFiles();

// =============================================
// 3. Utility Functions
// =============================================
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

const withGenerationLock = async (fn) => {
while (isGenerating) {
console.log('[EPG] Waiting for existing generation to complete...');
await new Promise(resolve => setTimeout(resolve, 1000));
}

try {
isGenerating = true;
fs.writeFileSync(lockFile, process.pid.toString());
return await fn();
} finally {
isGenerating = false;
try { fs.unlinkSync(lockFile); } catch (e) {}
}
};

// =============================================
// 4. Database Connection
// =============================================
/*let db;
try {
db = new Database(process.env.MUUMIMAMMAN_KASILAUKKU, {
password: process.env.ANTIMERKKI,
readonly: true
});
} catch (err) {
console.error('Database connection failed:', err);
process.exit(1);
}*/

// =============================================
// 5. Express Application Setup
// =============================================
nextApp.prepare().then(() => {
    const app = express();

    // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).send('Internal Server Error');
  });

    // Security middleware
    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('X-Frame-Options', 'DENY');
        next();
    });

    // Logging middleware
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });

// ===========================================
// 6. API Routes
// ===========================================
    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'OK' });
    });

    app.get('/epg.xml', async (req, res) => {
        const cachedFile = path.join(tmpDir.name, 'epg_cache.xml');

        if (fs.existsSync(cachedFile) && checkFileFreshness(cachedFile)) {
            console.log('[EPG] Serving cached file');
            res.setHeader('Content-Type', 'application/xml');
            return fs.createReadStream(cachedFile).pipe(res);
        }

        return withGenerationLock(async () => {
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
                    const fallbackContent = fs.readFileSync(path.join(__dirname, 'guide.xml'), 'utf8');
                    console.log('[EPG] Falling back to static guide.xml');
                    res.setHeader('Content-Type', 'application/xml');
                    res.send(fallbackContent);
                } 
                catch (fallbackErr) {
                    console.error('[EPG] Fallback failed:', fallbackErr);
                    res.status(500).send(message);
                }
            }
        };

        const sendSuccess = (content) => {
        if (!hasResponded) {
        hasResponded = true;
        fs.writeFileSync(cachedFile, content);
        console.log(`[EPG] Cached response to ${cachedFile}`);
        res.setHeader('Content-Type', 'application/xml');
        res.send(content);
        }
        };

        const savedChannels = path.join(__dirname, 'savedchannels.xml');
        
        if (fs.existsSync(savedChannels)) {
            console.log(`[FILE CHECK] Debugging if savedchannels.xml exists`);
        }
        else
        {
            console.log('[PERKELE] If you can see this, it means that the EPG might not generate. Checking current directory for debug purposes');
            console.log(savedChannels);
        }

        const args = ['run', 'grab', '--', `--channels=${savedChannels}`, `--output=${tempFile.name}`];
        console.log(`[EPG] Command: npm ${args.join(' ')}`);

        const grab = spawn('npm', args, { stdio: 'pipe', cwd: process.cwd() });

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
            }
            catch (err) {
                console.error('[EPG] File error:', err);
                sendError('EPG processing failed');
            }
        } 
        else {
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
    });

// ===========================================
// 7. Let Next.js handle all other routes
// ===========================================
const nextHandler = handle;

// Custom handler to catch errors
const handleNextRequests = (req, res) => {
  console.log(`Handling Next.js route: ${req.url}`);
  return nextHandler(req, res).catch(err => {
    console.error('Next.js request failed:', err);
    res.status(500).send('Internal Server Error');
  });
};


// Next.js catch-all handler
    app.use((req, res) => {
        return handle(req, res);
    });

// ===========================================
// 8. Start Server
// ===========================================
const server = app.listen(port, () => {
console.log(`Server running on port ${port}`);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;
});
