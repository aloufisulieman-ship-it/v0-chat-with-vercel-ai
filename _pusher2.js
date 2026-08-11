const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  for (let i=0;i<80;i++){
    await pool.query("UPDATE active_camera_streams SET last_seen_at=now() WHERE camera_id='cam-grid-a'");
    await new Promise(r=>setTimeout(r,400));
  }
  await pool.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
