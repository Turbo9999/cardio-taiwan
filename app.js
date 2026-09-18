const SUPABASE_URL = "https://wylfqwzictkepnefwksx.supabase.co";

// ⚠️ 保留你目前 GitHub 裡原本的 Supabase Publishable Key
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5ITurxoUWu2ihIkDBrzWaQ_8uFP1LxZ";

// ================================
// CARDIO TAIWAN
// 動態分店 + 日期 + 課表版本
// ================================

// 預設分店
let selectedBranchId = "1d0c08d3-b6b9-473a-b76a-c6330a291888";
let selectedBranchName = "台北統領";

// 預設日期
// 目前資料庫有 2026-09-17 的測試課表
let selectedDate = "2026-09-17";

// 所有分店
let branches = [];

// 課表
let schedule = [];

// ================================
// BADGES
// ================================

const badges = [
  ["🥊","Combat Rookie","完成 1 堂 BODYCOMBAT®",true],
  ["🥊","Combat Warrior","完成 25 堂 BODYCOMBAT®",false],
  ["🏋️","Pump Starter","完成 5 堂 BODYPUMP®",false],
  ["🔥","Cardio Beast","累積 50 小時有氧",false],
  ["⚡","Early Bird","完成 10 堂早晨課程",false],
  ["🌈","Class Collector","完成 5 種不同課程",false]
];

// ================================
// LOCAL STORAGE
// ================================

let xp = Number(localStorage.getItem("cq_xp") || 0);
let completed = Number(localStorage.getItem("cq_completed") || 0);
let streak = Number(localStorage.getItem("cq_streak") || 0);

// ================================
// DOM
// ================================

const content = document.querySelector("#content");
const title = document.querySelector("#pageTitle");

// ================================
// TOAST
// ================================

function toast(msg){

  const el = document.querySelector("#toast");

  if(!el) return;

  el.textContent = msg;
  el.classList.add("show");

  setTimeout(() => {
    el.classList.remove("show");
  }, 1800);
}

// ================================
// LOAD BRANCHES
// 從 Supabase 取得所有分店
// ================================

