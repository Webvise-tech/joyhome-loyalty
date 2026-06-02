// One-time script to grant super_admin to a Firebase user.
// Usage:
//   cd scripts
//   npm install firebase-admin
//   node set-super-admin.js <user-uid>

const admin = require('firebase-admin')
const path = require('path')

const serviceAccount = require(path.resolve(__dirname, '../backend/firebase-service-account.json'))
const uid = process.argv[2]

if (!uid) {
  console.error('Usage: node set-super-admin.js <user-uid>')
  process.exit(1)
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })

admin.auth().setCustomUserClaims(uid, { role: 'super_admin' })
  .then(() => admin.auth().getUser(uid))
  .then((user) => {
    console.log('Success — claims now:', user.customClaims)
    console.log(`User ${user.email} is now a super_admin.`)
    process.exit(0)
  })
  .catch((err) => {
    console.error('Failed:', err.message)
    process.exit(1)
  })
