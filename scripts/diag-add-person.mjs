import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const cols = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' ORDER BY 1`,
  );
  console.log("user_columns", cols.rows.map((row) => row.column_name).join(","));

  const roles = await client.query(`SELECT code FROM "Role" ORDER BY 1`);
  console.log("roles", roles.rows.map((row) => row.code).join(","));

  const matches = await client.query(
    `SELECT username, email,
            EXISTS (
              SELECT 1 FROM "OrganizationMembership" m WHERE m."userId" = u.id
            ) AS has_membership
     FROM "User" u
     WHERE lower(email) = lower($1) OR lower(username) = lower($2)`,
    ["jasonbaddley+mason@gmail.com", "mharper"],
  );
  console.log("matches", JSON.stringify(matches.rows));

  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO "User" (id, username, email, "passwordHash", "createdAt", "updatedAt", "isSuperAdmin", "mustChangePassword")
       VALUES (gen_random_uuid(), $1, $2, $3, now(), now(), false, true)`,
      ["diagrollbackuser", "diag-rollback@example.com", "x"],
    );
    console.log("insert", "ok");
  } catch (error) {
    console.log("insert_error", error.code, error.constraint, error.message);
  } finally {
    await client.query("ROLLBACK");
  }
} finally {
  await client.end();
}
