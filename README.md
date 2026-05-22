# Sentinel-X MCP Server 🚀
**The Unified Multi-Stack Engineering Platform**

Sentinel-X คือระบบ MCP Server ที่ถูกสกัดและรวมร่างจากฟีเจอร์ที่ดีที่สุดของ `bmntogo-dev` และ `laravel-mcp` โดยออกแบบมาให้เป็นระบบที่ **Stack-Agnostic** (ไม่จำกัดภาษาหรือ Framework) แต่มีความฉลาดในระดับ Framework-specific ผ่านระบบ Adapters

## 🌟 ฟีเจอร์หลัก (Key Features)

### 1. 🔍 Surgical Intelligence
- **Surgical Read**: อ่านไฟล์เฉพาะบรรทัดที่ต้องการ ประหยัด Token สูงสุด
- **Contextual Search**: ค้นหาโค้ดพร้อมบริบทบรรทัดรอบข้าง (Grep-like logic)
- **Stack Detector**: ตรวจจับภาษา (PHP, Node, Python, Go) และ Framework อัตโนมัติ

### 2. 🧠 Cognitive Memory & Planning
- **Hybrid Memory**: จดจำข้อเท็จจริงแยก Project (แชร์กับทีม) และ User (ส่วนตัว)
- **Senior Planner**: บังคับให้ AI วางแผนและวิเคราะห์ความเสี่ยงก่อนแก้ไขโค้ด
- **Smart Recall**: ค้นหาความจำอัจฉริยะด้วยระบบ Scoring และ Semantic match

### 📊 3. Database Intelligence
- **Multi-DB Support**: รองรับ SQLite (Built-in) และ MSSQL (SQL Server) พร้อมขยายไปยัง MySQL/PostgreSQL ได้ง่าย
- **ERD Visualizer**: ดึงแผนผังโครงสร้างตารางและความสัมพันธ์ออกมาเป็นกราฟ
- **Inferred Relations**: เดาความสัมพันธ์ Table ได้เองแม้ใน DB จะไม่ได้สร้าง Foreign Key ไว้
- **Multi-Connection Pooling**: รองรับการเชื่อมต่อฐานข้อมูลหลายก้อนพร้อมกันผ่านการใช้ Suffix ในไฟล์ `.env` (เช่น `DB_DATABASE_LOGS`) และเรียกใช้ผ่านพารามิเตอร์ `connection_name`

## 🛠 วิธีใช้งานเบื้องต้น (Usage)

1. **เริ่มต้นใช้งาน (Initialization)**:
   เรียก `plan_task` ทุกครั้งที่ได้รับโจทย์ เพื่อให้ระบบวางแผนและเลือกเครื่องมือที่เหมาะสม

2. **สร้างความจำ (Building Memory)**:
   เรียก `memory_index_project` เพื่อให้ระบบ Scan โครงสร้างโปรเจกต์เข้าหน่วยความจำ

3. **แก้ไขโค้ดอย่างปลอดภัย (Safe Editing)**:
   ใช้ `write_file` ซึ่งมีระบบ **Atomic Write Guard** และ **Syntax Check** อัตโนมัติ

4. **การตั้งค่าฐานข้อมูลหลายชุด (Multi-Database Config)**:
   คุณสามารถเชื่อมต่อฐานข้อมูลได้หลายตัวในโปรเจกต์เดียว โดยเติม Suffix ลงใน `.env` เช่น:
   ```env
   # ฐานข้อมูลหลัก (Default)
   DB_CONNECTION=sqlsrv
   DB_DATABASE=my_main_db

   # ฐานข้อมูลรอง (ใช้ Suffix _LOGS)
   DB_CONNECTION_LOGS=sqlite
   DB_DATABASE_LOGS=storage/logs.sqlite
   ```
   จากนั้นส่งค่า `connection_name: "LOGS"` ไปกับเครื่องมือ `db_*` เพื่อสลับการเชื่อมต่อ

## 📂 โครงสร้างโปรเจกต์
```
sentinel-x/
├── src/
│   ├── core/           # หัวใจหลัก (Memory, Surgical I/O, Planner, etc.)
│   ├── adapters/       # ตัวจัดการแต่ละ Stack (Laravel, Node, Python)
│   └── tools/          # MCP Tool Definitions & Handlers
├── storage/            # ไฟล์ความจำ JSON
├── skills/             # ไฟล์ Workflow YAML (Skills)
└── server.js           # Entry point
```

---
*Created by Gemini CLI Agent — May 2026*
