import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import argon2 from "argon2";
import pg from "pg";
import crypto from "crypto";

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL chưa được cấu hình trong .env");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu. Vui lòng thử lại sau."
  }
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

/* =========================
   HELPERS
========================= */

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase();
}

function normalizeContact(contact) {
  return String(contact || "")
    .trim()
    .toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9._]{3,30}$/.test(username);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^\+?[0-9]{8,15}$/.test(value);
}

function isValidContact(value) {
  return isValidEmail(value) || isValidPhone(value);
}

function generateRandomNumber() {
  return crypto.randomInt(100000, 1000000);
}

async function generateKaisoulId(client) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const randomNumber = generateRandomNumber();

    const sequenceResult = await client.query(`
      INSERT INTO kaisoul_sequences (id, last_number)
      VALUES (1, 1)
      ON CONFLICT (id)
      DO UPDATE SET last_number = kaisoul_sequences.last_number + 1
      RETURNING last_number
    `);

    const sequenceNumber = sequenceResult.rows[0].last_number;

    const sequence = String(sequenceNumber).padStart(3, "0");

    const kaisoulId =
      `SODK-${randomNumber}/${sequence}//KAISOULID`;

    const exists = await client.query(
      `SELECT 1 FROM users WHERE kaisoul_id = $1 LIMIT 1`,
      [kaisoulId]
    );

    if (exists.rowCount === 0) {
      return {
        kaisoulId,
        randomNumber,
        sequenceNumber
      };
    }
  }

  throw new Error("Không thể tạo KAISOUL ID duy nhất.");
}

function createSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}

function setSessionCookie(res, token) {
  res.cookie("kaisoul_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearSessionCookie(res) {
  res.clearCookie("kaisoul_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });
}

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    null
  );
}

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      success: true,
      service: "KAISOUL ID",
      status: "online"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Database không khả dụng."
    });
  }
});

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", async (req, res) => {
  const client = await pool.connect();

  try {
    let {
      displayName,
      username,
      password,
      confirmPassword,
      contact
    } = req.body;

    displayName = String(displayName || "").trim();
    username = normalizeUsername(username);
    contact = normalizeContact(contact);

    if (!displayName) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị không được để trống."
      });
    }

    if (displayName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Tên hiển thị tối đa 50 ký tự."
      });
    }

    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message:
          "Username chỉ được chứa chữ thường, số, dấu chấm và dấu gạch dưới."
      });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 8 ký tự."
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu xác nhận không khớp."
      });
    }

    if (!isValidContact(contact)) {
      return res.status(400).json({
        success: false,
        message: "Email hoặc số điện thoại không hợp lệ."
      });
    }

    await client.query("BEGIN");

    const duplicate = await client.query(
      `
      SELECT id
      FROM users
      WHERE username = $1
         OR email = $2
         OR phone = $3
      LIMIT 1
      `,
      [
        username,
        isValidEmail(contact) ? contact : null,
        isValidPhone(contact) ? contact : null
      ]
    );

    if (duplicate.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Username, email hoặc số điện thoại đã được sử dụng."
      });
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id
    });

    const {
      kaisoulId,
      randomNumber,
      sequenceNumber
    } = await generateKaisoulId(client);

    const email = isValidEmail(contact) ? contact : null;
    const phone = isValidPhone(contact) ? contact : null;

    const userResult = await client.query(
      `
      INSERT INTO users (
        kaisoul_id,
        random_number,
        sequence_number,
        username,
        display_name,
        password_hash,
        email,
        phone,
        profile_visibility,
        allow_username_search
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'public',true)
      RETURNING
        id,
        kaisoul_id,
        username,
        display_name,
        email,
        phone,
        created_at
      `,
      [
        kaisoulId,
        randomNumber,
        sequenceNumber,
        username,
        displayName,
        passwordHash,
        email,
        phone
      ]
    );

    const user = userResult.rows[0];

    const sessionToken = createSessionToken();

    await client.query(
      `
      INSERT INTO sessions (
        token_hash,
        user_id,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES (
        encode(digest($1, 'sha256'), 'hex'),
        $2,
        $3,
        $4,
        NOW() + INTERVAL '30 days'
      )
      `,
      [
        sessionToken,
        user.id,
        getClientIp(req),
        req.headers["user-agent"] || null
      ]
    );

    await client.query(
      `
      INSERT INTO login_history (
        user_id,
        ip_address,
        user_agent,
        success
      )
      VALUES ($1,$2,$3,true)
      `,
      [
        user.id,
        getClientIp(req),
        req.headers["user-agent"] || null
      ]
    );

    await client.query("COMMIT");

    setSessionCookie(res, sessionToken);

    res.status(201).json({
      success: true,
      message: "Tạo tài khoản thành công.",
      user
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("REGISTER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Không thể tạo tài khoản."
    });
  } finally {
    client.release();
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  const client = await pool.connect();

  try {
    const identifier = normalizeContact(req.body.identifier);
    const password = String(req.body.password || "");

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ thông tin đăng nhập."
      });
    }

    const result = await client.query(
      `
      SELECT *
      FROM users
      WHERE username = $1
         OR email = $1
         OR phone = $1
      LIMIT 1
      `,
      [identifier]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        success: false,
        message: "Thông tin đăng nhập không chính xác."
      });
    }

    const user = result.rows[0];

    const validPassword = await argon2.verify(
      user.password_hash,
      password
    );

    await client.query(
      `
      INSERT INTO login_history (
        user_id,
        ip_address,
        user_agent,
        success
      )
      VALUES ($1,$2,$3,$4)
      `,
      [
        user.id,
        getClientIp(req),
        req.headers["user-agent"] || null,
        validPassword
      ]
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Thông tin đăng nhập không chính xác."
      });
    }

    const sessionToken = createSessionToken();

    await client.query(
      `
      INSERT INTO sessions (
        token_hash,
        user_id,
        ip_address,
        user_agent,
        expires_at
      )
      VALUES (
        encode(digest($1, 'sha256'), 'hex'),
        $2,
        $3,
        $4,
        NOW() + INTERVAL '30 days'
      )
      `,
      [
        sessionToken,
        user.id,
        getClientIp(req),
        req.headers["user-agent"] || null
      ]
    );

    setSessionCookie(res, sessionToken);

    res.json({
      success: true,
      message: "Đăng nhập thành công.",
      user: {
        id: user.id,
        kaisoul_id: user.kaisoul_id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        phone: user.phone,
        avatar_url: user.avatar_url,
        bio: user.bio,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Không thể đăng nhập."
    });
  } finally {
    client.release();
  }
});

