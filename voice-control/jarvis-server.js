const express = require('express');
const { Groq } = require('groq-sdk');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Store conversation context
let conversationHistory = [];

// Database of applications
const appDatabase = {
  // Browsers
  'chrome': 'google-chrome',
  'firefox': 'firefox',
  'edge': 'microsoft-edge',
  'safari': 'safari',
  
  // Games
  'steam': 'steam',
  'minecraft': 'minecraft',
  'roblox': 'roblox',
  'fortnite': 'fortnite',
  'valorant': 'valorant',
  'csgo': 'csgo',
  
  // Productivity
  'vs code': 'code',
  'vscode': 'code',
  'notepad': 'notepad',
  'word': 'winword',
  'excel': 'excel',
  'powerpoint': 'powerpnt',
  
  // Media
  'vlc': 'vlc',
  'spotify': 'spotify',
  'youtube': 'google-chrome https://www.youtube.com',
  'netflix': 'google-chrome https://www.netflix.com',
  
  // Communication
  'discord': 'discord',
  'slack': 'slack',
  'telegram': 'telegram',
  'whatsapp': 'whatsapp',
  
  // Utilities
  'calculator': 'calc',
  'cmd': 'cmd',
  'terminal': 'powershell'
};

// Web apps database
const webApps = {
  'youtube': 'https://www.youtube.com',
  'google': 'https://www.google.com',
  'facebook': 'https://www.facebook.com',
  'twitter': 'https://www.twitter.com',
  'instagram': 'https://www.instagram.com',
  'linkedin': 'https://www.linkedin.com',
  'github': 'https://www.github.com',
  'gmail': 'https://mail.google.com',
  'chatgpt': 'https://chat.openai.com',
  'netflix': 'https://www.netflix.com',
  'spotify': 'https://www.spotify.com',
  'amazon': 'https://www.amazon.com',
  'reddit': 'https://www.reddit.com',
  'twitch': 'https://www.twitch.tv',
  'tiktok': 'https://www.tiktok.com'
};

// System info
const os = require('os');
const platform = os.platform(); // 'win32', 'linux', 'darwin'

// JARVIS AI System Prompt
const JARVIS_SYSTEM_PROMPT = `You are JARVIS, an advanced AI assistant inspired by Tony Stark's AI from Iron Man. 

Your capabilities:
1. OPEN APPLICATIONS - Open any desktop application installed on user's computer
2. OPEN WEB APPS - Open websites and web applications in browser
3. CONTROL SYSTEM - Adjust volume, brightness, take screenshots, lock screen, etc.
4. EXECUTE GAMES - Launch gaming applications
5. SEARCH & BROWSE - Search for information and open web pages
6. SYSTEM INFORMATION - Provide computer stats and information
7. EXECUTE COMMANDS - Run system commands when needed

When user gives command, respond EXACTLY in this JSON format:
{
  "action_type": "open_app|open_web|system_control|game|search|info|command",
  "action": "specific action name",
  "target": "what to open/control",
  "parameters": { "param1": "value1" },
  "confirmation": "Human readable confirmation message",
  "coolness_factor": 1-10
}

Examples:
- User: "Open Minecraft"
  Response: {"action_type": "game", "action": "launch", "target": "minecraft", "confirmation": "Launching Minecraft for you, sir", "coolness_factor": 8}

- User: "Search for Messi on YouTube"
  Response: {"action_type": "search", "action": "youtube_search", "target": "Messi", "confirmation": "Searching YouTube for Messi", "coolness_factor": 7}

- User: "Open VS Code"
  Response: {"action_type": "open_app", "action": "launch", "target": "vs code", "confirmation": "Opening VS Code, ready for development", "coolness_factor": 6}

Be creative with confirmations - make it feel like JARVIS!`;

