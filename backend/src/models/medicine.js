const db = require('../config/db');

class Medicine {
  static async create({ user_id, name, quantity, min_stock, expiry_date }) {
    const query = `
      INSERT INTO medicines (user_id, name, quantity, min_stock, expiry_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [user_id, name, quantity, min_stock, expiry_date];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async findAllByUserId(user_id) {
    const query = 'SELECT * FROM medicines WHERE user_id = $1 ORDER BY created_at DESC';
    const { rows } = await db.query(query, [user_id]);
    return rows;
  }

  static async findByIdAndUser(id, user_id) {
    const query = 'SELECT * FROM medicines WHERE id = $1 AND user_id = $2';
    const { rows } = await db.query(query, [id, user_id]);
    return rows[0];
  }

  static async update(id, user_id, { name, quantity, min_stock, expiry_date }) {
    const query = `
      UPDATE medicines
      SET name = $1, quantity = $2, min_stock = $3, expiry_date = $4
      WHERE id = $5 AND user_id = $6
      RETURNING *
    `;
    const values = [name, quantity, min_stock, expiry_date, id, user_id];
    const { rows } = await db.query(query, values);
    return rows[0];
  }

  static async delete(id, user_id) {
    const query = 'DELETE FROM medicines WHERE id = $1 AND user_id = $2 RETURNING id';
    const { rows } = await db.query(query, [id, user_id]);
    return rows[0];
  }
}

module.exports = Medicine;
