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

async function runProfileTests() {
  console.log('=== STARTING 12L-B PROFILE API E2E TEST SUITE ===\n');
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
    const studentAEmail = `profile_a_${timestamp}@college.edu`;
    const studentBEmail = `profile_b_${timestamp}@college.edu`;
    const password = 'Password@123';

    // 1. Setup Auth
    const regA = await makeRequest('POST', '/api/auth/register', { full_name: 'Profile Student A', email: studentAEmail, password });
    const regB = await makeRequest('POST', '/api/auth/register', { full_name: 'Profile Student B', email: studentBEmail, password });

    const studentAId = regA.body.user ? regA.body.user.id : null;
    const studentBId = regB.body.user ? regB.body.user.id : null;

    const loginA = await makeRequest('POST', '/api/auth/login', { email: studentAEmail, password });
    const loginB = await makeRequest('POST', '/api/auth/login', { email: studentBEmail, password });

    const tokenA = loginA.body.token;
    const tokenB = loginB.body.token;

    assert(!!tokenA && !!tokenB, 'Auth Setup: 2 test student accounts registered & logged in');

    // 2. PUT /api/profile (Create Student Profile)
    const t2 = await makeRequest('PUT', '/api/profile', {
      college_name: 'IIT Indore',
      course: 'Computer Science & Engineering',
      year_of_study: '3rd Year',
      gender: 'male',
      age: 21,
      bio: 'Looking for a calm, studious roommate near campus.',
      city: 'Indore',
      profile_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
    }, tokenA);
    assert(t2.status === 200 || t2.status === 201, 'PUT /api/profile creates student profile (200/201 Created)');

    // 3. GET /api/profile (Get Own Profile)
    const t3 = await makeRequest('GET', '/api/profile', null, tokenA);
    assert(t3.status === 200 && t3.body.profile && t3.body.profile.college_name === 'IIT Indore', 'GET /api/profile retrieves authenticated student profile');

    // 4. PUT /api/profile (Update Existing Profile)
    const t4 = await makeRequest('PUT', '/api/profile', {
      college_name: 'IIT Indore',
      course: 'Artificial Intelligence',
      year_of_study: '4th Year',
      gender: 'male',
      age: 22,
      bio: 'Updated bio: Final year student looking for flatmate.',
      city: 'Indore'
    }, tokenA);
    assert(t4.status === 200 && t4.body.profile.course === 'Artificial Intelligence', 'PUT /api/profile updates existing profile');

    // 5. GET /api/profile/:userId (Student B views Student A's profile)
    const t5 = await makeRequest('GET', `/api/profile/${studentAId}`, null, tokenB);
    assert(t5.status === 200 && t5.body.profile && t5.body.profile.user_id === studentAId, 'GET /api/profile/:userId retrieves other student profile');

    // 6. PUT /api/profile (Invalid Gender returns 400 Bad Request)
    const t6 = await makeRequest('PUT', '/api/profile', {
      gender: 'alien'
    }, tokenA);
    assert(t6.status === 400, 'PUT /api/profile with invalid gender returns 400 Bad Request');

    // 7. PUT /api/profile (Invalid Age returns 400 Bad Request)
    const t7 = await makeRequest('PUT', '/api/profile', {
      age: 5
    }, tokenA);
    assert(t7.status === 400, 'PUT /api/profile with invalid age returns 400 Bad Request');

    // 8. GET /api/profile/:userId (Invalid User ID returns 400 Bad Request)
    const t8 = await makeRequest('GET', '/api/profile/invalid_id', null, tokenA);
    assert(t8.status === 400, 'GET /api/profile/invalid_id returns 400 Bad Request');

    // 9. GET /api/profile/999999 (Nonexistent User returns 404 Not Found)
    const t9 = await makeRequest('GET', '/api/profile/999999', null, tokenA);
    assert(t9.status === 404, 'GET /api/profile/999999 returns 404 Not Found');

    // 10. GET /api/profile without token returns 401 Unauthorized
    const t10 = await makeRequest('GET', '/api/profile', null, null);
    assert(t10.status === 401, 'GET /api/profile without token returns 401 Unauthorized');

    console.log(`\n=== PROFILE TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runProfileTests();
