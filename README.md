# Nimidd

Nimidd เป็นเว็บแอพพิธีเสี่ยงเซียมซีแบบ personal ritual ที่รวมการลงทะเบียนผู้ใช้ การอ่านลายมือด้วย OpenCV/LLM การเตรียมใจก่อนพิธี การเขย่าเซียมซีแบบ 3D realtime และการสรุปผลคำทำนายเฉพาะบุคคลไว้ใน flow เดียว

## แอพนี้ทำอะไร

- ให้ผู้ใช้ลงทะเบียนด้วยชื่อ วันเกิด และภาพฝ่ามือ
- ประมวลผลภาพฝ่ามือด้วย OpenCV และส่งต่อให้ LLM วิเคราะห์ลายมือ
- แสดงสถานะการวิเคราะห์ลายมือแบบ async พร้อม toast เมื่อวิเคราะห์เสร็จ
- ให้ผู้ใช้เลือกกิจกรรมเตรียมใจ ความรู้สึก บรรยากาศวัด กล่องเซียมซี หมวดคำทำนาย และเพลงประกอบ
- มีหน้าฝึกสมาธิหรือเดินอย่างมีสติก่อนเริ่มพิธี
- แสดงฉากเขย่าเซียมซีแบบ Three.js พร้อมรับสัญญาณ realtime จาก MQTT/WebSocket
- สุ่มใบเซียมซีและเลขนำโชคใหม่ทุกครั้งที่เขย่าสำเร็จ
- สร้างคำทำนายเฉพาะคุณโดยผสานข้อมูลลายมือ ใบเซียมซี และพลังงานจากการเขย่า
- วิเคราะห์ sentiment จากข้อความความรู้สึกของผู้ใช้
- บันทึกผลเซียมซีและแสดง dashboard ประวัติ/สถิติส่วนตัว
- มีหน้าร้านของมงคลและหน้าทำบุญออนไลน์เป็นส่วนต่อจากผลคำทำนาย

## User Flow หลัก

1. `Login / Register`  
   ผู้ใช้กรอกชื่อ วันเกิด และถ่ายหรืออัปโหลดภาพฝ่ามือ

2. `Palm Reading`  
   ระบบสร้าง OpenCV processing preview ก่อน แล้ววิเคราะห์ลายมือแบบ background job

3. `Setup`  
   ผู้ใช้เลือกกิจกรรมเตรียมใจ บันทึกความรู้สึก เลือกวัด กล่องเซียมซี หมวดคำทำนาย และเพลง

4. `Meditation`  
   ผู้ใช้พักใจด้วย breathing/walking screen และสามารถไปต่อได้ทันที

5. `Shake`  
   ผู้ใช้เขย่าเซียมซีผ่านฉาก 3D หรือผ่าน MQTT sensor event จนพลังเจตนาเต็ม

6. `Result`  
   ระบบแสดงใบเซียมซี เลขนำโชค คำทำนายเฉพาะคุณ คำถามชวนทบทวน และปุ่มบันทึกผล

7. `Dashboard`  
   ผู้ใช้ดูผลล่าสุด ประวัติการเสี่ยงเซียมซี สถิติ และเริ่มพิธีใหม่จากข้อมูลเดิมได้

## ส่วนประกอบหลัก

### Frontend

- React 19 + Vite
- React Router สำหรับ route หลัก เช่น `/login`, `/setup`, `/meditation`, `/shake`, `/result`, `/dashboard`, `/shop`, `/donate`
- Three.js สำหรับฉากเขย่าเซียมซี
- WebSocket client สำหรับรับ event realtime จาก backend
- Local state + localStorage fallback สำหรับข้อมูลผู้ใช้และประวัติ

ไฟล์สำคัญ:

- `src/ritual-app.tsx` - flow หลักของพิธีทั้งหมด
- `src/ritual-primitives.tsx` - design primitives, data constants, icon/component พื้นฐาน
- `src/dashboard.tsx` - dashboard ส่วนตัว
- `src/realtime.ts` - realtime WebSocket/MQTT event bridge
- `src/api.ts` - API client ฝั่ง frontend

### Backend

- Bun server สำหรับ serve frontend, API proxy, session, SQLite persistence และ WebSocket
- Proxy request ไปยัง Python LLM service
- Subscribe MQTT แล้ว broadcast event ต่อให้ frontend ผ่าน `/events`
- จัดการ palm-reading job แบบ async

API หลัก:

- `POST /api/palm-reading/jobs`
- `GET /api/palm-reading/jobs/:jobId`
- `POST /api/siamsee-reading`
- `POST /api/sentiment`
- `GET /api/session`
- `POST /api/session/user`
- `PUT /api/ritual`
- `GET /api/readings`
- `POST /api/readings`

