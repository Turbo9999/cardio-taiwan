const SUPABASE_URL = "https://wylfqwzictkepnefwksx.supabase.co";

// ⚠️ 把下面這串替換成你自己的 Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5ITurxoUWu2ihIkDBrzWaQ_8uFP1LxZ";

// 台北統領
const BRANCH_ID = "1d0c08d3-b6b9-473a-b76a-c6330a291888";

// 目前先抓 2026-09-17
const TARGET_DATE = "2026-09-17";

let schedule = [];

const badges = [
  ["🥊","Combat Rookie","完成 1 堂 BODYCOMBAT®",true],
  ["🥊","Combat Warrior","完成 25 堂 BODYCOMBAT®",false],
  ["🏋️","Pump Starter","完成 5 堂 BODYPUMP®",false],
  ["🔥","Cardio Beast","累積 50 小時有氧",false],
  ["⚡","Early Bird","完成 10 堂早晨課程",false],
  ["🌈","Class Collector","完成 5 種不同課程",false]
];

let xp = Number(localStorage.getItem("cq_xp") || 0);
let completed = Number(localStorage.getItem("cq_completed") || 0);
let streak = Number(localStorage.getItem("cq_streak") || 0);

const content = document.querySelector("#content");
const title = document.querySelector("#pageTitle");

