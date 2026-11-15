/* 神兽与城市数据 */
(function () {
  const SH = window.SH;

  /* ---------- 神兽 ----------
     tags 直接参与事件权重计算，是"性格改变玩法"的实现方式。
     insight 四阶段：0 初见 / 1 好奇 / 2 领会 / 3 回信
  ------------------------------------------------------------------ */
  SH.BEASTS = [
    {
      id: 'baize',
      name: '白泽',
      title: '博闻多识',
      desc: '上古知万物之情的灵兽。喜欢博物馆、古城与旧书店，总想把眼前的新东西和古籍里的记载对上号。',
      tags: ['history', 'curious', 'calm', 'scholar'],
      cityPref: { xian: 3, suzhou: 2, dunhuang: 2, hangzhou: 1 },
      quirk: '见闻考据：更容易触发文化、古迹与"古今对照"类事件',
      color: '#7c8ea8'
    },
    {
      id: 'jiuweihu',
      name: '九尾狐',
      title: '活泼好奇',
      desc: '青丘来的小狐狸。喜欢夜市、美食与热闹的人群，走到哪儿都能交上朋友，也总能找到最好吃的那一口。',
      tags: ['social', 'food', 'playful', 'night'],
      cityPref: { chengdu: 3, harbin: 2, xian: 1, hangzhou: 2 },
      quirk: '人间交游：更容易结识旅途中的人，带回有趣的礼物',
      color: '#e0a273'
    },
    {
      id: 'qingniao',
      name: '青鸟',
      title: '温柔细腻',
      desc: '替神仙传信的青鸟。喜欢雨天、邮局和安静的小巷，擅长看见普通人之间那些没说出口的话。',
      tags: ['letter', 'quiet', 'empathy', 'rain'],
      cityPref: { suzhou: 2, hangzhou: 3, harbin: 2, chengdu: 1 },
      quirk: '书信传递：更容易收到别人的托付，带回特别的留言',
      color: '#6fa8a0'
    }
  ];

  /* ---------- 城市 ---------- */
  SH.CITIES = [
    {
      id: 'xian',
      name: '西安',
      region: '关中',
      tags: ['history', 'ancient', 'city', 'food'],
      weather: ['sunny', 'cloudy', 'night'],
      intro: '城墙下面跑着钢铁长龙，城楼上的风还是唐代的。'
    },
    {
      id: 'chengdu',
      name: '成都',
      region: '蜀中',
      tags: ['food', 'night', 'social', 'city'],
      weather: ['rain', 'cloudy', 'night'],
      intro: '夜里九点，街上的火锅味比星星还密。'
    },
    {
      id: 'suzhou',
      name: '苏州',
      region: '江南',
      tags: ['water', 'quiet', 'craft', 'rain'],
      weather: ['rain', 'cloudy', 'sunny'],
      intro: '船从桥下过去，橹声一响，水就皱了。'
    },
    {
      id: 'hangzhou',
      name: '杭州',
      region: '江南',
      tags: ['water', 'nature', 'quiet', 'tea'],
      weather: ['rain', 'sunny', 'cloudy'],
      intro: '西湖边上总有雨，也总有人愿意为一场雨停下。'
    },
    {
      id: 'dunhuang',
      name: '敦煌',
      region: '河西',
      tags: ['desert', 'history', 'nature', 'star'],
      weather: ['sunny', 'night', 'cloudy'],
      intro: '沙子会说话，只是说得慢，要听很多年。'
    },
    {
      id: 'harbin',
      name: '哈尔滨',
      region: '北疆',
      tags: ['snow', 'nature', 'night', 'food'],
      weather: ['snow', 'night', 'sunny'],
      intro: '冷得干脆，所以屋子里的光显得特别暖。'
    }
  ];

  /* ---------- 旅行偏好 ---------- */
  SH.PREFERENCES = [
    { id: 'free', name: '随缘出行', tags: [], desc: '不设方向，哪里都去。最容易遇见意料之外。' },
    { id: 'ancient', name: '古城漫游', tags: ['history', 'ancient'], desc: '偏向古迹、博物馆与老城。' },
    { id: 'nature', name: '山水寻踪', tags: ['nature', 'water', 'desert', 'snow'], desc: '偏向自然风景与四季。' },
    { id: 'urban', name: '都市见闻', tags: ['city', 'night', 'social', 'food'], desc: '偏向城市、夜市与人间烟火。' }
  ];

  /* ---------- 认知弧线四阶段文案 ---------- */
  SH.INSIGHT_STAGES = [
    {
      n: 0,
      name: '初见',
      desc: '它把人间的一切都当成神迹。',
      letter: '这里的东西都好奇怪。铁做的兽会自己跑，方盒子会发光，人人对着一块小镜子说话。我想，这大概是个还在施法的时代吧。'
    },
    {
      n: 1,
      name: '好奇',
      desc: '它开始追问"为什么"。',
      letter: '我不再只觉得它们是神迹了。我开始想知道：铁兽靠什么认路？发光的盒子为什么记得住字？我买了本讲这些的书，虽然只看懂一半。'
    },
    {
      n: 2,
      name: '领会',
      desc: '它承认，人类不用法术，也做到了许多不可思议的事。',
      letter: '人类没有腾云之术，却让千里之外的人听见彼此的声音。没有点金之手，却把沙漠种出了城。我想，法术和本事，原来不是一回事。'
    },
    {
      n: 3,
      name: '回信',
      desc: '它想给这个人间，写点什么。',
      letter: '从前我替神仙传信，如今人间自己会传信了。可我还是想飞下去——不是因为没有我不行，而是因为我想去看看那些还在等一句话的人。'
    }
  ];
})();
