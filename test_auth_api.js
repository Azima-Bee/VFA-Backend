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

async function runAuthTests() {
  console.log('=== STARTING 12L-A AUTHENTICATION API E2E TEST SUITE ===\n');
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
    const testEmail = `auth_test_${timestamp}@college.edu`;
    const password = 'Password@123';

    // 1. POST /api/auth/register (Valid registration)
    const t1 = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Auth Test Student',
      email: testEmail,
      password: password,
      phone: '9876543210'
    });
    assert(t1.status === 201 && t1.body.user && t1.body.user.role === 'student', 'POST /api/auth/register returns 201 Created and user role student');

    // 2. POST /api/auth/register (Duplicate email returns 409 Conflict)
    const t2 = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Duplicate Student',
      email: testEmail,
      password: password
    });
    assert(t2.status === 409, 'POST /api/auth/register duplicate email returns 409 Conflict');

    // 3. POST /api/auth/register (Missing email returns 400 Bad Request)
    const t3 = await makeRequest('POST', '/api/auth/register', {
      full_name: 'No Email Student',
      password: password
    });
    assert(t3.status === 400, 'POST /api/auth/register missing email returns 400 Bad Request');

    // 4. POST /api/auth/register (Short password returns 400 Bad Request)
    const t4 = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Short Pass',
      email: `short_${timestamp}@college.edu`,
      password: '123'
    });
    assert(t4.status === 400, 'POST /api/auth/register password < 6 characters returns 400 Bad Request');

    // 5. POST /api/auth/login (Valid credentials return 200 OK and JWT)
    const t5 = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: password
    });
    const token = t5.body.token;
    assert(t5.status === 200 && !!token && t5.body.user.email === testEmail, 'POST /api/auth/login with valid credentials returns 200 OK and JWT token');

    // 6. POST /api/auth/login (Wrong password returns 401 Unauthorized)
    const t6 = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword123'
    });
    assert(t6.status === 401, 'POST /api/auth/login with wrong password returns 401 Unauthorized');

    // 7. POST /api/auth/login (Unknown email returns 401 Unauthorized)
    const t7 = await makeRequest('POST', '/api/auth/login', {
      email: `unknown_${timestamp}@college.edu`,
      password: password
    });
    assert(t7.status === 401, 'POST /api/auth/login with unknown email returns 401 Unauthorized');

    // 8. POST /api/auth/login (Missing password returns 400 Bad Request)
    const t8 = await makeRequest('POST', '/api/auth/login', {
      email: testEmail
    });
    assert(t8.status === 400, 'POST /api/auth/login missing password returns 400 Bad Request');

    // 9. GET /api/auth/me (Authenticated request returns 200 OK and user info)
    const t9 = await makeRequest('GET', '/api/auth/me', null, token);
    assert(t9.status === 200 && t9.body.user && t9.body.user.email === testEmail, 'GET /api/auth/me with valid JWT returns 200 OK and user info');

    // 10. GET /api/auth/me (Unauthenticated request returns 401 Unauthorized)
    const t10 = await makeRequest('GET', '/api/auth/me', null, null);
    assert(t10.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');

    // 11. GET /api/auth/me (Invalid token returns 401 Unauthorized)
    const t11 = await makeRequest('GET', '/api/auth/me', null, 'invalid.jwt.token');
    assert(t11.status === 401, 'GET /api/auth/me with invalid JWT returns 401 Unauthorized');

    console.log(`\n=== AUTH TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runAuthTests();