function toast(msg){
  const el = document.querySelector("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

async function loadSchedule(){

  const params = new URLSearchParams({
    select: "date,start_time,end_time,room,instructor,classes(name,category)",
    branch_id: `eq.${BRANCH_ID}`,
    date: `eq.${TARGET_DATE}`,
    order: "start_time.asc"
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/class_schedules?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    }
  );

  if(!response.ok){
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const rows = await response.json();

  schedule = rows.map(row => ({
    time: row.start_time ? row.start_time.slice(0,5) : "",
    end: row.end_time ? row.end_time.slice(0,5) : "",
    name: row.classes?.name || "未命名課程",
    room: row.room || "",
    instructor: row.instructor || "",
    type: row.classes?.category || ""
  }));
}

function completeWorkout(name){

  xp += 300;
  completed += 1;
  streak = Math.max(streak, 1);

  localStorage.setItem("cq_xp", xp);
  localStorage.setItem("cq_completed", completed);
  localStorage.setItem("cq_streak", streak);

  toast(`🎉 ${name} 完成！ +300 XP`);

  render("home");
}

function nav(tab){

  localStorage.setItem("cq_tab", tab);

  render(tab);
}

document.querySelectorAll("[data-tab]").forEach(button => {

  button.addEventListener("click", () => {
    nav(button.dataset.tab);
  });

});

function render(tab = "home"){

  document.querySelectorAll("[data-tab]").forEach(button => {

    button.classList.toggle(
      "active",
      button.dataset.tab === tab
    );

  });

  const titles = {
    home: "首頁",
    classes: "課表",
    badges: "勳章",
    social: "社群",
    profile: "我的"
  };

  title.textContent = titles[tab];

  if(tab === "home") home();
  if(tab === "classes") classes();
  if(tab === "badges") badgePage();
  if(tab === "social") social();
  if(tab === "profile") profile();
}

function home(){

  content.innerHTML = `
    <section class="hero">

      <div class="eyebrow">WELCOME BACK</div>

      <h2>TURBO 👋</h2>

      <div class="muted">
        今天也把一點 XP 帶回家。
      </div>

      <div class="stats">

        <div class="stat">
          <b>${xp.toLocaleString()}</b>
          <small>XP</small>
        </div>

        <div class="stat">
          <b>Lv.${Math.floor(xp / 1000) + 1}</b>
          <small>等級</small>
        </div>

        <div class="stat">
          <b>🔥 ${streak}</b>
          <small>Streak</small>
        </div>

      </div>

    </section>

    <section class="section">

      <div class="section-title">
        <h3>🎯 今日任務</h3>
        <span>1 / 3</span>
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
          <i style="width:${completed % 2 ? 100 : 35}%"></i>
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

      <div class="section-title">

        <h3>📅 台北統領課程</h3>

        <span>
          ${schedule.length} 堂
        </span>

      </div>

      ${
        schedule.length
        ? schedule.slice(0,3).map(card).join("")
        : `<div class="muted">正在載入課表...</div>`
      }

    </section>
  `;
}

function card(c){

  return `
    <article class="class-card">

      <div class="row">

        <div>

          <div class="class-time">
            ${c.time} - ${c.end}
          </div>

          <div class="class-name">
            ${c.name}
          </div>

          <div class="class-meta">
            ${c.room} · 教練 ${c.instructor}
            <br>
            ${c.type}
          </div>

        </div>

        <button
          class="ghost"
          onclick='completeWorkout(${JSON.stringify(c.name)})'
        >
          完成
        </button>

      </div>

    </article>
  `;
}

function classes(){

  content.innerHTML = `

    <input
      class="search"
      id="q"
      placeholder="搜尋課程，例如 BODYCOMBAT、瑜伽、飛輪"
    >

    <div class="filterbar">

      <button
        class="ghost"
        onclick="filterClasses('all')"
      >
        全部
      </button>

      <button
        class="ghost"
        onclick="filterClasses('Les Mills')"
      >
        Les Mills
      </button>

      <button
        class="ghost"
        onclick="filterClasses('MOSSA')"
      >
        MOSSA
      </button>

      <button
        class="ghost"
        onclick="filterClasses('飛輪心率')"
      >
        飛輪
      </button>

      <button
        class="ghost"
        onclick="filterClasses('心肺肌力訓練')"
      >
        有氧
      </button>

    </div>

    <section class="section">

      <div class="section-title">

        <h3>📍 台北統領</h3>

        <span>
          2026/09/17
        </span>

      </div>

      <div id="classList">

        ${
          schedule.length
          ? schedule.map(card).join("")
          : `<div class="muted">正在載入課表...</div>`
        }

      </div>

      <div class="source">

        資料來源：World Gym Taiwan 公開有氧課表。<br>

        本頁資料由 CARDIO TAIWAN Supabase 資料庫提供。

        <br><br>

        <a
          href="https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule"
          target="_blank"
          rel="noreferrer"
        >
          查看官方課表
        </a>

      </div>

    </section>
  `;

  const search = document.querySelector("#q");

  if(search){

    search.addEventListener("input", event => {
      filterClasses(event.target.value);
    });

  }
}

function filterClasses(q){

  const list = document.querySelector("#classList");

  if(!list) return;

  const term = (q || "all").toLowerCase();

  const rows = schedule.filter(c => {

    return (
      term === "all" ||
      Object.values(c)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );

  });

  list.innerHTML =
    rows.map(card).join("") ||
    `<div class="muted">找不到符合的課程。</div>`;
}

function badgePage(){

  const unlocked =
    badges.filter(b => b[3]).length;

  content.innerHTML = `

    <div class="section-title">

      <h3>🏅 Badge Collection</h3>

      <span>
        ${Math.min(unlocked, completed)}
        / ${badges.length}
      </span>

    </div>

    <div class="badge-grid">

      ${badges.map(b => `

        <article class="badge ${b[3] ? "" : "locked"}">

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
            ? `<div class="pill" style="margin-top:12px">
                 UNLOCKED
               </div>`
            : `<div style="margin-top:12px">
                 🔒 LOCKED
               </div>`
          }

        </article>

      `).join("")}

    </div>
  `;
}

function social(){

  content.innerHTML = `

    <section class="section">

      <div class="section-title">

        <h3>👥 Community</h3>

        <span>附近健身玩家</span>

      </div>

      <article class="post">

        <div class="post-header">

          <div class="mini-avatar">
            K
          </div>

          <div>

            <b>Kevin</b>

            <div class="muted">
              剛剛 · 板橋
            </div>

          </div>

        </div>

        <p>
          🥊 今天完成 BODYCOMBAT®！又多一個 XP。
        </p>

        <div class="actions">
          ♡ 18　💬 3　🏅 Combat Rookie
        </div>

      </article>

      <article class="post">

        <div class="post-header">

          <div class="mini-avatar">
            A
          </div>

          <div>

            <b>Alex</b>

            <div class="muted">
              1 小時前 · 新北
            </div>

          </div>

        </div>

        <p>
          🔥 連續運動 7 天，今天繼續。
        </p>

        <div class="actions">
          ♡ 12　💬 1　🔥 7 DAY STREAK
        </div>

      </article>

    </section>
  `;
}

function profile(){

  content.innerHTML = `

    <section class="hero profile-card">

      <div class="big-avatar">
        T
      </div>

      <h2>
        TURBO
      </h2>

      <div class="muted">
        Level ${Math.floor(xp / 1000) + 1}
      </div>

      <div class="stats">

        <div class="stat">
          <b>${completed}</b>
          <small>完成課程</small>
        </div>

        <div class="stat">
          <b>${xp}</b>
          <small>XP</small>
        </div>

        <div class="stat">
          <b>${streak}</b>
          <small>Streak</small>
        </div>

      </div>

    </section>

    <section class="section">

      <div class="section-title">

        <h3>📊 我的紀錄</h3>

      </div>

      <div class="quest">

        <div class="row">

          <b>有氧完成率</b>

          <span class="xp">
            ${Math.min(100, completed * 8)}%
          </span>

        </div>

        <div class="progress">

          <i
            style="width:${Math.min(100, completed * 8)}%"
          ></i>

        </div>

      </div>

    </section>
  `;
}

async function init(){

  try{

    await loadSchedule();

    render(
      localStorage.getItem("cq_tab") || "home"
    );

  }catch(error){

    console.error("Supabase error:", error);

    schedule = [];

    render(
      localStorage.getItem("cq_tab") || "home"
    );

    toast("⚠️ 課表載入失敗");

  }

}

init();
