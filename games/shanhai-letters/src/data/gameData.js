/**
 * 《山海来信 v2.0》核心世界数据表（纯数据常量，Web 与小程序完全通用）
 */
import { EVENTS, DYNAMIC_FRAGMENTS, COAUTHOR_LETTERS } from './eventsData.js';

export { EVENTS, DYNAMIC_FRAGMENTS, COAUTHOR_LETTERS };

/* ---------- 四只山海神兽 ---------- */
export const BEASTS = [
  {
    id: 'baize',
    name: '白泽',
    title: '博闻多识',
    desc: '上古知万物之情的灵兽。喜欢博物馆、古城与旧书店，总想把眼前的新东西和古籍里的记载对上号。',
    tags: ['history', 'curious', 'calm', 'scholar'],
    cityPref: { xian: 3, suzhou: 2, dunhuang: 2, hangzhou: 1, dali: 1 },
    quirk: '见闻考据：更容易触发文化、古迹与"古今对照"类事件',
    color: '#6b82a1',
    inkTone: '#2f3d4f',
    paperTint: 'cool',
    quotes: [
      '窗外那座楼，比古图里画的还高呢。',
      '我正在把昨天带回来的车票夹进书里。',
      '茶凉了再添一点热水，不急。',
      '人间没有法术，却也把日子理得井井有条。'
    ]
  },
  {
    id: 'jiuweihu',
    name: '九尾狐',
    title: '活泼好奇',
    desc: '青丘来的小狐狸。喜欢夜市、美食与热闹的人群，走到哪儿都能交上朋友，也总能找到最好吃的那一口。',
    tags: ['social', 'food', 'playful', 'night'],
    cityPref: { chengdu: 3, harbin: 2, xian: 1, hangzhou: 2, quanzhou: 2 },
    quirk: '人间交游：更容易结识旅途中的人，带回有趣的礼物',
    color: '#d98c5f',
    inkTone: '#5a3324',
    paperTint: 'warm',
    quotes: [
      '今天空气里有桂花味，还有……烤红薯味！',
      '帮我装点好吃的在包袱里好不好？',
      '上次认识的人问我尾巴怎么梳得这么蓬松。',
      '晒太阳的地板暖烘烘的，再躺一会儿就出门。'
    ]
  },
  {
    id: 'qingniao',
    name: '青鸟',
    title: '温柔细腻',
    desc: '替神仙传信的青鸟。喜欢雨天、邮局和安静的小巷，擅长看见普通人之间那些没说出口的话。',
    tags: ['letter', 'quiet', 'empathy', 'rain'],
    cityPref: { suzhou: 2, hangzhou: 3, harbin: 2, chengdu: 1, dali: 2 },
    quirk: '书信传递：更容易收到别人的托付，带回特别的留言',
    color: '#5a9a91',
    inkTone: '#254a45',
    paperTint: 'jade',
    quotes: [
      '风从窗棂吹进来，像在催我再去远一点。',
      '每一封信折起来的时候，声音都不一样。',
      '如果下雨的话，我想在屋檐下多听一会儿。',
      '谢谢你帮我留着这盏灯，我总能找到回来的路。'
    ]
  },
  {
    id: 'jingwei',
    name: '精卫',
    title: '衔木填海',
    desc: '曾经发誓填平东海的灵鸟。如今飞越跨海长桥与沙漠防风林，才发现人间自有另一种不屈的移山填海之法。',
    tags: ['water', 'travel', 'craft', 'star'],
    cityPref: { quanzhou: 4, dunhuang: 2, harbin: 2, dali: 2, xian: 1 },
    quirk: '行远志坚：偏爱海港、大桥与远途奇观，更容易带回稀有路线记录',
    color: '#b85c4e',
    inkTone: '#4b2a26',
    paperTint: 'rose',
    unlockHint: '任一神兽达到第 2 阶「好奇」，或驿站累计出行满 4 次后，雨夜叩门入驻',
    quotes: [
      '今天把那粒西山石子擦了擦，放在窗台晒太阳。',
      '人造的跨海长桥，可比我一只鸟飞过去稳当多了。',
      '包袱里别忘塞张地图，我想去风浪更大的海口看看。',
      '从前只顾着低头飞，如今才觉得驿站的灯光这样暖。'
    ]
  }
];

/* ---------- 八座现代城市 ---------- */
export const CITIES = [
  {
    id: 'xian', name: '西安', region: '关中',
    tags: ['history', 'ancient', 'city', 'food'],
    weather: ['sunny', 'cloudy', 'night'],
    intro: '城墙下面跑着钢铁长龙，城楼上的风还是唐代的。'
  },
  {
    id: 'chengdu', name: '成都', region: '蜀中',
    tags: ['food', 'night', 'social', 'city'],
    weather: ['rain', 'cloudy', 'night'],
    intro: '夜里九点，街上的火锅味比星星还密。'
  },
  {
    id: 'suzhou', name: '苏州', region: '江南',
    tags: ['water', 'quiet', 'craft', 'rain'],
    weather: ['rain', 'cloudy', 'sunny'],
    intro: '船从桥下过去，橹声一响，水就皱了。'
  },
  {
    id: 'hangzhou', name: '杭州', region: '江南',
    tags: ['water', 'nature', 'quiet', 'tea'],
    weather: ['rain', 'sunny', 'cloudy'],
    intro: '西湖边上总有雨，也总有人愿意为一场雨停下。'
  },
  {
    id: 'dunhuang', name: '敦煌', region: '河西',
    tags: ['desert', 'history', 'nature', 'star'],
    weather: ['sunny', 'night', 'cloudy'],
    intro: '沙子会说话，只是说得慢，要听很多年。'
  },
  {
    id: 'harbin', name: '哈尔滨', region: '北疆',
    tags: ['snow', 'nature', 'night', 'food'],
    weather: ['snow', 'night', 'sunny'],
    intro: '冷得干脆，所以屋子里的光显得特别暖。'
  },
  {
    id: 'quanzhou', name: '泉州', region: '闽南',
    tags: ['water', 'history', 'craft', 'travel'],
    weather: ['sunny', 'rain', 'cloudy'],
    intro: '红砖古厝对着刺桐花开，宋元的海风至今还在古港打转。'
  },
  {
    id: 'dali', name: '大理', region: '滇西',
    tags: ['nature', 'quiet', 'craft', 'star'],
    weather: ['sunny', 'cloudy', 'night'],
    intro: '苍山十九峰压着洱海的云，风花雪月在这里是每天的日子。'
  }
];

