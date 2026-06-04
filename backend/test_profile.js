const http = require('http');

async function test() {
  // 1. Register
  const regRes = await fetch('http://localhost:3002/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser_lang', email: 'test_lang@test.com', password: 'password123' })
  });
  const regData = await regRes.json();
  const token = regData.token;
  console.log('Reg token:', token);

  // 2. Update profile
  const patchRes = await fetch('http://localhost:3002/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ language: 'fr' })
  });
  const patchData = await patchRes.json();
  console.log('Patch data:', patchData);

  // 3. Get profile
  const getRes = await fetch('http://localhost:3002/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData = await getRes.json();
  console.log('Get data:', getData);
}
test();
