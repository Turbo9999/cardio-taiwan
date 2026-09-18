// ========================================
// CARDIO TAIWAN
// World Gym Schedule Sync
// Step 3: Inspect World Gym page structure
// ========================================

const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";


function getScriptUrls(html){

  const results = [];

  const regex =
    /<script[^>]+src=["']([^"']+)["']/gi;

  let match;

  while((match = regex.exec(html)) !== null){

    results.push(match[1]);

  }

  return [...new Set(results)];

}


function getInterestingUrls(html){

  const results = [];

  const regex =
    /https?:\/\/[^"'<> ]+/gi;

  let match;

  while((match = regex.exec(html)) !== null){

    const url = match[0];

    const lower =
      url.toLowerCase();

    if(
      lower.includes("api") ||
      lower.includes("schedule") ||
      lower.includes("class") ||
      lower.includes("aerobic")
    ){

      results.push(url);

    }

  }

  return [
    ...new Set(results)
  ].slice(0,50);

}


function getDateMatches(html){

  const patterns = [

    /2026[-\/]09[-\/](14|15|16|17|18|19|20)/g,

    /2026[-\/]9[-\/](14|15|16|17|18|19|20)/g,

    /Sep\.?\s*(14|15|16|17|18|19|20)/gi,

    /September\s*(14|15|16|17|18|19|20)/gi

  ];


  const results = [];


  patterns.forEach(
    regex => {

      const matches =
        html.match(regex) || [];

      results.push(
        ...matches
      );

    }
  );


  return [
    ...new Set(results)
  ];

}


function getBodyCombatSample(html){

  const keyword =
    "BODYCOMBAT";

  const index =
    html
      .toUpperCase()
      .indexOf(keyword);


  if(index === -1){

    return "";

  }


  const start =
    Math.max(
      0,
      index - 1500
    );


  const end =
    Math.min(
      html.length,
      index + 3500
    );


  return html.slice(
    start,
    end
  );

}


export default async function handler(
  req,
  res
){

  try{

    const response =
      await fetch(
        WORLD_GYM_URL,
        {
          headers:{
            "User-Agent":
              "Mozilla/5.0 (compatible; CARDIO-TAIWAN/1.0)"
          }
        }
      );


    if(!response.ok){

      return res.status(502).json({

        success:false,

        message:
          "無法取得 World Gym 官方課表",

        status:
          response.status

      });

    }


    const html =
      await response.text();


    const scriptUrls =
      getScriptUrls(html);


    const interestingUrls =
      getInterestingUrls(html);


    const dateMatches =
      getDateMatches(html);


    const bodyCombatSample =
      getBodyCombatSample(html);


    return res.status(200).json({

      success:true,

      branch:
        "台北統領",

      source:
        "World Gym Taiwan",

      status:
        response.status,

      htmlLength:
        html.length,

      dateMatches,

      scriptUrls,

      interestingUrls,

      hasBodyCombat:
        html
          .toUpperCase()
          .includes("BODYCOMBAT"),

      bodyCombatSample

    });


  }catch(error){

    console.error(
      "World Gym inspection error:",
      error
    );


    return res.status(500).json({

      success:false,

      message:
        "World Gym 頁面分析失敗",

      error:
        error.message

    });

  }

}