/* ---------- 山海八节气轮转 ---------- */
export const SEASONS = [
  { id: 'lichun', name: '立春·新芽', weatherBias: 'sunny', particle: 'petals', materialBoost: ['dew', 'bamboo_shoot'], desc: '冻土初融，院里新抽了嫩绿竹芽，适合采露煮茶。' },
  { id: 'guyu', name: '谷雨·春茶', weatherBias: 'rain', particle: 'rain', materialBoost: ['dew', 'raw_paper'], desc: '细雨润物，檐下滴水叮咚，江南雨夜奇遇概率提升。' },
  { id: 'xiaoman', name: '小满·听风', weatherBias: 'cloudy', particle: 'petals', materialBoost: ['bamboo_shoot', 'raw_paper'], desc: '竹影摇曳，山海风清，远游带回书画纸笺更容易。' },
  { id: 'xiazhi', name: '夏至·流萤', weatherBias: 'night', particle: 'fireflies', materialBoost: ['cinnabar', 'dew'], desc: '白昼最长，夜色里有流萤在庭院草丛升起。' },
  { id: 'qiufen', name: '秋分·金桂', weatherBias: 'sunny', particle: 'petals', materialBoost: ['osmanthus_seed', 'dew'], desc: '金桂扑簌飘落满院，做桂花糕再合适不过。' },
  { id: 'shuangjiang', name: '霜降·柿红', weatherBias: 'cloudy', particle: 'leaves', materialBoost: ['osmanthus_seed', 'cinnabar'], desc: '晚风微凉，红叶入阶，最宜添茶温酒话家常。' },
  { id: 'dongzhi', name: '冬至·初雪', weatherBias: 'snow', particle: 'snow', materialBoost: ['cinnabar', 'raw_paper'], desc: '炉火红泥，北疆落雪，夜色灯笼与雪地事件更易相遇。' },
  { id: 'dahan', name: '大寒·守岁', weatherBias: 'night', particle: 'snow', materialBoost: ['cinnabar', 'osmanthus_seed'], desc: '岁末将近，万家灯火最暖时，双兽同行羁绊增长更快。' }
];

/* ---------- 五维心境盘 ---------- */
export const TRAITS = [
  { id: 'scholar', name: '格物', desc: '博古通今，追问原理', color: '#466982' },
  { id: 'empathy', name: '悲悯', desc: '体察人心，珍视托付', color: '#b85443' },
  { id: 'calm', name: '逍遥', desc: '随风听雨，不急不躁', color: '#4f7050' },
  { id: 'food', name: '烟火', desc: '贪恋市井，人间百味', color: '#c88032' },
  { id: 'brave', name: '破妄', desc: '敢向未知，破浪问津', color: '#8a5b94' }
];

/* ---------- 12 种后天性格印记（由五维心境觉醒，带来反差萌） ---------- */
export const PERSONA_QUIRKS = [
  {
    id: 'quirk-gourmet', name: '夜市老饕', requireTrait: { food: 3 },
    desc: '哪怕平日端庄，一嗅到烤串与红汤香味也会走不动路。',
    tagBoost: { food: 1.8, night: 1.5 }, cityBias: { chengdu: 2, xian: 1 }
  },
  {
    id: 'quirk-collator', name: '古籍校勘', requireTrait: { scholar: 3 },
    desc: '路过博物馆和碑林总要蹲下来核对铭文与偏旁。',
    tagBoost: { history: 1.8, scholar: 1.8 }, cityBias: { xian: 2, dunhuang: 2 }
  },
  {
    id: 'quirk-rainlistener', name: '檐下听雨人', requireTrait: { calm: 3 },
    desc: '一落雨就放慢步子，在青石板巷子里听雨打芭蕉。',
    tagBoost: { rain: 2.0, quiet: 1.6 }, cityBias: { suzhou: 2, hangzhou: 2 }
  },
  {
    id: 'quirk-messenger', name: '山海飞鸿', requireTrait: { empathy: 3 },
    desc: '擅长记下陌生人没说出口的挂念，并替他们带一程话。',
    tagBoost: { letter: 2.0, empathy: 1.8 }, cityBias: { suzhou: 1, quanzhou: 2 }
  },
  {
    id: 'quirk-pioneer', name: '破浪问津', requireTrait: { brave: 3 },
    desc: '喜欢天没亮就出发，去港口、车站和地图的边缘。',
    tagBoost: { travel: 1.9, star: 1.5 }, cityBias: { quanzhou: 2, dunhuang: 2 }
  },
  {
    id: 'quirk-teadrinker', name: '竹炉煎茶客', requireTrait: { calm: 6 },
    desc: '在每座城都能准确找到坐得住一下午的街角茶寮。',
    tagBoost: { tea: 2.0, water: 1.5 }, cityBias: { hangzhou: 2, dali: 2 }
  },
  {
    id: 'quirk-storyteller', name: '茶馆听书人', requireTrait: { empathy: 6 },
    desc: '坐在长凳尾排捧场，最爱听老街坊讲三十年前的旧事。',
    tagBoost: { social: 1.8, quiet: 1.5 }, cityBias: { chengdu: 2, dali: 1 }
  },
  {
    id: 'quirk-starwatcher', name: '观星拾遗', requireTrait: { scholar: 6 },
    desc: '能把上古二十八宿与现代天文望远镜里的星座一一叠合。',
    tagBoost: { star: 2.0, desert: 1.6 }, cityBias: { dunhuang: 3, dali: 2 }
  },
  {
    id: 'quirk-snowwalker', name: '踏雪寻灯', requireTrait: { brave: 6 },
    desc: '越冷越精神，专门在结霜的夜街上数透着暖光的窗户。',
    tagBoost: { snow: 2.0, night: 1.6 }, cityBias: { harbin: 3 }
  },
  {
    id: 'quirk-sketcher', name: '风物速写师', requireTrait: { scholar: 5, empathy: 4 },
    desc: '随身带炭笔，见了老手艺与古桥总要画下拆解线稿。',
    tagBoost: { record: 2.0, craft: 1.7 }
  },
  {
    id: 'quirk-hearth', name: '人间掌灯人', requireTrait: { empathy: 8, calm: 5 },
    desc: '习惯为晚归的人留一盏小灯，也总被夜色里的温柔留住。',
    tagBoost: { night: 1.9, empathy: 1.7 }
  },
  {
    id: 'quirk-seaexplorer', name: '百川归海志', requireTrait: { brave: 8, food: 4 },
    desc: '走过海港与排档，知道潮汐何时起落，也知道鲜蚝几分熟。',
    tagBoost: { water: 2.0, travel: 1.7 }, cityBias: { quanzhou: 3 }
  }
];