/* =========================
   AUTH MIDDLEWARE
========================= */

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies.kaisoul_session;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Chưa đăng nhập."
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const result = await pool.query(
      `
      SELECT
        s.id AS session_id,
        u.*
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
        AND u.account_status = 'active'
      LIMIT 1
      `,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      clearSessionCookie(res);

      return res.status(401).json({
        success: false,
        message: "Session không hợp lệ hoặc đã hết hạn."
      });
    }

    req.user = result.rows[0];

    await pool.query(
      `
      UPDATE sessions
      SET last_active = NOW()
      WHERE id = $1
      `,
      [req.user.session_id]
    );

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Không thể xác thực tài khoản."
    });
  }
}

/* =========================
   CURRENT USER
========================= */

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    user: {
      id: user.id,
      kaisoul_id: user.kaisoul_id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      phone: user.phone,
      avatar_url: user.avatar_url,
      bio: user.bio,
      profile_visibility: user.profile_visibility,
      allow_username_search: user.allow_username_search,
      created_at: user.created_at
    }
  });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    await pool.query(
      `
      UPDATE sessions
      SET revoked_at = NOW()
      WHERE id = $1
      `,
      [req.user.session_id]
    );

    clearSessionCookie(res);

    res.json({
      success: true,
      message: "Đã đăng xuất."
    });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Không thể đăng xuất."
    });
  }
});

/* =========================
   404
========================= */

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API không tồn tại."
  });
});

/* =========================
   GLOBAL ERROR
========================= */

app.use((error, req, res, next) => {
  console.error("GLOBAL ERROR:", error);

  res.status(500).json({
    success: false,
    message: "Đã xảy ra lỗi máy chủ."
  });
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(`KAISOUL ID backend đang chạy tại port ${PORT}`);
});
