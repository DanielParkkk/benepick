import { Pool } from 'pg';

// 커넥션 풀 — 서버리스 환경에서 재사용
let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
    });
  }
  return pool;
}

// 공지 테이블 & 관리자 테이블 & 개인화 테이블 자동 생성 (없으면)
export async function initDB() {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS notice (
        id          SERIAL PRIMARY KEY,
        title       VARCHAR(300) NOT NULL,
        content     TEXT NOT NULL,
        author_name VARCHAR(100) NOT NULL DEFAULT '관리자',
        pinned      BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_user (
        id              SERIAL PRIMARY KEY,
        username        VARCHAR(100) NOT NULL UNIQUE,
        hashed_password VARCHAR(255) NOT NULL,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_scrap (
        id         SERIAL PRIMARY KEY,
        user_id    VARCHAR(255) NOT NULL,
        policy_id  VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, policy_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_scrap_user ON user_scrap (user_id);

      CREATE TABLE IF NOT EXISTS user_recently_viewed (
        id          SERIAL PRIMARY KEY,
        user_id     VARCHAR(255) NOT NULL,
        policy_id   VARCHAR(255) NOT NULL,
        viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, policy_id)
      );
      CREATE INDEX IF NOT EXISTS idx_user_rv_user ON user_recently_viewed (user_id);
    `);
  } finally {
    client.release();
  }
}
