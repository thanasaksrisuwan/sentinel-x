import { PathPolicy } from "./src/core/path-policy.js";
import path from "path";

const root = "D:\\laragon\\www\\bmntogo";
process.env.MCP_READ_ALLOWLIST = "";
const policy = new PathPolicy(root);

const testPaths = [
	"application/models/Model_sale_manager.php",
	"index.php",
	"application/views/welcome.php"
];

testPaths.forEach(p => {
	try {
		const allowed = policy.isAllowed(p, "read");
		console.log(`${allowed ? "✅ ALLOWED" : "❌ BLOCKED"}: ${p}`);
	} catch (e) {
		console.log(`💥 ERROR  : ${p} - ${e.message}`);
	}
});
