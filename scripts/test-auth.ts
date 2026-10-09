import { z } from "zod";
import { registerSchema, loginSchema } from "../src/lib/validations/schemas";
import { generateReferralCode } from "../src/lib/utils";

type Case = { name: string; fn: () => Promise<void> | void };
const results: Array<{ name: string; pass: boolean; err?: string }> = [];

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

async function run(name: string, fn: Case["fn"]) {
  try {
    await fn();
    results.push({ name, pass: true });
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    results.push({ name, pass: false, err: e?.message ?? String(e) });
    console.log(`  ✗ ${name}\n      ${e?.message ?? e}`);
  }
}

async function main() {
  console.log("\n== PH2 Auth Harness: Schema Rules ==");

  await run("rejects password shorter than 8 chars", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "Pass123", confirmPassword: "Pass123", referralCode: "",
    });
    assert(r.success === false);
    assert((r as any).error?.issues?.[0]?.message?.includes("8 characters"));
  });

  await run("rejects password without uppercase letter", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "password1", confirmPassword: "password1", referralCode: "",
    });
    assert(r.success === false);
    assert((r as any).error?.issues?.[0]?.message?.includes("uppercase"));
  });

  await run("rejects password without digit", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "Passwords", confirmPassword: "Passwords", referralCode: "",
    });
    assert(r.success === false);
    assert((r as any).error?.issues?.[0]?.message?.includes("number"));
  });

  await run("rejects mismatched confirmPassword", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "Password1", confirmPassword: "Password2", referralCode: "",
    });
    assert(r.success === false);
    const issuePath = (r as any).error?.issues?.[0]?.path ?? [];
    assert(issuePath[0] === "confirmPassword");
  });

  await run("accepts strong matching password (Password1)", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "Password1", confirmPassword: "Password1", referralCode: "",
    });
    assert(r.success === true, "registerSchema should accept Password1");
  });

  await run("accepts strong matching password (StrongPass9)", async () => {
    const r = registerSchema.safeParse({
      name: "A B", email: "a@b.co", phone: "+15551234567",
      password: "StrongPass9", confirmPassword: "StrongPass9", referralCode: "ABC123",
    });
    assert(r.success === true, "registerSchema should accept StrongPass9");
  });

  await run("login schema also rejects weak password", async () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "weak" });
    assert(r.success === false, "loginSchema should reject weak passwords");
  });

  await run("login schema accepts strong password", async () => {
    const r = loginSchema.safeParse({ email: "a@b.co", password: "StrongPass9" });
    assert(r.success === true, "loginSchema should accept StrongPass9");
  });

  console.log("\n== PH2 Auth Harness: Referral Code Uniqueness 100 batch ==");

  async function generateUniqueReferralCodeWrap(
    getUserByReferralCode: (code: string) => Promise<unknown>,
    length = 8,
    maxAttempts = 5,
  ): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = generateReferralCode(length);
      const existing = await getUserByReferralCode(candidate);
      if (!existing) return candidate;
    }
    throw new Error(
      `[referral-code] Failed to generate a unique code after ${maxAttempts} attempts`,
    );
  }

  await run("100 sequential unique codes have no collisions", async () => {
    const seen = new Set<string>();
    const usedByCode = new Map<string, boolean>();
    for (let i = 0; i < 100; i++) {
      const c = await generateUniqueReferralCodeWrap(async (code) => usedByCode.get(code) ?? null);
      usedByCode.set(c, true);
      seen.add(c);
    }
    assert(seen.size === 100, `expected 100 unique codes, got ${seen.size}`);
  });

  console.log("\n== PH2 Auth Harness: Referral Bounded Retry Loop ==");

  await run("5 consecutive collisions (maxAttempts=5) throws with attempt count", async () => {
    let calls = 0;
    const alwaysCollision = async () => {
      calls++;
      return { uid: "x" };
    };
    let threwCorrectly = false;
    try {
      await generateUniqueReferralCodeWrap(alwaysCollision, 8, 5);
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      threwCorrectly = msg.includes("5 attempts") && calls === 5;
    }
    assert(threwCorrectly, `expected error with '5 attempts' after 5 calls, got calls=${calls}`);
  });

  await run("4 collisions then success on 5th attempt returns candidate", async () => {
    let calls = 0;
    const collide4ThenPass = async () => {
      calls++;
      return calls <= 4 ? { uid: "x" } : null;
    };
    const code = await generateUniqueReferralCodeWrap(collide4ThenPass, 8, 5);
    assert(typeof code === "string" && code.length === 8, `expected string[8] got '${code}'`);
    assert(calls === 5, `expected 5 mock calls got ${calls}`);
  });

  console.log("\n== PH2 Auth Harness: Summary ==");
  const pass = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`Result: ${pass}/${total} passed`);
  if (pass < total) {
    console.log("Failures:");
    for (const r of results) if (!r.pass) console.log(`  - ${r.name}: ${r.err}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Unhandled harness error:", e);
  process.exit(1);
});
