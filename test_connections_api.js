const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runConnectionsTests() {
  console.log('=== STARTING 12L-E CONNECTIONS API E2E VERIFICATION TEST SUITE ===\n');
  let testCount = 0;
  let passCount = 0;

  function assert(condition, testName, extraInfo = '') {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`✅ TEST ${testCount}: ${testName}`);
    } else {
      console.error(`❌ TEST ${testCount}: ${testName} - FAILED! ${extraInfo}`);
    }
  }

  try {
    const timestamp = Date.now();
    const userAEmail = `conn_a_${timestamp}@college.edu`;
    const userBEmail = `conn_b_${timestamp}@college.edu`;
    const userCEmail = `conn_c_${timestamp}@college.edu`;

    // 1. Setup Auth: Register User A, User B, User C
    const regA = await makeRequest('POST', '/api/auth/register', { full_name: 'Conn Student A', email: userAEmail, password: 'password123' });
    const regB = await makeRequest('POST', '/api/auth/register', { full_name: 'Conn Student B', email: userBEmail, password: 'password123' });
    const regC = await makeRequest('POST', '/api/auth/register', { full_name: 'Conn Student C', email: userCEmail, password: 'password123' });

    const userAId = regA.body.user ? regA.body.user.id : null;
    const userBId = regB.body.user ? regB.body.user.id : null;
    const userCId = regC.body.user ? regC.body.user.id : null;

    const loginA = await makeRequest('POST', '/api/auth/login', { email: userAEmail, password: 'password123' });
    const loginB = await makeRequest('POST', '/api/auth/login', { email: userBEmail, password: 'password123' });
    const loginC = await makeRequest('POST', '/api/auth/login', { email: userCEmail, password: 'password123' });

    const tokenA = loginA.body.token;
    const tokenB = loginB.body.token;
    const tokenC = loginC.body.token;

    assert(!!tokenA && !!tokenB && !!tokenC, 'Authentication Setup (Registered 3 test accounts & retrieved JWTs)');

    // 1. GET /api/connections (Authenticated user retrieves connections list)
    const t1 = await makeRequest('GET', '/api/connections', null, tokenA);
    assert(t1.status === 200 && Array.isArray(t1.body.connections), 'GET /api/connections returns 200 OK and connections list');

    // 2. GET /api/connections (Unauthenticated request returns 401)
    const t2 = await makeRequest('GET', '/api/connections', null, null);
    assert(t2.status === 401, 'GET /api/connections without JWT returns 401 Unauthorized');

    // 3. POST /api/connections/:userId (User A sends connection request to User B)
    const t3 = await makeRequest('POST', `/api/connections/${userBId}`, null, tokenA);
    assert(t3.status === 201 && t3.body.connection && t3.body.connection.id > 0, `POST /api/connections/${userBId} creates request (201 Created)`);
    const connABId = t3.body.connection ? t3.body.connection.id : null;

    // 4. POST /api/connections/:userId (Duplicate connection request returns 409 Conflict)
    const t4 = await makeRequest('POST', `/api/connections/${userBId}`, null, tokenA);
    assert(t4.status === 409, 'POST /api/connections duplicate request returns 409 Conflict');

    // 5. GET /api/connections (User B sees incoming request in connections list)
    const t5 = await makeRequest('GET', '/api/connections', null, tokenB);
    const hasIncoming = t5.body.connections && t5.body.connections.some(c => c.id === connABId && c.status === 'pending');
    assert(t5.status === 200 && hasIncoming, 'GET /api/connections shows incoming request for User B');

    // 6. PATCH /api/connections/:id/accept (User B accepts connection request)
    const t6 = await makeRequest('PATCH', `/api/connections/${connABId}/accept`, null, tokenB);
    assert(t6.status === 200, 'PATCH /api/connections/:id/accept accepts request (200 OK)');

    // 7. GET /api/connections (Accepted connection appears in User A & User B lists with status 'accepted')
    const t7A = await makeRequest('GET', '/api/connections', null, tokenA);
    const isAcceptedA = t7A.body.connections && t7A.body.connections.some(c => c.id === connABId && c.status === 'accepted');
    assert(t7A.status === 200 && isAcceptedA, 'Accepted connection appears in User A connection list with status accepted');

    // 8. User A sends request to User C; User C rejects request
    const t8Req = await makeRequest('POST', `/api/connections/${userCId}`, null, tokenA);
    const connACId = t8Req.body.connection ? t8Req.body.connection.id : null;
    const t8Reject = await makeRequest('PATCH', `/api/connections/${connACId}/reject`, null, tokenC);
    assert(t8Reject.status === 200, 'PATCH /api/connections/:id/reject rejects request (200 OK)');

    // 9. PATCH /api/connections/:id/accept (Unauthorized user User C cannot accept request connABId)
    const t9 = await makeRequest('PATCH', `/api/connections/${connABId}/accept`, null, tokenC);
    assert(t9.status === 403 || t9.status === 400, 'PATCH /api/connections/:id/accept by unauthorized user returns 403/400');

    // 10. POST /api/connections/999999 (Invalid target student ID)
    const t10 = await makeRequest('POST', '/api/connections/999999', null, tokenA);
    assert(t10.status === 404, 'POST /api/connections/999999 returns 404 Not Found');

    // 11. PATCH /api/connections/999999/accept (Invalid connection ID)
    const t11 = await makeRequest('PATCH', '/api/connections/999999/accept', null, tokenA);
    assert(t11.status === 404, 'PATCH /api/connections/999999/accept returns 404 Not Found');

    // 12. POST /api/messages (Accepted connection User A to User B allows messaging)
    const t12 = await makeRequest('POST', '/api/messages', { receiver_id: userBId, message: 'Messaging unlocked after acceptance!' }, tokenA);
    assert(t12.status === 201, 'Accepted connection allows messaging (201 Created)');

    // 13. POST /api/messages (Unconnected / Rejected User A to User C messaging attempt returns 403)
    const t13 = await makeRequest('POST', '/api/messages', { receiver_id: userCId, message: 'Unconnected message attempt' }, tokenA);
    assert(t13.status === 403, 'Unconnected / Rejected users messaging attempt returns 403 Forbidden');

    console.log(`\n=== TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runConnectionsTests();
