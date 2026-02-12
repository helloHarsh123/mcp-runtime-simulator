import { loadMCPConfig, spawnServer, executeMCPTool } from './server/serverManager.js';

async function testGitHubSearch() {
  // Load config and start GitHub server
  loadMCPConfig();
  const spawnResult = await spawnServer('github');
  
  if (spawnResult.error) {
    console.error('Failed to start GitHub server:', spawnResult.error);
    return;
  }
  
  console.log('GitHub server started successfully');
  
  // Test search_users tool
  try {
    console.log('Calling search_users with q=octocat...');
    const result = await executeMCPTool('github', 'search_users', { q: 'octocat' });
    console.log('Result:', result);
  } catch (error) {
    console.error('Error calling search_users:', error);
  }
}

testGitHubSearch().catch(console.error);