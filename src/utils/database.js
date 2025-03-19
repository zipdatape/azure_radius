import mysql from "mysql2/promise"

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

export async function query(sql, params) {
  const [results] = await pool.execute(sql, params)
  return results
}

export async function initDatabase() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS allowed_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userPrincipalName VARCHAR(255) NOT NULL UNIQUE,
        displayName VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Error initializing database:", error)
  }
}


