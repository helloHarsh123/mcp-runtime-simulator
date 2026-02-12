import { loadMCPConfig, spawnServer, getAllTools, killServer } from './serverManager.js';

async function run() {
  const config = loadMCPConfig();
  const serverNames = Object.keys(config);
  
  console.log(`Found configured servers: ${serverNames.join(', ')}`);

  // 1. Start ALL servers
  for (const name of serverNames) {
    console.log(`Starting ${name}...`);
    // Note: This might fail for GitHub if GITHUB_TOKEN isn't set in your environment!
    const result = await spawnServer(name);
    
    if (result.error) {
      console.error(`❌ Failed to start ${name}:`, result.error);
    } else {
      console.log(`✅ ${name} is running.`);
    }
  }

  // 2. Fetch tools from all running servers
  console.log("\nFetching tools from all active servers...");
  const tools = await getAllTools();
  
  console.log(`\nTotal Tools Found: ${tools.length}`);
  tools.forEach(t => {
    console.log(`- [${t.server}] ${t.name}: ${t.description?.slice(0, 50) || ''}...`);
  });

  // 3. Cleanup
  console.log("\nStopping servers...");
  serverNames.forEach(name => killServer(name));
}

run();