const SUPABASE_URL = "https://wylfqwzictkepnefwksx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5ITurxoUWu2ihIkDBrzWaQ_8uFP1LxZ";

const AUTH_STORAGE_KEY = "cq_auth_session";
let authSession = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
let currentUser = null;
let profileName = "";
let isAdmin = false;
let themeColor = localStorage.getItem("cq_theme_color") || "white";
let socialCity = "";
let socialBranchId = "";


// ========================================
// CARDIO TAIWAN
// ========================================

let branches = [];
let schedule = [];
let worldGymBranchSlugs = new Map();
let worldGymBranchLocations = new Map();
let savedTasks = JSON.parse(localStorage.getItem("cq_saved_tasks") || "[]");


function normalizedBranchName(name){

  return String(name || "")
    .replace(/\s+/g, "")
    .replace(/World\s*Gym/gi, "")
    .trim();

}


function worldGymBranchSlug(officialUrl, branchName = ""){

  // Supabase currently has both「台北統領」and「台北統領店」,
  // but only the first record carries the official URL. They are the same club.
  if(
    branchName === "台北統領" ||
    branchName === "台北統領店"
  ){
    return "taipei-tonling";
  }

  const listedSlug =
    worldGymBranchSlugs.get(
      normalizedBranchName(branchName)
    );

  if(listedSlug){
    return listedSlug;
  }

  if(!officialUrl){
    return "";
  }

  try{

    const match =
      new URL(officialUrl).pathname.match(
        /^\/en\/find-a-club\/([a-z0-9-]+)\/aerobics-class-schedule\/?$/i
      );

    return match ? match[1].toLowerCase() : "";

  }catch(error){

    return "";

  }

}


// ========================================
// 使用者目前選擇
// 不預設任何分店
// ========================================

let selectedBranchId =
  localStorage.getItem("cq_branch_id") || "";

let selectedBranchName =
  localStorage.getItem("cq_branch_name") || "";

let selectedCity =
  localStorage.getItem("cq_city") || "";

let selectedDate =
  localStorage.getItem("cq_date") || "";


const badges = [
  ["🥊","Combat Rookie","完成 1 堂 BODYCOMBAT®",true],
  ["🥊","Combat Warrior","完成 25 堂 BODYCOMBAT®",false],
  ["🏋️","Pump Starter","完成 5 堂 BODYPUMP®",false],
  ["🔥","Cardio Beast","累積 50 小時有氧",false],
  ["⚡","Early Bird","完成 10 堂早晨課程",false],
  ["🌈","Class Collector","完成 5 種不同課程",false]
];


let xp =
  Number(localStorage.getItem("cq_xp") || 0);

let completed =
  Number(localStorage.getItem("cq_completed") || 0);

let streak =
  Number(localStorage.getItem("cq_streak") || 0);


const content =
  document.querySelector("#content");

const title =
  document.querySelector("#pageTitle");


// ========================================
// UI 工具
// ========================================

function toast(msg){

  const el =
    document.querySelector("#toast");

  if(!el) return;

  el.textContent = msg;

  el.classList.add("show");

  setTimeout(() => {

    el.classList.remove("show");

  }, 1800);

}


function formatDate(date){

  if(!date) return "";

  const parts =
    date.split("-");

  if(parts.length !== 3){
    return date;
  }

  return `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`;

}


function formatDateSlash(date){

  if(!date) return "";

  return date.replaceAll("-", "/");

}


// ========================================
// 課表頁 CSS
// ========================================

function injectScheduleStyles(){

  if(
    document.querySelector(
      "#schedule-page-styles"
    )
  ){
    return;
  }

  const style =
    document.createElement("style");

  style.id =
    "schedule-page-styles";

  style.textContent = `

    .schedule-controls{
      display:flex;
      flex-direction:column;
      gap:12px;
      margin:24px 0 24px;
    }

    .schedule-control{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .schedule-control-label{
      width:72px;
      min-width:72px;
      font-size:17px;
      font-weight:700;
      color:var(--text);
      line-height:1;
    }

    .schedule-control-input{
      flex:1;
      min-width:0;
      height:52px;
      box-sizing:border-box;
      border:1px solid var(--line);
      border-radius:16px;
      background:var(--panel);
      color:var(--text);
      padding:0 14px;
      font-size:16px;
      text-align:left;
      -webkit-text-align:left;
      outline:none;
    }

    .schedule-control-input:focus{
      border-color:var(--accent);
      box-shadow:
        0 0 0 2px
        rgba(233,79,155,.12);
    }

    .schedule-control-input:disabled{
      opacity:.5;
      cursor:not-allowed;
    }

    .schedule-date-input{
      color-scheme:var(--date-scheme, dark);
      text-align:left;
      -webkit-text-align:left;
    }

    .schedule-empty{
      padding:32px 18px;
      text-align:center;
      border:1px dashed var(--line);
      border-radius:18px;
      color:var(--muted);
      background:var(--panel);
    }

    .schedule-loading{
      padding:30px 18px;
      text-align:center;
      color:var(--muted);
    }

    .schedule-heading{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:14px;
    }

    .schedule-heading h3{
      margin:0;
    }

    .schedule-heading-date{
      color:var(--muted);
      font-size:14px;
      white-space:nowrap;
    }

    .schedule-notice{
      padding:18px;
      border-radius:16px;
      background:var(--panel);
      border:1px solid var(--line);
      color:var(--muted);
      text-align:center;
    }

    /* ==================================
       分店下拉選單
       ================================== */

    #branchSelector{
      appearance:auto;
      -webkit-appearance:auto;
    }

    #branchSelector optgroup{
      font-weight:700;
    }

    #branchSelector option{
      font-weight:400;
    }

    @media(max-width:430px){

      .schedule-control-label{
        width:68px;
        min-width:68px;
        font-size:16px;
      }

      .schedule-control-input{
        height:50px;
        font-size:15px;
      }

    }

  `;

  document.head.appendChild(style);

}


// ========================================
// Supabase API
// ========================================

function authHeaders(){
  return {
    "apikey": SUPABASE_PUBLISHABLE_KEY,
    "Authorization": `Bearer ${authSession?.access_token || SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

async function authRequest(path, options = {}){
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: { "apikey": SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(payload.message || payload.error_description || payload.msg || payload.error || "帳號服務暫時無法使用");
  return payload;
}

async function saveCloudProfile(){
  if(!currentUser || !authSession) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}`, {
    method: "PATCH",
    headers: { ...authHeaders(), "Prefer": "return=minimal" },
    body: JSON.stringify({ display_name: profileName || currentUser.email.split("@")[0], theme_color: themeColor, xp, streak_days: streak })
  });
  if(!response.ok) throw new Error("個人資料同步失敗");
}