/* ---------- 庭院灵材（5 种） ---------- */
export const MATERIALS = [
  { id: 'dew', name: '山泉清露', desc: '晨起荷叶尖接的微露，烹茶揉糕都要用它。' },
  { id: 'osmanthus_seed', name: '秋实金桂', desc: '院里桂树落下的香瓣，甜津津的。' },
  { id: 'bamboo_shoot', name: '青丘竹叶', desc: '清香带韧的青竹箬叶，能扎伞骨也能裹竹筒饭。' },
  { id: 'raw_paper', name: '宣麻素纸', desc: '晒干的桑皮宣纸，裁成手账、灯罩或折成地图。' },
  { id: 'cinnabar', name: '辰砂印泥', desc: '细研过的朱砂矿物，封火漆、制铜铃与朱印全靠它。' }
];

/* ---------- 随身道具（12 件，全数支持茶案手作） ---------- */
export const ITEMS = [
  {
    id: 'camera', name: '旧式相机', emoji: '📷', tags: ['record', 'curious'],
    bias: {}, boost: { record: 2, nature: 1 },
    desc: '它总想把自己没看懂的东西拍下来，回去慢慢想。',
    effect: 'postcard', hint: '更容易留下旅途拍立得与明信片',
    recipe: { raw_paper: 1, cinnabar: 1 }
  },
  {
    id: 'oldbook', name: '古书残页', emoji: '📜', tags: ['history', 'scholar'],
    bias: { xian: 3, dunhuang: 2 }, boost: { history: 2.5 },
    desc: '一页看不出年代的书。它相信答案都在里面。',
    effect: 'lore', hint: '古今对照多涨见闻',
    recipe: { raw_paper: 2, dew: 1 }
  },
  {
    id: 'umbrella', name: '油纸伞', emoji: '☂️', tags: ['rain', 'quiet'],
    bias: { hangzhou: 2, suzhou: 2 }, boost: { rain: 2.5, quiet: 1.5 },
    desc: '伞骨是竹的，伞面涂了桐油。下雨天它才想起带。',
    effect: 'rain', hint: '雨天会拐进深巷且必带回画片',
    recipe: { bamboo_shoot: 2, raw_paper: 1 }
  },
  {
    id: 'map', name: '旅行地图', emoji: '🗺️', tags: ['travel', 'curious'],
    bias: {}, boost: { travel: 2 },
    desc: '一张被折了很多次的地图，边角已经毛了。',
    effect: 'far', hint: '走得更远，大概率游历两座城',
    recipe: { raw_paper: 1, bamboo_shoot: 1 }
  },
  {
    id: 'osmanthus', name: '桂花糕', emoji: '🍡', tags: ['food', 'social'],
    bias: {}, boost: { social: 1.5, food: 1.5 },
    desc: '甜，但容易碎。它可能会分给别人，也可能自己吃掉。',
    effect: 'share', hint: '路上更容易与人交朋友',
    recipe: { osmanthus_seed: 2, dew: 1 }
  },
  {
    id: 'bamboo', name: '竹筒饭', emoji: '🍚', tags: ['food', 'nature'],
    bias: {}, boost: { food: 1.5, nature: 1.2 },
    desc: '装着米饭的竹筒，劈开时有股清香。',
    effect: 'long', hint: '耐饥远行，提升双站出行概率',
    recipe: { bamboo_shoot: 2, dew: 1 }
  },
  {
    id: 'hawthorn', name: '山楂糕', emoji: '🍬', tags: ['food', 'playful'],
    bias: {}, boost: { playful: 1.5, social: 1.2 },
    desc: '酸得直皱眉，它还是每次都要带。',
    effect: 'cheer', hint: '心情好，归来见闻 +1',
    recipe: { osmanthus_seed: 1, cinnabar: 1 }
  },
  {
    id: 'notebook', name: '空白手账', emoji: '📓', tags: ['record', 'scholar'],
    bias: {}, boost: { record: 2, scholar: 1.5 },
    desc: '它开始学着把自己看见的写下来。',
    effect: 'note', hint: '更容易留下成篇记录与纪念品',
    recipe: { raw_paper: 2 }
  },
  {
    id: 'bell', name: '铜铃', emoji: '🔔', tags: ['social', 'playful'],
    bias: {}, boost: { social: 1.8 },
    desc: '铃一响，就有人回头。',
    effect: 'meet', hint: '提高纪念品掉落率',
    recipe: { cinnabar: 1, bamboo_shoot: 1 }
  },
  {
    id: 'lantern', name: '小灯笼', emoji: '🏮', tags: ['night', 'quiet'],
    bias: {}, boost: { night: 2 },
    desc: '走夜路的时候，它说这样看起来不那么像妖怪。',
    effect: 'night', hint: '夜里走得安稳，额外带回灯影好物',
    recipe: { raw_paper: 1, cinnabar: 1 }
  },
  {
    id: 'compass', name: '西域司南', emoji: '🧭', tags: ['star', 'travel', 'ancient'],
    bias: { dunhuang: 3, quanzhou: 3, dali: 2 }, boost: { star: 2.5, travel: 2.2 },
    desc: '磁勺磨得发亮的青铜司南，据说专指《山海经》里未写尽的旧道。',
    effect: 'rare', hint: '大幅提升稀有/传说纪念品与敦煌泉州遇奇几率',
    recipe: { cinnabar: 2, bamboo_shoot: 1, dew: 1 }
  },
  {
    id: 'waxseal', name: '加急火漆', emoji: '🕯️', tags: ['letter', 'empathy'],
    bias: { suzhou: 2, hangzhou: 2 }, boost: { letter: 2.6, empathy: 2 },
    desc: '混了松香与辰砂的特制火漆，封在包袱角上能借风顺途。',
    effect: 'express', hint: '行程缩短约 35%，且优先触发事件链与回声信件',
    recipe: { cinnabar: 2, osmanthus_seed: 1 }
  }
];

/* ---------- 纪念品（36 件） ---------- */
const S = (id, name, city, rarity, tags, desc, attract) => ({
  id, name, city, rarity, tags, desc, attract: attract || []
});