ไฟล์สำคัญ:

- `backend/server.ts` - HTTP/WebSocket/API/MQTT bridge
- `backend/db.ts` - SQLite session, user, ritual และ reading persistence

### LLM Service

Python REST service สำหรับงาน AI/vision:

- OpenCV preprocessing ภาพฝ่ามือ
- Palm reading จากภาพฝ่ามือ
- Sentiment analysis จากข้อความความรู้สึก
- Siamsee reading generation จากลายมือ ใบเซียมซี และข้อมูลการเขย่า

Endpoints:

- `GET /health`
- `POST /palm-reading`
- `POST /sentiment`
- `POST /siamsee-reading`

ไฟล์สำคัญ:

- `llm-service/src/llm_service/server.py`
- `llm-service/src/llm_service/preprocess_palm.py`
- `llm-service/src/llm_service/palm_flow.py`
- `llm-service/src/llm_service/siamsee/generate.py`
- `llm-service/src/llm_service/siamsee/prompts.py`

## Realtime และ IoT

ระบบรองรับ MQTT สำหรับ event การเขย่า:

- `v1/shake` - event เขย่าทั่วไป
- `v1/detection` - sensor/detection payload เช่น acceleration, gyro, shaking state

Backend subscribe MQTT แล้วส่งต่อให้ frontend ผ่าน WebSocket:

- `ws://<host>/events`

Frontend ใช้ event เหล่านี้เพื่อเพิ่มพลังเจตนาในหน้าเขย่าเซียมซีและเก็บ shake session สำหรับคำทำนายเฉพาะรอบนั้น

## ข้อมูลที่ระบบบันทึก

- โปรไฟล์ผู้ใช้
- ภาพ/ผลวิเคราะห์ฝ่ามือ
- สถานะ ritual ล่าสุด
- ใบเซียมซีที่สุ่มได้
- เลขนำโชคของรอบนั้น
- คำทำนายและ sentiment result
- ประวัติผลเซียมซีสำหรับ dashboard

## การรันโปรเจกต์

### Frontend dev server

```bash
bun run dev
```

### Backend

```bash
bun run start
```

### LLM service

```bash
cd llm-service
uv run llm-service
```

### Build frontend

```bash
bun run build
```

## Docker Compose

`docker-compose.yml` รวม service หลักให้รันได้ด้วยคำสั่งเดียว:

```bash
docker compose up --build
```

หลังจาก container พร้อมแล้ว เปิดแอพที่:

```text
http://127.0.0.1:5173
```

Service ใน compose:

- `nimidd` - แอพหลักที่ build React frontend แล้ว serve static/API/WebSocket ด้วย Bun backend ใน container เดียว
- `mqtt` - Eclipse Mosquitto broker
- `llm-service` - Python AI service
- `watchtower` - auto update image สำหรับ deploy เท่านั้น เปิดด้วย `docker compose --profile deploy up`

Port เริ่มต้น:

- `APP_PORT=5173` -> `nimidd:80`
- `MQTT_PORT=1884` -> `mqtt:1883`
- `MQTT_WS_PORT=18883` -> `mqtt:9001`
- `LLM_PORT=8000` -> `llm-service:8000`

Environment สำคัญ:

- `MQTT_BROKER_URL`
- `LLM_SERVICE_URL`
- `DB_PATH`
- `UPLOAD_DIR`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_SIAMSEE_MODEL`
- `OPENAI_SENTIMENT_MODEL`
- `LLM_OUTPUT_DIR`

ใน compose ค่า internal network ถูกตั้งไว้แล้ว:

- `MQTT_BROKER_URL=mqtt://mqtt:1883`
- `LLM_SERVICE_URL=http://llm-service:8000`

จึงไม่ต้องรัน `bun run dev`, `bun run start`, หรือ `uv run llm-service` แยกเมื่อใช้ Docker Compose

ถ้าอุปกรณ์ภายนอกต้อง publish MQTT เข้า port `1883` จริง ๆ และเครื่องไม่มี process อื่นจับ port นี้อยู่ ให้รันแบบ override ได้:

```bash
MQTT_PORT=1883 docker compose up --build
```

## สรุปสั้น

Nimidd คือแอพเซียมซีเชิงพิธีกรรมที่พยายามทำให้ประสบการณ์เสี่ยงเซียมซีเป็น personal journey: เริ่มจากรู้จักผู้ใช้ผ่านลายมือและความรู้สึก พาเข้าสู่พิธีผ่านการเตรียมใจและการเขย่าแบบ realtime แล้วสรุปออกมาเป็นคำทำนายส่วนตัว ประวัติ และ action ต่อ เช่น บันทึกผล ซื้อของมงคล หรือทำบุญออนไลน์
