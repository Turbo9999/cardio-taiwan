// ========================================
// CARDIO TAIWAN
// World Gym Schedule Sync
// Step 4: Inspect schedule block structure
// ========================================

const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";


function findScheduleSamples(html){

  const results = [];

  const timeRegex =
    /\b\d{2}:\d{2}\|\d{2}:\d{2}\b/g;

  let match;

  let count = 0;


  while(
    (match = timeRegex.exec(html)) !== null
    &&
    count < 10
  ){

    const index =
      match.index;


    const start =
      Math.max(
        0,
        index - 2500
      );


    const end =
      Math.min(
        html.length,
        index + 5000
      );


    results.push({

      time:
        match[0],

      html:
        html.slice(
          start,
          end
        )

    });


    count++;

  }


  return results;

}


function findDateAttributes(html){

  const results = [];

  const patterns = [

    /data-date=["'][^"']+["']/gi,

    /data-day=["'][^"']+["']/gi,

    /data-week=["'][^"']+["']/gi,

    /data-key=["'][^"']+["']/gi,

    /data-column=["'][^"']+["']/gi,

    /data-index=["'][^"']+["']/gi,

    /data-id=["'][^"']+["']/gi

  ];


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
  ].slice(0,200);

}


function findScheduleClasses(html){

  const results = [];

  const regex =
    /class=["'][^"']*(schedule|class|course|aerobic|calendar|week|day)[^"']*["']/gi;

  let match;


  while(
    (match = regex.exec(html)) !== null
  ){

    results.push(
      match[0]
    );

    if(results.length >= 200){

      break;

    }

  }


  return [
    ...new Set(results)
  ];

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


    const scheduleSamples =
      findScheduleSamples(html);


    const dateAttributes =
      findDateAttributes(html);


    const scheduleClasses =
      findScheduleClasses(html);


    return res.status(200).json({

      success:true,

      source:
        "World Gym Taiwan",

      branch:
        "台北統領",

      status:
        response.status,

      htmlLength:
        html.length,

      scheduleSampleCount:
        scheduleSamples.length,

      scheduleSamples,

      dateAttributes,

      scheduleClasses

    });


  }catch(error){

    console.error(
      "World Gym structure inspection error:",
      error
    );


    return res.status(500).json({

      success:false,

      message:
        "World Gym 課表結構分析失敗",

      error:
        error.message

    });

  }

}
