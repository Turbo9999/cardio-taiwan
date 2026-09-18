// ========================================
// CARDIO TAIWAN
// World Gym Schedule Sync
// Step 2: Test World Gym official page
// ========================================

const WORLD_GYM_URL =
  "https://www.worldgymtaiwan.com/en/find-a-club/taipei-tonling/aerobics-class-schedule";


export default async function handler(req, res){

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


    return res.status(200).json({

      success:true,

      source:"World Gym Taiwan",

      branch:"台北統領",

      status:response.status,

      htmlLength:html.length,

      message:
        "成功取得 World Gym 官方課表頁面"

    });


  }catch(error){

    console.error(
      "World Gym fetch error:",
      error
    );


    return res.status(500).json({

      success:false,

      message:
        "World Gym 課表取得失敗",

      error:
        error.message

    });

  }

}
