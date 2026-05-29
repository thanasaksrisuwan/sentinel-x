import { PathPolicy } from "./src/core/path-policy.js";
import path from "path";

const root = process.cwd();
const policy = new PathPolicy(root);

const testPaths = [
	"application/models/Model_sale_manager.php",
	"application/views/welcome.php",
	"js/app.js",
	"models/User.php",
	"system/core/CodeIgniter.php", // Should be blocked
	".git/config", // Should be blocked
	"node_modules/express/index.js", // Should be blocked
	"package.json",
	".env", // Should be blocked
	"./application/models/Model_sale_manager.php"
];

console.log(`Testing PathPolicy at: ${root}`);
testPaths.forEach(p => {
	try {
		const allowed = policy.isAllowed(p, "read");
		console.log(`${allowed ? "✅ ALLOWED" : "❌ BLOCKED"}: ${p}`);
	} catch (e) {
		console.log(`💥 ERROR  : ${p} - ${e.message}`);
	}
});
