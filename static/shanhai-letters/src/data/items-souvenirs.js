/* 道具、纪念品、访客数据 */
(function () {
  const SH = window.SH;

  /* ---------- 随身道具 ----------
     bias: 目的地城市权重加成
     boost: 事件 tag 权重加成
     effect: 特殊结算效果（由 systems 解释）
  ------------------------------------------------------------------ */
  SH.ITEMS = [
    {
      id: 'camera', name: '旧式相机', emoji: '📷', tags: ['record', 'curious'],
      bias: {}, boost: { record: 2, nature: 1 },
      desc: '它总想把自己没看懂的东西拍下来，回去慢慢想。',
      effect: 'postcard', hint: '更容易寄回带图的东西'
    },
    {
      id: 'oldbook', name: '古书残页', emoji: '📜', tags: ['history', 'scholar'],
      bias: { xian: 3, dunhuang: 2 }, boost: { history: 2.5 },
      desc: '一页看不出年代的书。它相信答案都在里面。',
      effect: 'lore', hint: '更容易翻出古时候的线索'
    },
    {
      id: 'umbrella', name: '油纸伞', emoji: '☂️', tags: ['rain', 'quiet'],
      bias: { hangzhou: 2, suzhou: 2 }, boost: { rain: 2.5, quiet: 1.5 },
      desc: '伞骨是竹的，伞面涂了桐油。下雨天它才想起带。',
      effect: 'rain', hint: '下雨时会拐进安静的巷子'
    },
    {
      id: 'map', name: '旅行地图', emoji: '🗺️', tags: ['travel', 'curious'],
      bias: {}, boost: { travel: 2 },
      desc: '一张被折了很多次的地图，边角已经毛了。',
      effect: 'far', hint: '走得更远，去得更久'
    },
    {
      id: 'osmanthus', name: '桂花糕', emoji: '🍡', tags: ['food', 'social'],
      bias: {}, boost: { social: 1.5, food: 1.5 },
      desc: '甜，但容易碎。它可能会分给别人，也可能自己吃掉。',
      effect: 'share', hint: '路上更容易遇到人'
    },
    {
      id: 'bamboo', name: '竹筒饭', emoji: '🍚', tags: ['food', 'nature'],
      bias: {}, boost: { food: 1.5, nature: 1.2 },
      desc: '装着米饭的竹筒，劈开时有股清香。',
      effect: 'long', hint: '路上不容易饿'
    },
    {
      id: 'hawthorn', name: '山楂糕', emoji: '🍬', tags: ['food', 'playful'],
      bias: {}, boost: { playful: 1.5, social: 1.2 },
      desc: '酸得直皱眉，它还是每次都要带。',
      effect: 'cheer', hint: '心情会好一点'
    },
    {
      id: 'notebook', name: '空白手账', emoji: '📓', tags: ['record', 'scholar'],
      bias: {}, boost: { record: 2, scholar: 1.5 },
      desc: '它开始学着把自己看见的写下来。',
      effect: 'note', hint: '更容易留下成篇的记录'
    },
    {
      id: 'bell', name: '铜铃', emoji: '🔔', tags: ['social', 'playful'],
      bias: {}, boost: { social: 1.8 },
      desc: '铃一响，就有人回头。',
      effect: 'meet', hint: '更容易被人注意到'
    },
    {
      id: 'lantern', name: '小灯笼', emoji: '🏮', tags: ['night', 'quiet'],
      bias: {}, boost: { night: 2 },
      desc: '走夜路的时候，它说这样看起来不那么像妖怪。',
      effect: 'night', hint: '在夜里走得更安稳'
    }
  ];

  /* ---------- 纪念品 ----------
     rarity: common / rare / legend
     attract: 累计可吸引的访客标签
  ------------------------------------------------------------------ */
  const S = (id, name, city, rarity, tags, desc, attract) => ({
    id, name, city, rarity, tags, desc, attract: attract || []
  });

  SH.SOUVENIRS = [
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
    S('sou-silk', '苏绣手帕', 'suzhou', 'rare', ['craft', 'letter'], '青瓷色的丝帕，角上绣了一朵梅。', ['craft']),
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
    // 通用
    S('sou-rail-map', '铁路手册', '*', 'rare', ['travel', 'record'], '白泽自己做的铁路图，边角写满了批注。', ['travel', 'scholar']),
    S('sou-postcard', '空白明信片', '*', 'common', ['letter'], '没有写字的明信片。它说，留给你写。', ['letter']),
    S('sou-handbook', '现代人间观察笔记', '*', 'legend', ['record', 'scholar'], '厚厚一本，按"铁兽/方盒/小镜"分了类。', ['scholar'])
  ];

  /* ---------- 访客（家园摆放累计解锁）
     gift:  到访时赠送的纪念品
     bonus: 常驻事件权重加成 tag -> 倍率
     letter: 到访时寄来的一封信（含回信选项）
  ------------------------------------------------------------------ */
  SH.VISITORS = [
    {
      id: 'grandma', name: '巷口的老奶奶', need: ['letter', 'rain'], count: 3,
      line: '她把一张画塞进神兽翅膀里，说想寄给远方的孙女。',
      gift: 'sou-postcard',
      bonus: { letter: 1.4, empathy: 1.3 },
      letter: {
        title: '老奶奶托人带来的画',
        body: '那天在你这儿歇脚的老奶奶，托我带一样东西给你。\n是一张画。画上是太阳、房子，三个歪歪扭扭的人。\n她说孙女收到会高兴的。她还说，谢谢你家的神兽，那天陪她说了很久的话。\n画我压在驿站的桌板下了，你去拿吧。',
        reply: [
          { text: '替我谢谢她', memory: { thank_friend: 1 } },
          { text: '下次请她进来坐坐', memory: { knock_door: 1 } },
          { text: '这张画要好好收着', memory: { keep_item: 1 } }
        ]
      }
    },
    {
      id: 'postman', name: '退休的邮递员', need: ['letter'], count: 4,
      line: '他带来一沓旧信封，说这些地址早就拆了，可字还在。',
      gift: 'sou-silk',
      bonus: { letter: 1.5, record: 1.3 },
      letter: {
        title: '旧邮递员留下的信封',
        body: '我在你家驿站门口坐了一下午。\n带了一沓退回来的信——地址早就拆了，人也散了，可字还在。\n我不舍得扔。你们家那位青鸟说，它愿意替我送送看。\n那就送吧。送不到也没关系，至少信还在飞。',
        reply: [
          { text: '让它送，我支持', memory: { encourage: 1 } },
          { text: '有些信不用送到', memory: { value_ordinary: 1 } },
          { text: '你也进来喝口茶', memory: { care_back: 1 } }
        ]
      }
    },
    {
      id: 'teahouse', name: '茶馆老板', need: ['tea', 'quiet'], count: 3,
      line: '他留了个靠窗的位置，说那一位每天都来。',
      gift: 'sou-tea-lid',
      bonus: { quiet: 1.4, tea: 1.5 },
      letter: {
        title: '茶馆的靠窗位置',
        body: '路过你家门口，闻到茶香，就进来坐了会儿。\n我在自家茶馆给人留了个靠窗的位置，留了很多年。\n那一位每天都来，从不点单，我照旧给他上一壶。\n你们家的神兽问我为什么。我说：位置留着，人就还在。\n它记了很久。',
        reply: [
          { text: '这句话该记下来', memory: { record_habit: 1 } },
          { text: '下次带我一起去坐坐', memory: { bring_me: 1 } },
          { text: '给它也留个位置吧', memory: { keep_light: 1 } }
        ]
      }
    },
    {
      id: 'vendor', name: '夜市摊主', need: ['food', 'night'], count: 4,
      line: '她多给了一串，说这只狐狸上次帮她招揽过客人。',
      gift: 'sou-hotpot-token',
      bonus: { food: 1.4, social: 1.3, night: 1.2 },
      letter: {
        title: '夜市摊主的谢礼',
        body: '那只小狐狸上次在我摊子前站着，客人就多了一倍。\n也不知道是它招的，还是大家就想看它。\n多给了一串，它没舍得吃完，包回来了。\n跟它说：下次来，不用排队。',
        reply: [
          { text: '它一定很开心', memory: { comfort_beast: 1 } },
          { text: '下次一起去吃', memory: { bring_me: 1 } },
          { text: '记得少放点辣', memory: { care_beast: 1 } }
        ]
      }
    },
    {
      id: 'guide', name: '沙漠向导', need: ['desert', 'star'], count: 3,
      line: '他指着星星说，你们上古那套说法，和我们的名字居然对得上。',
      gift: 'sou-sand-vial',
      bonus: { desert: 1.4, star: 1.5 },
      letter: {
        title: '向导标注的星图',
        body: '那天你们家白泽跟我对了一夜的星名。\n它叫的那些名字，和我们骆驼队叫的，居然大半都对得上。\n我画了一张，两边名字都标上，送你们。\n下回进沙漠，带上它——它比指南针管用。',
        reply: [
          { text: '两个名字都写上去', memory: { record_habit: 1 } },
          { text: '下次一起去沙漠', memory: { ask_together: 1 } },
          { text: '路上小心', memory: { care_back: 1 } }
        ]
      }
    },
    {
      id: 'curator', name: '博物馆讲解员', need: ['history', 'scholar'], count: 4,
      line: '她说：你这只白泽，比我们馆里的资料还认真。',
      gift: 'sou-terracotta',
      bonus: { history: 1.5, scholar: 1.4, ancient: 1.3 },
      letter: {
        title: '讲解员的批注本',
        body: '你们家白泽在我馆里泡了三天，把讲解词里的每一处年代都问了一遍。\n有一处它说错了，我核了资料，竟然是它对。\n我把我的批注本留给它了。上面有很多"待查"。\n它要是查出来，记得告诉我一声。',
        reply: [
          { text: '让它查，查完寄给你', memory: { promise_deliver: 1 } },
          { text: '你们可以一起研究', memory: { bring_friend: 1 } },
          { text: '谢谢你的认真', memory: { thank_friend: 1 } }
        ]
      }
    }
  ];
})();
