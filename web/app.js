"use strict";

const TOOL_VERSION = "0.5.0";
const NASA_ENDPOINT = "https://power.larc.nasa.gov/api/temporal/hourly/point";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const PARAMETER = "T2M";
const COMMUNITY = "AG";
const GEOCODE_MIN_INTERVAL_MS = 1000;
const COUNTRY_CITY_LIMIT = 10;
const DEFAULT_SAMPLE = [
  "site_id,name,latitude,longitude,country",
  "kuwait_city,科威特市,29.3759,47.9774,科威特",
  "jizan_saudi,吉赞,16.8892,42.5511,沙特阿拉伯",
].join("\n");

const CITY_GAZETTEER = [
  {
    site_id: "dubai",
    name_zh: "迪拜",
    name_en: "Dubai",
    aliases: ["迪拜市", "دبي", "Dubai, UAE"],
    country_zh: "阿联酋",
    country_code: "ae",
    latitude: 25.2048,
    longitude: 55.2708,
    source: "built-in",
  },
  {
    site_id: "ahvaz",
    name_zh: "阿瓦士",
    name_en: "Ahvaz",
    aliases: ["اهواز"],
    country_zh: "伊朗",
    country_code: "ir",
    latitude: 31.3183,
    longitude: 48.6706,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "basra",
    name_zh: "巴士拉",
    name_en: "Basra",
    aliases: ["البصرة"],
    country_zh: "伊拉克",
    country_code: "iq",
    latitude: 30.5085,
    longitude: 47.7804,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "jacobabad",
    name_zh: "雅各布阿巴德",
    name_en: "Jacobabad",
    aliases: [],
    country_zh: "巴基斯坦",
    country_code: "pk",
    latitude: 28.281,
    longitude: 68.4388,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "riyadh",
    name_zh: "利雅得",
    name_en: "Riyadh",
    aliases: ["الرياض"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 24.7136,
    longitude: 46.6753,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "mecca",
    name_zh: "麦加",
    name_en: "Mecca",
    aliases: ["Makkah", "مكة"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 21.3891,
    longitude: 39.8579,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "kuwait_city",
    name_zh: "科威特市",
    name_en: "Kuwait City",
    aliases: ["مدينة الكويت"],
    country_zh: "科威特",
    country_code: "kw",
    latitude: 29.3759,
    longitude: 47.9774,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "jizan_saudi",
    name_zh: "吉赞",
    name_en: "Jizan",
    aliases: ["Jazan", "جازان"],
    country_zh: "沙特阿拉伯",
    country_code: "sa",
    latitude: 16.8892,
    longitude: 42.5511,
    source: "built-in",
    hot_city: true,
  },
  {
    site_id: "port_sudan",
    name_zh: "苏丹港",
    name_en: "Port Sudan",
    aliases: ["بورسودان"],
    country_zh: "苏丹",
    country_code: "sd",
    latitude: 19.6158,
    longitude: 37.2164,
    source: "built-in",
    hot_city: true,
  },
];

const COUNTRY_TOP_CITY_SEEDS = {
  cn: [
    ["beijing", "北京", "Beijing", 39.9042, 116.4074, "首都/经济城市候选"],
    ["shanghai", "上海", "Shanghai", 31.2304, 121.4737, "直辖市/经济城市候选"],
    ["shenzhen", "深圳", "Shenzhen", 22.5431, 114.0579, "经济城市候选"],
    ["guangzhou", "广州", "Guangzhou", 23.1291, 113.2644, "省会/经济城市候选"],
    ["chongqing", "重庆", "Chongqing", 29.563, 106.5516, "直辖市/经济城市候选"],
    ["suzhou", "苏州", "Suzhou", 31.2989, 120.5853, "经济城市候选"],
    ["chengdu", "成都", "Chengdu", 30.5728, 104.0668, "省会/经济城市候选"],
    ["hangzhou", "杭州", "Hangzhou", 30.2741, 120.1551, "省会/经济城市候选"],
    ["wuhan", "武汉", "Wuhan", 30.5928, 114.3055, "省会/经济城市候选"],
    ["nanjing", "南京", "Nanjing", 32.0603, 118.7969, "省会/经济城市候选"],
  ],
  us: [
    ["new_york", "纽约", "New York", 40.7128, -74.006, "经济城市候选"],
    ["los_angeles", "洛杉矶", "Los Angeles", 34.0522, -118.2437, "经济城市候选"],
    ["chicago", "芝加哥", "Chicago", 41.8781, -87.6298, "经济城市候选"],
    ["san_francisco", "旧金山", "San Francisco", 37.7749, -122.4194, "经济城市候选"],
    ["washington_dc", "华盛顿", "Washington, D.C.", 38.9072, -77.0369, "首都/经济城市候选"],
    ["dallas", "达拉斯", "Dallas", 32.7767, -96.797, "经济城市候选"],
    ["houston", "休斯敦", "Houston", 29.7604, -95.3698, "经济城市候选"],
    ["boston", "波士顿", "Boston", 42.3601, -71.0589, "经济城市候选"],
    ["atlanta", "亚特兰大", "Atlanta", 33.749, -84.388, "经济城市候选"],
    ["miami", "迈阿密", "Miami", 25.7617, -80.1918, "经济城市候选"],
  ],
  in: [
    ["mumbai", "孟买", "Mumbai", 19.076, 72.8777, "经济城市候选"],
    ["delhi", "德里", "Delhi", 28.7041, 77.1025, "首都圈/经济城市候选"],
    ["bengaluru", "班加罗尔", "Bengaluru", 12.9716, 77.5946, "经济城市候选"],
    ["hyderabad", "海得拉巴", "Hyderabad", 17.385, 78.4867, "经济城市候选"],
    ["chennai", "金奈", "Chennai", 13.0827, 80.2707, "经济城市候选"],
    ["pune", "浦那", "Pune", 18.5204, 73.8567, "经济城市候选"],
    ["ahmedabad", "艾哈迈达巴德", "Ahmedabad", 23.0225, 72.5714, "经济城市候选"],
    ["kolkata", "加尔各答", "Kolkata", 22.5726, 88.3639, "经济城市候选"],
    ["surat", "苏拉特", "Surat", 21.1702, 72.8311, "经济城市候选"],
    ["jaipur", "斋浦尔", "Jaipur", 26.9124, 75.7873, "经济城市候选"],
  ],
  jp: [
    ["tokyo", "东京", "Tokyo", 35.6762, 139.6503, "首都/经济城市候选"],
    ["osaka", "大阪", "Osaka", 34.6937, 135.5023, "经济城市候选"],
    ["nagoya", "名古屋", "Nagoya", 35.1815, 136.9066, "经济城市候选"],
    ["yokohama", "横滨", "Yokohama", 35.4437, 139.638, "经济城市候选"],
    ["fukuoka", "福冈", "Fukuoka", 33.5902, 130.4017, "经济城市候选"],
    ["sapporo", "札幌", "Sapporo", 43.0618, 141.3545, "经济城市候选"],
    ["kobe", "神户", "Kobe", 34.6901, 135.1955, "经济城市候选"],
    ["kyoto", "京都", "Kyoto", 35.0116, 135.7681, "经济城市候选"],
    ["hiroshima", "广岛", "Hiroshima", 34.3853, 132.4553, "经济城市候选"],
    ["sendai", "仙台", "Sendai", 38.2682, 140.8694, "经济城市候选"],
  ],
  de: [
    ["berlin", "柏林", "Berlin", 52.52, 13.405, "首都/经济城市候选"],
    ["munich", "慕尼黑", "Munich", 48.1351, 11.582, "经济城市候选"],
    ["hamburg", "汉堡", "Hamburg", 53.5511, 9.9937, "经济城市候选"],
    ["frankfurt", "法兰克福", "Frankfurt", 50.1109, 8.6821, "经济城市候选"],
    ["cologne", "科隆", "Cologne", 50.9375, 6.9603, "经济城市候选"],
    ["stuttgart", "斯图加特", "Stuttgart", 48.7758, 9.1829, "经济城市候选"],
    ["dusseldorf", "杜塞尔多夫", "Dusseldorf", 51.2277, 6.7735, "经济城市候选"],
    ["dortmund", "多特蒙德", "Dortmund", 51.5136, 7.4653, "经济城市候选"],
    ["essen", "埃森", "Essen", 51.4556, 7.0116, "经济城市候选"],
    ["leipzig", "莱比锡", "Leipzig", 51.3397, 12.3731, "经济城市候选"],
  ],
  gb: [
    ["london", "伦敦", "London", 51.5074, -0.1278, "首都/经济城市候选"],
    ["manchester", "曼彻斯特", "Manchester", 53.4808, -2.2426, "经济城市候选"],
    ["birmingham_uk", "伯明翰", "Birmingham", 52.4862, -1.8904, "经济城市候选"],
    ["glasgow", "格拉斯哥", "Glasgow", 55.8642, -4.2518, "经济城市候选"],
    ["edinburgh", "爱丁堡", "Edinburgh", 55.9533, -3.1883, "经济城市候选"],
    ["leeds", "利兹", "Leeds", 53.8008, -1.5491, "经济城市候选"],
    ["liverpool", "利物浦", "Liverpool", 53.4084, -2.9916, "经济城市候选"],
    ["bristol", "布里斯托尔", "Bristol", 51.4545, -2.5879, "经济城市候选"],
    ["cambridge_uk", "剑桥", "Cambridge", 52.2053, 0.1218, "经济城市候选"],
    ["oxford", "牛津", "Oxford", 51.752, -1.2577, "经济城市候选"],
  ],
  fr: [
    ["paris", "巴黎", "Paris", 48.8566, 2.3522, "首都/经济城市候选"],
    ["lyon", "里昂", "Lyon", 45.764, 4.8357, "经济城市候选"],
    ["marseille", "马赛", "Marseille", 43.2965, 5.3698, "经济城市候选"],
    ["toulouse", "图卢兹", "Toulouse", 43.6047, 1.4442, "经济城市候选"],
    ["lille", "里尔", "Lille", 50.6292, 3.0573, "经济城市候选"],
    ["bordeaux", "波尔多", "Bordeaux", 44.8378, -0.5792, "经济城市候选"],
    ["nice", "尼斯", "Nice", 43.7102, 7.262, "经济城市候选"],
    ["nantes", "南特", "Nantes", 47.2184, -1.5536, "经济城市候选"],
    ["strasbourg", "斯特拉斯堡", "Strasbourg", 48.5734, 7.7521, "经济城市候选"],
    ["rennes", "雷恩", "Rennes", 48.1173, -1.6778, "经济城市候选"],
  ],
  it: [
    ["milan", "米兰", "Milan", 45.4642, 9.19, "经济城市候选"],
    ["rome", "罗马", "Rome", 41.9028, 12.4964, "首都/经济城市候选"],
    ["turin", "都灵", "Turin", 45.0703, 7.6869, "经济城市候选"],
    ["naples", "那不勒斯", "Naples", 40.8518, 14.2681, "经济城市候选"],
    ["bologna", "博洛尼亚", "Bologna", 44.4949, 11.3426, "经济城市候选"],
    ["florence", "佛罗伦萨", "Florence", 43.7696, 11.2558, "经济城市候选"],
    ["venice", "威尼斯", "Venice", 45.4408, 12.3155, "经济城市候选"],
    ["genoa", "热那亚", "Genoa", 44.4056, 8.9463, "经济城市候选"],
    ["verona", "维罗纳", "Verona", 45.4384, 10.9916, "经济城市候选"],
    ["bari", "巴里", "Bari", 41.1171, 16.8719, "经济城市候选"],
  ],
  ca: [
    ["toronto", "多伦多", "Toronto", 43.6532, -79.3832, "经济城市候选"],
    ["montreal", "蒙特利尔", "Montreal", 45.5017, -73.5673, "经济城市候选"],
    ["vancouver", "温哥华", "Vancouver", 49.2827, -123.1207, "经济城市候选"],
    ["calgary", "卡尔加里", "Calgary", 51.0447, -114.0719, "经济城市候选"],
    ["edmonton", "埃德蒙顿", "Edmonton", 53.5461, -113.4938, "经济城市候选"],
    ["ottawa", "渥太华", "Ottawa", 45.4215, -75.6972, "首都/经济城市候选"],
    ["winnipeg", "温尼伯", "Winnipeg", 49.8951, -97.1384, "经济城市候选"],
    ["quebec_city", "魁北克市", "Quebec City", 46.8139, -71.208, "经济城市候选"],
    ["hamilton_ca", "汉密尔顿", "Hamilton", 43.2557, -79.8711, "经济城市候选"],
    ["waterloo", "滑铁卢", "Waterloo", 43.4643, -80.5204, "经济城市候选"],
  ],
  br: [
    ["sao_paulo", "圣保罗", "Sao Paulo", -23.5558, -46.6396, "经济城市候选"],
    ["rio_de_janeiro", "里约热内卢", "Rio de Janeiro", -22.9068, -43.1729, "经济城市候选"],
    ["brasilia", "巴西利亚", "Brasilia", -15.7939, -47.8828, "首都/经济城市候选"],
    ["belo_horizonte", "贝洛奥里藏特", "Belo Horizonte", -19.9167, -43.9345, "经济城市候选"],
    ["curitiba", "库里蒂巴", "Curitiba", -25.4284, -49.2733, "经济城市候选"],
    ["porto_alegre", "阿雷格里港", "Porto Alegre", -30.0346, -51.2177, "经济城市候选"],
    ["recife", "累西腓", "Recife", -8.0476, -34.877, "经济城市候选"],
    ["salvador", "萨尔瓦多", "Salvador", -12.9777, -38.5016, "经济城市候选"],
    ["fortaleza", "福塔莱萨", "Fortaleza", -3.7319, -38.5267, "经济城市候选"],
    ["campinas", "坎皮纳斯", "Campinas", -22.9099, -47.0626, "经济城市候选"],
  ],
  ru: [
    ["moscow", "莫斯科", "Moscow", 55.7558, 37.6173, "首都/经济城市候选"],
    ["saint_petersburg", "圣彼得堡", "Saint Petersburg", 59.9311, 30.3609, "经济城市候选"],
    ["novosibirsk", "新西伯利亚", "Novosibirsk", 55.0084, 82.9357, "经济城市候选"],
    ["yekaterinburg", "叶卡捷琳堡", "Yekaterinburg", 56.8389, 60.6057, "经济城市候选"],
    ["kazan", "喀山", "Kazan", 55.7961, 49.1064, "经济城市候选"],
    ["nizhny_novgorod", "下诺夫哥罗德", "Nizhny Novgorod", 56.2965, 43.9361, "经济城市候选"],
    ["samara", "萨马拉", "Samara", 53.1959, 50.1008, "经济城市候选"],
    ["ufa", "乌法", "Ufa", 54.7388, 55.9721, "经济城市候选"],
    ["rostov_on_don", "顿河畔罗斯托夫", "Rostov-on-Don", 47.2357, 39.7015, "经济城市候选"],
    ["krasnodar", "克拉斯诺达尔", "Krasnodar", 45.0355, 38.9753, "经济城市候选"],
  ],
  au: [
    ["sydney", "悉尼", "Sydney", -33.8688, 151.2093, "经济城市候选"],
    ["melbourne", "墨尔本", "Melbourne", -37.8136, 144.9631, "经济城市候选"],
    ["brisbane", "布里斯班", "Brisbane", -27.4698, 153.0251, "经济城市候选"],
    ["perth", "珀斯", "Perth", -31.9523, 115.8613, "经济城市候选"],
    ["adelaide", "阿德莱德", "Adelaide", -34.9285, 138.6007, "经济城市候选"],
    ["canberra", "堪培拉", "Canberra", -35.2809, 149.13, "首都/经济城市候选"],
    ["gold_coast", "黄金海岸", "Gold Coast", -28.0167, 153.4, "经济城市候选"],
    ["newcastle_au", "纽卡斯尔", "Newcastle", -32.9283, 151.7817, "经济城市候选"],
    ["wollongong", "卧龙岗", "Wollongong", -34.4278, 150.8931, "经济城市候选"],
    ["geelong", "吉朗", "Geelong", -38.1499, 144.3617, "经济城市候选"],
  ],
  mx: [
    ["mexico_city", "墨西哥城", "Mexico City", 19.4326, -99.1332, "首都/经济城市候选"],
    ["monterrey", "蒙特雷", "Monterrey", 25.6866, -100.3161, "经济城市候选"],
    ["guadalajara", "瓜达拉哈拉", "Guadalajara", 20.6597, -103.3496, "经济城市候选"],
    ["puebla", "普埃布拉", "Puebla", 19.0414, -98.2063, "经济城市候选"],
    ["queretaro", "克雷塔罗", "Queretaro", 20.5888, -100.3899, "经济城市候选"],
    ["tijuana", "蒂华纳", "Tijuana", 32.5149, -117.0382, "经济城市候选"],
    ["leon_mx", "莱昂", "Leon", 21.1619, -101.6922, "经济城市候选"],
    ["juarez", "华雷斯", "Ciudad Juarez", 31.6904, -106.4245, "经济城市候选"],
    ["merida", "梅里达", "Merida", 20.9674, -89.5926, "经济城市候选"],
    ["san_luis_potosi", "圣路易斯波托西", "San Luis Potosi", 22.1565, -100.9855, "经济城市候选"],
  ],
  sa: [
    ["riyadh", "利雅得", "Riyadh", 24.7136, 46.6753, "首都/经济城市候选"],
    ["jeddah", "吉达", "Jeddah", 21.4858, 39.1925, "经济城市候选"],
    ["mecca", "麦加", "Mecca", 21.3891, 39.8579, "经济城市候选"],
    ["dammam", "达曼", "Dammam", 26.4207, 50.0888, "经济城市候选"],
    ["khobar", "胡拜尔", "Khobar", 26.2172, 50.1971, "经济城市候选"],
    ["medina", "麦地那", "Medina", 24.5247, 39.5692, "经济城市候选"],
    ["jubail", "朱拜勒", "Jubail", 27.0046, 49.646, "经济城市候选"],
    ["taif", "塔伊夫", "Taif", 21.4373, 40.5127, "经济城市候选"],
    ["jizan_saudi", "吉赞", "Jizan", 16.8892, 42.5511, "经济城市候选"],
    ["yanbu", "延布", "Yanbu", 24.0889, 38.0618, "经济城市候选"],
  ],
  ae: [
    ["dubai", "迪拜", "Dubai", 25.2048, 55.2708, "经济城市候选"],
    ["abu_dhabi", "阿布扎比", "Abu Dhabi", 24.4539, 54.3773, "首都/经济城市候选"],
    ["sharjah", "沙迦", "Sharjah", 25.3463, 55.4209, "经济城市候选"],
    ["al_ain", "艾因", "Al Ain", 24.2075, 55.7447, "经济城市候选"],
    ["ajman", "阿治曼", "Ajman", 25.4052, 55.5136, "经济城市候选"],
    ["ras_al_khaimah", "哈伊马角", "Ras Al Khaimah", 25.8007, 55.9762, "经济城市候选"],
    ["fujairah", "富查伊拉", "Fujairah", 25.1288, 56.3265, "经济城市候选"],
    ["umm_al_quwain", "乌姆盖万", "Umm Al Quwain", 25.5647, 55.5552, "经济城市候选"],
    ["jebel_ali", "杰贝阿里", "Jebel Ali", 24.9857, 55.0273, "经济城市候选"],
    ["khor_fakkan", "豪尔费坎", "Khor Fakkan", 25.3313, 56.34199, "经济城市候选"],
  ],
  ir: [
    ["tehran", "德黑兰", "Tehran", 35.6892, 51.389, "首都/经济城市候选"],
    ["mashhad", "马什哈德", "Mashhad", 36.2605, 59.6168, "经济城市候选"],
    ["isfahan", "伊斯法罕", "Isfahan", 32.6546, 51.668, "经济城市候选"],
    ["karaj", "卡拉季", "Karaj", 35.8401, 50.9391, "经济城市候选"],
    ["shiraz", "设拉子", "Shiraz", 29.5918, 52.5837, "经济城市候选"],
    ["tabriz", "大不里士", "Tabriz", 38.0962, 46.2738, "经济城市候选"],
    ["qom", "库姆", "Qom", 34.6399, 50.8759, "经济城市候选"],
    ["ahvaz", "阿瓦士", "Ahvaz", 31.3183, 48.6706, "经济城市候选"],
    ["kerman", "克尔曼", "Kerman", 30.2839, 57.0834, "经济城市候选"],
    ["rasht", "拉什特", "Rasht", 37.2808, 49.5832, "经济城市候选"],
  ],
  iq: [
    ["baghdad", "巴格达", "Baghdad", 33.3152, 44.3661, "首都/经济城市候选"],
    ["basra", "巴士拉", "Basra", 30.5085, 47.7804, "经济城市候选"],
    ["mosul", "摩苏尔", "Mosul", 36.34, 43.13, "经济城市候选"],
    ["erbil", "埃尔比勒", "Erbil", 36.1911, 44.0092, "经济城市候选"],
    ["najaf", "纳杰夫", "Najaf", 32.0259, 44.3462, "经济城市候选"],
    ["karbala", "卡尔巴拉", "Karbala", 32.616, 44.0249, "经济城市候选"],
    ["sulaymaniyah", "苏莱曼尼亚", "Sulaymaniyah", 35.5572, 45.4356, "经济城市候选"],
    ["kirkuk", "基尔库克", "Kirkuk", 35.4676, 44.3922, "经济城市候选"],
    ["nasiriyah", "纳西里耶", "Nasiriyah", 31.057, 46.2573, "经济城市候选"],
    ["hilla", "希拉", "Hilla", 32.4798, 44.4328, "经济城市候选"],
  ],
  pk: [
    ["karachi", "卡拉奇", "Karachi", 24.8607, 67.0011, "经济城市候选"],
    ["lahore", "拉合尔", "Lahore", 31.5204, 74.3587, "经济城市候选"],
    ["faisalabad", "费萨拉巴德", "Faisalabad", 31.4504, 73.135, "经济城市候选"],
    ["islamabad", "伊斯兰堡", "Islamabad", 33.6844, 73.0479, "首都/经济城市候选"],
    ["rawalpindi", "拉瓦尔品第", "Rawalpindi", 33.5651, 73.0169, "经济城市候选"],
    ["multan", "木尔坦", "Multan", 30.1575, 71.5249, "经济城市候选"],
    ["peshawar", "白沙瓦", "Peshawar", 34.0151, 71.5249, "经济城市候选"],
    ["sialkot", "锡亚尔科特", "Sialkot", 32.4945, 74.5229, "经济城市候选"],
    ["hyderabad_pk", "海得拉巴", "Hyderabad", 25.396, 68.3578, "经济城市候选"],
    ["jacobabad", "雅各布阿巴德", "Jacobabad", 28.281, 68.4388, "高温城市候选"],
  ],
};

const COUNTRY_NAMES = {
  cn: ["中国", "China"],
  us: ["美国", "United States"],
  in: ["印度", "India"],
  jp: ["日本", "Japan"],
  de: ["德国", "Germany"],
  gb: ["英国", "United Kingdom"],
  fr: ["法国", "France"],
  it: ["意大利", "Italy"],
  ca: ["加拿大", "Canada"],
  br: ["巴西", "Brazil"],
  ru: ["俄罗斯", "Russia"],
  au: ["澳大利亚", "Australia"],
  mx: ["墨西哥", "Mexico"],
  sa: ["沙特阿拉伯", "Saudi Arabia"],
  ae: ["阿联酋", "United Arab Emirates"],
  ir: ["伊朗", "Iran"],
  iq: ["伊拉克", "Iraq"],
  pk: ["巴基斯坦", "Pakistan"],
};

function topCityRowsForCountry(countryCode) {
  const [country_zh, country_en] = COUNTRY_NAMES[countryCode] || [countryCode, countryCode];
  return (COUNTRY_TOP_CITY_SEEDS[countryCode] || []).map(
    ([site_id, name_zh, name_en, latitude, longitude, label], index) => ({
      site_id,
      name_zh,
      name_en,
      aliases: [name_en],
      country_zh,
      country_en,
      country_code: countryCode,
      latitude,
      longitude,
      source: "built-in",
      confidence_label: label,
      country_top_city: true,
      sort_rank: index,
    }),
  );
}

const COUNTRY_TOP_CITIES = Object.keys(COUNTRY_TOP_CITY_SEEDS).flatMap(topCityRowsForCountry);
const BUILT_IN_CITIES = [...CITY_GAZETTEER, ...COUNTRY_TOP_CITIES];

const HOT_CITIES = CITY_GAZETTEER
  .filter((city) => city.hot_city)
  .map((city) => [city.site_id, city.name_zh, city.latitude, city.longitude, city.country_zh]);

const COUNTRY_QUERY_ALIASES = {
  "澳大利亚": "Australia",
  australia: "Australia",
  "巴基斯坦": "Pakistan",
  pakistan: "Pakistan",
  "巴西": "Brazil",
  brazil: "Brazil",
  "加拿大": "Canada",
  canada: "Canada",
  "德国": "Germany",
  germany: "Germany",
  deutschland: "Germany",
  "法国": "France",
  france: "France",
  "俄罗斯": "Russia",
  russia: "Russia",
  "印度": "India",
  india: "India",
  bharat: "India",
  "伊拉克": "Iraq",
  iraq: "Iraq",
  "伊朗": "Iran",
  iran: "Iran",
  "意大利": "Italy",
  italy: "Italy",
  "日本": "Japan",
  japan: "Japan",
  "墨西哥": "Mexico",
  mexico: "Mexico",
  "美国": "United States",
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  "英国": "United Kingdom",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  "united kingdom": "United Kingdom",
  "沙特": "Saudi Arabia",
  "沙特阿拉伯": "Saudi Arabia",
  "saudi": "Saudi Arabia",
  "saudi arabia": "Saudi Arabia",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  "阿联酋": "United Arab Emirates",
  "阿拉伯联合酋长国": "United Arab Emirates",
  "阿拉伯聯合酋長國": "United Arab Emirates",
  "科威特": "Kuwait",
  kuwait: "Kuwait",
  "苏丹": "Sudan",
  sudan: "Sudan",
  "中国": "China",
  "中华人民共和国": "China",
  china: "China",
  prc: "China",
};

const elements = {
  csvInput: document.getElementById("csvInput"),
  fileInput: document.getElementById("fileInput"),
  dualSourceFile: document.getElementById("dualSourceFile"),
  dualSourceStatus: document.getElementById("dualSourceStatus"),
  clearDualSource: document.getElementById("clearDualSource"),
  loadHotCities: document.getElementById("loadHotCities"),
  downloadTemplate: document.getElementById("downloadTemplate"),
  geocodeQuery: document.getElementById("geocodeQuery"),
  geocodeCountry: document.getElementById("geocodeCountry"),
  geocodeButton: document.getElementById("geocodeButton"),
  geocodeStatus: document.getElementById("geocodeStatus"),
  geocodeResults: document.getElementById("geocodeResults"),
  countryCityQuery: document.getElementById("countryCityQuery"),
  countryCityButton: document.getElementById("countryCityButton"),
  countryCityStatus: document.getElementById("countryCityStatus"),
  countryCityResults: document.getElementById("countryCityResults"),
  startYear: document.getElementById("startYear"),
  endYear: document.getElementById("endYear"),
  timeStandard: document.getElementById("timeStandard"),
  threshold: document.getElementById("threshold"),
  refreshCache: document.getElementById("refreshCache"),
  runButton: document.getElementById("runButton"),
  clearCache: document.getElementById("clearCache"),
  progressBar: document.getElementById("progressBar"),
  currentTask: document.getElementById("currentTask"),
  runSummary: document.getElementById("runSummary"),
  warnings: document.getElementById("warnings"),
  summaryTableBody: document.querySelector("#summaryTable tbody"),
  downloadButtons: document.getElementById("downloadButtons"),
  cacheStatus: document.getElementById("cacheStatus"),
};

let activeResult = null;
let lastGeocodeRequestAt = 0;
let dualSourceEvidence = null;

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function hotCitiesCsv() {
  return rowsToCsv([
    ["site_id", "name", "latitude", "longitude", "country"],
    ...HOT_CITIES,
  ]);
}

function parseCsv(text) {
  const cleaned = text.replace(/^\ufeff/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    const next = cleaned[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      if (row.some((item) => item.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((item) => item.trim() !== "")) rows.push(row);
  return rows;
}

function indexCsvRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    const indexed = {};
    headers.forEach((header, index) => {
      indexed[header] = row[index] ?? "";
    });
    return indexed;
  });
}

function normalizeHeader(header) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

function firstPresent(row, names) {
  for (const name of names) {
    const value = row?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function normalizeSiteId(value, fallback) {
  const source = value && value.trim() ? value.trim() : fallback;
  return source
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function countrySearchText(value) {
  const normalized = normalizeSearchText(value);
  return COUNTRY_QUERY_ALIASES[normalized] || value.trim();
}

function countryCodeForQuery(countryName) {
  const canonical = normalizeSearchText(countrySearchText(countryName));
  if (COUNTRY_NAMES[canonical]) return canonical;
  for (const [countryCode, names] of Object.entries(COUNTRY_NAMES)) {
    if (names.some((name) => normalizeSearchText(name) === canonical)) {
      return countryCode;
    }
  }
  return "";
}

function isMostlyAscii(value) {
  return /^[\x00-\x7F\s,.'-]+$/.test(value);
}

function builtInSearch(query, countryHint) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCountry = normalizeSearchText(countryHint);
  if (!normalizedQuery) return [];
  const matches = BUILT_IN_CITIES.filter((city) => {
    const names = [city.name_zh, ...city.aliases];
    if (!isMostlyAscii(query)) {
      names.push(city.name_en);
    } else {
      // For English city names, prefer external geocoding candidates unless the
      // user gives a qualified alias like "Dubai, UAE".
      names.push(...city.aliases.filter((alias) => alias.includes(",")));
    }
    const nameMatch = names.some((name) => normalizeSearchText(name) === normalizedQuery);
    if (!nameMatch) return false;
    if (!normalizedCountry) return true;
    return [city.country_zh, city.country_code].some((value) =>
      normalizeSearchText(value).includes(normalizedCountry),
    );
  }).map((city) => ({
    source: "built-in",
    display_name: `${city.name_zh} / ${city.name_en}, ${city.country_zh}`,
    name: city.name_zh,
    country: city.country_zh,
    country_code: city.country_code,
    latitude: city.latitude,
    longitude: city.longitude,
    category: "place",
    type: "city",
    site_id: city.site_id,
    confidence_label: city.confidence_label || "内置城市",
  }));
  return dedupeCandidates(matches);
}

function builtInCountryCities(countryName) {
  const countryCode = countryCodeForQuery(countryName);
  if (!countryCode) return [];
  return COUNTRY_TOP_CITIES.filter((city) => city.country_code === countryCode).map((city) => ({
    source: "built-in",
    display_name: `${city.name_zh} / ${city.name_en}, ${city.country_zh}`,
    name: city.name_zh,
    country: city.country_zh,
    country_code: city.country_code,
    latitude: city.latitude,
    longitude: city.longitude,
    category: "place",
    type: "city",
    site_id: city.site_id,
    confidence_label: city.confidence_label || "内置城市",
    population: "",
    sort_population: 0,
    sort_rank: city.sort_rank,
  }));
}

function parseSites(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV 至少需要表头和一行坐标。");
  }

  const headers = rows[0].map(normalizeHeader);
  const indexOf = (...names) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };

  const siteIdIndex = indexOf("site_id", "id");
  const nameIndex = indexOf("name", "city", "city_name");
  const latIndex = indexOf("latitude", "lat");
  const lonIndex = indexOf("longitude", "lon", "lng");
  const countryIndex = indexOf("country", "country_zh");

  if (latIndex < 0 || lonIndex < 0) {
    throw new Error("CSV 必须包含 latitude 和 longitude 字段。");
  }

  const usedIds = new Set();
  return rows.slice(1).map((row, offset) => {
    const lineNumber = offset + 2;
    const latitude = Number(row[latIndex]);
    const longitude = Number(row[lonIndex]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new Error(`第 ${lineNumber} 行 latitude 不合法：${row[latIndex] || ""}`);
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error(`第 ${lineNumber} 行 longitude 不合法：${row[lonIndex] || ""}`);
    }
    const name = nameIndex >= 0 ? (row[nameIndex] || "").trim() : "";
    const fallback = `site_${offset + 1}`;
    const siteId = normalizeSiteId(siteIdIndex >= 0 ? row[siteIdIndex] : name, fallback);
    if (usedIds.has(siteId)) {
      throw new Error(`site_id 重复：${siteId}`);
    }
    usedIds.add(siteId);
    return {
      site_id: siteId,
      name: name || siteId,
      latitude,
      longitude,
      country: countryIndex >= 0 ? (row[countryIndex] || "").trim() : "",
    };
  });
}

function currentSiteIds() {
  try {
    return new Set(parseSites(elements.csvInput.value).map((site) => site.site_id));
  } catch (_error) {
    const rows = parseCsv(elements.csvInput.value || "");
    if (rows.length < 2) return new Set();
    const headers = rows[0].map(normalizeHeader);
    const siteIdIndex = headers.indexOf("site_id");
    if (siteIdIndex < 0) return new Set();
    return new Set(rows.slice(1).map((row) => normalizeSiteId(row[siteIdIndex], "")).filter(Boolean));
  }
}

function appendCandidateToCsv(candidate) {
  const siteId = normalizeSiteId(candidate.site_id || candidate.name, "geocode_site");
  if (currentSiteIds().has(siteId)) {
    setGeocodeStatus(`site_id 已存在：${siteId}。请先在 CSV 中改名或删除重复行。`, true);
    return;
  }

  const hasText = elements.csvInput.value.trim().length > 0;
  const prefix = hasText ? elements.csvInput.value.replace(/\s+$/g, "") : "site_id,name,latitude,longitude,country";
  const line = rowsToCsv([
    [
      siteId,
      candidate.name || siteId,
      Number(candidate.latitude).toFixed(4),
      Number(candidate.longitude).toFixed(4),
      candidate.country || "",
    ],
  ]);
  elements.csvInput.value = `${prefix}\n${line}`;
  setGeocodeStatus(`已加入：${siteId}, ${candidate.name}, ${Number(candidate.latitude).toFixed(4)}, ${Number(candidate.longitude).toFixed(4)}`);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("nasa-power-temperature-tool", 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("responses")) {
        db.createObjectStore("responses", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("geocodes")) {
        db.createObjectStore("geocodes", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("countryCities")) {
        db.createObjectStore("countryCities", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function dbPut(db, storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function dbClearStores(db, storeNames) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, "readwrite");
    for (const storeName of storeNames) {
      tx.objectStore(storeName).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function cacheKey(site, year, timeStandard) {
  return [
    PARAMETER,
    COMMUNITY,
    site.latitude.toFixed(4),
    site.longitude.toFixed(4),
    year,
    timeStandard,
  ].join("|");
}

function buildNasaUrl(site, year, timeStandard) {
  const params = new URLSearchParams({
    parameters: PARAMETER,
    community: COMMUNITY,
    latitude: site.latitude.toFixed(4),
    longitude: site.longitude.toFixed(4),
    start: `${year}0101`,
    end: `${year}1231`,
    format: "JSON",
    "time-standard": timeStandard,
    header: "true",
  });
  return `${NASA_ENDPOINT}?${params.toString()}`;
}

function geocodeCacheKey(query, countryHint) {
  return [normalizeSearchText(query), normalizeSearchText(countryHint)].join("|");
}

function buildNominatimUrl(query, countryHint) {
  const searchText = [query.trim(), countryHint.trim()].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    format: "jsonv2",
    q: searchText,
    limit: "5",
    "accept-language": "zh-CN,en",
    addressdetails: "1",
  });
  return `${NOMINATIM_ENDPOINT}?${params.toString()}`;
}

async function waitForGeocodeRateLimit() {
  const now = Date.now();
  const remaining = GEOCODE_MIN_INTERVAL_MS - (now - lastGeocodeRequestAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
  lastGeocodeRequestAt = Date.now();
}

function rankGeocodeCandidate(candidate) {
  const placeTypes = ["city", "town", "municipality", "village"];
  const categoryScore = candidate.category === "place" ? 0 : 10;
  const typeScore = placeTypes.includes(candidate.type) ? 0 : candidate.type === "administrative" ? 7 : 3;
  const sourceScore = candidate.source === "built-in" ? -5 : 0;
  return sourceScore + categoryScore + typeScore - Number(candidate.importance || 0);
}

function normalizeNominatimResult(result) {
  const address = result.address || {};
  const name = result.name || address.city || address.town || address.state || result.display_name || "";
  const country = address.country || "";
  const candidate = {
    source: "nominatim",
    display_name: result.display_name || name,
    name,
    country,
    country_code: address.country_code || "",
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    category: result.category || "",
    type: result.type || result.addresstype || "",
    addresstype: result.addresstype || "",
    importance: Number(result.importance || 0),
    confidence_label: "地理编码候选",
  };
  if (candidate.category === "place" && ["city", "town", "municipality"].includes(candidate.type)) {
    candidate.confidence_label = "城市候选";
  } else if (candidate.category === "boundary") {
    candidate.confidence_label = "行政边界候选";
  }
  const readableId = normalizeSiteId(candidate.name || candidate.display_name, "");
  const stableFallback = `${candidate.type || "place"}_${result.place_id || result.osm_id || "site"}`;
  candidate.site_id = readableId && readableId.length > 2 ? readableId : stableFallback;
  return candidate;
}

function setGeocodeStatus(message, error = false) {
  elements.geocodeStatus.textContent = message;
  elements.geocodeStatus.classList.toggle("error", error);
}

function setCountryCityStatus(message, error = false) {
  elements.countryCityStatus.textContent = message;
  elements.countryCityStatus.classList.toggle("error", error);
}

function setDualSourceStatus(message, error = false) {
  elements.dualSourceStatus.textContent = message;
  elements.dualSourceStatus.classList.toggle("error", error);
}

function countryCityFailureMessage(error) {
  const message = error?.message || String(error);
  return `国家城市候选读取失败：${message}。仍可使用城市名单点查询或手工填写经纬度。`;
}

function candidateMeta(candidate) {
  const sourceLabel = {
    "built-in": "内置城市表",
    nominatim: "OpenStreetMap Nominatim",
  }[candidate.source] || candidate.source;
  const pieces = [
    sourceLabel,
    candidate.confidence_label,
    candidate.country,
    candidate.population ? `人口 ${candidate.population}` : "",
    `${Number(candidate.latitude).toFixed(4)}, ${Number(candidate.longitude).toFixed(4)}`,
  ];
  return pieces.filter(Boolean).join(" · ");
}

function renderCandidates(container, candidates) {
  container.innerHTML = "";
  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "candidate-empty";
    empty.textContent = "未找到候选。可以补充国家/地区提示后再查，或直接手工填写经纬度。";
    container.appendChild(empty);
    return;
  }

  for (const candidate of candidates) {
    const item = document.createElement("div");
    item.className = "candidate-item";

    const body = document.createElement("div");
    const title = document.createElement("div");
    title.className = "candidate-title";
    title.textContent = candidate.display_name || candidate.name;

    const meta = document.createElement("div");
    meta.className = "candidate-meta";
    meta.textContent = candidateMeta(candidate);

    body.append(title, meta);

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "加入列表";
    button.addEventListener("click", () => appendCandidateToCsv(candidate));

    item.append(body, button);
    container.appendChild(item);
  }
}

function renderGeocodeCandidates(candidates) {
  renderCandidates(elements.geocodeResults, candidates);
}

function renderCountryCityCandidates(candidates) {
  renderCandidates(elements.countryCityResults, candidates);
}

async function runGeocodeSearch() {
  const query = elements.geocodeQuery.value.trim();
  const countryHint = elements.geocodeCountry.value.trim();
  if (!query) {
    setGeocodeStatus("请输入城市名。", true);
    elements.geocodeResults.innerHTML = "";
    return;
  }

  elements.geocodeButton.disabled = true;
  elements.geocodeResults.innerHTML = "";
  setGeocodeStatus("正在查询地名...");
  try {
    const builtIn = builtInSearch(query, countryHint);
    if (builtIn.length) {
      renderGeocodeCandidates(builtIn);
      setGeocodeStatus(`找到 ${builtIn.length} 个内置候选。`);
      return;
    }

    const db = await openDatabase();
    const { results, cacheHit } = await queryNominatim(db, query, countryHint);
    renderGeocodeCandidates(results);
    const suffix = cacheHit ? "来自本地地名缓存。" : "来自 OpenStreetMap Nominatim。";
    setGeocodeStatus(`找到 ${results.length} 个候选，${suffix}`);
  } catch (error) {
    setGeocodeStatus(`地名查询失败：${error.message || error}。仍可手工填写经纬度。`, true);
  } finally {
    elements.geocodeButton.disabled = false;
  }
}

async function queryNominatim(db, query, countryHint) {
  const key = geocodeCacheKey(query, countryHint);
  const cached = await dbGet(db, "geocodes", key);
  if (cached?.results) {
    return { results: cached.results, cacheHit: true };
  }

  await waitForGeocodeRateLimit();
  const url = buildNominatimUrl(query, countryHint);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Nominatim 请求失败：HTTP ${response.status}`);
  }
  const payload = await response.json();
  const results = payload
    .map(normalizeNominatimResult)
    .filter((candidate) => Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude))
    .sort((a, b) => rankGeocodeCandidate(a) - rankGeocodeCandidate(b));
  await dbPut(db, "geocodes", {
    key,
    query,
    countryHint,
    url,
    results,
    saved_at: new Date().toISOString(),
    source: "nominatim",
  });
  return { results, cacheHit: false };
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude) || !candidate.name) continue;
    const key = [
      normalizeSearchText(candidate.name),
      Number(candidate.latitude).toFixed(2),
      Number(candidate.longitude).toFixed(2),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

async function queryCountryCities(db, countryName) {
  const countryCode = countryCodeForQuery(countryName);
  const key = `country-top-cities|${countryCode || normalizeSearchText(countryName)}`;
  const cached = await dbGet(db, "countryCities", key);
  if (cached?.results) {
    return {
      results: cached.results,
      cacheHit: true,
      countryCode: cached.countryCode || countryCode,
      countryLabel: cached.countryLabel || countryName,
      missingBuiltIn: cached.missingBuiltIn || false,
    };
  }

  const countryLabel = countryCode ? COUNTRY_NAMES[countryCode][0] : countryName;
  const results = dedupeCandidates(builtInCountryCities(countryName))
    .sort((a, b) => (a.sort_rank ?? 999) - (b.sort_rank ?? 999))
    .slice(0, COUNTRY_CITY_LIMIT);
  await dbPut(db, "countryCities", {
    key,
    countryName,
    countryCode,
    countryLabel,
    results,
    saved_at: new Date().toISOString(),
    source: "built-in-country-top-cities",
    missingBuiltIn: !countryCode || !results.length,
  });
  return {
    results,
    cacheHit: false,
    countryCode,
    countryLabel,
    missingBuiltIn: !countryCode || !results.length,
  };
}

async function runCountryCitySearch() {
  const countryName = elements.countryCityQuery.value.trim();
  if (!countryName) {
    setCountryCityStatus("请输入国家名称。", true);
    elements.countryCityResults.innerHTML = "";
    return;
  }

  elements.countryCityButton.disabled = true;
  elements.countryCityResults.innerHTML = "";
  setCountryCityStatus("正在读取内置国家城市候选...");
  try {
    const db = await openDatabase();
    const { results, cacheHit, countryLabel, missingBuiltIn } = await queryCountryCities(db, countryName);
    renderCountryCityCandidates(results);
    if (missingBuiltIn) {
      setCountryCityStatus(
        `当前未内置“${countryName}”的 Top10 经济城市候选；请使用“按城市名添加点位”逐个查询，或手工输入经纬度。`,
      );
      return;
    }
    const sourceText = cacheHit
      ? "来自本地国家城市缓存。"
      : `来自 ${countryLabel || countryName} 预置表；这是工具内置实用候选，不是官方 GDP 精确排名。`;
    setCountryCityStatus(`找到 ${results.length} 个候选，${sourceText}`);
  } catch (error) {
    setCountryCityStatus(countryCityFailureMessage(error), true);
  } finally {
    elements.countryCityButton.disabled = false;
  }
}

function normalizeDualSourceRow(row) {
  const siteId = String(firstPresent(row, ["city_id", "site_id", "id"])).trim();
  const status = String(firstPresent(row, ["status", "dual_source_status", "一致状态"])).trim();
  if (!siteId || !status) return null;
  return {
    site_id: siteId,
    name: firstPresent(row, ["city_zh", "name", "city_name", "城市"]),
    country: firstPresent(row, ["country_zh", "country", "国家"]),
    sample_count: firstPresent(row, ["sample_count", "样本"]),
    compared_count: firstPresent(row, ["compared_count", "可比较样本"]),
    missing_count: firstPresent(row, ["missing_count", "缺测"]),
    nasa_mean_sample_t2m_c: firstPresent(row, ["nasa_mean_sample_t2m_c", "nasa_mean"]),
    era5_mean_sample_t2m_c: firstPresent(row, ["era5_mean_sample_t2m_c", "era5_mean"]),
    mean_bias_era5_minus_nasa_c: firstPresent(row, ["mean_bias_era5_minus_nasa_c", "mean_bias"]),
    p95_abs_point_diff_c: firstPresent(row, ["p95_abs_point_diff_c", "point_p95_abs_diff"]),
    p95_band_mean_bias_c: firstPresent(row, ["p95_band_mean_bias_c", "p95_bias"]),
    tail_mean_bias_c: firstPresent(row, ["tail_mean_bias_c", "tail_bias"]),
    status,
    reason: firstPresent(row, ["reason", "备注", "说明"]),
  };
}

function parseDualSourceEvidence(text, filename) {
  const trimmed = text.trim();
  let payload = null;
  let rows = [];
  if (!trimmed) {
    throw new Error("双源校验文件为空。");
  }
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    payload = JSON.parse(trimmed);
    const rawRows = Array.isArray(payload) ? payload : payload.city_summaries;
    if (!Array.isArray(rawRows)) {
      throw new Error("JSON 中未找到 city_summaries 数组。");
    }
    rows = rawRows.map(normalizeDualSourceRow).filter(Boolean);
  } else {
    rows = indexCsvRows(parseCsv(trimmed)).map(normalizeDualSourceRow).filter(Boolean);
    payload = {
      method: "Imported dual-source consistency CSV",
      city_summaries: rows,
    };
  }
  if (!rows.length) {
    throw new Error("未解析到包含 city_id/site_id 与 status 的城市级校验结果。");
  }
  const bySiteId = new Map();
  for (const row of rows) {
    bySiteId.set(normalizeSearchText(row.site_id), row);
  }
  return {
    source_file: filename,
    loaded_at: new Date().toISOString(),
    method: payload.method || "",
    provider: payload.provider || "",
    provider_model: payload.provider_model || "",
    fetch_granularity: payload.fetch_granularity || "",
    sample_size: payload.sample_size || "",
    seed: payload.seed || "",
    thresholds: {
      mean_threshold_c: payload.mean_threshold_c ?? "",
      tail_threshold_c: payload.tail_threshold_c ?? "",
      tail_vote_threshold_c: payload.tail_vote_threshold_c ?? "",
      point_hard_threshold_c: payload.point_hard_threshold_c ?? "",
    },
    rows,
    bySiteId,
  };
}

function dualSourceForSite(siteId) {
  return dualSourceEvidence?.bySiteId.get(normalizeSearchText(siteId)) || null;
}

async function loadDualSourceEvidenceFromFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    dualSourceEvidence = parseDualSourceEvidence(text, file.name);
    setDualSourceStatus(`已导入 ${dualSourceEvidence.rows.length} 个城市的双源校验结果：${file.name}`);
    if (activeResult) {
      setWarning("双源证据已导入；请重新开始拉取，让新的 Excel 融合该证据。");
    }
  } catch (error) {
    dualSourceEvidence = null;
    elements.dualSourceFile.value = "";
    setDualSourceStatus(`双源校验文件解析失败：${error.message || error}`, true);
  }
}

function clearDualSourceEvidence() {
  dualSourceEvidence = null;
  elements.dualSourceFile.value = "";
  setDualSourceStatus("未导入；不影响 NASA 主数据拉取。");
}

async function fetchWithRetry(url, retries = 3) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
      }
    }
  }
  throw lastError;
}

function dateParts(key) {
  const year = key.slice(0, 4);
  const month = key.slice(4, 6);
  const day = key.slice(6, 8);
  const hour = key.slice(8, 10);
  return {
    date: `${year}-${month}-${day}`,
    hour,
    datetime: `${year}-${month}-${day} ${hour}:00`,
  };
}

function parseT2mRecords(site, year, payload, timeStandard) {
  const parameter = payload?.properties?.parameter?.[PARAMETER];
  if (!parameter || typeof parameter !== "object") {
    throw new Error(`${site.site_id} ${year}: NASA JSON 中未找到 properties.parameter.${PARAMETER}`);
  }
  const fillValue = Number(payload?.header?.fill_value ?? -999);
  const hourColumn = `hour_${timeStandard.toLowerCase()}`;
  const datetimeColumn = `datetime_${timeStandard.toLowerCase()}`;

  return Object.keys(parameter).sort().map((key) => {
    const raw = parameter[key];
    const numeric = raw === null || raw === undefined ? null : Number(raw);
    const t2m = numeric === null || !Number.isFinite(numeric) || numeric <= fillValue ? null : numeric;
    const parts = dateParts(key);
    return {
      site_id: site.site_id,
      name: site.name,
      country: site.country,
      latitude: site.latitude.toFixed(4),
      longitude: site.longitude.toFixed(4),
      date: parts.date,
      [hourColumn]: parts.hour,
      [datetimeColumn]: parts.datetime,
      t2m_c: t2m === null ? "" : t2m.toFixed(2),
      source: "NASA POWER Hourly API",
      parameter: PARAMETER,
      time_standard: timeStandard,
    };
  });
}

function summarizeSite(site, rows, threshold, cacheHits, cacheMisses, failedYears) {
  const values = rows
    .map((row) => Number(row.t2m_c))
    .filter((value) => Number.isFinite(value));
  const exceedCount = values.filter((value) => value >= threshold).length;
  const sum = values.reduce((total, value) => total + value, 0);
  const dualSource = dualSourceForSite(site.site_id);
  return {
    site_id: site.site_id,
    name: site.name,
    country: site.country,
    latitude: site.latitude.toFixed(4),
    longitude: site.longitude.toFixed(4),
    row_count: rows.length,
    valid_count: values.length,
    missing_count: rows.length - values.length,
    t2m_c_min: values.length ? Math.min(...values).toFixed(2) : "",
    t2m_c_mean: values.length ? (sum / values.length).toFixed(2) : "",
    t2m_c_max: values.length ? Math.max(...values).toFixed(2) : "",
    threshold_c: threshold.toFixed(1),
    exceed_count: exceedCount,
    exceed_ratio: values.length ? (exceedCount / values.length).toFixed(6) : "",
    exceed_ratio_percent: values.length ? `${((exceedCount / values.length) * 100).toFixed(2)}%` : "",
    dual_source_status: dualSource ? dualSource.status : "未导入",
    dual_source_reason: dualSource ? dualSource.reason : "",
    dual_source_sample_count: dualSource ? dualSource.sample_count : "",
    dual_source_compared_count: dualSource ? dualSource.compared_count : "",
    dual_source_mean_bias_c: dualSource ? dualSource.mean_bias_era5_minus_nasa_c : "",
    dual_source_tail_bias_c: dualSource ? dualSource.tail_mean_bias_c : "",
    cache_hits: cacheHits,
    cache_misses: cacheMisses,
    failed_years: failedYears.join(";"),
  };
}

function buildWideRows(longRows, sites, timeStandard) {
  const hourColumn = `hour_${timeStandard.toLowerCase()}`;
  const wideMap = new Map();
  for (const row of longRows) {
    const key = `${row.date}|${row[hourColumn]}`;
    if (!wideMap.has(key)) {
      wideMap.set(key, { date: row.date, [hourColumn]: row[hourColumn] });
    }
    wideMap.get(key)[`${row.site_id}_t2m_c`] = row.t2m_c;
  }
  const columns = ["date", hourColumn, ...sites.map((site) => `${site.site_id}_t2m_c`)];
  const rows = Array.from(wideMap.values()).sort((a, b) => {
    const left = `${a.date} ${a[hourColumn]}`;
    const right = `${b.date} ${b[hourColumn]}`;
    return left.localeCompare(right);
  });
  for (const row of rows) {
    for (const column of columns) {
      if (!(column in row)) row[column] = "";
    }
  }
  return { rows, columns };
}

function setWarning(message, error = false) {
  elements.warnings.hidden = !message;
  elements.warnings.classList.toggle("error", error);
  elements.warnings.textContent = message || "";
}

function setProgress(done, total, message) {
  elements.progressBar.max = total || 1;
  elements.progressBar.value = done;
  elements.currentTask.textContent = message;
}

function setBusy(isBusy) {
  elements.runButton.disabled = isBusy;
  elements.clearCache.disabled = isBusy;
  elements.fileInput.disabled = isBusy;
  elements.dualSourceFile.disabled = isBusy;
  elements.clearDualSource.disabled = isBusy;
  elements.geocodeButton.disabled = isBusy;
  elements.countryCityButton.disabled = isBusy;
}

function renderSummaryTable(rows) {
  elements.summaryTableBody.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const cells = [
      row.site_id,
      row.name,
      row.valid_count,
      row.missing_count,
      row.t2m_c_min,
      row.t2m_c_mean,
      row.t2m_c_max,
      row.exceed_count,
      row.exceed_ratio_percent,
      row.dual_source_status,
      row.cache_hits,
      row.cache_misses,
    ];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    }
    elements.summaryTableBody.appendChild(tr);
  }
}

function setDownloadsEnabled(result) {
  activeResult = result;
  elements.downloadButtons.querySelectorAll("button").forEach((button) => {
    button.disabled = !result;
  });
}

function downloadText(filename, text, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resultFilename(name, extension) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "_");
  return `nasa_power_t2m_${name}_${stamp}.${extension}`;
}

function safeSheetName(name, usedNames) {
  const cleaned = String(name || "sheet")
    .replace(/[:\\/?*\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "sheet";
  let candidate = cleaned;
  let index = 2;
  while (usedNames.has(candidate)) {
    const suffix = `_${index}`;
    candidate = `${cleaned.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

function rowsToAoa(rows, columns) {
  return [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? "")),
  ];
}

function summarySheetAoa(result) {
  const manifest = result.manifest;
  return [
    ["项目", "内容"],
    ["数据源", manifest.source],
    ["接口", manifest.endpoint],
    ["参数", `${manifest.parameter} (${manifest.parameter_meaning})`],
    ["时间标准", manifest.params.timeStandard],
    ["年份范围", `${manifest.params.startYear}-${manifest.params.endYear}`],
    ["超温阈值", `${manifest.params.threshold} °C`],
    ["点位数量", manifest.site_count],
    ["合并长表行数", result.longRows.length],
    ["宽表行数", result.wideRows.length],
    ["缓存命中", manifest.cache_hits],
    ["缓存未命中", manifest.cache_misses],
    ["失败请求", manifest.error_count],
    ["双源一致证据", manifest.dual_source?.status || "未导入"],
    ["双源证据文件", manifest.dual_source?.source_file || ""],
    ["工具版本", manifest.tool_version],
    ["生成时间", manifest.generated_at],
    ["说明", "T2M 为 2 米气温小时平均值，单位摄氏度；宽表按 date + hour 对齐全部点位；双源一致为可选抽样证据层。"],
    [],
    [
      "site_id",
      "名称",
      "国家",
      "纬度",
      "经度",
      "小时数",
      "有效小时",
      "缺失值",
      "温度范围",
      "平均温度",
      "超温阈值",
      "超温小时数",
      "超温占比",
      "双源状态",
      "双源备注",
      "缓存命中",
      "缓存未命中",
      "失败年份",
    ],
    ...result.summaryRows.map((row) => [
      row.site_id,
      row.name,
      row.country,
      row.latitude,
      row.longitude,
      row.row_count,
      row.valid_count,
      row.missing_count,
      row.t2m_c_min || row.t2m_c_max ? `${row.t2m_c_min} 至 ${row.t2m_c_max} °C` : "",
      row.t2m_c_mean ? `${row.t2m_c_mean} °C` : "",
      `${row.threshold_c} °C`,
      row.exceed_count,
      row.exceed_ratio_percent,
      row.dual_source_status,
      row.dual_source_reason,
      row.cache_hits,
      row.cache_misses,
      row.failed_years,
    ]),
  ];
}

function manifestRows(manifest) {
  const rows = [
    { key: "tool_version", value: manifest.tool_version },
    { key: "generated_at", value: manifest.generated_at },
    { key: "source", value: manifest.source },
    { key: "endpoint", value: manifest.endpoint },
    { key: "parameter", value: manifest.parameter },
    { key: "parameter_meaning", value: manifest.parameter_meaning },
    { key: "community", value: manifest.community },
    { key: "start_year", value: manifest.params.startYear },
    { key: "end_year", value: manifest.params.endYear },
    { key: "time_standard", value: manifest.params.timeStandard },
    { key: "threshold_c", value: manifest.params.threshold },
    { key: "refresh_cache", value: manifest.params.refreshCache },
    { key: "site_count", value: manifest.site_count },
    { key: "total_requests", value: manifest.total_requests },
    { key: "cache_hits", value: manifest.cache_hits },
    { key: "cache_misses", value: manifest.cache_misses },
    { key: "error_count", value: manifest.error_count },
    { key: "dual_source.status", value: manifest.dual_source?.status || "未导入" },
    { key: "dual_source.source_file", value: manifest.dual_source?.source_file || "" },
    { key: "dual_source.method", value: manifest.dual_source?.method || "" },
    { key: "dual_source.provider", value: manifest.dual_source?.provider || "" },
    { key: "dual_source.provider_model", value: manifest.dual_source?.provider_model || "" },
    { key: "dual_source.fetch_granularity", value: manifest.dual_source?.fetch_granularity || "" },
    { key: "dual_source.sample_size", value: manifest.dual_source?.sample_size || "" },
    { key: "dual_source.seed", value: manifest.dual_source?.seed || "" },
    { key: "sheets", value: "摘要, 宽表_全部点位对齐, 每个点位长表, 双源一致校验(如有), 运行记录, 错误记录(如有)" },
  ];
  for (const site of manifest.sites) {
    rows.push({
      key: `site.${site.site_id}`,
      value: `${site.name}, ${site.country || ""}, ${site.latitude}, ${site.longitude}`,
    });
  }
  return rows;
}

function autosizeSheet(sheet, rows, columns) {
  sheet["!cols"] = columns.map((column) => {
    const max = Math.max(
      String(column).length,
      ...rows.slice(0, 250).map((row) => String(row[column] ?? "").length),
    );
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });
}

function appendJsonSheet(workbook, name, rows, columns, usedNames) {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: columns });
  autosizeSheet(sheet, rows, columns);
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name, usedNames));
}

function appendAoaSheet(workbook, name, aoa, usedNames) {
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet["!cols"] = aoa[0].map((_, columnIndex) => {
    const max = Math.max(...aoa.slice(0, 250).map((row) => String(row[columnIndex] ?? "").length));
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });
  XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(name, usedNames));
}

function dualSourceManifest() {
  if (!dualSourceEvidence) {
    return { status: "未导入" };
  }
  return {
    status: "已导入",
    source_file: dualSourceEvidence.source_file,
    loaded_at: dualSourceEvidence.loaded_at,
    method: dualSourceEvidence.method,
    provider: dualSourceEvidence.provider,
    provider_model: dualSourceEvidence.provider_model,
    fetch_granularity: dualSourceEvidence.fetch_granularity,
    sample_size: dualSourceEvidence.sample_size,
    seed: dualSourceEvidence.seed,
    thresholds: dualSourceEvidence.thresholds,
    row_count: dualSourceEvidence.rows.length,
  };
}

const DUAL_SOURCE_COLUMNS = [
  "site_id",
  "name",
  "country",
  "sample_count",
  "compared_count",
  "missing_count",
  "nasa_mean_sample_t2m_c",
  "era5_mean_sample_t2m_c",
  "mean_bias_era5_minus_nasa_c",
  "p95_abs_point_diff_c",
  "p95_band_mean_bias_c",
  "tail_mean_bias_c",
  "status",
  "reason",
];

function downloadExcelWorkbook() {
  if (!activeResult) return;
  if (!window.XLSX) {
    setWarning("Excel 导出组件未加载。请确认网络可访问 cdn.sheetjs.com，或改用本地静态服务后刷新页面。", true);
    return;
  }
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set();

  appendAoaSheet(workbook, "摘要", summarySheetAoa(activeResult), usedNames);
  appendJsonSheet(workbook, "宽表_全部点位对齐", activeResult.wideRows, activeResult.wideColumns, usedNames);

  for (const site of activeResult.manifest.sites) {
    const rows = activeResult.longRows.filter((row) => row.site_id === site.site_id);
    appendJsonSheet(workbook, `${site.name || site.site_id}_长表`, rows, activeResult.longColumns, usedNames);
  }

  if (activeResult.dualSource?.rows?.length) {
    appendJsonSheet(workbook, "双源一致校验", activeResult.dualSource.rows, DUAL_SOURCE_COLUMNS, usedNames);
  }

  appendJsonSheet(workbook, "运行记录", manifestRows(activeResult.manifest), ["key", "value"], usedNames);

  if (activeResult.errors.length) {
    appendJsonSheet(workbook, "错误记录", activeResult.errors, activeResult.errorColumns, usedNames);
  }

  XLSX.writeFile(workbook, resultFilename("workbook", "xlsx"), { compression: true });
}

function downloadResult(type) {
  if (!activeResult) return;
  if (type === "excel") {
    downloadExcelWorkbook();
  }
}

function collectParams() {
  const startYear = Number(elements.startYear.value);
  const endYear = Number(elements.endYear.value);
  const threshold = Number(elements.threshold.value);
  const timeStandard = elements.timeStandard.value;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || startYear > endYear) {
    throw new Error("年份范围不合法。");
  }
  if (endYear - startYear > 40) {
    throw new Error("年份跨度过大，请缩小范围后重试。");
  }
  if (!Number.isFinite(threshold)) {
    throw new Error("超温阈值不合法。");
  }
  return {
    startYear,
    endYear,
    threshold,
    timeStandard,
    refreshCache: elements.refreshCache.checked,
  };
}

async function runExport() {
  setBusy(true);
  setDownloadsEnabled(null);
  setWarning("");
  elements.summaryTableBody.innerHTML = "";

  try {
    const params = collectParams();
    const sites = parseSites(elements.csvInput.value);
    const years = [];
    for (let year = params.startYear; year <= params.endYear; year += 1) years.push(year);
    const warnings = [];
    if (sites.length > 20) warnings.push(`本次包含 ${sites.length} 个点位，超过建议的 20 个点位。`);
    if (years.length > 10) warnings.push(`本次包含 ${years.length} 个自然年，超过建议的 10 年。`);
    if (warnings.length) setWarning(warnings.join(" "));

    const db = await openDatabase();
    const longRows = [];
    const summaryRows = [];
    const errors = [];
    const requests = [];
    const total = sites.length * years.length;
    let done = 0;

    for (const site of sites) {
      const siteRows = [];
      let cacheHits = 0;
      let cacheMisses = 0;
      const failedYears = [];
      for (const year of years) {
        const key = cacheKey(site, year, params.timeStandard);
        const url = buildNasaUrl(site, year, params.timeStandard);
        const requestRecord = {
          site_id: site.site_id,
          name: site.name,
          latitude: site.latitude,
          longitude: site.longitude,
          year,
          time_standard: params.timeStandard,
          cache_key: key,
          url,
          cache_hit: false,
          ok: false,
        };

        setProgress(done, total, `请求 ${site.name} ${year} ${params.timeStandard}`);
        try {
          let payload = null;
          if (!params.refreshCache) {
            const cached = await dbGet(db, "responses", key);
            if (cached?.payload) {
              payload = cached.payload;
              cacheHits += 1;
              requestRecord.cache_hit = true;
            }
          }
          if (!payload) {
            payload = await fetchWithRetry(url, 3);
            await dbPut(db, "responses", {
              key,
              payload,
              url,
              saved_at: new Date().toISOString(),
              site: {
                latitude: site.latitude,
                longitude: site.longitude,
              },
              year,
              time_standard: params.timeStandard,
              parameter: PARAMETER,
            });
            cacheMisses += 1;
          }
          const rows = parseT2mRecords(site, year, payload, params.timeStandard);
          siteRows.push(...rows);
          longRows.push(...rows);
          requestRecord.ok = true;
          requestRecord.row_count = rows.length;
        } catch (error) {
          failedYears.push(String(year));
          requestRecord.error = error.message || String(error);
          errors.push({
            site_id: site.site_id,
            name: site.name,
            latitude: site.latitude.toFixed(4),
            longitude: site.longitude.toFixed(4),
            year,
            error: requestRecord.error,
            url,
          });
        } finally {
          requests.push(requestRecord);
          done += 1;
          setProgress(done, total, `已完成 ${done}/${total}`);
        }
      }
      summaryRows.push(summarizeSite(site, siteRows, params.threshold, cacheHits, cacheMisses, failedYears));
      renderSummaryTable(summaryRows);
    }

    const wide = buildWideRows(longRows, sites, params.timeStandard);
    const summaryColumns = [
      "site_id",
      "name",
      "country",
      "latitude",
      "longitude",
      "row_count",
      "valid_count",
      "missing_count",
      "t2m_c_min",
      "t2m_c_mean",
      "t2m_c_max",
      "threshold_c",
      "exceed_count",
      "exceed_ratio",
      "exceed_ratio_percent",
      "dual_source_status",
      "dual_source_reason",
      "dual_source_sample_count",
      "dual_source_compared_count",
      "dual_source_mean_bias_c",
      "dual_source_tail_bias_c",
      "cache_hits",
      "cache_misses",
      "failed_years",
    ];
    const hourColumn = `hour_${params.timeStandard.toLowerCase()}`;
    const datetimeColumn = `datetime_${params.timeStandard.toLowerCase()}`;
    const longColumns = [
      "site_id",
      "name",
      "country",
      "latitude",
      "longitude",
      "date",
      hourColumn,
      datetimeColumn,
      "t2m_c",
      "source",
      "parameter",
      "time_standard",
    ];
    const errorColumns = ["site_id", "name", "latitude", "longitude", "year", "error", "url"];
    const manifest = {
      tool_version: TOOL_VERSION,
      generated_at: new Date().toISOString(),
      source: "NASA POWER Hourly API",
      endpoint: NASA_ENDPOINT,
      parameter: PARAMETER,
      parameter_meaning: "2-meter air temperature, hourly average, degree Celsius",
      community: COMMUNITY,
      params,
      dual_source: dualSourceManifest(),
      site_count: sites.length,
      sites,
      total_requests: requests.length,
      cache_hits: summaryRows.reduce((sum, row) => sum + Number(row.cache_hits || 0), 0),
      cache_misses: summaryRows.reduce((sum, row) => sum + Number(row.cache_misses || 0), 0),
      error_count: errors.length,
      requests,
      outputs: {
        workbook_xlsx: "download button: Excel workbook",
      },
    };

    const result = {
      params,
      summaryRows,
      summaryColumns,
      longRows,
      longColumns,
      wideRows: wide.rows,
      wideColumns: wide.columns,
      errors,
      errorColumns,
      dualSource: dualSourceEvidence ? { rows: dualSourceEvidence.rows } : null,
      manifest,
    };

    setDownloadsEnabled(result);
    const completeText = `完成：${sites.length} 个点位，${years.length} 年，${longRows.length.toLocaleString()} 条小时记录，${errors.length} 个失败请求。`;
    elements.runSummary.textContent = completeText;
    setProgress(total, total, completeText);
    if (errors.length) {
      setWarning(`有 ${errors.length} 个请求失败，下载 Excel 后可在“错误记录”sheet 查看。`, true);
    }
  } catch (error) {
    setWarning(error.message || String(error), true);
    elements.runSummary.textContent = "运行失败。";
    setProgress(0, 1, "运行失败，请检查输入。");
  } finally {
    setBusy(false);
  }
}

async function updateCacheStatus() {
  try {
    await openDatabase();
    elements.cacheStatus.textContent = "缓存：IndexedDB 可用";
  } catch (error) {
    elements.cacheStatus.textContent = "缓存：不可用";
    setWarning(`浏览器 IndexedDB 不可用：${error.message || error}`, true);
  }
}

elements.csvInput.value = DEFAULT_SAMPLE;
elements.loadHotCities.addEventListener("click", () => {
  elements.csvInput.value = hotCitiesCsv();
});
elements.downloadTemplate.addEventListener("click", () => {
  downloadText("nasa_power_temperature_input_template.csv", `\ufeff${hotCitiesCsv()}\n`, "text/csv;charset=utf-8");
});
elements.fileInput.addEventListener("change", async () => {
  const file = elements.fileInput.files?.[0];
  if (!file) return;
  elements.csvInput.value = await file.text();
});
elements.dualSourceFile.addEventListener("change", async () => {
  const file = elements.dualSourceFile.files?.[0];
  await loadDualSourceEvidenceFromFile(file);
});
elements.clearDualSource.addEventListener("click", () => {
  clearDualSourceEvidence();
});
elements.geocodeButton.addEventListener("click", () => {
  runGeocodeSearch();
});
elements.geocodeQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGeocodeSearch();
  }
});
elements.geocodeCountry.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runGeocodeSearch();
  }
});
elements.countryCityButton.addEventListener("click", () => {
  runCountryCitySearch();
});
elements.countryCityQuery.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runCountryCitySearch();
  }
});
elements.runButton.addEventListener("click", () => {
  runExport();
});
elements.clearCache.addEventListener("click", async () => {
  setBusy(true);
  try {
    const db = await openDatabase();
    await dbClearStores(db, ["responses", "geocodes", "countryCities"]);
    setWarning("浏览器缓存已清空。");
  } catch (error) {
    setWarning(`清空缓存失败：${error.message || error}`, true);
  } finally {
    setBusy(false);
  }
});
elements.downloadButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-download]");
  if (button) downloadResult(button.dataset.download);
});

updateCacheStatus();