async function loadCloudProfile(){
  if(!currentUser || !authSession) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${currentUser.id}&select=display_name,theme_color,xp,streak_days,is_admin`, { headers: authHeaders() });
  if(!response.ok) return;
  const rows = await response.json();
  if(rows[0]){
    profileName = rows[0].display_name || "";
    themeColor = ["white", "black", "navy", "gray"].includes(rows[0].theme_color) ? rows[0].theme_color : "white";
    xp = Number(rows[0].xp || 0);
    streak = Number(rows[0].streak_days || 0);
    isAdmin = rows[0].is_admin === true;
    applyTheme(themeColor, false);
  }
  const workoutResponse = await fetch(`${SUPABASE_URL}/rest/v1/workouts?user_id=eq.${currentUser.id}&select=id`, { headers: authHeaders() });
  if(workoutResponse.ok) completed = (await workoutResponse.json()).length;
}

async function restoreSession(){
  if(!authSession?.access_token) return;
  try{
    currentUser = await authRequest("user", { headers: { "Authorization": `Bearer ${authSession.access_token}` } });
    profileName = currentUser.user_metadata?.display_name || "";
    await loadCloudProfile();
  }catch(error){
    authSession = null;
    currentUser = null;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function consumeAuthCallback(){
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if(!accessToken) return;
  authSession = { access_token: accessToken, refresh_token: refreshToken || "" };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
  window.history.replaceState({}, document.title, window.location.pathname);
}

function signInWithGoogle(){
  const redirectTo = encodeURIComponent(window.location.origin);
  window.location.assign(`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`);
}

function applyTheme(color, persist = true){
  const themes = {
    white:{ "--bg":"#f4f6fa", "--panel":"#ffffff", "--panel2":"#edf1f7", "--line":"#d6dde8", "--text":"#172033", "--muted":"#5d6b80", "--accent":"#d94669", "--accent2":"#6d5ce8", "--green":"#087d57", "--yellow":"#a85b00", "--topbar":"rgba(244,246,250,.92)", "--hero-a":"#ffffff", "--hero-b":"#eaf0f8", "--glow":"rgba(217,70,105,.18)", "--stat":"rgba(23,32,51,.045)", "--pill-bg":"rgba(217,70,105,.12)", "--pill-text":"#b42450", "--progress":"#dbe3ee", "--primary2":"#ef6b8e", "--mini":"#dce5f1", "--link":"#4264c7", "--toast-bg":"#172033", "--toast-text":"#ffffff", "--date-scheme":"light" },
    black:{ "--bg":"#090b10", "--panel":"#12161e", "--panel2":"#181e28", "--line":"#29313d", "--text":"#f4f7fb", "--muted":"#9da7b5", "--accent":"#ff4f86", "--accent2":"#8b7cff", "--green":"#39d98a", "--yellow":"#ffd166", "--topbar":"rgba(9,11,16,.9)", "--hero-a":"#171b27", "--hero-b":"#11151d", "--glow":"rgba(255,79,134,.25)", "--stat":"rgba(255,255,255,.04)", "--pill-bg":"rgba(255,79,134,.12)", "--pill-text":"#ff8eaf", "--progress":"#252b35", "--primary2":"#ff6aa0", "--mini":"#272e3a", "--link":"#9eb7ff", "--toast-bg":"#eef2f7", "--toast-text":"#111111", "--date-scheme":"dark" },
    navy:{ "--bg":"#071525", "--panel":"#0d2036", "--panel2":"#122b46", "--line":"#244260", "--text":"#eef7ff", "--muted":"#9ab2c9", "--accent":"#39b9ff", "--accent2":"#6c7dff", "--green":"#48d6a2", "--yellow":"#ffd36a", "--topbar":"rgba(7,21,37,.91)", "--hero-a":"#122d4b", "--hero-b":"#0b1b30", "--glow":"rgba(57,185,255,.22)", "--stat":"rgba(255,255,255,.055)", "--pill-bg":"rgba(57,185,255,.14)", "--pill-text":"#8bd6ff", "--progress":"#193650", "--primary2":"#6484ff", "--mini":"#193a59", "--link":"#8bd6ff", "--toast-bg":"#eaf6ff", "--toast-text":"#102235", "--date-scheme":"dark" },
    gray:{ "--bg":"#282b31", "--panel":"#343840", "--panel2":"#41464f", "--line":"#575e69", "--text":"#f4f5f7", "--muted":"#b6bbc4", "--accent":"#ffc857", "--accent2":"#ed8f55", "--green":"#67d9a5", "--yellow":"#ffd773", "--topbar":"rgba(40,43,49,.92)", "--hero-a":"#414650", "--hero-b":"#30343b", "--glow":"rgba(255,200,87,.18)", "--stat":"rgba(255,255,255,.06)", "--pill-bg":"rgba(255,200,87,.14)", "--pill-text":"#ffe09a", "--progress":"#4a505a", "--primary2":"#ee9b61", "--mini":"#505762", "--link":"#ffd98a", "--toast-bg":"#f4f5f7", "--toast-text":"#24272d", "--date-scheme":"dark" }
  };
  const navBackgrounds = { white:"rgba(255,255,255,.94)", black:"rgba(12,15,21,.94)", navy:"rgba(7,21,37,.94)", gray:"rgba(40,43,49,.94)" };
  themeColor = themes[color] ? color : "black";
  Object.entries(themes[themeColor]).forEach(([name, value]) => document.documentElement.style.setProperty(name, value));
  document.documentElement.style.setProperty("--nav-bg", navBackgrounds[themeColor]);
  if(persist) localStorage.setItem("cq_theme_color", themeColor);
}

function previewTheme(color){
  applyTheme(color, true);
}

function syncAvatar(){
  const avatar = document.querySelector("#avatar");
  if(!avatar) return;
  const label = (profileName || currentUser?.email || "T").trim();
  avatar.textContent = (label.slice(0, 1) || "T").toUpperCase();
}

async function updateProfile(event){
  event.preventDefault();
  const form = event.currentTarget;
  const displayName = form.display_name.value.trim().slice(0, 40);
  const color = form.theme_color.value;
  if(!displayName) return toast("請填寫暱稱");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try{
    profileName = displayName;
    applyTheme(color);
    await saveCloudProfile();
    syncAvatar();
    toast("個人資料已儲存");
    render("profile");
  }catch(error){ toast(`⚠️ ${error.message}`); }
  finally{ button.disabled = false; }
}

function escapeHtml(value){
  return String(value || "").replace(/[&<>'"]/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[character]));
}

function recordSearch(kind, label){
  if(!label) return;
  fetch(`${SUPABASE_URL}/rest/v1/search_events`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ kind, label }) }).catch(() => {});
}

async function signOut(){
  try{ if(authSession) await authRequest("logout", { method:"POST", headers:{ "Authorization": `Bearer ${authSession.access_token}` } }); }catch(error){}
  authSession = null; currentUser = null; profileName = ""; isAdmin = false;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  toast("已登出");
  render("profile");
}

async function supabaseFetch(
  table,
  params
){

  const url =
    `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`;

  const response =
    await fetch(
      url,
      {
        method:"GET",

        headers:{
          "apikey":
            SUPABASE_PUBLISHABLE_KEY,

          "Authorization":
            `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,

          "Accept":
            "application/json"
        }
      }
    );


  if(!response.ok){

    const errorText =
      await response.text();

    throw new Error(errorText);

  }


  return response.json();

}


