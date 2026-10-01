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

async function runTests() {
  console.log('=== STARTING 12L-C LISTINGS API E2E VERIFICATION TEST SUITE ===\n');
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
    // Step 0: Register & Login 2 test accounts
    const timestamp = Date.now();
    const user1Email = `owner_${timestamp}@college.edu`;
    const user2Email = `other_${timestamp}@college.edu`;

    await makeRequest('POST', '/api/auth/register', {
      full_name: 'Owner Student',
      email: user1Email,
      password: 'password123',
    });

    await makeRequest('POST', '/api/auth/register', {
      full_name: 'Other Student',
      email: user2Email,
      password: 'password123',
    });

    const login1 = await makeRequest('POST', '/api/auth/login', {
      email: user1Email,
      password: 'password123',
    });
    const token1 = login1.body.token;

    const login2 = await makeRequest('POST', '/api/auth/login', {
      email: user2Email,
      password: 'password123',
    });
    const token2 = login2.body.token;

    assert(!!token1 && !!token2, 'Authentication Setup (Registered 2 test accounts & retrieved JWTs)');

    // Create an active listing first to ensure database has a listing
    const seedListingData = {
      title: 'Initial Active 2BHK Flat',
      description: 'Fully furnished flat for college students.',
      property_type: 'flat',
      city: 'Indore',
      address: 'Vijay Nagar',
      monthly_rent: 7500,
      security_deposit: 10000,
      gender_preference: 'female',
      furnished: 'fully',
      image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    };
    await makeRequest('POST', '/api/listings', seedListingData, token1);

    // 1. GET /api/listings without params (with JWT)
    const t1 = await makeRequest('GET', '/api/listings', null, token1);
    assert(t1.status === 200 && Array.isArray(t1.body.listings), 'GET /api/listings returns 200 OK and listings array');

    // 2. GET /api/listings?city=Indore (with JWT)
    const t2 = await makeRequest('GET', '/api/listings?city=Indore', null, token1);
    assert(t2.status === 200 && Array.isArray(t2.body.listings), 'GET /api/listings?city=Indore returns 200 OK');

    // 3. GET /api/listings?property_type=flat (with JWT)
    const t3 = await makeRequest('GET', '/api/listings?property_type=flat', null, token1);
    assert(t3.status === 200 && Array.isArray(t3.body.listings), 'GET /api/listings?property_type=flat returns 200 OK');

    // 4. GET /api/listings?gender_preference=female (with JWT)
    const t4 = await makeRequest('GET', '/api/listings?gender_preference=female', null, token1);
    assert(t4.status === 200 && Array.isArray(t4.body.listings), 'GET /api/listings?gender_preference=female returns 200 OK');

    // 5. GET /api/listings?furnished=fully (with JWT)
    const t5 = await makeRequest('GET', '/api/listings?furnished=fully', null, token1);
    assert(t5.status === 200 && Array.isArray(t5.body.listings), 'GET /api/listings?furnished=fully returns 200 OK');

    // 6. GET /api/listings?min_rent=5000&max_rent=15000 (with JWT)
    const t6 = await makeRequest('GET', '/api/listings?min_rent=5000&max_rent=15000', null, token1);
    assert(t6.status === 200 && Array.isArray(t6.body.listings), 'GET /api/listings?min_rent=5000&max_rent=15000 returns 200 OK');

    // 7. Combined filter query (with JWT)
    const t7 = await makeRequest('GET', '/api/listings?city=Indore&property_type=flat&furnished=fully', null, token1);
    assert(t7.status === 200 && Array.isArray(t7.body.listings), 'Combined filter query returns 200 OK');

    // 8. POST /api/listings with valid JWT
    const newListingData = {
      title: 'E2E Test Flat 2BHK',
      description: 'Clean spacious flat for students near campus.',
      property_type: 'flat',
      city: 'Indore',
      address: 'Vijay Nagar Square',
      monthly_rent: 8500,
      security_deposit: 10000,
      gender_preference: 'any',
      furnished: 'semi',
      image_url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
    };
    const t8 = await makeRequest('POST', '/api/listings', newListingData, token1);
    assert(t8.status === 201 && t8.body.listing && t8.body.listing.id > 0, 'POST /api/listings creates new listing (201 Created)', `Status: ${t8.status}`);
    const createdListingId = t8.body.listing ? t8.body.listing.id : null;

    // 9. POST /api/listings without required fields (validation check)
    const t9 = await makeRequest('POST', '/api/listings', { title: '' }, token1);
    assert(t9.status === 400, 'POST /api/listings missing fields returns 400 Bad Request', `Status: ${t9.status}`);

    // 10. GET /api/listings/:id (valid ID, with JWT)
    const t10 = await makeRequest('GET', `/api/listings/${createdListingId}`, null, token1);
    assert(t10.status === 200 && t10.body.listing && t10.body.listing.id === createdListingId, `GET /api/listings/${createdListingId} returns 200 OK`);

    // 11. GET /api/listings/:id (non-existent ID, with JWT)
    const t11 = await makeRequest('GET', '/api/listings/999999', null, token1);
    assert(t11.status === 404, 'GET /api/listings/999999 returns 404 Not Found');

    // 12. PUT /api/listings/:id as owner
    const updatePayload = {
      title: 'Updated E2E Test Flat 2BHK',
      monthly_rent: 9000,
    };
    const t12 = await makeRequest('PUT', `/api/listings/${createdListingId}`, updatePayload, token1);
    assert(t12.status === 200 && t12.body.listing && t12.body.listing.title === 'Updated E2E Test Flat 2BHK', 'PUT /api/listings/:id as owner updates listing (200 OK)');

    // 13. PUT /api/listings/:id as non-owner (Forbidden check)
    const t13 = await makeRequest('PUT', `/api/listings/${createdListingId}`, { title: 'Hacked Title' }, token2);
    assert(t13.status === 403, 'PUT /api/listings/:id as non-owner returns 403 Forbidden');

    // 14. PUT /api/listings/:id with invalid data (validation check)
    const t14 = await makeRequest('PUT', `/api/listings/${createdListingId}`, { monthly_rent: -500 }, token1);
    assert(t14.status === 400 || t14.status === 422, 'PUT /api/listings/:id invalid data returns 400/422 Bad Request');

    // 15. DELETE /api/listings/:id as non-owner (Forbidden check)
    const t15 = await makeRequest('DELETE', `/api/listings/${createdListingId}`, null, token2);
    assert(t15.status === 403, 'DELETE /api/listings/:id as non-owner returns 403 Forbidden');

    // 16. DELETE /api/listings/:id as owner
    const t16 = await makeRequest('DELETE', `/api/listings/${createdListingId}`, null, token1);
    assert(t16.status === 200, 'DELETE /api/listings/:id as owner deletes listing (200 OK)');

    // 17. GET /api/listings/:id after deletion (with JWT)
    const t17 = await makeRequest('GET', `/api/listings/${createdListingId}`, null, token1);
    assert(t17.status === 404, 'GET /api/listings/:id after deletion returns 404 Not Found');

    // 18. GET /api/listings without JWT token (Unauthenticated check)
    const t18 = await makeRequest('GET', '/api/listings', null, null);
    assert(t18.status === 401, 'GET /api/listings without token returns 401 Unauthorized');

    console.log(`\n=== TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runTests();
