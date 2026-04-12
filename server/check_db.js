const mysql = require('mysql2/promise');

async function check() {
  const connection = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'fitflow_caragua'
  });
  
  try {
    const [rows] = await connection.query('SHOW TABLES');
    console.log(rows);
    const [cols] = await connection.query('DESCRIBE exercicios');
    console.log(cols);
  } catch(e) {
    console.error(e);
  } finally {
    await connection.end();
  }
}
check();