async function loadBranches(){

  const params = new URLSearchParams({

    select:
      "id,name,city,official_url,latitude,longitude,checkin_radius",

    order:
      "city.asc,name.asc"

  });

  const response = await fetch(

    `${SUPABASE_URL}/rest/v1/branches?${params.toString()}`,

    {
      method: "GET",

      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization":
          `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    }

  );

  if(!response.ok){

    const errorText = await response.text();

    throw new Error(errorText);

  }

  branches = await response.json();

  // 如果預設分店不存在
  // 自動選第一間分店

  if(branches.length){

    const exists =
      branches.some(
        branch => branch.id === selectedBranchId
      );

    if(!exists){

      selectedBranchId = branches[0].id;
      selectedBranchName = branches[0].name;

    }

  }

}

// ================================
// LOAD SCHEDULE
// 根據目前選擇的分店＋日期抓課表
// ================================

async function loadSchedule(){

  if(!selectedBranchId){

    schedule = [];
    return;

  }

  const params = new URLSearchParams({

    select:
      "date,start_time,end_time,room,instructor,classes(name,category)",

    branch_id:
      `eq.${selectedBranchId}`,

    date:
      `eq.${selectedDate}`,

    order:
      "start_time.asc"

  });

  const response = await fetch(

    `${SUPABASE_URL}/rest/v1/class_schedules?${params.toString()}`,

    {
      method: "GET",

      headers: {
        "apikey": SUPABASE_PUBLISHABLE_KEY,
        "Authorization":
          `Bearer ${SUPABASE_PUBLISHABLE_KEY}`
      }
    }

  );

  if(!response.ok){

    const errorText = await response.text();

    throw new Error(errorText);

  }

  const rows = await response.json();

  schedule = rows.map(row => ({

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
      row.room ||
      "",

    instructor:
      row.instructor ||
      "",

    type:
      row.classes?.category ||
      ""

  }));

}

// ================================
// CHANGE BRANCH
// ================================

async function changeBranch(branchId){

  const branch =
    branches.find(
      branch => branch.id === branchId
    );

  if(!branch) return;

  selectedBranchId = branch.id;
  selectedBranchName = branch.name;

  try{

    await loadSchedule();

    render("classes");

    toast(`📍 已切換到 ${selectedBranchName}`);

  }catch(error){

    console.error(
      "Schedule error:",
      error
    );

    schedule = [];

    render("classes");

    toast("⚠️ 課表載入失敗");

  }

}

// ================================
// CHANGE DATE
// ================================

async function changeDate(date){

  if(!date) return;

  selectedDate = date;

  try{

    await loadSchedule();

    render("classes");

    toast(`📅 已切換到 ${selectedDate}`);

  }catch(error){

    console.error(
      "Schedule error:",
      error
    );

    schedule = [];

    render("classes");

    toast("⚠️ 課表載入失敗");

  }

}

// ================================
// COMPLETE WORKOUT
// 暫時仍使用 localStorage
// GPS 驗證之後再接
// ================================

function completeWorkout(name){

  xp += 300;

  completed += 1;

  streak =
    Math.max(streak, 1);

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

  toast(
    `🎉 ${name} 完成！ +300 XP`
  );

  render("home");

}

// ================================
// NAVIGATION
// ================================

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

// ================================
// RENDER
// ================================

function render(tab = "home"){

  document
    .querySelectorAll("[data-tab]")
    .forEach(button => {

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

  title.textContent =
    titles[tab] || "首頁";

  if(tab === "home")
    home();

  if(tab === "classes")
    classes();

  if(tab === "badges")
    badgePage();

  if(tab === "social")
    social();

  if(tab === "profile")
    profile();

}

// ================================
// HOME
// ================================

function home(){

  content.innerHTML = `

    <section class="hero">

      <div class="eyebrow">
        WELCOME BACK
      </div>

      <h2>
        TURBO 👋
      </h2>

      <div class="muted">
        今天也把一點 XP 帶回家。
      </div>

      <div class="stats">

        <div class="stat">

          <b>
            ${xp.toLocaleString()}
          </b>

          <small>
            XP
          </small>

        </div>

        <div class="stat">

          <b>
            Lv.${Math.floor(xp / 1000) + 1}
          </b>

          <small>
            等級
          </small>

        </div>

        <div class="stat">

          <b>
            🔥 ${streak}
          </b>

          <small>
            Streak
          </small>

        </div>

      </div>

    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          🎯 今日任務
        </h3>

        <span>
          1 / 3
        </span>

      </div>


      <div class="quest">

        <div class="row">

          <div>

            <span class="pill">
              DAILY QUEST
            </span>

            <h3
              style="margin:8px 0 3px"
            >
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
            style="width:${completed % 2 ? 100 : 35}%"
          ></i>

        </div>


        <button
          class="primary"
          onclick="nav('classes')"
        >
          找課程
        </button>

      </div>

    </section>


    <section class="section">

      <div class="section-title">

        <h3>
          📍 ${selectedBranchName}
        </h3>

        <span>
          ${schedule.length} 堂
        </span>

      </div>


      ${
        schedule.length

        ? schedule
            .slice(0,3)
            .map(card)
            .join("")

        : `
          <div class="muted">
            目前沒有課程資料。
          </div>
        `
      }

    </section>

  `;

}

// ================================
// CLASS CARD
// ================================

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

            ${c.room}
            · 教練 ${c.instructor}

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

// ================================
// CLASSES
// ================================

function classes(){

  content.innerHTML = `

    <section class="section">

      <div class="section-title">

        <h3>
          📍 選擇分店
        </h3>

      </div>


      <select
        id="branchSelect"
        class="search"
        style="margin-bottom:12px"
      >

        ${
          branches.length

          ? branches
              .map(branch => `

                <option
                  value="${branch.id}"
                  ${
                    branch.id === selectedBranchId
                    ? "selected"
                    : ""
                  }
                >

                  ${
                    branch.city
                    ? `${branch.city} · `
                    : ""
                  }

                  ${branch.name}

                </option>

              `)
              .join("")

          : `
              <option>
                尚無分店資料
              </option>
            `
        }

      </select>


      <div class="section-title">

        <h3>
          📅 選擇日期
        </h3>

      </div>


      <input
        class="search"
        id="dateSelect"
        type="date"
        value="${selectedDate}"
        style="margin-bottom:18px"
      >


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

          <h3>
            📍 ${selectedBranchName}
          </h3>

          <span>
            ${selectedDate}
          </span>

        </div>


        <div id="classList">

          ${
            schedule.length

            ? schedule
                .map(card)
                .join("")

            : `
              <div class="muted">
                這一天目前沒有課程資料。
              </div>
            `
          }

        </div>


        <div class="source">

          資料來源：World Gym Taiwan 公開有氧課表。
          <br>

          本頁資料由 CARDIO TAIWAN Supabase 資料庫提供。

          <br><br>

          ${
            getCurrentBranchUrl()
          }

        </div>

      </section>

    </section>

  `;


  // 分店選擇

  const branchSelect =
    document.querySelector(
      "#branchSelect"
    );

  if(branchSelect){

    branchSelect.addEventListener(
      "change",
      event => {

        changeBranch(
          event.target.value
        );

      }
    );

  }


  // 日期選擇

  const dateSelect =
    document.querySelector(
      "#dateSelect"
    );

  if(dateSelect){

    dateSelect.addEventListener(
      "change",
      event => {

        changeDate(
          event.target.value
        );

      }
    );

  }


  // 搜尋

  const search =
    document.querySelector("#q");

  if(search){

    search.addEventListener(
      "input",
      event => {

        filterClasses(
          event.target.value
        );

      }
    );

  }

}

// ================================
// OFFICIAL BRANCH URL
// ================================

function getCurrentBranchUrl(){

  const branch =
    branches.find(
      branch =>
        branch.id === selectedBranchId
    );

  if(
    branch &&
    branch.official_url
  ){

    return `

      <a
        href="${branch.official_url}"
        target="_blank"
        rel="noreferrer"
      >
        查看官方課表
      </a>

    `;

  }

  return "";

}

// ================================
// FILTER CLASSES
// ================================

function filterClasses(q){

  const list =
    document.querySelector(
      "#classList"
    );

  if(!list) return;

  const term =
    (q || "all")
      .toLowerCase();

  const rows =
    schedule.filter(c => {

      return (

        term === "all"

        ||

        Object
          .values(c)
          .join(" ")
          .toLowerCase()
          .includes(term)

      );

    });


  list.innerHTML =

    rows
      .map(card)
      .join("")

    ||

    `
      <div class="muted">
        找不到符合的課程。
      </div>
    `;

}

// ================================
// BADGES
// ================================

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

      ${badges.map(b => `

        <article
          class="badge ${
            b[3]
            ? ""
            : "locked"
          }"
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

      `).join("")}

    </div>

  `;

}

// ================================
// SOCIAL
// ================================

function social(){

  content.innerHTML = `

    <section class="section">

      <div class="section-title">

        <h3>
          👥 Community
        </h3>

        <span>
          附近健身玩家
        </span>

      </div>


      <article class="post">

        <div class="post-header">

          <div class="mini-avatar">
            K
          </div>

          <div>

            <b>
              Kevin
            </b>

            <div class="muted">
              剛剛 · 板橋
            </div>

          </div>

        </div>


        <p>
          🥊 今天完成 BODYCOMBAT®！
          又多一個 XP。
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

            <b>
              Alex
            </b>

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

// ================================
// PROFILE
// ================================

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
            ${Math.min(100, completed * 8)}%
          </span>

        </div>


        <div class="progress">

          <i
            style="width:${Math.min(
              100,
              completed * 8
            )}%"
          ></i>

        </div>

      </div>

    </section>

  `;

}

// ================================
// INIT
// ================================

async function init(){

  try{

    // 先抓分店

    await loadBranches();

    // 再抓課表

    await loadSchedule();

    // 最後顯示頁面

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

    branches = [];
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

// ================================
// START
// ================================

init();
