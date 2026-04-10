const db = require('../config/db');
const bcrypt = require('bcryptjs');

class User {
  static async create({ name, email, password, googleId = null }) {
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    const query = `
      INSERT INTO users (name, email, password, google_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, created_at
    `;
    const values = [name, email, hashedPassword, googleId];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const { rows } = await db.query(query, [email]);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
    const { rows } = await db.query(query, [id]);
    return rows[0];
  }
}

module.exports = User;
