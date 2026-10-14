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
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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

async function runNotificationsTests() {
  console.log('=== STARTING NOTIFICATIONS API E2E TEST SUITE ===\n');
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
    const emailA = `notif_a_${timestamp}@college.edu`;
    const emailB = `notif_b_${timestamp}@college.edu`;

    // 1. Setup Test User A
    const regA = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Notif Student A',
      email: emailA,
      password: 'Password@123',
    });
    assert(regA.status === 201 && regA.body.user, 'Register Test User A');
    const userAId = regA.body.user.id;

    const loginA = await makeRequest('POST', '/api/auth/login', {
      email: emailA,
      password: 'Password@123',
    });
    assert(loginA.status === 200 && loginA.body.token, 'Login Test User A');
    const tokenA = loginA.body.token;

    // 2. Setup Test User B
    const regB = await makeRequest('POST', '/api/auth/register', {
      full_name: 'Notif Student B',
      email: emailB,
      password: 'Password@123',
    });
    assert(regB.status === 201 && regB.body.user, 'Register Test User B');
    const userBId = regB.body.user.id;

    const loginB = await makeRequest('POST', '/api/auth/login', {
      email: emailB,
      password: 'Password@123',
    });
    assert(loginB.status === 200 && loginB.body.token, 'Login Test User B');
    const tokenB = loginB.body.token;

    // 3. GET /api/notifications (initial empty state for User A)
    const notifAInit = await makeRequest('GET', '/api/notifications', null, tokenA);
    assert(
      notifAInit.status === 200 && Array.isArray(notifAInit.body.notifications),
      'GET /api/notifications returns 200 OK and notification array'
    );

    // 4. Trigger connection request from User A to User B
    const connReq = await makeRequest('POST', `/api/connections/${userBId}`, null, tokenA);
    assert(connReq.status === 201, 'User A sends connection request to User B');
    const connId = connReq.body.connection ? connReq.body.connection.id : null;

    // 5. Verify User B receives Connection Request notification
    const notifBConn = await makeRequest('GET', '/api/notifications', null, tokenB);
    assert(
      notifBConn.status === 200 &&
        notifBConn.body.notifications.some((n) => n.type === 'connection_request'),
      'User B receives "connection_request" notification'
    );
    const notifBReq = notifBConn.body.notifications.find((n) => n.type === 'connection_request');

    // 6. User B accepts connection request
    const connAccept = await makeRequest('PATCH', `/api/connections/${connId}/accept`, null, tokenB);
    assert(connAccept.status === 200, 'User B accepts connection request');

    // 7. Verify User A receives Connection Accept notification
    const notifAAccept = await makeRequest('GET', '/api/notifications', null, tokenA);
    assert(
      notifAAccept.status === 200 &&
        notifAAccept.body.notifications.some((n) => n.type === 'connection_accept'),
      'User A receives "connection_accept" notification'
    );

    // 8. User A sends message to User B
    const msgSend = await makeRequest(
      'POST',
      '/api/messages',
      { receiver_id: userBId, message: 'Hello for notifications test!' },
      tokenA
    );
    assert(msgSend.status === 201, 'User A sends message to User B');

    // 9. Verify User B receives Message notification
    const notifBMsg = await makeRequest('GET', '/api/notifications', null, tokenB);
    assert(
      notifBMsg.status === 200 &&
        notifBMsg.body.notifications.some((n) => n.type === 'message'),
      'User B receives "message" notification'
    );

    // 10. Mark notification as read (User B marks connection request notification read)
    if (notifBReq) {
      const markRead = await makeRequest(
        'PATCH',
        `/api/notifications/${notifBReq.id}/read`,
        null,
        tokenB
      );
      assert(markRead.status === 200, 'PATCH /api/notifications/:id/read marks notification as read');
    } else {
      assert(false, 'PATCH /api/notifications/:id/read (Notification not found)');
    }

    // 11. Unauthorized mark read (User A tries to mark User B\'s notification as read)
    if (notifBReq) {
      const markReadUnauth = await makeRequest(
        'PATCH',
        `/api/notifications/${notifBReq.id}/read`,
        null,
        tokenA
      );
      assert(
        markReadUnauth.status === 403,
        'PATCH /api/notifications/:id/read returns 403 Forbidden for unauthorized user'
      );
    }

    // 12. Delete notification (User B deletes notification)
    if (notifBReq) {
      const delNotif = await makeRequest('DELETE', `/api/notifications/${notifBReq.id}`, null, tokenB);
      assert(delNotif.status === 200, 'DELETE /api/notifications/:id deletes notification');
    }

    // 13. Request without authentication token
    const unauthReq = await makeRequest('GET', '/api/notifications');
    assert(unauthReq.status === 401, 'GET /api/notifications without token returns 401 Unauthorized');

    // 14. Invalid notification ID
    const invalidIdReq = await makeRequest('PATCH', '/api/notifications/999999/read', null, tokenA);
    assert(invalidIdReq.status === 404, 'PATCH /api/notifications/999999/read returns 404 Not Found');

    console.log(`\n=== NOTIFICATIONS TEST SUITE COMPLETE: ${passCount}/${testCount} PASSED ===`);
  } catch (err) {
    console.error('Notifications test execution error:', err);
  }
}

runNotificationsTests();
