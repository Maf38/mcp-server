const axios = require('axios');

const API_URL = 'http://192.168.1.187:3000';

async function testAPI() {
  try {
    // Test health
    console.log('Testing health endpoint...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('Health check:', health.data);

    // Test creating context
    console.log('\nTesting context creation...');
    const createContext = await axios.post(`${API_URL}/context`, {
      key: 'test',
      value: 'Hello MCP!',
      metadata: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    });
    console.log('Context created:', createContext.data);

    // Test getting context
    console.log('\nTesting context retrieval...');
    const getContext = await axios.get(`${API_URL}/context/test`);
    console.log('Context retrieved:', getContext.data);

    // Test batch operation
    console.log('\nTesting batch operation...');
    const batchContext = await axios.post(`${API_URL}/context/batch`, [
      {
        key: 'batch1',
        value: 'Batch Test 1',
        metadata: { type: 'batch' }
      },
      {
        key: 'batch2',
        value: 'Batch Test 2',
        metadata: { type: 'batch' }
      }
    ]);
    console.log('Batch operation result:', batchContext.data);

    // Test capabilities
    console.log('\nTesting capabilities endpoint...');
    const capabilities = await axios.get(`${API_URL}/capabilities`);
    console.log('Server capabilities:', capabilities.data);

  } catch (error) {
    console.error('Error during test:', error.response ? error.response.data : error.message);
  }
}

testAPI(); 