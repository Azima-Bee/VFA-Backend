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

async function runVerificationTests() {
  console.log('=== STARTING 12L-B STUDENT ID VERIFICATION API E2E TEST SUITE ===\n');
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
    const studentAEmail = `verif_a_${timestamp}@college.edu`;
    const studentBEmail = `verif_b_${timestamp}@college.edu`;
    const adminEmail = `admin_verif_${timestamp}@flatmate.demo`;
    const password = 'Password@123';

    // 1. Setup Auth: 2 Students + 1 Admin
    const regA = await makeRequest('POST', '/api/auth/register', { full_name: 'Verif Student A', email: studentAEmail, password });
    const regB = await makeRequest('POST', '/api/auth/register', { full_name: 'Verif Student B', email: studentBEmail, password });
    const loginAdmin = await makeRequest('POST', '/api/auth/login', { email: adminEmail, password: 'admin123' });

    const studentAId = regA.body.user ? regA.body.user.id : null;
    const studentBId = regB.body.user ? regB.body.user.id : null;

    const loginA = await makeRequest('POST', '/api/auth/login', { email: studentAEmail, password });
    const loginB = await makeRequest('POST', '/api/auth/login', { email: studentBEmail, password });

    const tokenA = loginA.body.token;
    const tokenB = loginB.body.token;
    const tokenAdmin = loginAdmin.body.token;

    assert(!!tokenA && !!tokenB && !!tokenAdmin, 'Auth Setup: 2 students and 1 admin authenticated');

    // 2. POST /api/verification (Student A submits verification request)
    const t2 = await makeRequest('POST', '/api/verification', {
      document_type: 'student_id',
      document_url: 'https://example.com/docs/student_a_id.pdf',
      university_email: studentAEmail,
      student_id_number: 'STU2026Indore'
    }, tokenA);
    assert(t2.status === 201 && t2.body.verification && t2.body.verification.status === 'pending', 'POST /api/verification submits request with status pending (201 Created)');
    const verifId = t2.body.verification ? t2.body.verification.id : null;

    // 3. POST /api/verification (Duplicate pending request returns 409 Conflict)
    const t3 = await makeRequest('POST', '/api/verification', {
      document_type: 'college_id',
      document_url: 'https://example.com/docs/student_a_id_2.pdf'
    }, tokenA);
    assert(t3.status === 409, 'POST /api/verification duplicate pending returns 409 Conflict');

    // 4. GET /api/verification (Student A gets own verification record)
    const t4 = await makeRequest('GET', '/api/verification', null, tokenA);
    assert(t4.status === 200 && Array.isArray(t4.body.verifications) && t4.body.verifications.length > 0, 'GET /api/verification returns own verification records');

    // 5. GET /api/verification/:userId (Student B views Student A verification - privacy protection: no doc URL)
    const t5 = await makeRequest('GET', `/api/verification/${studentAId}`, null, tokenB);
    assert(t5.status === 200 && t5.body.verification.status === 'pending' && !t5.body.verification.document_url, 'GET /api/verification/:userId returns safe status and hides document_url');

    // 6. PATCH /api/verification/:id/status as Student (Should be rejected with 403 Forbidden)
    const t6 = await makeRequest('PATCH', `/api/verification/${verifId}/status`, { status: 'verified' }, tokenA);
    assert(t6.status === 403, 'Normal student attempting to approve verification receives 403 Forbidden');

    // 7. PATCH /api/verification/:id/status as Admin (Admin approves verification)
    const t7 = await makeRequest('PATCH', `/api/verification/${verifId}/status`, { status: 'verified' }, tokenAdmin);
    assert(t7.status === 200 && t7.body.verification.status === 'verified', 'Admin approves verification request (200 OK, status verified)');

    // 8. GET /api/verification/:userId (Student B views verified status)
    const t8 = await makeRequest('GET', `/api/verification/${studentAId}`, null, tokenB);
    assert(t8.status === 200 && t8.body.verification.status === 'verified', 'Verification status verified is publicly reflected');

    // 9. Student B submits verification; Admin rejects it
    const t9Submit = await makeRequest('POST', '/api/verification', {
      document_type: 'admission_letter',
      document_url: 'https://example.com/docs/student_b_letter.pdf'
    }, tokenB);
    const verifBId = t9Submit.body.verification ? t9Submit.body.verification.id : null;

    const t9Reject = await makeRequest('PATCH', `/api/verification/${verifBId}/status`, { status: 'rejected' }, tokenAdmin);
    assert(t9Reject.status === 200 && t9Reject.body.verification.status === 'rejected', 'Admin rejects verification request (200 OK, status rejected)');

    // 10. POST /api/verification (Invalid document type returns 400)
    const t10 = await makeRequest('POST', '/api/verification', {
      document_type: 'passport_fake',
      document_url: 'https://example.com/docs/passport.pdf'
    }, tokenA);
    assert(t10.status === 400, 'POST /api/verification with invalid document type returns 400 Bad Request');

    // 11. POST /api/verification (Invalid document URL returns 400)
    const t11 = await makeRequest('POST', '/api/verification', {
      document_type: 'college_id',
      document_url: 'ftp://not_a_valid_http_url'
    }, tokenA);
    assert(t11.status === 400, 'POST /api/verification with invalid document URL returns 400 Bad Request');

    // 12. GET /api/verification/admin (Admin views queue)
    const t12 = await makeRequest('GET', '/api/verification/admin', null, tokenAdmin);
    assert(t12.status === 200 && Array.isArray(t12.body.verifications), 'GET /api/verification/admin returns full verifications queue for admin');

    console.log(`\n=== VERIFICATION TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Test execution error:', err);
  }
}

runVerificationTests();