// ========================================
// 載入分店
// ========================================

async function loadBranches(){

  const params =
    new URLSearchParams({

      select:
        "id,name,city,official_url",

      order:
        "city.asc,name.asc"

    });


  branches =
    await supabaseFetch(
      "branches",
      params
    );


  if(!branches.length){

    throw new Error(
      "Supabase branches 沒有資料"
    );

  }


  // 如果之前有選過分店
  // 而且這間分店仍然存在
  // 就保留使用者的選擇

  if(selectedBranchId){

    const savedBranch =
      branches.find(
        branch =>
          branch.id === selectedBranchId
      );


    if(savedBranch){

      selectedBranchName =
        savedBranch.name;

      selectedCity =
        savedBranch.city || "";

      localStorage.setItem(
        "cq_city",
        selectedCity
      );

    }else{

      selectedBranchId = "";
      selectedBranchName = "";

      localStorage.removeItem(
        "cq_branch_id"
      );

      localStorage.removeItem(
        "cq_branch_name"
      );

    }

  }


  if(
    selectedCity &&
    !branches.some(
      branch =>
        branch.city === selectedCity
    )
  ){

    selectedCity = "";

    localStorage.removeItem(
      "cq_city"
    );

  }

}


// World Gym's public Find a Club response supplies the authoritative mapping
// from each Taiwanese branch name to its public schedule-page slug.
async function loadWorldGymBranchSlugs(){

  try{

    const response =
      await fetch("/api/worldgym-branches");

    const payload =
      await response.json();

    if(!response.ok || !payload.success){
      throw new Error(payload.error || "World Gym 分店清單載入失敗");
    }

    worldGymBranchSlugs =
      new Map(
        payload.branches.map(
          branch => [
            normalizedBranchName(branch.name),
            branch.slug
          ]
        )
      );

    worldGymBranchLocations = new Map(
      payload.branches.map(branch => [normalizedBranchName(branch.name), { latitude: branch.latitude, longitude: branch.longitude }])
    );

    const expressBranchNames =
      new Set(
        payload.branches
          .filter(
            branch =>
              branch.series === "Express"
          )
          .map(
            branch =>
              normalizedBranchName(branch.name)
          )
      );

    // Express stores are intentionally excluded from CARDIO TAIWAN's
    // branch selector, using World Gym's own public series classification.
    branches =
      branches.filter(
        branch =>
          !expressBranchNames.has(
            normalizedBranchName(branch.name)
          )
      );

    if(
      selectedBranchId &&
      !branches.some(
        branch =>
          branch.id === selectedBranchId
      )
    ){

      selectedBranchId = "";
      selectedBranchName = "";
      schedule = [];

      localStorage.removeItem(
        "cq_branch_id"
      );

      localStorage.removeItem(
        "cq_branch_name"
      );

    }

  }catch(error){

    // Keep the existing Supabase schedule path usable if the public list
    // is temporarily unavailable.
    console.warn(
      "World Gym branch list error:",
      error
    );

  }

}


// ========================================
// 載入指定分店＋指定日期
// ========================================

async function loadSchedule(){

  schedule = [];


  // 沒選分店
  if(!selectedBranchId){

    return;

  }


  // 沒選日期
  if(!selectedDate){

    return;

  }


  const selectedBranch =
    branches.find(
      branch =>
        branch.id === selectedBranchId
    );

  const branchSlug =
    worldGymBranchSlug(
      selectedBranch?.official_url,
      selectedBranch?.name
    );


  // A branch with an official public schedule URL is read live from our
  // serverless parser. The parser returns World Gym's class_date directly.
  if(branchSlug){

    const response =
      await fetch(
        `/api/sync-worldgym?branch=${encodeURIComponent(branchSlug)}&date=${encodeURIComponent(selectedDate)}`
      );

    const payload =
      await response.json();

    if(!response.ok || !payload.success){

      throw new Error(
        payload.error || "World Gym 課表載入失敗"
      );

    }

    schedule =
      payload.classes.map(
        item => ({

          time: item.startTime || "",
          end: item.endTime || "",
          name: item.className || "未命名課程",
          room: item.classroom || "",
          instructor: item.instructor || "",
          type: item.category || ""

        })
      );

    return;

  }


  const params =
    new URLSearchParams({

      select:
        "date,start_time,end_time,room,instructor,classes(name,category)",

      branch_id:
        `eq.${selectedBranchId}`,

      date:
        `eq.${selectedDate}`,

      order:
        "start_time.asc"

    });


  const rows =
    await supabaseFetch(
      "class_schedules",
      params
    );


  schedule =
    rows.map(
      row => ({

        time:
          row.start_time
            ? row.start_time.slice(0,5)
            : "",

        end:
          row.end_time
            ? row.end_time.slice(0,5)
            : "",

        name:
          row.classes?.name ||
          "未命名課程",

        room:
          row.room || "",

        instructor:
          row.instructor || "",

        type:
          row.classes?.category || ""

      })
    );

}


// ========================================
// 選擇分店
// ========================================

async function changeBranch(
  branchId
){

  const branch =
    branches.find(
      item =>
        item.id === branchId
    );


  if(!branch){

    return;

  }


  selectedBranchId =
    branch.id;

  recordSearch("branch_search", branch.name);

  selectedBranchName =
    branch.name;

  selectedCity =
    branch.city || "";


  localStorage.setItem(
    "cq_branch_id",
    selectedBranchId
  );

  localStorage.setItem(
    "cq_branch_name",
    selectedBranchName
  );

  localStorage.setItem(
    "cq_city",
    selectedCity
  );


  // 選擇分店後
  // 如果還沒選日期，不抓課表

  if(selectedDate){

    await refreshSchedule();

  }else{

    render("classes");

  }

}