export const SOUVENIRS = [
  // 西安
  S('sou-train-sketch', '铁兽速写', 'xian', 'rare', ['record', 'travel'], '蜡笔画的钢铁长龙，边角被揉皱了。背面写着"尚未查证"。', ['scholar']),
  S('sou-terracotta', '小陶俑', 'xian', 'common', ['history'], '一只耳朵缺了角的陶俑。它说，站了这么久，辛苦了。', ['history']),
  S('sou-paper-cut', '窗花', 'xian', 'common', ['craft'], '红纸剪的公鸡，贴在窗上会透光。', ['craft']),
  S('sou-wall-brick', '城墙砖屑', 'xian', 'common', ['history'], '一小块城墙的碎屑，用麻绳系着。', ['history']),
  S('sou-bell-charm', '钟楼铜铃', 'xian', 'rare', ['history', 'record'], '照着钟楼的铃做的挂饰，摇起来声音很闷。', ['history']),
  // 成都
  S('sou-hotpot-token', '火锅号码牌', 'chengdu', 'common', ['food'], '木制的等位号码牌，背面还留着油渍。', ['food']),
  S('sou-panda-ear', '熊猫耳朵', 'chengdu', 'common', ['playful'], '毛茸茸的发夹。它戴了一下，又不好意思地摘了。', ['playful']),
  S('sou-tea-lid', '茶碗盖', 'chengdu', 'common', ['quiet'], '茶馆里缺了个口的碗盖，据说能拴住一整个下午。', ['quiet']),
  S('sou-lantern', '纸灯笼', 'chengdu', 'common', ['night'], '折得很认真，虽然有点歪。', ['night']),
  S('sou-chili', '辣椒串', 'chengdu', 'common', ['food'], '一串干辣椒。它咬了一口，之后两天没说话。', ['food']),
  // 苏州
  S('sou-paper-umbrella', '油纸伞', 'suzhou', 'rare', ['rain', 'craft'], '靛蓝色的油纸伞。它说下雨的时候，人才会慢下来。', ['rain', 'craft']),
  S('sou-silk', '苏绣手帕', 'suzhou', 'rare', ['craft', 'letter'], '青瓷色的丝帕，角上绣了一朵梅。', ['craft', 'letter']),
  S('sou-boat-paddle', '小橹', 'suzhou', 'common', ['water'], '船家送的小木橹，说是给孩子玩的。', ['water']),
  S('sou-arch-stone', '桥形石', 'suzhou', 'common', ['water', 'nature'], '一块天然弯成拱形的石头。', ['water']),
  S('sou-kunqu-fan', '昆曲小扇', 'suzhou', 'rare', ['craft', 'quiet'], '扇面上画着半张脸，另半张留白。', ['craft']),
  // 杭州
  S('sou-lotus-pod', '莲蓬', 'hangzhou', 'common', ['nature'], '干透的莲蓬，摇一摇还会响。', ['nature']),
  S('sou-longjing', '龙井茶包', 'hangzhou', 'common', ['tea', 'quiet'], '一小包茶叶，纸上有炒茶人的名字。', ['tea']),
  S('sou-rain-bottle', '雨水瓶', 'hangzhou', 'rare', ['rain', 'letter'], '装着西湖雨水的小瓶。标签写着"某日，断桥"。', ['rain', 'letter']),
  S('sou-bridge-mark', '断桥书签', 'hangzhou', 'common', ['craft'], '刻着桥的木书签，边缘磨圆了。', ['craft']),
  S('sou-osmanthus', '糖桂花', 'hangzhou', 'common', ['food'], '一罐腌好的桂花，开盖就是秋天。', ['food']),
  // 敦煌
  S('sou-sand-vial', '沙瓶', 'dunhuang', 'common', ['desert'], '一整瓶金色的沙，据说每一粒都叫得出名字。', ['desert']),
  S('sou-camel-bell', '驼铃', 'dunhuang', 'rare', ['desert', 'travel'], '黄铜的小铃，声音比看起来要远。', ['desert']),
  S('sou-fresco', '壁画残片', 'dunhuang', 'rare', ['history', 'craft'], '画着飞天的陶片，颜料还亮着。', ['history']),
  S('sou-star-chart', '星图', 'dunhuang', 'legend', ['star', 'record'], '手绘的星图，边上标注了它自己起的名字。', ['star', 'scholar']),
  // 哈尔滨
  S('sou-ice-lantern', '冰灯', 'harbin', 'rare', ['snow', 'night'], '一小块会发光的冰，据说天暖了就化。', ['snow']),
  S('sou-snowflake', '剪纸雪花', 'harbin', 'common', ['snow', 'craft'], '六折的剪纸，摊开时它愣了很久。', ['snow']),
  S('sou-pinecone', '落霜松果', 'harbin', 'common', ['nature'], '结着霜的松果，拿进屋会滴水。', ['nature']),
  // 泉州 & 大理 & 跨城传家宝
  S('sou-sea-pearl', '刺桐海螺', 'quanzhou', 'rare', ['water', 'travel'], '贴在耳边能听见宋元古港涨潮声的粉白海螺。', ['water', 'travel']),
  S('sou-brick-ship', '福船木模', 'quanzhou', 'rare', ['craft', 'travel'], '尖底水密隔舱的精巧福船，连帆绳都系得一丝不苟。', ['craft', 'travel']),
  S('sou-tie-dye', '苍山扎染帕', 'dali', 'common', ['craft', 'nature'], '板蓝根染就的方帕，中间晕出一朵苍山白雪云。', ['craft', 'quiet']),
  S('sou-wind-flower', '风花雪月签', 'dali', 'rare', ['nature', 'letter'], '压进了半片洱海干荷与苍山雪松针的木质书签。', ['quiet', 'letter']),
  S('sou-compass', '古铜星盘', '*', 'legend', ['star', 'travel'], '刻着二十八宿与海丝航向的旧铜盘，在夜间微温。', ['star', 'scholar']),
  S('sou-hearth-stone', '暖炉镇纸', '*', 'legend', ['empathy', 'quiet'], '故人亲手打磨的温玉镇纸，压在案头时墨香不散。', ['history', 'quiet']),
  // 通用
  S('sou-rail-map', '铁路手册', '*', 'rare', ['travel', 'record'], '白泽自己做的铁路图，边角写满了批注。', ['travel', 'scholar']),
  S('sou-postcard', '空白明信片', '*', 'common', ['letter'], '没有写字的明信片。它说，留给你写。', ['letter']),
  S('sou-handbook', '现代人间观察笔记', '*', 'legend', ['record', 'scholar'], '厚厚一本，按"铁兽/方盒/小镜"分了类。', ['scholar'])
];