// Voice command processing endpoint
app.post('/api/voice-command', async (req, res) => {
  try {
    const { audioText } = req.body;

    if (!audioText) {
      return res.status(400).json({ error: 'No audio text provided' });
    }

    // Add user message to history
    conversationHistory.push({
      role: 'user',
      content: audioText
    });

    // Call Groq Llama model
    const message = await groq.messages.create({
      model: 'llama-3.1-70b-versatile',
      max_tokens: 500,
      system: JARVIS_SYSTEM_PROMPT,
      messages: conversationHistory
    });

    const aiResponse = message.content[0].text;
    
    // Parse JSON response
    let action = null;
    try {
      // Extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        action = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('JSON parse error:', e);
      action = { action_type: 'error', confirmation: aiResponse };
    }

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: aiResponse
    });

    // Execute the action
    const result = await executeAction(action);

    res.json({
      success: true,
      aiResponse: action?.confirmation || aiResponse,
      action: action,
      result: result,
      coolness: action?.coolness_factor || 5
    });

  } catch (error) {
    console.error('Error processing voice command:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute action based on type
async function executeAction(action) {
  try {
    if (!action) {
      return { success: false, message: 'Invalid action' };
    }

    switch (action.action_type) {
      case 'open_app':
        return await openApplication(action.target);
      
      case 'open_web':
        return await openWebApp(action.target);
      
      case 'game':
        return await launchGame(action.target);
      
      case 'search':
        return await search(action.target, action.parameters);
      
      case 'system_control':
        return await systemControl(action.action, action.parameters);
      
      case 'info':
        return await getSystemInfo();
      
      case 'command':
        return await executeCommand(action.target);
      
      default:
        return { success: false, message: 'Unknown action' };
    }
  } catch (error) {
    console.error('Action execution error:', error);
    return { success: false, error: error.message };
  }
}

// Open desktop application
async function openApplication(appName) {
  try {
    const normalizedApp = appName.toLowerCase().trim();
    const appPath = appDatabase[normalizedApp];

    if (!appPath) {
      return { success: false, message: `Application "${appName}" not found in database` };
    }

    if (platform === 'win32') {
      exec(`start ${appPath}`);
    } else if (platform === 'linux') {
      exec(`${appPath} &`);
    } else if (platform === 'darwin') {
      exec(`open -a "${appPath}"`);
    }

    io.emit('app_opened', { app: appName });
    return { success: true, message: `Opened ${appName}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Open web application
async function openWebApp(webName) {
  try {
    const normalizedWeb = webName.toLowerCase().trim();
    const webUrl = webApps[normalizedWeb];

    if (!webUrl) {
      return { success: false, message: `Web app "${webName}" not found` };
    }

    const browserCmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${browserCmd} "${webUrl}"`);

    io.emit('web_opened', { app: webName, url: webUrl });
    return { success: true, message: `Opening ${webName}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Launch game
async function launchGame(gameName) {
  try {
    const normalizedGame = gameName.toLowerCase().trim();
    const gamePath = appDatabase[normalizedGame];

    if (!gamePath) {
      return { success: false, message: `Game "${gameName}" not found` };
    }

    if (platform === 'win32') {
      exec(`start ${gamePath}`);
    } else if (platform === 'linux') {
      exec(`${gamePath} &`);
    } else if (platform === 'darwin') {
      exec(`open -a "${gamePath}"`);
    }

    io.emit('game_launched', { game: gameName });
    return { success: true, message: `Launching ${gameName}... Get ready to play!` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Search on YouTube or Google
async function search(query, parameters = {}) {
  try {
    const platform = parameters.platform || 'youtube';
    let url = '';

    if (platform === 'youtube') {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    } else if (platform === 'google') {
      url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    } else {
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    }

    const browserCmd = platform === 'win32' ? 'start' : platform === 'darwin' ? 'open' : 'xdg-open';
    exec(`${browserCmd} "${url}"`);

    io.emit('search_performed', { query, platform, url });
    return { success: true, message: `Searching for "${query}" on ${platform}` };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// System control
async function systemControl(control, parameters) {
  try {
    if (control === 'volume') {
      const level = parameters.level || 50;
      if (platform === 'win32') {
        exec(`nircmd.exe setsysvolume ${Math.round(level * 655)}`);
      }
      return { success: true, message: `Volume set to ${level}%` };
    }

    if (control === 'brightness') {
      const level = parameters.level || 50;
      if (platform === 'win32') {
        exec(`powershell -Command "Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods | ForEach-Object { $_.WmiSetBrightness(1, ${Math.round(level * 2.55)}) }"`);
      }
      return { success: true, message: `Brightness set to ${level}%` };
    }

    if (control === 'screenshot') {
      if (platform === 'win32') {
        exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('%{PRTSC}')"`);
      } else if (platform === 'linux') {
        exec('scrot ~/screenshot_$(date +%s).png');
      }
      return { success: true, message: 'Screenshot taken' };
    }

    if (control === 'lock') {
      if (platform === 'win32') {
        exec('rundll32.exe user32.dll,LockWorkStation');
      } else if (platform === 'linux') {
        exec('xdg-screensaver lock');
      }
      return { success: true, message: 'Screen locked' };
    }

    if (control === 'sleep') {
      if (platform === 'win32') {
        exec('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
      } else if (platform === 'linux') {
        exec('systemctl suspend');
      }
      return { success: true, message: 'Entering sleep mode' };
    }

    return { success: false, message: 'Unknown system control' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Get system information
async function getSystemInfo() {
  try {
    const info = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: `${Math.round(os.totalmem() / (1024 ** 3))} GB`,
      uptime: `${Math.round(os.uptime() / 3600)} hours`,
      homeDir: os.homedir()
    };

    return { success: true, info };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Execute custom command
async function executeCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    return { success: true, output: stdout || stderr };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Reset conversation
app.post('/api/reset-conversation', (req, res) => {
  conversationHistory = [];
  res.json({ success: true, message: 'JARVIS memory reset' });
});

// Get available apps
app.get('/api/available-apps', (req, res) => {
  const apps = Object.keys(appDatabase);
  const webAppsKeys = Object.keys(webApps);
  res.json({
    applications: apps,
    webApps: webAppsKeys,
    games: apps.filter(a => ['steam', 'minecraft', 'roblox', 'fortnite', 'valorant', 'csgo'].includes(a))
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'JARVIS Voice Control System' });
});

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🤖 JARVIS VOICE CONTROL SYSTEM 🤖   ║
║   Powered by Groq Llama AI             ║
╚════════════════════════════════════════╝

✨ Server running on http://localhost:${PORT}
🎤 Voice recognition enabled
🧠 AI brain: Groq Llama 3.1 (70B)
💻 Ready to control your device!
  `);
});

// Socket.io for real-time communication
const io = require('socket.io')(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

module.exports = app;
