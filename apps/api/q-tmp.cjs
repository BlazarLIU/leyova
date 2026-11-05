const { Pool } = require('pg')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
async function main() {
  const u = await pool.query('SELECT id, username, role, status FROM users ORDER BY id')
  console.log('USERS:', JSON.stringify(u.rows))
  try {
    const b = await pool.query('SELECT * FROM ai_context_bindings')
    console.log('BINDINGS:', JSON.stringify(b.rows))
  } catch (e) { console.log('BINDINGS ERR:', e.message) }
  await pool.end()
}
main()