/* ---------- 8 条跨城故人捎物委托 ---------- */
export const COMMISSIONS = [
  {
    id: 'comm-dunhuang-silk',
    title: '画师的江南念想',
    requester: '敦煌守窟画师',
    targetCity: 'dunhuang',
    wantSouvenir: 'sou-silk',
    rewardSouvenir: 'sou-hearth-stone',
    rewardStamp: 'xinghe',
    story: '画师修补了半辈子干涸洞窟里的衣袂飘带，却从未见过真正柔软得像水一样的苏绣丝帕。',
    fulfillTitle: '【托付达成】丝帕上的飞天',
    fulfillBody: '我把你包袱里捎带的「苏绣手帕」转交给那位敦煌守窟画师了。\n他对着手帕上那朵梅花看了足足一刻钟，说原来江南的线真是软的，比颜料里的青金石还透亮。\n他回赠了一枚亲手磨热的「暖炉镇纸」与一枚星河闲章，说替他压住驿站的信纸，别被风吹散。'
  },
  {
    id: 'comm-xian-tea',
    title: '泡馍大爷的一口春茶',
    requester: '西安城墙根秦大爷',
    targetCity: 'xian',
    wantSouvenir: 'sou-longjing',
    rewardSouvenir: 'sou-bell-charm',
    rewardMaterial: { dew: 2, cinnabar: 2 },
    story: '教神兽掰泡馍的秦大爷嘴馋西湖新茶多年，却一直舍不得关了早晨的热汤锅出远门。',
    fulfillTitle: '【托付达成】热汤锅边泡龙井',
    fulfillBody: '清晨五点半我把「龙井茶包」送到了泡馍馆。\n秦大爷拿刚烧开的滚水冲了一大搪瓷缸，喝一口直咂嘴："香！这茶叶跟咱西安的春风一个脾气，爽利！"\n他非要把店门口挂了二十年的旧铜铃解下来送我，说是"听个响，路上不孤单"。'
  },
  {
    id: 'comm-suzhou-sand',
    title: '绣娘想看一眼大漠的沙',
    requester: '苏州绣坊沈姑',
    targetCity: 'suzhou',
    wantSouvenir: 'sou-sand-vial',
    rewardSouvenir: 'sou-kunqu-fan',
    rewardStamp: 'yanyu',
    story: '沈姑总把丝线绣出烟雨江南的淡色，最近接了幅大漠孤烟的屏风，总觉得没摸过真沙子下不了针。',
    fulfillTitle: '【托付达成】一瓶金色调进丝线里',
    fulfillBody: '沈姑把你捎去的敦煌「沙瓶」倒在白宣纸上，拿放大镜数金沙在灯光下的反光。\n"怪不得古画要用泥金，"她笑着把「昆曲小扇」包好递给我，"烟雨里也能绣出大漠的日头了。"'
  },
  {
    id: 'comm-harbin-lantern',
    title: '冰雕师的巴蜀暖灯',
    requester: '哈尔滨老冰匠',
    targetCity: 'harbin',
    wantSouvenir: 'sou-lantern',
    rewardSouvenir: 'sou-ice-lantern',
    rewardMaterial: { cinnabar: 2, raw_paper: 2 },
    story: '零下二十多度的冰场里，老冰匠听说南方竹骨糊纸的灯笼透着暖光，想照着模样凿进明年的冰城墙。',
    fulfillTitle: '【托付达成】冰墙里点起一盏纸灯',
    fulfillBody: '我把成都带去的「纸灯笼」放进了冰匠刚挖好的冰龛里。\n透着冰面照出来的红光，暖得连雪花落上去都舍不得立刻冻住。\n老冰匠当场雕了一只晶莹透亮的「冰灯」装在木盒里回赠，说放在窗台可以伴着读信。'
  },
  {
    id: 'comm-quanzhou-starchart',
    title: '老船长校对海天星图',
    requester: '泉州古港陈船长',
    targetCity: 'quanzhou',
    wantSouvenir: 'sou-star-chart',
    rewardSouvenir: 'sou-compass',
    rewardStamp: 'changhuan',
    story: '退休老船长年轻时靠看星象走南洋，听说敦煌沙漠里也有人对照上古星官记下了一张星图，想借去合璧校勘。',
    fulfillTitle: '【托付达成】山星海星同在一盘',
    fulfillBody: '陈船长把敦煌「星图」铺在码头石桌上，用红笔连出南洋航线与大漠驼道的重合星位，高兴得像个孩子。\n"山里的星和海上的星原是一家人！"他把祖传的「古铜星盘」包进麂皮里托我带回，说驿站往后的路还长着呢。'
  },
  {
    id: 'comm-chengdu-rain',
    title: '茶馆听书人的西湖雨',
    requester: '成都茶馆周先生',
    targetCity: 'chengdu',
    wantSouvenir: 'sou-rain-bottle',
    rewardSouvenir: 'sou-panda-ear',
    rewardMaterial: { osmanthus_seed: 3, dew: 2 },
    story: '说书的周先生这阵子在讲《白蛇传》，总想泡一壶真正的西湖雨水茶，好讲出断桥烟雨的味儿。',
    fulfillTitle: '【托付达成】断桥雨煮青城茶',
    fulfillBody: '茶馆炉火一旺，「雨水瓶」里的西湖水居然真煮出了清甜味！\n周先生一拍醒木，满堂茶客鼓掌叫好。散场后隔壁桌的小姑娘把自己的「熊猫耳朵」送给了我，说听得入迷，这是赏银。'
  },
  {
    id: 'comm-dali-tea',
    title: '白族阿婆的江南春信',
    requester: '大理周城染布阿婆',
    targetCity: 'dali',
    wantSouvenir: 'sou-bridge-mark',
    rewardSouvenir: 'sou-tie-dye',
    rewardMaterial: { bamboo_shoot: 3, raw_paper: 2 },
    story: '染布阿婆年轻时曾收过一位杭州织锦朋友寄来的木书签，可惜早年搬家弄丢了，一直念念不忘。',
    fulfillTitle: '【托付达成】两片江南云落在靛蓝缸边',
    fulfillBody: '阿婆接过「断桥书签」时，摩挲着上面圆润的桥拱轮廓笑了好久。\n"杭州的朋友还好吗？"她转身挑了缸底纹样最周正的「苍山扎染帕」让我带回驿站，说"风把信吹来了，布替我回礼"。'
  },
  {
    id: 'comm-hangzhou-osmanthus',
    title: '守园人找回的桂花方',
    requester: '杭州茶山阿婆',
    targetCity: 'hangzhou',
    wantSouvenir: 'sou-chili',
    rewardSouvenir: 'sou-osmanthus',
    rewardMaterial: { osmanthus_seed: 3, cinnabar: 1 },
    story: '西湖边腌糖桂花的阿婆听说蜀中人用干辣椒能配出另一番暖意，想讨一串挂在灶头驱散江南冬天的湿寒。',
    fulfillTitle: '【托付达成】江南湿冷灶头挂起川椒红',
    fulfillBody: '那串「辣椒串」一挂上青砖灶台，整个厨房立刻热闹起来。\n阿婆喜滋滋地掀开坛盖，舀了一满罐今秋最新鲜的「糖桂花」塞进包袱："回去蒸糕吃，比糖还润肺！"'
  }
];

