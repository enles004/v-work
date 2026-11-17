import { AuthSession } from "../src/auth.js";
import { VworkClient } from "../src/client.js";
import { loadConfig } from "../src/config.js";
import { extractIdentity } from "../src/tools/mine.js";
import { extractDocs, summarizeDocs } from "../src/tools/tracker.js";

const config = loadConfig();
const auth = new AuthSession(config);
const client = new VworkClient(config, auth);

try {
  const me = await client.get("/permissions/me");
  console.log("✅ Đăng nhập OK:", extractIdentity(me));

  const body = await client.get(`/project-tracker/${config.project}/docs`);
  const docs = extractDocs(body);
  console.log(`📄 ${config.project}: ${docs.length} doc`);
  console.log("📊", summarizeDocs(docs));
  console.log("🔑 field của doc đầu tiên:", Object.keys(docs[0] ?? {}).join(", "));
  console.log("🧾 mẫu:", JSON.stringify(docs[0], null, 2)?.slice(0, 800));
} catch (error) {
  console.error("❌", (error as Error).message);
  process.exit(1);
}