// ========================================
// 選擇縣市
// ========================================

function changeCity(city){

  selectedCity = city;

  if(city) recordSearch("city", city);

  localStorage.setItem(
    "cq_city",
    selectedCity
  );

  selectedBranchId = "";
  selectedBranchName = "";
  schedule = [];

  localStorage.removeItem(
    "cq_branch_id"
  );

  localStorage.removeItem(
    "cq_branch_name"
  );

  render("classes");

}


// ========================================
// 選擇日期
// ========================================

async function changeDate(
  date
){

  if(!date){

    selectedDate = "";

    localStorage.removeItem(
      "cq_date"
    );

    schedule = [];

    render("classes");

    return;

  }


  selectedDate =
    date;


  localStorage.setItem(
    "cq_date",
    selectedDate
  );


  // 沒選分店
  // 不查詢

  if(!selectedBranchId){

    render("classes");

    return;

  }


  await refreshSchedule();

}


// ========================================
// 重新抓課表
// ========================================

async function refreshSchedule(){

  const list =
    document.querySelector(
      "#classList"
    );


  if(list){

    list.innerHTML = `

      <div class="schedule-loading">

        正在載入
        ${formatDate(selectedDate)}
        的課表…

      </div>

    `;

  }


  try{

    await loadSchedule();

    render("classes");

  }catch(error){

    console.error(
      "Schedule error:",
      error
    );

    schedule = [];

    render("classes");

    toast(
      "⚠️ 課表載入失敗"
    );

  }

}


// ========================================
// 完成課程
// ========================================

async function completeWorkout(name){

  xp += 300;

  completed += 1;

  streak =
    Math.max(
      streak,
      1
    );


  localStorage.setItem(
    "cq_xp",
    xp
  );

  localStorage.setItem(
    "cq_completed",
    completed
  );

  localStorage.setItem(
    "cq_streak",
    streak
  );

  if(currentUser && authSession){
    try{
      await saveCloudProfile();
      await fetch(`${SUPABASE_URL}/rest/v1/workouts`, {
        method: "POST",
        headers: { ...authHeaders(), "Prefer": "return=minimal" },
        body: JSON.stringify({ user_id: currentUser.id, class_name: name, xp_awarded: 300 })
      });
    }catch(error){
      console.warn("Workout sync error:", error);
      toast("已完成課程，雲端同步稍後會再嘗試");
    }
  }


  toast(
    `🎉 ${name} 完成！ +300 XP`
  );


  render("home");

}


function saveTask(c){
  if(!selectedBranchId || !selectedDate) return toast("請先選好分店與日期");
  const task = { id:`${selectedBranchId}|${selectedDate}|${c.time}|${c.name}`, branchId:selectedBranchId, branchName:selectedBranchName, city:selectedCity, date:selectedDate, ...c };
  if(!savedTasks.some(item => item.id === task.id)) savedTasks.push(task);
  localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
  toast("已加入我的任務");
  nav("home");
}

function taskExpired(task){
  const end = new Date(`${task.date}T${task.end || task.time}:00`);
  return !Number.isNaN(end.getTime()) && new Date() > new Date(end.getTime() + 3600000);
}

function bindTaskSwipe(){
  document.querySelectorAll(".task-swipe[data-task-index]").forEach(wrapper => {
    let startX = 0;
    let offset = 0;
    const element = wrapper.querySelector(".saved-task");
    wrapper.addEventListener("touchstart", event => { startX = event.touches[0].clientX; offset = wrapper.classList.contains("swiped") ? -104 : 0; }, { passive:true });
    wrapper.addEventListener("touchmove", event => {
      const difference = Math.min(0, Math.max(-104, offset + event.touches[0].clientX - startX));
      element.style.transform = `translateX(${difference}px)`;
    }, { passive:true });
    element.addEventListener("touchend", event => {
      const difference = event.changedTouches[0].clientX - startX;
      element.style.transform = "";
      wrapper.classList.toggle("swiped", difference < -55 || (offset && difference < 35));
    }, { passive:true });
  });
}

function removeTask(index){
  savedTasks.splice(index, 1);
  localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
  toast("任務已移除");
  render("home");
}

function completeSavedTask(index){
  const task = savedTasks[index];
  if(!task) return;
  completeWorkout(task, task);
}

function bilingualCourseName(name){
  const pairs = [
    ["BODYCOMBAT", "有氧格鬥"], ["BODYPUMP", "槓鈴肌力"], ["BODYBALANCE", "身心靈平衡"],
    ["BODYATTACK", "有氧體能"], ["BODYJAM", "舞蹈有氧"], ["RPM", "飛輪"],
    ["SPRINT", "高強度飛輪"], ["瑜伽", "Yoga"], ["皮拉提斯", "Pilates"], ["飛輪", "Indoor Cycling"]
  ];
  const found = pairs.find(([first, second]) => String(name).toUpperCase().includes(first) || String(name).includes(second));
  return found ? `${name} · ${String(name).toUpperCase().includes(found[0]) ? found[1] : found[0]}` : name;
}