/* ---------- 六大博古架「堂前雅韵」气场 ---------- */
export const ROOM_AURAS = [
  {
    id: 'aura-jiangnan', name: '江南听雨局',
    need: ['rain', 'water', 'quiet'], min: 3,
    bonus: { rain: 1.45, quiet: 1.35, water: 1.3 },
    desc: '檐雨、青瓷与茶香聚拢在正厅，江南水乡与雨天事件更常造访。'
  },
  {
    id: 'aura-silkroad', name: '大漠星河局',
    need: ['desert', 'star', 'history'], min: 3,
    bonus: { desert: 1.45, star: 1.45, history: 1.3 },
    desc: '驼铃与星图在木架上遥遥相对，敦煌与观星奇遇概率大增。'
  },
  {
    id: 'aura-market', name: '市井百味局',
    need: ['food', 'playful', 'night'], min: 3,
    bonus: { food: 1.45, night: 1.35, social: 1.3 },
    desc: '红灯与烟火气盈满堂前，美食、夜市与人间交游纷至沓来。'
  },
  {
    id: 'aura-scholar', name: '古今考据局',
    need: ['scholar', 'history', 'craft'], min: 3,
    bonus: { scholar: 1.5, history: 1.35, craft: 1.3 },
    desc: '书香与手艺之气沉稳绵长，见闻考据事件额外增加见闻收获。'
  },
  {
    id: 'aura-voyage', name: '山海远航局',
    need: ['travel', 'water', 'star'], min: 3,
    bonus: { travel: 1.5, water: 1.35 },
    desc: '海螺、福船与铁路图共鸣，远途双站游历与海港奇遇更易开启。'
  },
  {
    id: 'aura-letters', name: '鸿雁尺素局',
    need: ['letter', 'quiet', 'craft'], min: 3,
    bonus: { letter: 1.5, empathy: 1.4 },
    desc: '笔墨素纸之气静默流动，回声信件与故人托付更易入信箱。'
  }
];

/* ---------- 六枚山海朱砂闲章 ---------- */
export const STAMPS = [
  { id: 'jianzi', name: '见字如面', sub: '常备闲章', motto: '纸短情长，展信安好' },
  { id: 'pingan', name: '岁岁平安', sub: '常备闲章', motto: '风霜不侵，早归驿站' },
  { id: 'shanhai', name: '山海同风', sub: '常备闲章', motto: '天地虽阔，心意相通' },
  { id: 'yanyu', name: '烟雨江南', sub: '故人赠印', motto: '一伞一巷，慢听微雨' },
  { id: 'xinghe', name: '大漠星河', sub: '故人赠印', motto: '星斗垂野，古今同观' },
  { id: 'changhuan', name: '人间长欢', sub: '访客赠印', motto: '一饭一茶，尽得其乐' }
];

