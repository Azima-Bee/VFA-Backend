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

async function runMessagingTests() {
  console.log('=== STARTING 12L-D MESSAGING API E2E VERIFICATION TEST SUITE ===\n');
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
    const userAEmail = `user_a_${timestamp}@college.edu`;
    const userBEmail = `user_b_${timestamp}@college.edu`;
    const userCEmail = `user_c_${timestamp}@college.edu`;

    // 1. Setup Auth: Register User A, User B, User C
    const regA = await makeRequest('POST', '/api/auth/register', { full_name: 'Student A', email: userAEmail, password: 'password123' });
    const regB = await makeRequest('POST', '/api/auth/register', { full_name: 'Student B', email: userBEmail, password: 'password123' });
    const regC = await makeRequest('POST', '/api/auth/register', { full_name: 'Student C', email: userCEmail, password: 'password123' });

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

    // 2. Setup Connection: Send request from User A to User B, then Accept request as User B
    const connReq = await makeRequest('POST', `/api/connections/${userBId}`, null, tokenA);
    const connId = connReq.body.connection ? connReq.body.connection.id : null;
    let acceptRes;
    if (connId) {
      acceptRes = await makeRequest('PATCH', `/api/connections/${connId}/accept`, null, tokenB);
    }
    assert(acceptRes && acceptRes.status === 200, 'Connection Setup (Accepted connection between User A & User B)');

    // 3. GET /api/messages (Conversations list initially)
    const t3 = await makeRequest('GET', '/api/messages', null, tokenA);
    assert(t3.status === 200 && Array.isArray(t3.body.conversations), 'GET /api/messages returns 200 OK and conversations array');

    // 4. POST /api/messages (Send valid message from User A to User B)
    const sendPayload = { receiver_id: userBId, message: 'Hello Student B! Is the flatmate slot available?' };
    const t4 = await makeRequest('POST', '/api/messages', sendPayload, tokenA);
    assert(t4.status === 201 && t4.body.data && t4.body.data.id > 0, 'POST /api/messages sends valid message (201 Created)');
    const sentMsgId = t4.body.data ? t4.body.data.id : null;

    // 5. GET /api/messages/:userId (Fetch conversation history between User A and User B)
    const t5 = await makeRequest('GET', `/api/messages/${userBId}`, null, tokenA);
    assert(t5.status === 200 && Array.isArray(t5.body.messages) && t5.body.messages.length >= 1, `GET /api/messages/${userBId} returns 200 OK and messages history`);

    // 6. PATCH /api/messages/:id/read (Mark message as read by receiver User B)
    const t6 = await makeRequest('PATCH', `/api/messages/${sentMsgId}/read`, null, tokenB);
    assert(t6.status === 200, 'PATCH /api/messages/:id/read marks message as read by receiver (200 OK)');

    // 7. POST /api/messages (Empty message text validation)
    const t7 = await makeRequest('POST', '/api/messages', { receiver_id: userBId, message: '   ' }, tokenA);
    assert(t7.status === 400, 'POST /api/messages empty text returns 400 Bad Request');

    // 8. POST /api/messages (Self-messaging validation)
    const t8 = await makeRequest('POST', '/api/messages', { receiver_id: userAId, message: 'Self message' }, tokenA);
    assert(t8.status === 400, 'POST /api/messages to self returns 400 Bad Request');

    // 9. POST /api/messages (Messaging unconnected user User C)
    const t9 = await makeRequest('POST', '/api/messages', { receiver_id: userCId, message: 'Unconnected message' }, tokenA);
    assert(t9.status === 403, 'POST /api/messages to unconnected user returns 403 Forbidden');

    // 10. GET /api/messages/:userId (Get conversation with unconnected user User C)
    const t10 = await makeRequest('GET', `/api/messages/${userCId}`, null, tokenA);
    assert(t10.status === 403, 'GET /api/messages/:userId for unconnected user returns 403 Forbidden');

    // 11. GET /api/messages/:userId (Non-existent partner ID)
    const t11 = await makeRequest('GET', '/api/messages/999999', null, tokenA);
    assert(t11.status === 404, 'GET /api/messages/999999 returns 404 Not Found');

    // 12. GET /api/messages (Unauthenticated request without token)
    const t12 = await makeRequest('GET', '/api/messages', null, null);
    assert(t12.status === 401, 'GET /api/messages without JWT token returns 401 Unauthorized');

    console.log(`\n=== TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runMessagingTests();
