// 《牛来·梦境狂奔》 全局配置 —— 素朴“手搓”调色板取自电影海报与正片观感
export const CONFIG = {
  // 车道
  lanes: [-2.3, 0, 2.3],
  laneCount: 3,
  trackWidth: 8.4,

  // 速度（米/秒）
  baseSpeed: 10,
  maxSpeed: 27,
  accel: 0.14,

  // 物理参数
  gravity: 34,
  jumpVel: 12.8,
  slideTime: 0.62,

  // 赛道分段
  segLen: 30,
  segCount: 9,

  // 调色板（水墨海报 + 朴素低模正片）
  colors: {
    paper: 0xf4edda,      // 纸底
    skyTop: 0xefe8d4,     // 天顶·宣纸色
    skyBottom: 0xd9e0cd,  // 天际·淡青
    sun: 0xd08a72,        // 淡红日
    inkNear: 0x565d51,    // 近山·浓墨
    inkMid: 0x79826f,     // 中山·重墨
    inkFar: 0x9fac92,     // 远山·淡墨
    grass: 0x97a36b,      // 草原
    grassDark: 0x82925e,
    dirt: 0xc4a878,       // 土路
    dirtDark: 0xb09666,
    oxBody: 0xf2e8d4,     // 牛来·奶白
    oxPatch: 0x8a6a4e,    // 牛来·棕斑
    oxMuzzle: 0xe8b8ae,   // 鼻吻
    oxHorn: 0xe6d9bd,
    oxHoof: 0x584a3c,
    oxEye: 0x2e2a26,
    wolf: 0x6d7480,       // 狼
    wolfDark: 0x565d68,
    leopard: 0xd9b455,    // 豹拉
    grassBall: 0x7fa04f,  // 草料（收集）
    bell: 0xc9973f,       // 铜铃
    wood: 0x8a6a48,       // 木桩
    woodDark: 0x74563a,
    stone: 0x9a9789,      // 石块
    treeLeaf: 0x6f8f5a,
    treeLeafDark: 0x5f7d4e,
    treeTrunk: 0x7a5c40,
    snake: 0x7fa08a,      // 灵蛇
    lark: 0xd8cfb2,       // 云雀·云玎
    accent: 0xb5453c,     // 印章红
  },

  fogNear: 55,
  fogFar: 210,
};
