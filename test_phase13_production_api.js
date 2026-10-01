const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: parsed
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runPhase13TestSuite() {
  console.log('================================================================');
  console.log('       STARTING PHASE 13 PRODUCTION READINESS TEST SUITE       ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const timestamp = Date.now();
  const studentAEmail = `studentA_${timestamp}@college.edu`;
  const studentBEmail = `studentB_${timestamp}@college.edu`;
  const studentCEmail = `studentC_${timestamp}@college.edu`;
  const adminEmail = `admin_${timestamp}@admin.org`;
  const password = 'Password@123';
  const newPassword = 'NewSecurePassword@456';

  let tokenA = '';
  let userAId = null;
  let tokenB = '';
  let userBId = null;
  let tokenC = '';
  let userCId = null;
  let adminToken = '';
  let adminId = null;
  let listingId = null;
  let connectionId = null;
  let verifAId = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Health Check Endpoints
    // -----------------------------------------------------------------
    console.log('\n--- 1. Health Check Endpoints ---');
    const healthRoot = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/health',
      method: 'GET'
    });
    assert(healthRoot.statusCode === 200 && healthRoot.data.success === true, 'GET /health returns 200 OK');

    const healthApi = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/health',
      method: 'GET'
    });
    assert(healthApi.statusCode === 200 && healthApi.data.success === true, 'GET /api/health returns 200 OK');

    // -----------------------------------------------------------------
    // TEST 2: Register Student A, Student B, Student C & Admin
    // -----------------------------------------------------------------
    console.log('\n--- 2. Account Registration ---');
    const regA = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { full_name: 'Student A Real', email: studentAEmail, password, phone: '9100000001' }
    );
    assert(regA.statusCode === 201 && regA.data.user.id, 'Register Student A (201 Created)');
    userAId = regA.data.user.id;

    const regB = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { full_name: 'Student B Real', email: studentBEmail, password, phone: '9100000002' }
    );
    assert(regB.statusCode === 201 && regB.data.user.id, 'Register Student B (201 Created)');
    userBId = regB.data.user.id;

    const regC = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { full_name: 'Student C Real', email: studentCEmail, password, phone: '9100000003' }
    );
    assert(regC.statusCode === 201 && regC.data.user.id, 'Register Student C (201 Created)');
    userCId = regC.data.user.id;

    // -----------------------------------------------------------------
    // TEST 3: Login & JWT Token Retrieval
    // -----------------------------------------------------------------
    console.log('\n--- 3. Authentication & JWT ---');
    const loginA = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentAEmail, password }
    );
    assert(loginA.statusCode === 200 && loginA.data.token, 'Login Student A (200 OK & JWT)');
    tokenA = loginA.data.token;

    const loginB = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentBEmail, password }
    );
    assert(loginB.statusCode === 200 && loginB.data.token, 'Login Student B (200 OK & JWT)');
    tokenB = loginB.data.token;

    const loginC = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentCEmail, password }
    );
    assert(loginC.statusCode === 200 && loginC.data.token, 'Login Student C (200 OK & JWT)');
    tokenC = loginC.data.token;

    const loginAdmin = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: adminEmail, password: 'admin' }
    );
    assert(loginAdmin.statusCode === 200 && loginAdmin.data.token, 'Login Admin (200 OK & JWT)');
    adminToken = loginAdmin.data.token;
    adminId = loginAdmin.data.user.id;

    // -----------------------------------------------------------------
    // TEST 4: Student Profile Creation & Privacy Audit
    // -----------------------------------------------------------------
    console.log('\n--- 4. Profile Management & Privacy ---');
    const createProfA = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/profile',
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        }
      },
      {
        college_name: 'IIT Delhi',
        course: 'Computer Science',
        year_of_study: '3rd Year',
        gender: 'male',
        age: 21,
        bio: 'Tech enthusiast looking for quiet study roommate.',
        city: 'New Delhi',
        profile_image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
      }
    );
    assert(createProfA.statusCode === 200 || createProfA.statusCode === 201, 'Create Student A Profile');

    // Public Profile Privacy Check: Student B reads Student A's profile
    const getProfAByB = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/profile/${userAId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(
      getProfAByB.statusCode === 200 &&
      getProfAByB.data.profile.college_name === 'IIT Delhi' &&
      getProfAByB.data.profile.password_hash === undefined &&
      getProfAByB.data.profile.email === undefined,
      'Public Profile does NOT leak password_hash or private email'
    );

    // -----------------------------------------------------------------
    // TEST 5: Student Verification Flow & Admin Approval
    // -----------------------------------------------------------------
    console.log('\n--- 5. Student Verification Flow ---');
    const submitVerifA = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/verification',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        }
      },
      {
        document_type: 'college_id',
        document_url: 'https://storage.vfa.edu/docs/student_id_101.jpg',
        university_email: 'aarav@iitd.ac.in',
        student_id_number: '2023CSB101'
      }
    );
    assert(submitVerifA.statusCode === 201 && submitVerifA.data.verification.status === 'pending', 'Student A Submits Verification (201 Created, pending)');
    verifAId = submitVerifA.data.verification.id;

    // Public verification privacy check: document_url must be hidden
    const getPublicVerifA = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/verification/${userAId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(
      getPublicVerifA.statusCode === 200 &&
      getPublicVerifA.data.verification.status === 'pending' &&
      getPublicVerifA.data.verification.document_url === undefined,
      'Public verification endpoint protects Student ID document URL'
    );

    // Admin approves verification
    const approveVerif = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/verification/${verifAId}/status`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      { status: 'verified' }
    );
    assert(approveVerif.statusCode === 200 && approveVerif.data.verification.status === 'verified', 'Admin Approves Student A Verification');

    // -----------------------------------------------------------------
    // TEST 6: Listing Creation & Connection Flow
    // -----------------------------------------------------------------
    console.log('\n--- 6. Listings & Connections ---');
    const createListing = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/listings',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`
        }
      },
      {
        title: 'Spacious 2 BHK Private Room near IIT Gate',
        description: 'Furnished room with study desk, AC, and Wi-Fi.',
        property_type: 'room',
        city: 'New Delhi',
        address: 'Hauz Khas Village',
        monthly_rent: 9500,
        security_deposit: 19000,
        gender_preference: 'male',
        furnished: 'fully',
        image_url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf'
      }
    );
    assert(createListing.statusCode === 201 && createListing.data.listing.id, 'Student A Creates Listing (201 Created)');
    listingId = createListing.data.listing.id;

    // Student B sends connection request to Student A
    const sendConn = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/connections/${userAId}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` }
      }
    );
    assert(sendConn.statusCode === 201, 'Student B Sends Connection Request to Student A');
    connectionId = sendConn.data.connection.id;

    // Student A accepts connection request
    const acceptConn = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/connections/${connectionId}/accept`,
        method: 'PATCH',
        headers: { Authorization: `Bearer ${tokenA}` }
      }
    );
    assert(acceptConn.statusCode === 200, 'Student A Accepts Connection Request');

    // -----------------------------------------------------------------
    // TEST 7: Messaging between Connected Students
    // -----------------------------------------------------------------
    console.log('\n--- 7. Messaging & Chat ---');
    const sendMsg = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenB}`
        }
      },
      { receiver_id: userAId, message: 'Hi Aarav, is the room still available for October?' }
    );
    assert(sendMsg.statusCode === 201 && sendMsg.data.data.id, 'Student B Sends Message to Student A (201 Created)');

    const getChat = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/messages/${userBId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(getChat.statusCode === 200 && getChat.data.messages.length > 0, 'Student A Retrieves Chat History');

    // -----------------------------------------------------------------
    // TEST 8: Negative Security Checks
    // -----------------------------------------------------------------
    console.log('\n--- 8. Negative Security Checks ---');
    // Student B attempts to access Admin Stats API
    const studentCallAdmin = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/admin/stats',
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(studentCallAdmin.statusCode === 403, 'Student calling Admin API returns 403 Forbidden');

    // Student B attempts to delete Student A's listing
    const studentDeleteOtherListing = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: `/api/listings/${listingId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(studentDeleteOtherListing.statusCode === 403, 'Student deleting another user\'s listing returns 403 Forbidden');

    // Student C attempts to message Student A without connection
    const unconnectedMsg = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenC}`
        }
      },
      { receiver_id: userAId, message: 'Unconnected message attempt' }
    );
    assert(unconnectedMsg.statusCode === 403, 'Unconnected user messaging attempt returns 403 Forbidden');

    // -----------------------------------------------------------------
    // TEST 9: Reporting System (User & Listing)
    // -----------------------------------------------------------------
    console.log('\n--- 9. Reporting System ---');
    const reportUser = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/reports',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenC}`
        }
      },
      { reported_user_id: userBId, reason: 'Suspicious profile activity', description: 'Testing user report flow.' }
    );
    assert(reportUser.statusCode === 201 && reportUser.data.report.id, 'Student C Reports Student B (201 Created)');
    const reportId = reportUser.data.report.id;

    const reportListing = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/reports',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenC}`
        }
      },
      { listing_id: listingId, reason: 'Duplicate listing', description: 'Testing listing report flow.' }
    );
    assert(reportListing.statusCode === 201 && reportListing.data.report.id, 'Student C Reports Listing (201 Created)');

    // Admin views all reports
    const adminReports = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/reports/admin',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminReports.statusCode === 200 && adminReports.data.reports.length >= 2, 'Admin Views Reports Queue');

    // Admin resolves report
    const resolveReport = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/reports/${reportId}/status`,
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      },
      { status: 'resolved' }
    );
    assert(resolveReport.statusCode === 200 && resolveReport.data.report.status === 'resolved', 'Admin Resolves Report (200 OK)');

    // -----------------------------------------------------------------
    // TEST 10: Direct User Blocking & Prevention
    // -----------------------------------------------------------------
    console.log('\n--- 10. Direct User Blocking ---');
    const blockUser = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/connections/block/${userCId}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }
    );
    assert(blockUser.statusCode === 200, 'Student A Directly Blocks Student C');

    // Blocked student C tries to send connection request to A
    const blockedConnAttempt = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/connections/${userAId}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenC}` }
      }
    );
    assert(blockedConnAttempt.statusCode === 409, 'Blocked student cannot send connection request (409 Conflict)');

    // Student A unblocks Student C
    const unblockUser = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/connections/unblock/${userCId}`,
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` }
      }
    );
    assert(unblockUser.statusCode === 200, 'Student A Directly Unblocks Student C');

    // -----------------------------------------------------------------
    // TEST 11: Account Management (Change Password, Forgot Password, Delete Account)
    // -----------------------------------------------------------------
    console.log('\n--- 11. Account Management ---');
    // Change password
    const changePass = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/change-password',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenC}`
        }
      },
      { current_password: password, new_password: newPassword }
    );
    assert(changePass.statusCode === 200, 'Student C Changes Password Successfully');

    // Old password fails
    const oldLoginFail = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentCEmail, password }
    );
    assert(oldLoginFail.statusCode === 401, 'Login with old password fails (401 Unauthorized)');

    // New password succeeds
    const newLoginSuccess = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentCEmail, password: newPassword }
    );
    assert(newLoginSuccess.statusCode === 200 && newLoginSuccess.data.token, 'Login with new password succeeds (200 OK)');
    const tokenCNew = newLoginSuccess.data.token;

    // Forgot password endpoint
    const forgotPass = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/forgot-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentCEmail }
    );
    assert(forgotPass.statusCode === 200 && forgotPass.data.success === true, 'Forgot Password returns safe 200 message');

    // Delete Account
    const deleteAcc = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/auth/account',
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenCNew}` }
    });
    assert(deleteAcc.statusCode === 200, 'Student C Deletes Own Account (200 OK)');

    // Deleted user login fails
    const deletedLogin = await makeRequest(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      },
      { email: studentCEmail, password: newPassword }
    );
    assert(deletedLogin.statusCode === 401, 'Deleted user account login fails (401 Unauthorized)');

    // -----------------------------------------------------------------
    // TEST 12: Admin Audit Logs
    // -----------------------------------------------------------------
    console.log('\n--- 12. Admin Audit Trail ---');
    const auditLogs = await makeRequest({
      hostname: BASE_HOST,
      port: BASE_PORT,
      path: '/api/admin/audit-logs',
      method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(auditLogs.statusCode === 200 && Array.isArray(auditLogs.data.logs) && auditLogs.data.logs.length > 0, 'Admin Audit Logs retrieved with chronologically recorded actions');

  } catch (error) {
    console.error('Test Runner Exception:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log('                 PHASE 13 TEST SUITE SUMMARY                    ');
  console.log('================================================================');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);
  console.log(`Result: ${failed === 0 ? '✅ 100% PRODUCTION READY' : '❌ TESTS FAILED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase13TestSuite();
