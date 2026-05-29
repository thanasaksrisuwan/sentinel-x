import { ToolRegistry } from "../src/core/tool-registry.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runEval() {
    console.log("🚀 Starting MCP Tool Eval...");
    const registry = new ToolRegistry();
    
    // Discover tools
    await registry.discover(path.join(__dirname, "../src/tools"));
    
    const tools = registry.allDefinitions();
    console.log(`✅ Loaded ${tools.length} tools successfully.`);
    
    // Check Git
    const gitTool = tools.find(t => t.name === "git");
    if (!gitTool) throw new Error("git tool missing");
    console.log("\n--- GIT TOOL SCHEMA ---");
    console.log("Description:", gitTool.description.split("\n")[0]);
    console.log("Properties:", Object.keys(gitTool.inputSchema.properties).join(", "));
    
    // Check git_autopilot
    const gitAuto = tools.find(t => t.name === "git_autopilot");
    const subActionNode = gitAuto.inputSchema.properties.sub_action;
    console.log("\n--- GIT AUTOPILOT SCHEMA ---");
    console.log("sub_action type:", subActionNode.type);
    console.log("sub_action enum:", subActionNode.enum);

    // Check sys_info
    const sysInfo = tools.find(t => t.name === "sys_info");
    console.log("\n--- SYS INFO SCHEMA ---");
    console.log("Description:", sysInfo.description.split("\n")[0]);
    
    console.log("\n✅ All Eval Checks Passed!");
}

runEval().catch(console.error);
