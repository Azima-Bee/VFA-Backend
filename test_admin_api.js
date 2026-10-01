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

async function runAdminTests() {
  console.log('=== STARTING ADMIN API E2E VERIFICATION TEST SUITE ===\n');
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
    const studentEmail = `student_admin_test_${timestamp}@college.edu`;
    const adminEmail = `admin_test_${timestamp}@flatmate.demo`;
    const password = 'Password@123';

    // 1. Auth Setup: Register Student + Login Admin
    const regStudent = await makeRequest('POST', '/api/auth/register', { full_name: 'Regular Student', email: studentEmail, password });
    const loginStudent = await makeRequest('POST', '/api/auth/login', { email: studentEmail, password });
    const loginAdmin = await makeRequest('POST', '/api/auth/login', { email: adminEmail, password: 'admin123' });

    const studentId = regStudent.body.user ? regStudent.body.user.id : null;
    const studentToken = loginStudent.body.token;
    const adminToken = loginAdmin.body.token;
    const adminId = loginAdmin.body.user ? loginAdmin.body.user.id : null;

    assert(!!studentToken && !!adminToken, 'Admin Login & Student Setup successful');

    // 2. Student cannot access admin stats API (403 Forbidden)
    const t2 = await makeRequest('GET', '/api/admin/stats', null, studentToken);
    assert(t2.status === 403, 'Student cannot access admin stats API (403 Forbidden)');

    // 3. Admin can access dashboard stats (200 OK)
    const t3 = await makeRequest('GET', '/api/admin/stats', null, adminToken);
    assert(t3.status === 200 && typeof t3.body.stats === 'object' && t3.body.stats.totalStudents >= 1, 'Admin can access dashboard stats (200 OK with real metric counts)');

    // 4. Admin can view all users list (200 OK)
    const t4 = await makeRequest('GET', '/api/admin/users', null, adminToken);
    assert(t4.status === 200 && Array.isArray(t4.body.users) && t4.body.users.some(u => u.email === studentEmail), 'Admin can view all users list');

    // 5. Student submits verification, Admin sees it in verifications queue
    const t5Submit = await makeRequest('POST', '/api/verification', {
      document_type: 'student_id',
      document_url: 'https://example.com/docs/admin_test_id.pdf'
    }, studentToken);
    const verifId = t5Submit.body.verification ? t5Submit.body.verification.id : null;

    const t5Queue = await makeRequest('GET', '/api/admin/verifications', null, adminToken);
    const inQueue = t5Queue.body.verifications && t5Queue.body.verifications.some(v => v.id === String(verifId));
    assert(t5Queue.status === 200 && inQueue, 'Admin can view pending verifications queue');

    // 6. Admin approves verification
    const t6Approve = await makeRequest('PATCH', `/api/verification/${verifId}/status`, { status: 'verified' }, adminToken);
    assert(t6Approve.status === 200 && t6Approve.body.verification.status === 'verified', 'Admin approves verification request');

    // 7. Approved status persists
    const t7Persist = await makeRequest('GET', `/api/verification/${studentId}`, null, adminToken);
    assert(t7Persist.status === 200 && t7Persist.body.verification.status === 'verified', 'Approved status persists in database');

    // 8. Admin suspends student account
    const t8Suspend = await makeRequest('PATCH', `/api/admin/users/${studentId}/status`, { status: 'suspended' }, adminToken);
    assert(t8Suspend.status === 200 && t8Suspend.body.user.account_status === 'suspended', 'Admin can suspend student account');

    // 9. Suspended user login is rejected (403 Forbidden)
    const t9LoginSuspended = await makeRequest('POST', '/api/auth/login', { email: studentEmail, password });
    assert(t9LoginSuspended.status === 403, 'Suspended user login is rejected (403 Forbidden)');

    // 10. Suspended user token is rejected by protected operations (403 Forbidden)
    const t10OpSuspended = await makeRequest('GET', '/api/auth/me', null, studentToken);
    assert(t10OpSuspended.status === 403, 'Suspended user protected operations are rejected (403 Forbidden)');

    // 11. Admin reactivates student account
    const t11Reactivate = await makeRequest('PATCH', `/api/admin/users/${studentId}/status`, { status: 'active' }, adminToken);
    assert(t11Reactivate.status === 200 && t11Reactivate.body.user.account_status === 'active', 'Admin can reactivate suspended account');

    // 12. Reactivated student can login again (200 OK)
    const t12LoginActive = await makeRequest('POST', '/api/auth/login', { email: studentEmail, password });
    const freshStudentToken = t12LoginActive.body.token;
    assert(t12LoginActive.status === 200 && !!freshStudentToken, 'Reactivated user can log in and retrieve fresh JWT');

    // 13. Student creates listing; Admin manages listing
    const t13CreateListing = await makeRequest('POST', '/api/listings', {
      title: 'Admin Moderation Test Flat',
      property_type: 'flat',
      city: 'Indore',
      address: 'Vijay Nagar',
      monthly_rent: 12000
    }, freshStudentToken);
    const listingId = t13CreateListing.body.listing ? t13CreateListing.body.listing.id : null;

    // 14. Admin views all listings
    const t14Listings = await makeRequest('GET', '/api/admin/listings', null, adminToken);
    const foundListing = t14Listings.body.listings && t14Listings.body.listings.some(l => l.id === String(listingId));
    assert(t14Listings.status === 200 && foundListing, 'Admin can view all listings including newly created ones');

    // 15. Admin updates listing status (inactive)
    const t15Update = await makeRequest('PATCH', `/api/admin/listings/${listingId}/status`, { status: 'inactive' }, adminToken);
    assert(t15Update.status === 200 && t15Update.body.status === 'inactive', 'Admin can update listing status');

    // 16. Admin deletes inappropriate listing
    const t16Delete = await makeRequest('DELETE', `/api/admin/listings/${listingId}`, null, adminToken);
    assert(t16Delete.status === 200, 'Admin can delete inappropriate listing');

    // 17. Admin cannot suspend self
    const t17Self = await makeRequest('PATCH', `/api/admin/users/${adminId}/status`, { status: 'suspended' }, adminToken);
    assert(t17Self.status === 400, 'Admin cannot accidentally suspend their own account (400 Bad Request)');

    console.log(`\n=== ADMIN TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runAdminTests();
