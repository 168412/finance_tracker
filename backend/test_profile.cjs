async function test() {
  const regRes = await fetch('http://localhost:3002/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'testuser_new3', email: 'test_new3@test.com', password: 'password123' })
  });
  const regData = await regRes.json();
  const token = regData.token;
  console.log('Reg token:', token);

  const patchRes = await fetch('http://localhost:3002/api/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ language: 'fr' })
  });
  const patchData = await patchRes.json();
  console.log('Patch data user language:', patchData.user.language);

  const getRes = await fetch('http://localhost:3002/api/auth/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const getData = await getRes.json();
  console.log('Get data user language:', getData.language);
}
test();
