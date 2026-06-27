/**
 * Smoke-test script for POST /auth/onboard.
 * Creates a dummy passport image in memory and calls the endpoint.
 */
const http = require('node:http');
const crypto = require('node:crypto');

const BOUNDARY = '----FormBoundary' + crypto.randomUUID().replace(/-/g, '');
const uniqueEmail = `onboard-${Date.now()}@smoketest.com`;

// Build multipart body
function buildMultipart(fields, file) {
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${BOUNDARY}\r\n` +
      `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
      `${value}\r\n`
    );
  }

  // File part
  parts.push(
    `--${BOUNDARY}\r\n` +
    `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n` +
    `Content-Type: ${file.contentType}\r\n\r\n`
  );

  const header = Buffer.from(parts.join(''));
  const footer = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);

  return Buffer.concat([header, file.buffer, footer]);
}

// Create a tiny valid JPEG (smallest possible — 2x1 px)
const fakeJpeg = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
]);

const body = buildMultipart(
  {
    email: uniqueEmail,
    password: 'SecurePass123!',
    fullName: 'Onboard Test Customer',
  },
  {
    fieldName: 'passport',
    fileName: 'passport.jpg',
    contentType: 'image/jpeg',
    buffer: fakeJpeg,
  }
);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/auth/onboard',
  method: 'POST',
  headers: {
    'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
    'Content-Length': body.length,
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log(`STATUS: ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      console.log(JSON.stringify(parsed, null, 2));

      // Verify key assertions
      const checks = [
        ['User role is CUSTOMER', parsed.user?.role === 'CUSTOMER'],
        ['Password is NOT in response', !parsed.user?.password],
        ['Application stage is SALES_POOL', parsed.application?.currentStage === 'SALES_POOL'],
        ['Document fileType is PASSPORT', parsed.document?.fileType === 'PASSPORT'],
        ['Document isApproved is false', parsed.document?.isApproved === false],
        ['Document ocrStatus is PENDING', parsed.document?.ocrStatus === 'PENDING'],
      ];

      console.log('\n--- ASSERTIONS ---');
      let allPassed = true;
      for (const [label, passed] of checks) {
        console.log(`${passed ? '✅' : '❌'} ${label}`);
        if (!passed) allPassed = false;
      }
      console.log(allPassed ? '\n🎉 ALL CHECKS PASSED' : '\n💥 SOME CHECKS FAILED');
      process.exit(allPassed ? 0 : 1);
    } catch {
      console.log('Raw response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
