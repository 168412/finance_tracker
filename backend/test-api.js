async function test() {
  const uniq = Date.now();
  const r = await fetch('http://localhost:3002/api/auth/signup', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ username: 'Test', email: `test${uniq}@test.com`, password: 'password123' })
  });
  let data = await r.json();
  const token = data.token;
  
  const rec = await fetch('http://localhost:3002/api/recurring', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Recurring status:', rec.status, await rec.text());

  const bdg = await fetch('http://localhost:3002/api/budgets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Budgets status:', bdg.status, await bdg.text());
}
test();
