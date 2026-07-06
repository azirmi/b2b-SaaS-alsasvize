/**
 * Smoke-test script for POST /auth/onboard.
 * Creates a dummy passport image in memory and calls the endpoint.
 */
const http = require('node:http');
const crypto = require('node:crypto');

const BOUNDARY = '----FormBoundary' + crypto.randomUUID().replace(/-/g, '');
const uniqueEmail = `onboard-${Date.now()}@smoketest.com`;

// Build multipart body with any number of file parts.
function buildMultipart(fields, files) {
  const chunks = [];

  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="${name}"\r\n\r\n` +
        `${value}\r\n`
      )
    );
  }

  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.fileName}"\r\n` +
        `Content-Type: ${file.contentType}\r\n\r\n`
      )
    );
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return Buffer.concat(chunks);
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
    phone: '+90 555 123 45 67',
    targetCountry: 'Germany',
    hasAcceptedKVKK: 'true',
    hasAcceptedTerms: 'true',
  },
  [
    {
      fieldName: 'passports',
      fileName: 'passport-applicant.jpg',
      contentType: 'image/jpeg',
      buffer: fakeJpeg,
    },
    {
      fieldName: 'passports',
      fileName: 'passport-family.jpg',
      contentType: 'image/jpeg',
      buffer: fakeJpeg,
    },
  ]
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
      const documents = parsed.documents ?? [];
      const firstDoc = documents[0];
      const checks = [
        ['User role is CUSTOMER', parsed.user?.role === 'CUSTOMER'],
        ['Password is NOT in response', !parsed.user?.password],
        ['Application stage is SALES_POOL', parsed.application?.currentStage === 'SALES_POOL'],
        ['Two passport documents returned', documents.length === 2],
        ['Document fileType is PASSPORT', firstDoc?.fileType === 'PASSPORT'],
        ['Document isApproved is false', firstDoc?.isApproved === false],
        ['Document ocrStatus is PENDING', firstDoc?.ocrStatus === 'PENDING'],
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
