# Sentinel-X Tool & Skill Design Guidelines
*(Based on Senior QA & AI Behavioral Audit)*

การสร้าง MCP Tool หรือ Autonomous Skill ใน Sentinel-X **ต้อง** ยึดหลัก "Agent-Friendly" ไม่ใช่ "Developer-Friendly" AI จะไม่ใช้เครื่องมือหากไม่เข้าใจบริบทที่ชัดเจน

## 1. กฎการเขียน Tool Description (The Trigger Formula)
ห้ามเขียน Description สั้นๆ แบบ API (เช่น "Get user data") ต้องเขียนในรูปแบบ **Trigger Formula**:

```text
Use this tool when... [สถานการณ์ที่ควรใช้]
Do not use this tool when... [สถานการณ์ที่ไม่ควรใช้]
Input should be... [รูปแบบ Input ที่คาดหวัง]
Returns... [รูปแบบ Output ที่จะได้รับ]
Common user phrases... [คำพูดของ User ที่ควร Trigger Tool นี้]
```

เครื่องมือ production ทุกตัวต้องมีครบทั้ง 5 ส่วนนี้ใน `description` เดียวกัน เพื่อให้ agent ตัดสินใจได้เองว่าเมื่อไหร่ควรใช้และเมื่อไหร่ควรหลีกเลี่ยง

**ตัวอย่างที่ดี:**
```javascript
description: `Use this tool when the user asks to analyze the blast radius or impact of changing a specific symbol (class, function, variable).
Do not use this tool for general file reading or searching without a specific symbol in mind.
Common phrases: "ผลกระทบ", "ถ้าแก้ตรงนี้จะพังไหม", "impact analysis".
Returns a risk level (low/medium/high) and recommended testing strategy.`
```

## 2. ขนาดของ Tool (Workflow-Level vs API-Level)
- **หลีกเลี่ยง:** การสร้าง Tool แบบ CRUD ย่อยๆ (เช่น `db_get_user`, `db_get_order`, `db_join_user_order`)
- **ควรทำ:** สร้าง Tool ระดับ Workflow ที่ตอบโจทย์ทางธุรกิจ (เช่น `db_get_user_order_history`)
- *Sentinel-X มี `Skill Engine` เพื่อนำ Tool เล็กๆ มาผูกรวมกันเป็น Workflow ได้ ให้ใช้ฟีเจอร์นั้นแทนการปล่อย Tool เล็กๆ เต็มระบบ*

## 3. การออกแบบ Schema (No Blackholes)
- ห้ามใช้ `type: "object"` แบบกว้างๆ (เช่น `options: {}`) โดยไม่มีคำอธิบาย properties
- กำหนด `required` ให้น้อยที่สุดเท่าที่จำเป็น
- ใช้ `enum` แทน `string` ธรรมดาหากเป็นไปได้ เพื่อตีกรอบความคิดให้ AI

## 4. Output Formatting (The 3-Layer Rule)
อย่าส่ง Raw Data ขนาดใหญ่ (เช่น JSON 1000 บรรทัด) กลับไปให้ AI ตรงๆ Output ควรประกอบด้วย 3 ส่วน:
1. `summary`: สรุปผลลัพธ์เป็นประโยคที่มนุษย์/AI อ่านเข้าใจง่าย
2. `data`: ข้อมูล Normalized ที่จำเป็น
3. `evidence` (Optional): แหล่งที่มาของข้อมูล (เช่น ไฟล์ไหน, บรรทัดที่เท่าไหร่)

## 5. การบังคับใช้ (System Prompt Integration)
เมื่อสร้าง Tool หรือ Skill ใหม่ ควรแน่ใจว่าโปรเจกต์มีไฟล์ `AGENT.md` หรือ `GEMINI.md` ที่ระบุ **Tool Usage Rules** ไว้อย่างชัดเจน เช่น:
> "For any task involving database structures, you MUST use 'db_schema_graph' before making assumptions."