/* ---------- 庭院动态茶会访客（含以物易物清单） ---------- */
export const VISITORS = [
  {
    id: 'grandma', name: '巷口的老奶奶', need: ['letter', 'rain'], count: 2,
    line: '她把一张画塞进神兽翅膀里，说想寄给远方的孙女。',
    gift: 'sou-postcard',
    bonus: { letter: 1.35, empathy: 1.3 },
    letter: {
      title: '老奶奶托人带来的画',
      body: '那天在你这儿歇脚的老奶奶，托我带一样东西给你。\n是一张画。画上是太阳、房子，三个歪歪扭扭的人。\n她说孙女收到会高兴的。她还说，谢谢你家的神兽，那天陪她说了很久的话。',
      reply: [
        { text: '替我谢谢她', trait: 'empathy', memory: { thank_friend: 1 } },
        { text: '下次请她进来坐坐', trait: 'calm', memory: { knock_door: 1 } },
        { text: '这张画要好好收着', trait: 'scholar', memory: { keep_item: 1 } }
      ]
    },
    trades: [
      { id: 'tr-gm-1', costType: 'souvenir', costId: 'sou-postcard', costCount: 2, gainType: 'item', gainId: 'waxseal', gainCount: 1, label: '2 张空白明信片 → 换 1 枚「加急火漆」' },
      { id: 'tr-gm-2', costType: 'material', costId: 'dew', costCount: 2, gainType: 'item', gainId: 'umbrella', gainCount: 1, label: '2 滴山泉清露 → 换 1 把「油纸伞」' }
    ]
  },
  {
    id: 'postman', name: '退休的邮递员', need: ['letter', 'travel'], count: 2,
    line: '他带来一沓旧信封，说这些地址早就拆了，可字还在。',
    gift: 'sou-silk',
    bonus: { letter: 1.45, record: 1.3 },
    letter: {
      title: '旧邮递员留下的信封',
      body: '我在你家驿站门口坐了一下午。\n带了一沓退回来的信——地址早就拆了，人也散了，可字还在。\n你们家那位青鸟说，它愿意替我送送看。送不到也没关系，至少信还在飞。',
      reply: [
        { text: '让它送，我支持', trait: 'brave', memory: { encourage: 1 } },
        { text: '有些信不用送到', trait: 'empathy', memory: { value_ordinary: 1 } },
        { text: '你也进来喝口茶', trait: 'calm', memory: { care_back: 1 } }
      ]
    },
    trades: [
      { id: 'tr-pm-1', costType: 'souvenir', costId: 'sou-bridge-mark', costCount: 1, gainType: 'item', gainId: 'waxseal', gainCount: 2, label: '1 枚断桥书签 → 换 2 枚「加急火漆」' },
      { id: 'tr-pm-2', costType: 'souvenir', costId: 'sou-postcard', costCount: 3, gainType: 'stamp', gainId: 'changhuan', gainCount: 1, label: '3 张空白明信片 → 刻「人间长欢」闲章' }
    ]
  },
  {
    id: 'teahouse', name: '茶馆老板', need: ['tea', 'quiet'], count: 2,
    line: '他留了个靠窗的位置，说那一位每天都来。',
    gift: 'sou-tea-lid',
    bonus: { quiet: 1.4, tea: 1.45 },
    letter: {
      title: '茶馆的靠窗位置',
      body: '路过你家门口，闻到茶香，就进来坐了会儿。\n我在自家茶馆给人留了个靠窗的位置，留了很多年。\n你们家的神兽问我为什么。我说：位置留着，人就还在。\n它记了很久。',
      reply: [
        { text: '这句话该记下来', trait: 'scholar', memory: { record_habit: 1 } },
        { text: '下次带我一起去坐坐', trait: 'calm', memory: { bring_me: 1 } },
        { text: '给它也留个位置吧', trait: 'empathy', memory: { keep_light: 1 } }
      ]
    },
    trades: [
      { id: 'tr-th-1', costType: 'souvenir', costId: 'sou-tea-lid', costCount: 1, gainType: 'material', gainId: 'dew', gainCount: 3, label: '1 只茶碗盖 → 换 3 滴「山泉清露」' },
      { id: 'tr-th-2', costType: 'souvenir', costId: 'sou-longjing', costCount: 1, gainType: 'item', gainId: 'osmanthus', gainCount: 2, label: '1 包龙井茶包 → 换 2 份「桂花糕」' }
    ]
  },
  {
    id: 'vendor', name: '夜市摊主', need: ['food', 'night'], count: 2,
    line: '她多给了一串，说这只狐狸上次帮她招揽过客人。',
    gift: 'sou-hotpot-token',
    bonus: { food: 1.4, social: 1.3, night: 1.2 },
    letter: {
      title: '夜市摊主的谢礼',
      body: '那只小狐狸上次在我摊子前站着，客人就多了一倍。\n多给了一串，它没舍得吃完，包回来了。\n跟它说：下次来，不用排队。',
      reply: [
        { text: '它一定很开心', trait: 'empathy', memory: { comfort_beast: 1 } },
        { text: '下次一起去吃', trait: 'food', memory: { bring_me: 1 } },
        { text: '记得少放点辣', trait: 'calm', memory: { care_beast: 1 } }
      ]
    },
    trades: [
      { id: 'tr-vd-1', costType: 'souvenir', costId: 'sou-hotpot-token', costCount: 1, gainType: 'material', gainId: 'osmanthus_seed', gainCount: 3, label: '1 枚火锅号码牌 → 换 3 份「秋实金桂」' },
      { id: 'tr-vd-2', costType: 'souvenir', costId: 'sou-chili', costCount: 1, gainType: 'item', gainId: 'lantern', gainCount: 2, label: '1 串干辣椒 → 换 2 盏「小灯笼」' }
    ]
  },
  {
    id: 'guide', name: '沙漠向导', need: ['desert', 'star'], count: 2,
    line: '他指着星星说，你们上古那套说法，和我们的名字居然对得上。',
    gift: 'sou-sand-vial',
    bonus: { desert: 1.4, star: 1.5 },
    letter: {
      title: '向导标注的星图',
      body: '那天你们家白泽跟我对了一夜的星名。\n它叫的那些名字，和我们骆驼队叫的，居然大半都对得上。\n下回进沙漠，带上它——它比指南针管用。',
      reply: [
        { text: '两个名字都写上去', trait: 'scholar', memory: { record_habit: 1 } },
        { text: '下次一起去沙漠', trait: 'brave', memory: { ask_together: 1 } },
        { text: '路上小心', trait: 'empathy', memory: { care_back: 1 } }
      ]
    },
    trades: [
      { id: 'tr-gd-1', costType: 'souvenir', costId: 'sou-sand-vial', costCount: 1, gainType: 'item', gainId: 'compass', gainCount: 1, label: '1 瓶敦煌沙 → 换 1 具「西域司南」' },
      { id: 'tr-gd-2', costType: 'souvenir', costId: 'sou-pinecone', costCount: 2, gainType: 'material', gainId: 'cinnabar', gainCount: 2, label: '2 枚落霜松果 → 换 2 份「辰砂印泥」' }
    ]
  },
  {
    id: 'curator', name: '博物馆讲解员', need: ['history', 'scholar'], count: 2,
    line: '她说：你这只白泽，比我们馆里的资料还认真。',
    gift: 'sou-terracotta',
    bonus: { history: 1.45, scholar: 1.4, ancient: 1.3 },
    letter: {
      title: '讲解员的批注本',
      body: '你们家白泽在我馆里泡了三天，把讲解词里的每一处年代都问了一遍。\n我把我的批注本留给它了。上面有很多"待查"。\n它要是查出来，记得告诉我一声。',
      reply: [
        { text: '让它查，查完寄给你', trait: 'brave', memory: { promise_deliver: 1 } },
        { text: '你们可以一起研究', trait: 'scholar', memory: { bring_friend: 1 } },
        { text: '谢谢你的认真', trait: 'empathy', memory: { thank_friend: 1 } }
      ]
    },
    trades: [
      { id: 'tr-cr-1', costType: 'souvenir', costId: 'sou-wall-brick', costCount: 1, gainType: 'item', gainId: 'oldbook', gainCount: 2, label: '1 块城墙砖屑 → 换 2 卷「古书残页」' },
      { id: 'tr-cr-2', costType: 'souvenir', costId: 'sou-terracotta', costCount: 2, gainType: 'item', gainId: 'camera', gainCount: 1, label: '2 个小陶俑 → 换 1 台「旧式相机」' }
    ]
  }
];

/* ---------- 旅行偏好 ---------- */
export const PREFERENCES = [
  { id: 'free', name: '随缘出行', tags: [], desc: '不设方向，哪里都去。最容易遇见意料之外。' },
  { id: 'ancient', name: '古城漫游', tags: ['history', 'ancient'], desc: '偏向古迹、博物馆与老城。' },
  { id: 'nature', name: '山水寻踪', tags: ['nature', 'water', 'desert', 'snow'], desc: '偏向自然风景与四季。' },
  { id: 'urban', name: '都市见闻', tags: ['city', 'night', 'social', 'food'], desc: '偏向城市、夜市与人间烟火。' }
];

/* ---------- 六阶认知弧线 ---------- */
export const INSIGHT_THRESHOLD = [0, 4, 10, 18, 28, 42];