function distanceMeters(aLat, aLng, bLat, bLng){
  const rad = value => value * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat/2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng/2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

function requestCurrentPosition(){
  return new Promise((resolve, reject) => {
    if(!navigator.geolocation) return reject(new Error("此裝置不支援定位"));
    navigator.geolocation.getCurrentPosition(resolve, error => reject(new Error(error.code === 1 ? "請允許定位權限後再驗證" : "目前無法取得定位")), { enableHighAccuracy:true, timeout:15000, maximumAge:0 });
  });
}

async function completeWorkout(c, taskContext = null){
  if(!currentUser) return toast("請先使用 Google 登入");
  const context = taskContext || { branchId:selectedBranchId, branchName:selectedBranchName, city:selectedCity, date:selectedDate };
  if(!context.branchId || !context.date) return toast("請從課表選擇要完成的課程");
  const start = new Date(`${context.date}T${c.time}:00`);
  const now = new Date();
  if(Number.isNaN(start.getTime()) || now < start) return toast("不能完成任務的原因：尚未開課");
  if(now > new Date(start.getTime() + 3600000)) return toast("不能完成任務的原因：已超過開課後 1 小時");
  const branchLocation = worldGymBranchLocations.get(normalizedBranchName(context.branchName));
  if(!branchLocation?.latitude || !branchLocation?.longitude) return toast("此分店定位資料載入中，請稍後再試");
  try{
    toast("正在驗證你是否在分店 200 公尺內…");
    const position = await requestCurrentPosition();
    const meters = distanceMeters(position.coords.latitude, position.coords.longitude, branchLocation.latitude, branchLocation.longitude);
    if(meters > 200) return toast("不能完成任務的原因：未在任務區（需在分店 200 公尺內）");
    xp += 300; completed += 1; streak = Math.max(streak, 1);
    localStorage.setItem("cq_xp", xp); localStorage.setItem("cq_completed", completed); localStorage.setItem("cq_streak", streak);
    await saveCloudProfile();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/workouts`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ user_id:currentUser.id, class_name:c.name, xp_awarded:300, branch_name:context.branchName, city:context.city, class_start_at:start.toISOString(), verified:true, distance_meters:Math.round(meters) }) });
    if(!response.ok) throw new Error("完成紀錄同步失敗");
    savedTasks = savedTasks.filter(task => !(task.branchId === context.branchId && task.date === context.date && task.time === c.time && task.name === c.name));
    localStorage.setItem("cq_saved_tasks", JSON.stringify(savedTasks));
    toast(`🎉 ${c.name} 已驗證完成！ +300 XP`); render("home");
  }catch(error){ toast(`⚠️ ${error.message}`); }
}

// ========================================
// 導覽
// ========================================

function nav(tab){

  localStorage.setItem(
    "cq_tab",
    tab
  );

  render(tab);

}


document
  .querySelectorAll("[data-tab]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        nav(
          button.dataset.tab
        );

      }
    );

  });


// ========================================
// Render
// ========================================

function render(
  tab = "home"
){

  syncAvatar();

  document
    .querySelectorAll("[data-tab]")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.tab === tab
      );

    });


  const titles = {

    home:"首頁",

    classes:"課表",

    badges:"成就",

    social:"統計",

    profile:"我的"

  };


  title.textContent =
    titles[tab] || "首頁";


  if(tab === "home"){
    home();
  }

  if(tab === "classes"){
    classes();
  }

  if(tab === "badges"){
    badgePage();
  }

  if(tab === "social"){
    leaderboard();
  }

  if(tab === "profile"){
    profile();
  }

}


// ========================================
// 首頁
// ========================================

function home(){

  content.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        WELCOME BACK
      </div>

      <h2>
        ${(profileName || (currentUser ? currentUser.email.split("@")[0] : "運動夥伴"))} 👋
      </h2>

      <div class="muted">
        今天也把一點 XP 帶回家。
      </div>

      <div class="stats">

        <div class="stat">
          <b>
            ${xp.toLocaleString()}
          </b>
          <small>XP</small>
        </div>

        <div class="stat">
          <b>
            Lv.${Math.floor(xp / 1000) + 1}
          </b>
          <small>等級</small>
        </div>

        <div class="stat">
          <b>
            🔥 ${streak}
          </b>
          <small>Streak</small>
        </div>

      </div>

    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          🎯 今日任務
        </h3>

        <span>
          ${savedTasks.length} 項待解
        </span>

      </div>


      <div class="quest">

        <div class="row">

          <div>

            <span class="pill">
              DAILY QUEST
            </span>

            <h3 style="margin:8px 0 3px">
              完成一堂有氧課
            </h3>

            <div class="muted">
              完成任一課程即可獲得 XP
            </div>

          </div>

          <div class="xp">
            +300
          </div>

        </div>


        <div class="progress">

          <i
            style="
              width:${completed % 2 ? 100 : 35}%
            "
          ></i>

        </div>


        <button
          class="primary"
          onclick="nav('classes')"
        >
          找今天的課
        </button>

      </div>

    </section>


    <section class="section">
      <div class="section-title"><h3>🧩 待解任務</h3><span>左滑顯示刪除</span></div>
      ${savedTasks.length ? `<div class="saved-task-list">${savedTasks.map((task, index) => `<div class="task-swipe" data-task-index="${index}"><button class="task-delete" type="button" onclick="removeTask(${index})">刪除</button><div class="saved-task ${taskExpired(task) ? "expired" : ""}"><b>${escapeHtml(bilingualCourseName(task.name))}${taskExpired(task) ? " · 已逾期" : ""}</b><span>${escapeHtml(task.branchName)} · ${task.date} ${task.time}${task.end ? `–${task.end}` : ""}</span>${taskExpired(task) ? "" : `<button class="primary" type="button" onclick="completeSavedTask(${index})">完成任務</button>`}</div></div>`).join("")}</div>` : `<div class="quest muted">從課表按「加入任務」，就會出現在這裡。</div>`}
    </section>

  `;

  bindTaskSwipe();

}


// ========================================
// 課程卡片
// ========================================

function card(c){

  return `

    <article class="class-card">

      <div class="row">

        <div>

          <div class="class-time">
            ${c.time} - ${c.end}
          </div>

          <div class="class-name">
            ${bilingualCourseName(c.name)}
          </div>

          <div class="class-meta">

            ${c.room}
            · 教練
            ${c.instructor}

            <br>

            ${c.type}

          </div>

        </div>


        <div class="card-actions">
          <button class="ghost" onclick='saveTask(${JSON.stringify(c)})'>加入任務</button>
          <button class="primary" onclick='completeWorkout(${JSON.stringify(c)})'>驗證完成</button>
        </div>

      </div>

    </article>

  `;

}


// ========================================
// 課表
// ========================================

function classes(){

  injectScheduleStyles();


  // ======================================
  // 分店選單：依縣市分組
  // ======================================

  const cityOrder = [

    "基隆市",
    "臺北市",
    "新北市",
    "桃園市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    "臺中市",
    "彰化縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "臺南市",
    "高雄市",
    "屏東縣",
    "宜蘭縣",
    "花蓮縣",
    "臺東縣"

  ];


  const groupedBranches = {};


  branches.forEach(
    branch => {

      const city =
        branch.city || "其他地區";


      if(!groupedBranches[city]){

        groupedBranches[city] = [];

      }


      groupedBranches[city].push(
        branch
      );

    }
  );


  const sortedCities = [

    ...cityOrder.filter(
      city =>
        groupedBranches[city]
    ),

    ...Object.keys(groupedBranches)
      .filter(
        city =>
          !cityOrder.includes(city)
      )
      .sort(
        (a,b) =>
          a.localeCompare(
            b,
            "zh-Hant"
          )
      )

  ];


  const cityOptions =
    sortedCities
      .map(
        city => `
          <option
            value="${city}"
            ${city === selectedCity ? "selected" : ""}
          >
            ${city}
          </option>
        `
      )
      .join("");

  const branchOptions =
    (groupedBranches[selectedCity] || [])
      .sort(
        (a,b) =>
          a.name.localeCompare(
            b.name,
            "zh-Hant"
          )
      )
      .map(
        branch => `
          <option
            value="${branch.id}"
            ${branch.id === selectedBranchId ? "selected" : ""}
          >
            ${branch.name}
          </option>
        `
      )
      .join("");


  const selectedBranchDetails =
    branches.find(
      b =>
        b.id === selectedBranchId
    );

  const displayBranchSlug =
    worldGymBranchSlug(
      selectedBranchDetails?.official_url,
      selectedBranchDetails?.name
    );

  const officialUrl =
    selectedBranchDetails?.official_url ||
    (
      displayBranchSlug
        ? `https://www.worldgymtaiwan.com/en/find-a-club/${displayBranchSlug}/aerobics-class-schedule`
        : ""
    );

  const hasLiveWorldGymSchedule =
    Boolean(
      displayBranchSlug
    );


  content.innerHTML = `

    <section class="schedule-controls">


      <div class="schedule-control">

        <div class="schedule-control-label">
          🗺️ 縣市
        </div>

        <select
          id="citySelector"
          class="schedule-control-input"
        >

          <option
            value=""
            ${!selectedCity ? "selected" : ""}
          >
            請選擇縣市
          </option>

          ${cityOptions}

        </select>

      </div>


      <div class="schedule-control">

        <div class="schedule-control-label">
          📍 店名
        </div>


        <select
          id="branchSelector"
          class="schedule-control-input"
          ${!selectedCity ? "disabled" : ""}
        >

          <option
            value=""
            ${
              !selectedBranchId
                ? "selected"
                : ""
            }
          >
            請選擇店名
          </option>

          ${branchOptions}

        </select>

      </div>


      <div class="schedule-control">

        <div class="schedule-control-label">
          📅 日期
        </div>


        <input
          id="dateSelector"
          class="schedule-control-input schedule-date-input"
          type="date"
          value="${selectedDate}"
          ${
            !selectedBranchId
              ? "disabled"
              : ""
          }
        >

      </div>

    </section>


    ${
      !selectedBranchId

        ? `

          <div class="schedule-notice">

            📍 請先選擇分店

            <br><br>

            選擇分店後，
            就可以選擇日期查看課表。

          </div>

        `

        : !selectedDate

          ? `

            <div class="schedule-notice">

              📅 請選擇日期

            </div>

          `

          : `

            <section class="section">

              <div class="schedule-heading">

                <h3>
                  📍 ${selectedBranchName}
                </h3>

                <span class="schedule-heading-date">
                  ${formatDateSlash(selectedDate)}
                </span>

              </div>


              <div id="classList">

                ${
                  schedule.length

                    ? schedule
                        .map(card)
                        .join("")

                    : `

                      <div class="schedule-empty">

                        <div
                          style="
                            font-size:32px;
                            margin-bottom:8px
                          "
                        >
                          🗓️
                        </div>

                        <div
                          style="
                            font-weight:700;
                            margin-bottom:6px
                          "
                        >
                          本日沒有課程資料
                        </div>

                        <div
                          style="font-size:14px"
                        >
                          ${selectedBranchName}
                          ·
                          ${formatDate(selectedDate)}
                        </div>

                      </div>

                    `
                }

              </div>


              ${
                officialUrl

                  ? `

                    <div class="source">

                      資料來源：
                      World Gym Taiwan
                      公開有氧課表。

                      <br>

                      ${
                        hasLiveWorldGymSchedule
                          ? "本頁資料由 World Gym 公開課表即時解析。"
                          : "本頁資料由 CARDIO TAIWAN Supabase 資料庫提供。"
                      }

                      <br><br>

                      <a
                        href="${officialUrl}"
                        target="_blank"
                        rel="noreferrer"
                      >
                        查看官方課表
                      </a>

                    </div>

                  `

                  : ""

              }

            </section>

          `

    }

  `;


  // ======================================
  // 縣市選擇
  // ======================================

  const citySelector =
    document.querySelector(
      "#citySelector"
    );

  if(citySelector){

    citySelector.addEventListener(
      "change",
      event => {
        changeCity(
          event.target.value
        );
      }
    );

  }


  // ======================================
  // 店名選擇
  // ======================================

  const branchSelector =
    document.querySelector(
      "#branchSelector"
    );


  if(branchSelector){

    branchSelector.addEventListener(
      "change",
      async event => {

        branchSelector.disabled =
          true;

        try{

          await changeBranch(
            event.target.value
          );

        }finally{

          branchSelector.disabled =
            false;

        }

      }
    );

  }


  // ======================================
  // 日期選擇
  // ======================================

  const dateSelector =
    document.querySelector(
      "#dateSelector"
    );


  if(dateSelector){

    dateSelector.addEventListener(
      "change",
      async event => {

        dateSelector.disabled =
          true;

        try{

          await changeDate(
            event.target.value
          );

        }finally{

          dateSelector.disabled =
            !selectedBranchId;

        }

      }
    );

  }


}


// ========================================
// 搜尋／篩選
// ========================================

function filterClasses(q){

  const list =
    document.querySelector(
      "#classList"
    );


  if(!list){
    return;
  }


  const term =
    (q || "all")
      .toLowerCase()
      .trim();


  const rows =
    schedule.filter(
      c => {

        if(term === "all"){
          return true;
        }


        return Object
          .values(c)
          .join(" ")
          .toLowerCase()
          .includes(term);

      }
    );


  list.innerHTML =

    rows.length

      ? rows
          .map(card)
          .join("")

      : `

        <div class="schedule-empty">

          <div
            style="
              font-size:30px;
              margin-bottom:8px
            "
          >
            🔎
          </div>

          找不到符合的課程。

        </div>

      `;

}


// ========================================
// 勳章
// ========================================

function badgePage(){

  const unlocked =
    badges.filter(
      b => b[3]
    ).length;


  content.innerHTML = `

    <div class="section-title">

      <h3>
        🏅 Badge Collection
      </h3>

      <span>
        ${Math.min(unlocked, completed)}
        / ${badges.length}
      </span>

    </div>


    <div class="badge-grid">

      ${badges.map(
        b => `

          <article
            class="
              badge
              ${b[3] ? "" : "locked"}
            "
          >

            <div class="badge-icon">
              ${b[0]}
            </div>

            <h4>
              ${b[1]}
            </h4>

            <p>
              ${b[2]}
            </p>

            ${
              b[3]

                ? `

                  <div
                    class="pill"
                    style="margin-top:12px"
                  >
                    UNLOCKED
                  </div>

                `

                : `

                  <div
                    style="margin-top:12px"
                  >
                    🔒 LOCKED
                  </div>

                `
            }

          </article>

        `
      ).join("")}

    </div>

  `;

}


// ========================================
// 社群
// ========================================

async function social(){
  const cities = [...new Set(branches.map(branch => branch.city).filter(Boolean))];
  const filteredBranches = branches.filter(branch => !socialCity || branch.city === socialCity);
  const cityOptions = cities.map(city => `<option value="${escapeHtml(city)}" ${city === socialCity ? "selected" : ""}>${escapeHtml(city)}</option>`).join("");
  const branchOptions = filteredBranches.map(branch => `<option value="${branch.id}" ${branch.id === socialBranchId ? "selected" : ""}>${escapeHtml(branch.name)}</option>`).join("");
  content.innerHTML = `
    <section class="section">
      <div class="section-title"><h3>👥 社群留言板</h3><span>依地區找運動夥伴</span></div>
      <div class="quest community-filters">
        <label>縣市<select onchange="changeSocialCity(this.value)"><option value="">全部縣市</option>${cityOptions}</select></label>
        <label>分店<select onchange="changeSocialBranch(this.value)"><option value="">全部分店</option>${branchOptions}</select></label>
      </div>
      ${currentUser ? `
        <form class="quest community-form" onsubmit="submitCommunityPost(event)">
          <h3>留下你的留言</h3>
          <textarea name="message" maxlength="500" required placeholder="分享今天的課程、揪團或運動心得…"></textarea>
          <button class="primary" type="submit">發布留言</button>
        </form>` : `
        <div class="quest"><b>登入後即可留言</b><p class="muted">你可在「我的」頁設定暱稱與 IG，讓留言更容易被認識。</p><button class="ghost" onclick="nav('profile')">前往登入</button></div>`}
      <div id="communityPosts" class="section"><div class="muted">載入留言中…</div></div>
    </section>`;
  await loadCommunityPosts();
}

function changeSocialCity(city){
  socialCity = city;
  socialBranchId = "";
  social();
}

function changeSocialBranch(branchId){
  socialBranchId = branchId;
  social();
}

async function loadCommunityPosts(){
  const target = document.querySelector("#communityPosts");
  if(!target) return;
  try{
    const params = new URLSearchParams({ select:"id,author_name,author_instagram,city,branch_name,message,created_at", order:"created_at.desc", limit:"100" });
    if(socialCity) params.set("city", `eq.${socialCity}`);
    if(socialBranchId){
      const branch = branches.find(item => item.id === socialBranchId);
      if(branch) params.set("branch_name", `eq.${branch.name}`);
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/community_posts?${params}`, { headers: authHeaders() });
    if(!response.ok) throw new Error("留言載入失敗");
    const posts = await response.json();
    target.innerHTML = posts.length ? posts.map(post => {
      const name = escapeHtml(post.author_name || "運動夥伴");
      const handle = String(post.author_instagram || "").replace(/^@/, "");
      const ig = handle ? `<a class="ig-link" href="https://instagram.com/${encodeURIComponent(handle)}" target="_blank" rel="noopener">@${escapeHtml(handle)}</a>` : "";
      const time = new Date(post.created_at).toLocaleString("zh-TW", { month:"numeric", day:"numeric", hour:"2-digit", minute:"2-digit" });
      return `<article class="post"><div class="post-header"><div class="mini-avatar">${name.slice(0,1).toUpperCase()}</div><div><b>${name}</b>${ig}<div class="muted">${escapeHtml(post.city || "其他地區")} · ${escapeHtml(post.branch_name || "未指定分店")} · ${time}</div></div></div><p>${escapeHtml(post.message).replace(/\n/g,"<br>")}</p></article>`;
    }).join("") : `<div class="quest muted">這個地區目前還沒有留言，來當第一位吧！</div>`;
  }catch(error){ target.innerHTML = `<div class="quest muted">${escapeHtml(error.message)}</div>`; }
}

async function submitCommunityPost(event){
  event.preventDefault();
  const message = event.currentTarget.message.value.trim();
  const branch = branches.find(item => item.id === socialBranchId);
  if(!socialCity || !branch) return toast("請先選擇縣市與分店再留言");
  const button = event.currentTarget.querySelector("button[type=submit]");
  button.disabled = true;
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/community_posts`, { method:"POST", headers:{ ...authHeaders(), "Prefer":"return=minimal" }, body:JSON.stringify({ user_id:currentUser.id, author_name:profileName || currentUser.email.split("@")[0], author_instagram:null, city:socialCity, branch_name:branch.name, message }) });
    if(!response.ok) throw new Error("留言發布失敗");
    toast("留言已發布");
    social();
  }catch(error){ toast(`⚠️ ${error.message}`); }
  finally{ button.disabled = false; }
}


async function leaderboard(){
  content.innerHTML = `<section class="section"><div class="section-title"><h3>🏆 排行榜</h3><span>已驗證完成與查詢熱度</span></div><div id="leaderboards" class="muted">載入排行榜中…</div></section>`;
  const target = document.querySelector("#leaderboards");
  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/leaderboard_stats`, { method:"POST", headers:authHeaders(), body:"{}" });
    if(!response.ok) throw new Error("排行榜載入失敗");
    const rows = await response.json();
    const titles = { popular_class:"🔥 熱門有氧課", member:"👤 人員完成度", city:"🗺️ 地區查詢", branch_search:"📍 分店查詢", branch_complete:"🏢 分店課程完成", activity:"💪 運動項目完成" };
    target.innerHTML = Object.entries(titles).map(([kind, title]) => {
      const items = rows.filter(row => row.kind === kind).slice(0,5);
      return `<section class="quest leaderboard"><h3>${title}</h3>${items.length ? items.map((item,index) => `<div class="rank-row"><b>${index+1}. ${escapeHtml(item.label)}</b><span>${item.value}</span></div>`).join("") : `<div class="muted">尚無已驗證資料</div>`}</section>`;
    }).join("");
  }catch(error){ target.innerHTML = `<div class="quest muted">${escapeHtml(error.message)}</div>`; }
}

// ========================================
// 個人
// ========================================

async function adminRequest(action, payload = {}){
  if(!authSession?.access_token) throw new Error("請先登入管理員帳號");
  const response = await fetch("/api/admin", {
    method:"POST",
    headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${authSession.access_token}` },
    body:JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if(!response.ok) throw new Error(result.error || "後台服務暫時無法使用");
  return result;
}

function renderAdminMembers(members = []){
  const target = document.querySelector("#admin-members");
  if(!target) return;
  target.innerHTML = members.length ? members.map(member => `<div class="rank-row"><div><b>${escapeHtml(member.display_name || "未設定暱稱")}</b><div class="muted">XP ${Number(member.xp || 0)} · 已登入會員</div></div><button class="ghost danger" type="button" onclick="deleteMember('${member.id}')">移除</button></div>`).join("") : `<div class="muted">找不到符合的會員</div>`;
}

async function findMembers(event){
  event?.preventDefault();
  const input = document.querySelector("#admin-member-query");
  try{
    const result = await adminRequest("members", { query:input?.value || "" });
    const count = document.querySelector("#member-count");
    if(count) count.textContent = `${result.total || 0} 位會員`;
    renderAdminMembers(result.members || []);
  }catch(error){ toast(`⚠️ ${error.message}`); }
}

async function deleteMember(id){
  if(!confirm("確定要移除此會員及其完成紀錄嗎？這個動作無法復原。")) return;
  try{
    await adminRequest("delete_member", { id });
    toast("會員已移除");
    findMembers();
  }catch(error){ toast(`⚠️ ${error.message}`); }
}

async function clearStatistics(){
  if(!confirm("確定要清空所有排行榜統計、完成紀錄與 XP 嗎？會員帳號不會被刪除，這個動作無法復原。")) return;
  try{
    await adminRequest("clear_statistics");
    toast("統計資料已清空");
    findMembers();
  }catch(error){ toast(`⚠️ ${error.message}`); }
}

function openAdmin(){
  if(!isAdmin) return toast("你沒有後台管理權限");
  content.innerHTML = `
    <section class="hero profile-card"><div class="big-avatar">管</div><h2>後台管理</h2><div class="muted">僅限管理員使用；清除與移除操作皆無法復原。</div></section>
    <section class="section"><div class="quest"><div class="section-title"><h3>會員管理</h3><span id="member-count">載入中…</span></div><form class="admin-search" onsubmit="findMembers(event)"><input id="admin-member-query" maxlength="40" placeholder="用暱稱搜尋會員"><button class="primary" type="submit">查詢</button></form><div id="admin-members" class="admin-members"><div class="muted">正在載入會員資料…</div></div></div></section>
    <section class="section"><div class="quest"><h3>統計資料</h3><p class="muted">清空排行榜、完成紀錄、XP 與連續天數；不會刪除會員帳號。</p><button class="ghost danger" type="button" onclick="clearStatistics()">清空統計數據</button></div></section>
    <section class="section"><button class="ghost" type="button" onclick="nav('profile')">返回我的</button></section>`;
  findMembers();
}

function profile(){

  if(!currentUser){
    content.innerHTML = `
      <section class="hero profile-card">
        <div class="big-avatar">G</div>
        <h2>建立你的運動帳號</h2>
        <div class="muted">使用 Google 登入後，XP、完成紀錄與勳章會安全同步到自己的帳號。</div>
      </section>
      <section class="section">
        <div class="quest google-login-card">
          <h3>使用 Google 繼續</h3>
          <p class="muted">不需要收取或點選驗證信。</p>
          <button class="google-login" type="button" onclick="signInWithGoogle()"><span aria-hidden="true">G</span> 使用 Google 繼續</button>
        </div>
      </section>`;
    return;
  }

  content.innerHTML = `

    <section class="hero profile-card">

      <div class="big-avatar">
        ${(profileName || currentUser.email).slice(0,1).toUpperCase()}
      </div>

      <h2>
        ${profileName || currentUser.email.split("@")[0]}
      </h2>

      <div class="muted">
        Level
        ${Math.floor(xp / 1000) + 1}
      </div>


      <div class="stats">

        <div class="stat">

          <b>
            ${completed}
          </b>

          <small>
            完成課程
          </small>

        </div>


        <div class="stat">

          <b>
            ${xp}
          </b>

          <small>
            XP
          </small>

        </div>


        <div class="stat">

          <b>
            ${streak}
          </b>

          <small>
            Streak
          </small>

        </div>

      </div>

    </section>

    <section class="section">
      <form class="quest profile-settings" onsubmit="updateProfile(event)">
        <div class="section-title"><h3>⚙️ 個人設定</h3><span>同步你的帳號資料</span></div>
        <label>暱稱<input name="display_name" maxlength="40" required value="${escapeHtml(profileName || currentUser.email.split("@")[0])}"></label>
        <label>背景主題<select name="theme_color" onchange="previewTheme(this.value)">
          <option value="white" ${themeColor === "white" ? "selected" : ""}>白色</option>
          <option value="black" ${themeColor === "black" ? "selected" : ""}>黑色</option>
          <option value="navy" ${themeColor === "navy" ? "selected" : ""}>深藍色</option>
          <option value="gray" ${themeColor === "gray" ? "selected" : ""}>灰色</option>
        </select></label>
        <button class="primary" type="submit">儲存個人設定</button>
      </form>
    </section>

    <section class="section">
      <div class="account-actions"><button class="ghost" onclick="signOut()">登出帳號</button>${isAdmin ? `<button class="ghost" type="button" onclick="openAdmin()">後台管理</button>` : ""}</div>
    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          📊 我的紀錄
        </h3>

      </div>


      <div class="quest">

        <div class="row">

          <b>
            有氧完成率
          </b>

          <span class="xp">
            ${Math.min(
              100,
              completed * 8
            )}%
          </span>

        </div>


        <div class="progress">

          <i
            style="
              width:${Math.min(
                100,
                completed * 8
              )}%
            "
          ></i>

        </div>

      </div>

    </section>

  `;

}


// ========================================
// INIT
// ========================================

async function init(){

  try{

    injectScheduleStyles();
    applyTheme(themeColor, false);

    // Google OAuth 完成後會把工作階段放在網址雜湊中；取用後立刻清除網址。
    consumeAuthCallback();

    // 還原既有登入狀態；失效的工作階段會安全地回到訪客模式。
    await restoreSession();


    // ① 載入分店
    await loadBranches();

    // ② 載入 World Gym 公開分店對應，不影響既有 Supabase 資料。
    await loadWorldGymBranchSlugs();


    // ③ 只有「已經有分店＋日期」
    // 才載入課表

    if(
      selectedBranchId &&
      selectedDate
    ){

      await loadSchedule();

    }else{

      schedule = [];

    }


    // ④ 顯示目前頁面

    render(
      localStorage.getItem(
        "cq_tab"
      ) || "home"
    );


  }catch(error){

    console.error(
      "Supabase error:",
      error
    );


    schedule = [];


    render(
      localStorage.getItem(
        "cq_tab"
      ) || "home"
    );


    toast(
      "⚠️ 資料載入失敗"
    );

  }

}


// ========================================
// START
// ========================================

init();
