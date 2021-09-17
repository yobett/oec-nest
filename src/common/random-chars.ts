import * as crypto from 'crypto';

const bytes = 3 * 4;
const count = 2;
for (let i = 0; i < count; i++) {
  console.log(crypto.randomBytes(bytes).toString('base64'));
}