export const INSIGHT_STAGES = [
  {
    n: 0, name: '初见',
    desc: '它把人间的一切都当成神迹。',
    letter: '这里的东西都好奇怪。铁做的兽会自己跑，方盒子会发光，人人对着一块小镜子说话。我想，这大概是个还在施法的时代吧。'
  },
  {
    n: 1, name: '好奇',
    desc: '它开始追问"为什么"。',
    letter: '我不再只觉得它们是神迹了。我开始想知道：铁兽靠什么认路？发光的盒子为什么记得住字？我买了本讲这些的书，虽然只看懂一半。'
  },
  {
    n: 2, name: '践行',
    desc: '它学着按人间的规矩走一段路。',
    letter: '今天我没有用任何神兽的法门，乖乖排队买票、扫码、等绿灯。原来按人间的步子慢慢走，风景反而看得更真切。'
  },
  {
    n: 3, name: '领会',
    desc: '它承认，人类不用法术，也做到了许多不可思议的事。',
    letter: '人类没有腾云之术，却让千里之外的人听见彼此的声音。没有点金之手，却把沙漠种出了草格。我想，法术和本事，原来不是一回事。'
  },
  {
    n: 4, name: '共鸣',
    desc: '它在人间烟火里认出了自己的影子。',
    letter: '从前看人间，觉得隔着一层画卷。如今走过雨巷、吃过夜摊、替老人送过画，忽然发觉——那些平凡的挂念，原来和上古山海是一样的重。'
  },
  {
    n: 5, name: '著书',
    desc: '它提笔写完了《新山海经》属于自己的那一卷。',
    letter: '上古的山海图终于补全了这一页。往后人间无论怎么变，只要驿站的茶还热着、门口信箱还开着，我就还会继续飞下去，给你写下一封信。'
  }
];

/* ---------- 图鉴分组 ---------- */
export const CODEX_GROUPS = [
  { id: 'folk', name: '人间烟火', tags: ['food', 'social', 'night', 'city', 'playful'], goal: 14 },
  { id: 'land', name: '山河万里', tags: ['nature', 'water', 'desert', 'snow', 'star'], goal: 14 },
  { id: 'relic', name: '古今遗珍', tags: ['history', 'ancient', 'craft', 'scholar'], goal: 12 },
  { id: 'letter', name: '人间书信', tags: ['letter', 'quiet', 'empathy', 'record'], goal: 12 }
];

/* ---------- 标签中文映射 ---------- */
export const TAG_NAME = {
  letter: '书信', rain: '雨天', tea: '茶', quiet: '清静', food: '吃食',
  night: '夜色', desert: '沙漠', star: '星辰', history: '古史', scholar: '学问',
  craft: '手艺', travel: '远行', nature: '山水', water: '水', snow: '雪',
  social: '交游', playful: '玩心', record: '记录', city: '城市',
  ancient: '古迹', curious: '好奇', empathy: '共情', calm: '沉静'
};

/* ---------- 回信记忆 → 归因回显 ---------- */
export const MEMORY_LINES = {
  look_out: '你说"下次看看窗外"',
  talk_stranger: '你说"跟旁边的人说句话试试"',
  record_habit: '你说"记下来，慢慢想"',
  explain_camera: '你说"那不是精灵，是摄像头"',
  thank_machine: '你说"守夜的东西也值得谢谢"',
  ask_fear: '你问过它"你怕黑吗"',
  talk_kid: '你说"下次跟小孩打个招呼"',
  brave: '你说"再试一次，这次走到顶"',
  value_ordinary: '你说"家常话也值得跑那么远"',
  call_me: '你说"也可以试试给我传音"',
  care_back: '你说"回来我给你泡茶"',
  thank_worker: '你说"跟他说一声辛苦了"',
  understand_others: '你说"他们追的是别人的晚饭"',
  slow_down: '你说"路上慢慢走"',
  join_in: '你说"跳会了教我"',
  ask_story: '你说"去问问她们为什么天天来"',
  stay_watcher: '你说"在旁边看着就好"',
  link_ancient: '你和它聊过"上古的符"',
  explain_gently: '你说"你的理解其实很接近"',
  enjoy_now: '你说"先买点吃的"',
  notice_child: '你问过"他是不是有心事"',
  walk_along: '你说"陪他走到家吧"',
  ask_past: '你问过"你小时候也这样吗"',
  bring_umbrella: '你说"下次带把伞"',
  love_rain: '你问过"雨声好听吗"',
  knock_door: '你说"敲敲门，问问能不能进屋"',
  share_warmth: '你说"把手套给它一只"',
  miss_home: '你问过"雪和青丘的一样吗"',
  stay_longer: '你说"多待一会儿再回来"',
  notice_one: '你问过"哪一格最让你在意"',
  keep_light: '你说"回来也给你留一盏"',
  ask_focus: '你问过它更在意什么',
  value_endure: '你说"还在，就是好事"',
  comfort_beast: '你说"他听见了"',
  ask_history: '你说"回来跟我说说那个皇帝"',
  bring_friend: '你说"下次带朋友一起去"',
  teach_back: '你说"下次教他点你的本事"',
  value_slow: '你说"慢慢来，值得"',
  ask_name: '你问过"他叫什么名字"',
  ask_taste: '你问过"好吃吗"',
  keep_contact: '你说"跟他们要个联系方式"',
  bring_me: '你说"下次带我一起去"',
  comfort_others: '你说"拆过的地方最好看"',
  keep_item: '你说"带回来给我"',
  belong: '你说"没人回头说明你融入了"',
  try_new: '你说"学着试试"',
  love_romance: '你说"这个名字真浪漫"',
  value_change: '你说"每年都不一样，真好"',
  care_beast: '你关心过它"在外面冷吗"',
  ask_together: '你说"下次一起去"',
  ask_promise: '你问过"你会一直叫吗"',
  explain_train: '你告诉它"那叫高铁，不是兽"',
  encourage: '你一直在鼓励它',
  buy_map: '你说"买张铁路图研究吧"',
  ask_next: '你问过"下一站想去哪"',
  send_card: '你说"寄给她一张明信片吧"',
  try_phone: '你说"你自己也可以试试手机"',
  promise_deliver: '你说"一定要送到"',
  ask_back: '你问过"什么时候回来看看我"',
  write_back: '你说"我也有话想让你带"',
  thank_friend: '你说"替我谢谢它"',
  ch_train: '它一直在研究那条钢铁长龙',
  ch_letter: '它一直在想那位等信的老人',
  ch_food: '它一直在人间四处找好吃的',
  ch_jingwei: '它一直在看人间怎样跨过山海'
};
