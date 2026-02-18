
import db from '../config/database';

export interface Payment {
  id: number;
  user_id: number;
  preference_id: string;
  mp_payment_id: string | null;
  status: string;
  plan: string;
  amount: number;
  currency: string;
  subscription_start: string | null;
  subscription_end: string | null;
  created_at: string;
  updated_at: string;
}

export class PaymentModel {
  static async createTable(): Promise<void> {
    const isPg = (db as any).pool !== undefined;
    const AUTO_INC = isPg ? 'SERIAL' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

    await db.exec(`
      CREATE TABLE IF NOT EXISTS payments (
        id ${AUTO_INC},
        user_id INTEGER NOT NULL,
        preference_id TEXT NOT NULL,
        mp_payment_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        plan TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'COP',
        subscription_start TEXT,
        subscription_end TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE${isPg ? ', PRIMARY KEY (id)' : ''}
      );
    `);
  }

  static async create(
    userId: number,
    preferenceId: string,
    plan: string,
    amount: number,
    currency: string = 'COP'
  ): Promise<Payment> {
    const now = new Date().toISOString();
    const result = await db.run(
      `INSERT INTO payments (user_id, preference_id, plan, amount, currency, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      [userId, preferenceId, plan, amount, currency, now, now]
    );
    return {
      id: Number(result.lastInsertId),
      user_id: userId,
      preference_id: preferenceId,
      mp_payment_id: null,
      status: 'pending',
      plan,
      amount,
      currency,
      subscription_start: null,
      subscription_end: null,
      created_at: now,
      updated_at: now,
    };
  }

  static async findByPreferenceId(preferenceId: string): Promise<Payment | undefined> {
    return db.get<Payment>('SELECT * FROM payments WHERE preference_id = ?', [preferenceId]);
  }

  static async findByMpPaymentId(mpPaymentId: string): Promise<Payment | undefined> {
    return db.get<Payment>('SELECT * FROM payments WHERE mp_payment_id = ?', [mpPaymentId]);
  }

  static async findByUserId(userId: number): Promise<Payment[]> {
    const result = await db.query<Payment>(
      'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  static async getActiveSubscription(userId: number): Promise<Payment | undefined> {
    const now = new Date().toISOString();
    return db.get<Payment>(
      `SELECT * FROM payments
       WHERE user_id = ? AND status = 'approved'
         AND subscription_end IS NOT NULL AND subscription_end > ?
       ORDER BY subscription_end DESC LIMIT 1`,
      [userId, now]
    );
  }

  /** Find all subscriptions that have expired (subscription_end <= now) and are still 'approved' */
  static async getExpiredSubscriptions(): Promise<Payment[]> {
    const now = new Date().toISOString();
    const result = await db.query<Payment>(
      `SELECT * FROM payments
       WHERE status = 'approved'
         AND subscription_end IS NOT NULL
         AND subscription_end <= ?`,
      [now]
    );
    return result.rows;
  }

  /** Find subscriptions expiring within the next N days */
  static async getExpiringSubscriptions(withinDays: number): Promise<Payment[]> {
    const now = new Date();
    const future = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.query<Payment>(
      `SELECT * FROM payments
       WHERE status = 'approved'
         AND subscription_end IS NOT NULL
         AND subscription_end > ?
         AND subscription_end <= ?`,
      [now.toISOString(), future]
    );
    return result.rows;
  }

  /** Set subscription dates when payment is approved */
  static async setSubscriptionDates(
    paymentId: number,
    start: string,
    end: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.run(
      'UPDATE payments SET subscription_start = ?, subscription_end = ?, updated_at = ? WHERE id = ?',
      [start, end, now, paymentId]
    );
  }

  /** Mark expired payment as expired */
  static async markExpired(paymentId: number): Promise<void> {
    const now = new Date().toISOString();
    await db.run(
      "UPDATE payments SET status = 'expired', updated_at = ? WHERE id = ?",
      [now, paymentId]
    );
  }

  static async updateStatus(
    preferenceId: string,
    status: string,
    mpPaymentId?: string
  ): Promise<void> {
    const now = new Date().toISOString();
    if (mpPaymentId) {
      await db.run(
        'UPDATE payments SET status = ?, mp_payment_id = ?, updated_at = ? WHERE preference_id = ?',
        [status, mpPaymentId, now, preferenceId]
      );
    } else {
      await db.run(
        'UPDATE payments SET status = ?, updated_at = ? WHERE preference_id = ?',
        [status, now, preferenceId]
      );
    }
  }

  static async updateStatusByMpPaymentId(
    mpPaymentId: string,
    status: string
  ): Promise<void> {
    const now = new Date().toISOString();
    await db.run(
      'UPDATE payments SET status = ?, updated_at = ? WHERE mp_payment_id = ?',
      [status, now, mpPaymentId]
    );
  }
}
