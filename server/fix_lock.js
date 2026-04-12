const mysql = require('mysql2/promise');

async function fix() {
  const connection = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'fitflow_caragua'
  });
  const [rows] = await connection.query('SHOW FULL PROCESSLIST');
  
  for(let row of rows) {
    if(row.Command === 'Query' && row.Info && row.Info.includes('exercicios') && row.Id !== connection.threadId) {
      console.log('Killing query ID', row.Id);
      await connection.query(`KILL ${row.Id}`);
    }
    // and metallic locks
    if(row.State && row.State.includes('Waiting for table metadata lock')) {
        console.log('Killing lock ID', row.Id);
        await connection.query(`KILL ${row.Id}`);
    }
  }
  const [rows2] = await connection.query('SHOW FULL PROCESSLIST');
  console.log(rows2);
  await connection.end();
}
fix();
