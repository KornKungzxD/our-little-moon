
const SUPABASE_URL = "https://yoinoiwffqhtcgpbknzk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4DUhdgz5nwXonbwFmocqxQ_lPLN9lk9";

const TOKEN_KEY = "our-little-moon-session-v1";
const TAIWAN_TIME_ZONE = "Asia/Taipei";

const $ = (id) => document.getElementById(id);

const loginPanel = $("loginPanel");
const loginForm = $("loginForm");
const pinInput = $("pinInput");
const loginButton = $("loginButton");
const loginMessage = $("loginMessage");
const appContent = $("appContent");
const logoutButton = $("logoutButton");

const todayElement = $("today");
const clockElement = $("clock");
const reminderTimeElement = $("reminderTime");
const statusElement = $("status");
const statusText = $("statusText");
const recordTimeElement = $("recordTime");
const takenButton = $("takenButton");
const undoButton = $("undoButton");
const historyElement = $("history");

let sessionToken = localStorage.getItem(TOKEN_KEY);
let busy = false;

function configured() {
  return SUPABASE_URL.startsWith("https://") &&
    SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

function apiUrl(functionName) {
  return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${functionName}`;
}

async function callFunction(functionName, body, token = null) {
  const headers = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_PUBLISHABLE_KEY,
  };

  if (token) {
    headers["x-session-token"] = token;
  }

  const response = await fetch(apiUrl(functionName), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `เกิดข้อผิดพลาด (${response.status})`);
  }

  return data;
}

function getTaiwanDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIWAN_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getTaiwanDateOffset(offset) {
  const [year, month, day] = getTaiwanDateKey()
    .split("-")
    .map(Number);

  const date = new Date(Date.UTC(year, month - 1, day - offset, 12));
  return getTaiwanDateKey(date);
}

function formatLocalDate(date = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatLocalTime(dateString = new Date()) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date(dateString));
}

function getTaiwanReminderAsLocalTime() {
  const [year, month, day] = getTaiwanDateKey()
    .split("-")
    .map(Number);

  // 21:30 น. ไต้หวัน = 13:30 UTC
  const reminderInstant = new Date(
    Date.UTC(year, month - 1, day, 13, 30, 0)
  );

  const localTime = new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(reminderInstant);

  return `${localTime} น. ไทย · 21:30 น. ไต้หวัน`;
}

function updateClock() {
  if (todayElement) todayElement.textContent = formatLocalDate();
  if (clockElement) clockElement.textContent = formatLocalTime();

  if (reminderTimeElement) {
    reminderTimeElement.textContent = getTaiwanReminderAsLocalTime();
  }
}

function showLogin(message = "") {
  loginPanel.hidden = false;
  appContent.hidden = true;
  loginMessage.textContent = message;
}

function showApp() {
  loginPanel.hidden = true;
  appContent.hidden = false;
}

function setBusy(value) {
  busy = value;
  loginButton.disabled = value;
  takenButton.disabled = value;
  undoButton.disabled = value;
}

function showStatus(message, done = false) {
  statusElement.classList.toggle("done", done);
  statusElement.classList.toggle("pending", !done);
  statusText.textContent = message;
}

function renderToday(logs) {
  const today = getTaiwanDateKey();
  const todayLog = logs.find((log) => log.log_date === today);

  if (todayLog && todayLog.status === "taken") {
    showStatus("มีการบันทึกว่ากินยาแล้ว", true);

    recordTimeElement.textContent = todayLog.recorded_at
      ? `บันทึกเมื่อ ${formatLocalTime(todayLog.recorded_at)} น. (เวลาของเครื่อง)`
      : "บันทึกแล้ว";

    takenButton.textContent = "✓ บันทึกของวันนี้เรียบร้อย";
    takenButton.disabled = true;
    undoButton.hidden = false;
  } else {
    showStatus("วันนี้ยังไม่มีบันทึก", false);
    recordTimeElement.textContent =
      "หากยืนยันแล้วว่ากินยา ให้กดบันทึกด้านล่าง";

    takenButton.textContent = "♡ บันทึกว่ากินยาแล้ว";
    takenButton.disabled = false;
    undoButton.hidden = true;
  }
}

function renderHistory(logs) {
  historyElement.replaceChildren();

  for (let offset = 0; offset < 7; offset++) {
    const key = getTaiwanDateOffset(offset);
    const log = logs.find((item) => item.log_date === key);

    const row = document.createElement("div");
    row.className = "history-item";

    const dateLabel = document.createElement("span");
    dateLabel.className = "history-date";
    dateLabel.textContent = offset === 0
      ? "วันนี้ (ไต้หวัน)"
      : new Intl.DateTimeFormat("th-TH", {
          timeZone: TAIWAN_TIME_ZONE,
          day: "numeric",
          month: "short",
        }).format(new Date(`${key}T12:00:00+08:00`));

    const detail = document.createElement("span");
    detail.className = "history-detail";

    if (log && log.status === "taken") {
      detail.classList.add("done");
      detail.textContent = log.recorded_at
        ? `บันทึกแล้ว · ${formatLocalTime(log.recorded_at)} น.`
        : "บันทึกแล้ว";
    } else {
      detail.textContent = "ไม่มีบันทึก";
    }

    row.append(dateLabel, detail);
    historyElement.append(row);
  }
}

async function loadLogs() {
  const result = await callFunction(
    "medicine-logs",
    { action: "read" },
    sessionToken
  );

  const logs = result.logs || [];
  renderToday(logs);
  renderHistory(logs);
}

async function verifySession() {
  if (!sessionToken) {
    showLogin();
    return false;
  }

  try {
    const result = await callFunction(
      "check-session",
      {},
      sessionToken
    );

    if (!result.valid) throw new Error("Session หมดอายุ");

    showApp();
    await loadLogs();
    return true;
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    sessionToken = null;
    showLogin("กรุณากรอก PIN เพื่อเข้าสู่ระบบอีกครั้ง");
    return false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const pin = pinInput.value.trim();

  if (!/^\d{4}$/.test(pin)) {
    loginMessage.textContent = "กรุณากรอก PIN ให้ครบ 4 หลัก";
    return;
  }

  if (!configured()) {
    loginMessage.textContent = "กรุณาตรวจสอบ Project URL และ Publishable Key";
    return;
  }

  setBusy(true);
  loginMessage.textContent = "กำลังตรวจสอบ PIN...";

  try {
    const result = await callFunction("verify-pin", { pin });

    if (!result.token) {
      throw new Error("ระบบไม่ได้ส่ง session token กลับมา");
    }

    sessionToken = result.token;
    localStorage.setItem(TOKEN_KEY, sessionToken);

    const checked = await callFunction("check-session", {}, sessionToken);

    if (!checked.valid) throw new Error("ตรวจสอบ session ไม่สำเร็จ");

    showApp();
    await loadLogs();
    pinInput.value = "";
    loginMessage.textContent = "";
  } catch (error) {
    localStorage.removeItem(TOKEN_KEY);
    sessionToken = null;
    showLogin(error.message || "เข้าสู่ระบบไม่สำเร็จ");
  } finally {
    setBusy(false);
  }
});

takenButton.addEventListener("click", async () => {
  if (busy) return;

  if (!confirm("คุณยืนยันแล้วใช่ไหมว่ากินยาของรอบวันนี้แล้ว?")) return;

  setBusy(true);

  try {
    await callFunction("medicine-logs", { action: "taken" }, sessionToken);
    await loadLogs();
  } catch (error) {
    alert(error.message || "บันทึกไม่สำเร็จ");
    await verifySession();
  } finally {
    setBusy(false);
  }
});

undoButton.addEventListener("click", async () => {
  if (busy) return;
  if (!confirm("ต้องการลบบันทึกของวันนี้ใช่ไหม?")) return;

  setBusy(true);

  try {
    await callFunction("medicine-logs", { action: "undo" }, sessionToken);
    await loadLogs();
  } catch (error) {
    alert(error.message || "แก้ไขบันทึกไม่สำเร็จ");
    await verifySession();
  } finally {
    setBusy(false);
  }
});

logoutButton.addEventListener("click", () => {
  // ล้าง token บนอุปกรณ์นี้เท่านั้น
  // การเพิกถอน session ฝั่งเซิร์ฟเวอร์ยังต้องเพิ่ม endpoint แยก
  localStorage.removeItem(TOKEN_KEY);
  sessionToken = null;
  showLogin("ออกจากระบบบนอุปกรณ์นี้แล้ว");
});

async function startApp() {
  updateClock();
  setInterval(updateClock, 1000);

  if (!configured()) {
    showLogin("กรุณาตั้งค่า Project URL และ Publishable Key ใน script.js ก่อน");
    return;
  }

  showLogin("กำลังตรวจสอบ session...");
  await verifySession();
}

startApp();
