import { 
  loadMCPConfig, 
  spawnServer, 
  getServers, 
  killServer, 
  getRunningServers 
} from './serverManager.js';

async function runTests() {
  console.log("--- 1. Loading Configuration ---");
  const config = loadMCPConfig();
  console.log("Config loaded:", config);

  console.log("\n--- 2. List Available Servers (Should be stopped) ---");
  console.log(getServers());

  console.log("\n--- 3. Spawning 'test-server' ---");
  const spawnResult = await spawnServer('test-server');
  console.log("Spawn Result:", spawnResult);

  if (spawnResult.error) {
    console.error("Test Failed: Could not spawn server.");
    return;
  }

  console.log("\n--- 4. Verify Server is Running ---");
  const running = getRunningServers();
  console.log("Running Servers:", running);
  
  // Check if our specific server is in the list
  const isRunning = running.some(s => s.name === 'test-server');
  console.log(`Is test-server running? ${isRunning ? 'YES' : 'NO'}`);

  console.log("\n--- 5. Attempt to Spawn Duplicate (Should Fail/Warn) ---");
  const dupResult = await spawnServer('test-server');
  console.log("Duplicate Spawn Result:", dupResult);

  console.log("\n--- 6. Killing Server ---");
  const killResult = killServer('test-server');
  console.log("Kill Result:", killResult);

  console.log("\n--- 7. Verify Server is Stopped ---");
  console.log("Running Servers after kill:", getRunningServers());

  console.log("\n--- Test Complete ---");
}

runTests().catch(console.error);