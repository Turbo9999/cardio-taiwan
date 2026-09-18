const SUPABASE_URL = "https://wylfqwzictkepnefwksx.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_5ITurxoUWu2ihIkDBrzWaQ_8uFP1LxZ";


// ========================================
// CARDIO TAIWAN
// ========================================

let branches = [];
let schedule = [];


// ========================================
// 使用者目前選擇
// 不預設任何分店
// ========================================

let selectedBranchId =
  localStorage.getItem("cq_branch_id") || "";

let selectedBranchName =
  localStorage.getItem("cq_branch_name") || "";

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
      color:#f3f4f6;
      line-height:1;
    }

    .schedule-control-input{
      flex:1;
      min-width:0;
      height:52px;
      box-sizing:border-box;
      border:1px solid #293242;
      border-radius:16px;
      background:#121720;
      color:#f5f7fb;
      padding:0 14px;
      font-size:16px;
      outline:none;
    }

    .schedule-control-input:focus{
      border-color:#e94f9b;
      box-shadow:
        0 0 0 2px
        rgba(233,79,155,.12);
    }

    .schedule-control-input:disabled{
      opacity:.5;
      cursor:not-allowed;
    }

    .schedule-date-input{
      color-scheme:dark;
    }

    .schedule-empty{
      padding:32px 18px;
      text-align:center;
      border:1px dashed #303847;
      border-radius:18px;
      color:#9ca3af;
      background:#11161e;
    }

    .schedule-loading{
      padding:30px 18px;
      text-align:center;
      color:#a8afbd;
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
      color:#929aaa;
      font-size:14px;
      white-space:nowrap;
    }

    .schedule-notice{
      padding:18px;
      border-radius:16px;
      background:#11161e;
      border:1px solid #293242;
      color:#aeb5c2;
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

  selectedBranchName =
    branch.name;


  localStorage.setItem(
    "cq_branch_id",
    selectedBranchId
  );

  localStorage.setItem(
    "cq_branch_name",
    selectedBranchName
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

function completeWorkout(name){

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


  toast(
    `🎉 ${name} 完成！ +300 XP`
  );


  render("home");

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

    badges:"勳章",

    social:"社群",

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
    social();
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
          1 / 3
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

      <div class="section-title">

        <h3>
          📅
          ${
            selectedBranchName ||
            "選擇你的健身分店"
          }
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

              ${
                selectedBranchName &&
                selectedDate

                  ? `${formatDate(selectedDate)} 暫無課程資料`

                  : "前往課表選擇分店與日期"

              }

            </div>

          `
      }

    </section>

  `;

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
            ${c.name}
          </div>

          <div class="class-meta">

            ${c.room}
            · 教練
            ${c.instructor}

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


  const branchOptions =
    sortedCities
      .map(
        city => {

          const options =
            groupedBranches[city]
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
                    ${
                      branch.id === selectedBranchId
                        ? "selected"
                        : ""
                    }
                  >
                    ${branch.name}
                  </option>

                `
              )
              .join("");


          return `

            <optgroup
              label="📍 ${city}"
            >

              ${options}

            </optgroup>

          `;

        }
      )
      .join("");


  const officialUrl =
    branches.find(
      b =>
        b.id === selectedBranchId
    )?.official_url || "";


  content.innerHTML = `

    <section class="schedule-controls">


      <div class="schedule-control">

        <div class="schedule-control-label">
          📍 分店
        </div>


        <select
          id="branchSelector"
          class="schedule-control-input"
        >

          <option
            value=""
            ${
              !selectedBranchId
                ? "selected"
                : ""
            }
          >
            請選擇分店
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

            <input
              class="search"
              id="q"
              placeholder="搜尋課程，例如 BODYCOMBAT、瑜伽、飛輪"
            >


            <div class="filterbar">

              <button
                class="ghost"
                data-filter="all"
              >
                全部
              </button>

              <button
                class="ghost"
                data-filter="Les Mills"
              >
                Les Mills
              </button>

              <button
                class="ghost"
                data-filter="MOSSA"
              >
                MOSSA
              </button>

              <button
                class="ghost"
                data-filter="飛輪心率"
              >
                飛輪
              </button>

              <button
                class="ghost"
                data-filter="心肺肌力訓練"
              >
                有氧
              </button>

            </div>


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

                      本頁資料由
                      CARDIO TAIWAN
                      Supabase 資料庫提供。

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
  // 分店選擇
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


  // ======================================
  // 搜尋
  // ======================================

  const search =
    document.querySelector(
      "#q"
    );


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


  // ======================================
  // 分類
  // ======================================

  document
    .querySelectorAll(
      "[data-filter]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            filterClasses(
              button.dataset.filter
            );

          }
        );

      }
    );

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


// ========================================
// 個人
// ========================================

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


    // ① 載入分店
    await loadBranches();


    // ② 只有「已經有分店＋日期」
    // 才載入課表

    if(
      selectedBranchId &&
      selectedDate
    ){

      await loadSchedule();

    }else{

      schedule = [];

    }


    // ③ 顯示目前頁面

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
