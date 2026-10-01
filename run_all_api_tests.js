const { execSync } = require('child_process');

const testSuites = [
  'test_auth_api.js',
  'test_profile_api.js',
  'test_verification_api.js',
  'test_listings_api.js',
  'test_connections_api.js',
  'test_messaging_api.js',
  'test_notifications_api.js',
  'test_admin_api.js',
  'test_phase13_production_api.js'
];

console.log('================================================================');
console.log('       VFA FULL END-TO-END AUTOMATED REGRESSION TEST RUNNER     ');
console.log('================================================================\n');

let allPassed = true;
let totalPassed = 0;
let totalFailed = 0;
let totalTests = 0;

for (const suite of testSuites) {
  console.log(`\n▶ Running ${suite}...`);
  try {
    const output = execSync(`node ${suite}`, { encoding: 'utf-8', cwd: __dirname });
    console.log(output);

    const match = output.match(/(\d+)\/(\d+)\s+PASSED/i) || output.match(/Passed:\s+(\d+)\s*\nFailed:\s+(\d+)\s*\nTotal:\s+(\d+)/i);
    if (match) {
      if (match[3]) {
        const pass = parseInt(match[1], 10);
        const fail = parseInt(match[2], 10);
        const tot = parseInt(match[3], 10);
        totalPassed += pass;
        totalTests += tot;
        totalFailed += fail;
      } else {
        const pass = parseInt(match[1], 10);
        const tot = parseInt(match[2], 10);
        totalPassed += pass;
        totalTests += tot;
        totalFailed += (tot - pass);
      }
    }
  } catch (err) {
    allPassed = false;
    console.error(`❌ Suite ${suite} failed with error:`, err.stdout || err.message);
  }
}

console.log('\n================================================================');
console.log('                     FINAL REGRESSION SUMMARY                   ');
console.log('================================================================');
console.log(`Passed: ${totalPassed}`);
console.log(`Failed: ${totalFailed}`);
console.log(`Total:  ${totalTests}`);
console.log(`Result: ${allPassed && totalFailed === 0 ? '✅ 100% ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
console.log('================================================================\n');

if (!allPassed || totalFailed > 0) {
  process.exit(1);
}
