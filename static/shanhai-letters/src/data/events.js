/* 事件库：数据驱动的旅行奇遇
   事件字段说明
   id        唯一标识
   city      城市 id，'*' 表示任意城市（由权重决定），数组表示这几个城市之一
   beast     '*' 或神兽 id（用于性格专属事件）
   tags      参与权重计算
   weight    基础权重
   weather   仅在该天气下出现
   requires  { item, memory:{k:v}, notMemory:{k:max}, souvenir, worldFlag, insightMin, notSeen }
   chain     { id, step } 事件链
   echo      true 表示这是"回声事件"（因玩家回信而开启），权重提升
   souvenir  带回来的纪念品（字符串或数组则随机）
   insight   认知经验增量
   memory    写入神兽记忆 { set: { k: v } }
   cause     归因回显文本（玩家看到的"因为我做了什么"）
   reply     回信三选一
------------------------------------------------------------------ */
(function () {
  const SH = window.SH;

  const E = (o) => o;

  SH.EVENTS = [
    /* ================= 通用：现代生活初见（city: *） ================= */
    E({
      id: 'ev-transit', city: '*', beast: '*', tags: ['travel', 'city'], weight: 10,
      title: '会跑的铁屋子', souvenir: 'sou-postcard', insight: 1,
      body: '今天坐了一次会自己跑的铁屋子，里面坐满了人，却没有一匹马。\n有人闭着眼，有人在看一块发光的小板子，谁也不说话。\n我数了数，一共三十七个人，只有两个在往外看。',
      cause: '它第一次独自坐上公共交通',
      reply: [
        { text: '下次可以看看窗外', memory: { look_out: 1 } },
        { text: '跟旁边的人说句话试试', memory: { talk_stranger: 1 } },
        { text: '记下来，回去慢慢想', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-convenience', city: '*', beast: '*', tags: ['city', 'curious'], weight: 9,
      title: '不熄灯的屋子', souvenir: 'sou-postcard', insight: 1,
      body: '发现一种屋子，半夜也不熄灯，里面摆满了吃的。\n我问店员："夜里不怕贼吗？"\n她笑了一下，指了指头顶一个小黑盒子，说："有它看着呢。"\n我抬头看了很久。那大概是一种守夜的精灵。',
      cause: '它走进了一家便利店',
      reply: [
        { text: '那个不是精灵，是摄像头', memory: { explain_camera: 1 } },
        { text: '守夜的东西，也值得谢谢', memory: { thank_machine: 1 } },
        { text: '你怕黑吗？', memory: { ask_fear: 1 } }
      ]
    }),
    E({
      id: 'ev-escalator', city: '*', beast: '*', tags: ['city', 'playful'], weight: 8,
      title: '会走路的台阶', souvenir: 'sou-postcard', insight: 1,
      body: '这里有一种台阶，自己会往上走。\n我站上去，又赶紧跳下来，来回试了六次。\n旁边一个小孩说："奶奶你看，这只狗好奇怪。"\n我想解释，又觉得解释起来更奇怪，就走了。',
      cause: '它遇见了自动扶梯',
      reply: [
        { text: '下次可以跟小孩打个招呼', memory: { talk_kid: 1 } },
        { text: '再试一次，这次走到顶', memory: { brave: 1 } },
        { text: '画下来给我看', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-videocall', city: '*', beast: '*', tags: ['city', 'letter'], weight: 9,
      title: '千里传音', souvenir: 'sou-postcard', insight: 1,
      body: '看见一个人在街上，对着一块小镜子说话，镜子里还传出另一个人的声音。\n我以为那是传说中的千里传音之术，激动得差点上前请教。\n走近一听，他在说："妈，我今晚不回来吃了。"\n原来法术都是用来讲这些话的。',
      cause: '它撞见了有人打视频电话',
      reply: [
        { text: '家常话也值得跑那么远', memory: { value_ordinary: 1 } },
        { text: '你也可以试试给我传音', memory: { call_me: 1 } },
        { text: '那你今晚想吃什么？', memory: { care_back: 1 } }
      ]
    }),
    E({
      id: 'ev-rider', city: '*', beast: '*', tags: ['city', 'social'], weight: 8,
      title: '跑得很快的人', souvenir: 'sou-postcard', insight: 1,
      body: '街上有一群穿着同样颜色衣服的人，骑得极快，车后绑着一个方箱子。\n他们好像在跟时间赛跑——虽然我不知道时间为什么值得追。\n有一个在红灯前停下来，仰头喝了一口水，又走了。',
      cause: '它注意到了外卖骑手',
      reply: [
        { text: '跟他说一声辛苦了', memory: { thank_worker: 1 } },
        { text: '他们追的是别人的晚饭', memory: { understand_others: 1 } },
        { text: '别学他们，路上慢慢走', memory: { slow_down: 1 } }
      ]
    }),
    E({
      id: 'ev-squaredance', city: '*', beast: '*', tags: ['social', 'night'], weight: 7,
      title: '广场上的舞', souvenir: 'sou-postcard', insight: 1,
      body: '傍晚的广场上，几十个人跟着一个方盒子放出来的曲子跳舞。\n没有祭祀，没有缘由，就是跳。\n有个阿姨拉我进去，我跳错了三步，没人介意。',
      cause: '它被拉进了广场舞的队伍',
      reply: [
        { text: '多去几次，跳会了教我', memory: { join_in: 1 } },
        { text: '问问她们为什么天天来', memory: { ask_story: 1 } },
        { text: '你在旁边看着就好', memory: { stay_watcher: 1 } }
      ]
    }),
    E({
      id: 'ev-qr', city: '*', beast: '*', tags: ['city', 'curious'], weight: 7,
      title: '一块花纹布', souvenir: 'sou-postcard', insight: 1,
      body: '买东西不用给钱，只要把一块小方块对着画满花纹的牌子照一下。\n我研究了半天，觉得这是一种符——画符的人不用懂，认符的东西自己会认。\n上古也有这样的符。只不过那时候，认符的是山神。',
      cause: '它看见了扫码支付',
      reply: [
        { text: '上古的符也是这样吗', memory: { link_ancient: 1 } },
        { text: '你的理解其实很接近', memory: { explain_gently: 1 } },
        { text: '别想了，先买点吃的', memory: { enjoy_now: 1 } }
      ]
    }),
    E({
      id: 'ev-schoolout', city: '*', beast: '*', tags: ['social', 'quiet'], weight: 7,
      title: '放学的时候', souvenir: 'sou-postcard', insight: 1,
      body: '下午四点，突然多出很多很小的孩子，背着比自己还大的包。\n他们讨论着今天发生的事，声音又急又亮。\n有一个走得很慢，边走边踢石子。我陪他走了两个路口。',
      cause: '它赶上了放学',
      reply: [
        { text: '他是不是有心事', memory: { notice_child: 1 } },
        { text: '陪他走到家吧', memory: { walk_along: 1 } },
        { text: '你小时候也这样吗', memory: { ask_past: 1 } }
      ]
    }),

    /* ================= 天气限定 ================= */
    E({
      id: 'ev-rain-shelter', city: '*', beast: '*', tags: ['rain', 'quiet'], weight: 12, weather: 'rain',
      title: '檐下躲雨', souvenir: 'sou-rain-bottle', insight: 1,
      body: '下雨了。我躲在一户人家的屋檐下，屋里飘出饭香。\n主人的猫隔着门缝看我，看了很久，然后睡着了。\n雨停的时候我才发现，自己也不急着走了。',
      cause: '路上遇到了雨',
      reply: [
        { text: '下次带把伞', memory: { bring_umbrella: 1 } },
        { text: '雨声好听吗', memory: { love_rain: 1 } },
        { text: '敲敲门，问问能不能进屋', memory: { knock_door: 1 } }
      ]
    }),
    E({
      id: 'ev-snow-night', city: '*', beast: '*', tags: ['snow', 'quiet'], weight: 12, weather: 'snow',
      title: '雪落下来的时候', souvenir: 'sou-snowflake', insight: 1,
      body: '下雪了。很安静，安静得能听见雪落在雪上的声音。\n有个小孩把手套摘了，伸手去接，他妈妈骂了他一句，又把自己的手套给他套上。\n我忽然想起青丘的雪，也是这样不讲道理地白。',
      cause: '它遇上了雪',
      reply: [
        { text: '把手套给它一只', memory: { share_warmth: 1 } },
        { text: '雪和青丘的一样吗', memory: { miss_home: 1 } },
        { text: '多待一会儿再回来', memory: { stay_longer: 1 } }
      ]
    }),
    E({
      id: 'ev-night-lights', city: '*', beast: '*', tags: ['night', 'quiet'], weight: 12, weather: 'night',
      title: '万家的灯', souvenir: 'sou-lantern', insight: 1,
      body: '天黑以后，我爬到一个很高的地方往下看。\n下面是一格一格的灯，每一格里都有一件正在进行的小事。\n有的在吃饭，有的在吵架，有的把灯关了——那是睡了。\n上古的时候，我们管这叫人间烟火。原来它一直都在。',
      cause: '它在夜里登高看灯',
      reply: [
        { text: '哪一格最让你在意', memory: { notice_one: 1 } },
        { text: '回来也给你留一盏', memory: { keep_light: 1 } },
        { text: '写下来，这是最好的一句', memory: { record_habit: 1 } }
      ]
    }),

    /* ================= 西安 ================= */
    E({
      id: 'ev-xian-wall', city: 'xian', beast: '*', tags: ['history', 'ancient'], weight: 11,
      title: '城墙与长龙', souvenir: 'sou-wall-brick', insight: 2,
      body: '我沿着城墙走了很久。墙很老，砖缝里长着草。\n墙根下，一列钢铁长龙轰隆隆地开过去，声音震得墙上的草都在抖。\n一千年和一百八十年，就这样叠在同一个画面里。',
      cause: '它去了西安城墙',
      reply: [
        { text: '草和火车你更在意哪个', memory: { ask_focus: 1 } },
        { text: '拍下来给我看看', memory: { record_habit: 1 } },
        { text: '墙还在，就是好事', memory: { value_endure: 1 } }
      ]
    }),
    E({
      id: 'ev-xian-terracotta', city: 'xian', beast: '*', tags: ['history', 'scholar'], weight: 10,
      title: '站了很久的人', souvenir: 'sou-terracotta', insight: 2,
      body: '在一个大坑里，站着几千个陶土做的人，排得整整齐齐。\n讲解员说，他们替一个皇帝站了两千多年。\n我走到边上，跟最近的一个说了句话："辛苦了。"\n它当然没有回答。可我站了一会儿，觉得它听见了。',
      cause: '它去了兵马俑',
      reply: [
        { text: '你说得对，他听见了', memory: { comfort_beast: 1 } },
        { text: '回来跟我说说那个皇帝', memory: { ask_history: 1 } },
        { text: '下次带九尾狐一起去', memory: { bring_friend: 1 } }
      ]
    }),
    E({
      id: 'ev-xian-food', city: 'xian', beast: '*', tags: ['food', 'social'], weight: 9,
      title: '一碗泡馍', souvenir: 'sou-hotpot-token', insight: 1,
      body: '吃了一碗要把饼自己掰碎的汤。隔壁桌的大爷教我：要掰成黄豆大小，太大不入味。\n我掰了四十分钟，他全程看着，最后说："行，勉强。"\n这是我来人间以后，第一次被人手把手地教一件事。',
      cause: '它钻进了西安的小馆子',
      reply: [
        { text: '下次教他点你的本事', memory: { teach_back: 1 } },
        { text: '一碗汤掰四十分钟，值得', memory: { value_slow: 1 } },
        { text: '大爷叫什么名字', memory: { ask_name: 1 } }
      ]
    }),

    /* ================= 成都 ================= */
    E({
      id: 'ev-chengdu-hotpot', city: 'chengdu', beast: '*', tags: ['food', 'social'], weight: 11,
      title: '红汤里捞月亮', souvenir: 'sou-chili', insight: 1,
      body: '他们把一锅红汤放在桌子中间，谁都可以往里下东西。\n我试图从汤里捞月亮的倒影，捞了七次，七次都是毛肚。\n同桌的人笑得不行，最后替我捞了一片，说："这个比月亮好吃。"',
      cause: '它吃了火锅',
      reply: [
        { text: '好吃吗', memory: { ask_taste: 1 } },
        { text: '跟他们要个联系方式', memory: { keep_contact: 1 } },
        { text: '下次带我一起去', memory: { bring_me: 1 } }
      ]
    }),
    E({
      id: 'ev-chengdu-teahouse', city: 'chengdu', beast: '*', tags: ['quiet', 'tea'], weight: 10,
      title: '一整个下午', souvenir: 'sou-tea-lid', insight: 2,
      body: '茶馆里坐满了人，什么都不做，就坐着。\n有个人掏耳朵掏了二十分钟，表情像在冥想。\n我问邻座："你们不赶时间吗？"\n他说："赶啊，但我先把这一口茶喝完。"',
      cause: '它在茶馆里坐了一下午',
      reply: [
        { text: '这句话值得记下来', memory: { record_habit: 1 } },
        { text: '你也坐到打烊吧', memory: { stay_longer: 1 } },
        { text: '回来我给你泡茶', memory: { care_back: 1 } }
      ]
    }),
    E({
      id: 'ev-chengdu-panda', city: 'chengdu', beast: '*', tags: ['playful', 'city'], weight: 9,
      title: '满街的耳朵', souvenir: 'sou-panda-ear', insight: 1,
      body: '街上很多人头上顶着黑白两色的耳朵。我以为那是某种新的图腾。\n后来才知道，是一种本地的熊。人们喜欢它，喜欢到要把它戴在头上。\n我买了一对戴上。走过三条街，没人回头。我有点失落，又有点松了口气。',
      cause: '它买了熊猫发箍',
      reply: [
        { text: '戴上很好看，真的', memory: { comfort_beast: 1 } },
        { text: '没人回头说明你融入了', memory: { belong: 1 } },
        { text: '留着回来给我看', memory: { keep_item: 1 } }
      ]
    }),

    /* ================= 苏州 ================= */
    E({
      id: 'ev-suzhou-boat', city: 'suzhou', beast: '*', tags: ['water', 'quiet'], weight: 11,
      title: '摇橹的人', souvenir: 'sou-boat-paddle', insight: 2,
      body: '坐了一次手摇的船。摇橹的阿姨一只手撑着，一只手在织毛衣。\n船过桥洞的时候她抬头看了一眼，说："这个洞，我家三代人都在下面过。"\n水很绿，把桥也染绿了。',
      cause: '它坐上了苏州的摇橹船',
      reply: [
        { text: '问问她家还有谁在摇船', memory: { ask_story: 1 } },
        { text: '三代人，那桥该记得他们', memory: { value_endure: 1 } },
        { text: '学着摇两下试试', memory: { try_new: 1 } }
      ]
    }),
    E({
      id: 'ev-suzhou-embroidery', city: 'suzhou', beast: '*', tags: ['craft', 'quiet'], weight: 10,
      title: '绣了半年的梅花', souvenir: 'sou-silk', insight: 2,
      body: '一间小绣坊里，一个姑娘正在绣一朵梅花，说已经绣了半年。\n我问："一天绣多久？"\n她说："八个小时。绣错一针，就要拆一天。"\n我看那朵梅，第六片花瓣上确实拆过。',
      cause: '它走进了苏州绣坊',
      reply: [
        { text: '拆过的地方最好看', memory: { comfort_others: 1 } },
        { text: '问问她为什么坚持', memory: { ask_story: 1 } },
        { text: '买下来带回来', memory: { keep_item: 1 } }
      ]
    }),
    E({
      id: 'ev-suzhou-alley', city: 'suzhou', beast: '*', tags: ['rain', 'quiet'], weight: 9,
      title: '一条走不完的巷子', souvenir: 'sou-paper-umbrella', insight: 1,
      body: '下雨，我拐进一条很窄的巷子。\n墙上有苔，脚下有水，尽头有一盏灯，灯下有人在剥豆子。\n我站在那里看了很久。她抬头说："进来躲雨啊。"\n我摇摇头。我不是在躲雨，我是在看。',
      cause: '雨让它拐进了小巷',
      reply: [
        { text: '下次就进去吧', memory: { knock_door: 1 } },
        { text: '你在看什么', memory: { ask_focus: 1 } },
        { text: '这条巷子叫什么名字', memory: { ask_name: 1 } }
      ]
    }),

    /* ================= 杭州 ================= */
    E({
      id: 'ev-hangzhou-rain', city: 'hangzhou', beast: '*', tags: ['rain', 'quiet', 'nature'], weight: 11,
      title: '断桥的雨', souvenir: 'sou-rain-bottle', insight: 2,
      body: '断桥上人很多，都在躲雨，又都不肯走。\n一个小孩问妈妈："桥断了为什么还能走？"\n妈妈说："它没断，是雪化了一半的时候看着像断了。"\n原来有些名字，记的是某一瞬间。',
      cause: '它在断桥遇雨',
      reply: [
        { text: '这个名字真浪漫', memory: { love_romance: 1 } },
        { text: '你看见雪化的时候了吗', memory: { ask_focus: 1 } },
        { text: '装一瓶雨回来', memory: { keep_item: 1 } }
      ]
    }),
    E({
      id: 'ev-hangzhou-tea', city: 'hangzhou', beast: '*', tags: ['tea', 'quiet', 'nature'], weight: 10,
      title: '炒茶的手', souvenir: 'sou-longjing', insight: 2,
      body: '在山上看人炒茶。锅很烫，他的手直接伸进去，翻、抖、压，一气呵成。\n我问："不烫吗？"\n他说："烫啊，所以要快。"\n我数了数，他从十六岁开始，这只手伸了四十年。',
      cause: '它去看了炒茶',
      reply: [
        { text: '买一包回来', memory: { keep_item: 1 } },
        { text: '问问他的师傅是谁', memory: { ask_story: 1 } },
        { text: '这双手该写进书上', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-hangzhou-osmanthus', city: 'hangzhou', beast: '*', tags: ['nature', 'food'], weight: 9,
      title: '一整个秋天的味道', souvenir: 'sou-osmanthus', insight: 1,
      body: '满城都是桂花香，香得有点不讲道理。\n有个阿婆在树下铺了布，摇树干，花就落下来。她说要腌一罐，留到冬天。\n我问："为什么留到冬天？"\n她说："冬天没有味道，得留一点。"',
      cause: '它赶上了桂花季',
      reply: [
        { text: '带一罐回来', memory: { keep_item: 1 } },
        { text: '冬天我们也留一点', memory: { care_back: 1 } },
        { text: '这话该写下来', memory: { record_habit: 1 } }
      ]
    }),

    /* ================= 敦煌 ================= */
    E({
      id: 'ev-dunhuang-cave', city: 'dunhuang', beast: '*', tags: ['history', 'craft'], weight: 11,
      title: '洞里的飞天', souvenir: 'sou-fresco', insight: 2,
      body: '洞里不许拍照，也不许大声。\n手电照上去的时候，一个飞天的脸亮了半秒。她飞了一千多年，还没落地。\n讲解员说，这些画是普通人一笔一笔画的，很多人一辈子没留下名字。\n我站在暗处，觉得有点熟。',
      cause: '它进了莫高窟',
      reply: [
        { text: '没名字的人也值得记', memory: { value_ordinary: 1 } },
        { text: '你也是被画在墙上的那一类', memory: { link_ancient: 1 } },
        { text: '别难过，画还在', memory: { comfort_beast: 1 } }
      ]
    }),
    E({
      id: 'ev-dunhuang-sand', city: 'dunhuang', beast: '*', tags: ['desert', 'nature'], weight: 10,
      title: '会唱歌的沙', souvenir: 'sou-sand-vial', insight: 1,
      body: '爬上沙山顶的时候，太阳正好下去。\n沙子真的会响——很多人一起往下滑，整座山都在低鸣。\n我想起古籍里写过"沙鸣如雷"，当时以为是夸张。\n原来夸张的从来不是古人，是我没来过。',
      cause: '它爬上了鸣沙山',
      reply: [
        { text: '装一瓶沙回来', memory: { keep_item: 1 } },
        { text: '古籍还写过什么', memory: { link_ancient: 1 } },
        { text: '天黑了就别待太久', memory: { care_back: 1 } }
      ]
    }),
    E({
      id: 'ev-dunhuang-star', city: 'dunhuang', beast: '*', tags: ['star', 'record'], weight: 9,
      title: '自己画的星图', souvenir: 'sou-star-chart', insight: 2,
      body: '这里的星星多得吓人，像有人把整条银河倒扣了下来。\n我试着把认识的名字一个一个对上去，对到一半发现：上古那些名字，这里都还在。\n只是没人叫了。\n我画了一张图，边上写了我自己的叫法。',
      cause: '它在敦煌看了一夜星星',
      reply: [
        { text: '你的叫法也要写上去', memory: { record_habit: 1 } },
        { text: '带回来给我讲一整夜', memory: { bring_me: 1 } },
        { text: '没人叫的名字，你会一直叫吗', memory: { ask_promise: 1 } }
      ]
    }),

    /* ================= 哈尔滨 ================= */
    E({
      id: 'ev-harbin-ice', city: 'harbin', beast: '*', tags: ['snow', 'night'], weight: 11,
      title: '会化的房子', souvenir: 'sou-ice-lantern', insight: 2,
      body: '他们用冰盖了一整座城，里面还埋了灯。\n我摸了摸墙，冷得干脆利落。\n一个工人说："暖和了就没了，明年再盖。"\n我想了想，说："那你们每年都要重盖一次。"\n他说："对啊，所以每年都不一样。"',
      cause: '它走进了冰雪大世界',
      reply: [
        { text: '每年都不一样，真好', memory: { value_change: 1 } },
        { text: '趁它还在，多待会儿', memory: { stay_longer: 1 } },
        { text: '带一块回来', memory: { keep_item: 1 } }
      ]
    }),
    E({
      id: 'ev-harbin-window', city: 'harbin', beast: '*', tags: ['snow', 'quiet'], weight: 10,
      title: '结霜的窗', souvenir: 'sou-snowflake', insight: 2,
      body: '零下二十几度。街上的窗玻璃都结着厚厚的霜花，从外面看不见里面。\n可每一扇窗都透出黄色的光。\n我忽然想：里面的人也看不见外面，可他们知道外面很冷——所以才把灯留着。',
      cause: '它在哈尔滨的街上走了很久',
      reply: [
        { text: '回来给你留灯', memory: { keep_light: 1 } },
        { text: '你在外面冷吗', memory: { care_beast: 1 } },
        { text: '写下来，这句很好', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-harbin-pear', city: 'harbin', beast: '*', tags: ['food', 'snow'], weight: 9,
      title: '冻梨', souvenir: 'sou-pinecone', insight: 1,
      body: '一种黑色的梨，冻得硬邦邦，要在水里慢慢缓开。\n卖梨的大爷说："急不得，急了就没味。"\n我蹲在路边等它化，等了二十分钟，手上冻得发红。\n最后一口咬下去，甜得我差点哭。',
      cause: '它在路边等一颗冻梨化开',
      reply: [
        { text: '等二十分钟，值了', memory: { value_slow: 1 } },
        { text: '下次戴手套', memory: { care_beast: 1 } },
        { text: '带一个回来给我', memory: { keep_item: 1 } }
      ]
    }),

    /* ================= 事件链 1：白泽与钢铁巨龙 ================= */
    E({
      id: 'ev-chain-train-1', city: 'xian', beast: 'baize', chain: { id: 'ch_train', step: 1 },
      tags: ['travel', 'history', 'scholar'], weight: 26,
      title: '铁甲异兽考', souvenir: 'sou-train-sketch', insight: 2,
      memory: { set: { ch_train: 1 } },
      body: '我在城墙上看见一头铁甲巨兽，长数百丈，腹中载人，日行千里而不喘。\n遍查古籍，未见此物。\n按《山海经》体例，我给它暂定名为"铁龙"，并画了速写一张。\n笔法不精，请见谅。',
      cause: '白泽第一次见到高铁',
      reply: [
        { text: '它叫高铁，不是兽', memory: { explain_train: 1 } },
        { text: '画得很好，继续研究', memory: { encourage: 1 } },
        { text: '别急着下结论，再看看', memory: { encourage: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-train-2', city: ['suzhou', 'hangzhou'], beast: 'baize', chain: { id: 'ch_train', step: 2 },
      requires: { memory: { ch_train: 1 } }, tags: ['travel', 'scholar'], weight: 34,
      title: '铁龙辨向考', souvenir: 'sou-postcard', insight: 2,
      memory: { set: { ch_train: 2 } },
      body: '今日又遇铁龙，已知其名为"高铁"。\n然有一事不解：如此庞然之物，山中无路，云中无迹，它如何辨认方向？\n我向一位乘客请教，他说："有轨道。"\n我又问："轨道是谁定的？"\n他想了很久，说："很多人，很多年。"',
      cause: '白泽的疑问从"它是什么"变成了"它怎么认路"',
      reply: [
        { text: '很多人很多年，是最好的答案', memory: { value_ordinary: 1 } },
        { text: '要不要买张铁路图研究', memory: { buy_map: 1 } },
        { text: '你开始像个学者了', memory: { encourage: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-train-3', city: ['harbin', 'dunhuang'], beast: 'baize', chain: { id: 'ch_train', step: 3 },
      requires: { memory: { ch_train: 2 } }, tags: ['travel', 'scholar'], weight: 40,
      title: '日行千里', souvenir: 'sou-rail-map', insight: 3,
      memory: { set: { ch_train: 3 } },
      worldFlag: 'has_rail_notes',
      body: '我买了一张铁路图，回家挂在墙上。\n从最北到最西，一条线一条线地数，数到半夜。\n上古有乘云之术，我只见过记载，从未见过人用它送一封信。\n如今人间虽无乘云之术，却自有日行千里的办法。\n——此条补入《新山海经·交通部》。',
      cause: '白泽把研究做成了自己的铁路手册',
      reply: [
        { text: '挂在家里吧，我帮你腾地方', memory: { keep_item: 1 } },
        { text: '下一站想去哪', memory: { ask_next: 1 } },
        { text: '你写的这一句，比古籍好', memory: { encourage: 1 } }
      ]
    }),

    /* ================= 事件链 2：青鸟与不再写信的人 ================= */
    E({
      id: 'ev-chain-letter-1', city: 'suzhou', beast: 'qingniao', chain: { id: 'ch_letter', step: 1 },
      tags: ['letter', 'quiet', 'empathy'], weight: 26,
      title: '门前坐了很久的人', souvenir: 'sou-postcard', insight: 2,
      memory: { set: { ch_letter: 1 } },
      body: '今天见到一位老奶奶，在门前坐了很久。\n她说，以前每年都能收到远方的信，如今大家都用手机了。\n我说，我却是从前替人送信的。\n她笑了，说："那你失业啦？"\n我想了想，好像是。',
      cause: '青鸟遇见了一位等信的老人',
      reply: [
        { text: '寄给她一张明信片吧', memory: { send_card: 1 } },
        { text: '也许你可以听听她以前的故事', memory: { ask_story: 1 } },
        { text: '你自己也可以试试手机', memory: { try_phone: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-letter-2', city: ['hangzhou', 'chengdu'], beast: 'qingniao', chain: { id: 'ch_letter', step: 2 },
      requires: { memory: { ch_letter: 1 } }, tags: ['letter', 'empathy'], weight: 34,
      title: '一张画', souvenir: 'sou-rain-bottle', insight: 2,
      memory: { set: { ch_letter: 2 } },
      body: '今天有个小孩，把一张画塞到我翅膀里。\n画上是太阳、房子和三个歪歪扭扭的人。\n他说："想寄给奶奶。"\n我问："为什么不发手机？"\n他说："画太大了，手机装不下。"\n我带着这张画飞了一整天。',
      cause: '有人托青鸟带一张画',
      reply: [
        { text: '一定要送到', memory: { promise_deliver: 1 } },
        { text: '问问他奶奶住哪', memory: { ask_story: 1 } },
        { text: '画得真好', memory: { comfort_others: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-letter-3', city: ['harbin', 'xian'], beast: 'qingniao', chain: { id: 'ch_letter', step: 3 },
      requires: { memory: { ch_letter: 2 } }, tags: ['letter', 'empathy'], weight: 40,
      title: '我还有许多地方可以去', souvenir: 'sou-handbook', insight: 3,
      memory: { set: { ch_letter: 3 } },
      worldFlag: 'has_handbook',
      body: '从前我替神仙传递书信，觉得世间没有比我飞得更快的信使。\n后来人们有了电话，有了网络，似乎再也不需要我了。\n可今日有个小孩，把一张画交给我，说想寄给远方的奶奶。\n我忽然觉得，我还有许多地方可以去。\n——不是因为没有我不行。是因为有些话，值得用飞的。',
      cause: '青鸟找到了继续飞的理由',
      reply: [
        { text: '那就一直飞下去吧', memory: { encourage: 1 } },
        { text: '什么时候回来看看我', memory: { ask_back: 1 } },
        { text: '我也有话想让你带', memory: { write_back: 1 } }
      ]
    }),

    /* ================= 事件链 3：九尾狐与人间美味 ================= */
    E({
      id: 'ev-chain-food-1', city: 'chengdu', beast: 'jiuweihu', chain: { id: 'ch_food', step: 1 },
      tags: ['food', 'night', 'social'], weight: 26,
      title: '夜市探险', souvenir: 'sou-hotpot-token', insight: 1,
      memory: { set: { ch_food: 1 } },
      body: '今晚去了夜市！灯全是红的，人比星星多。\n我从街头吃到街尾，第七家的时候开始后悔，第十家的时候决定不后悔。\n有个摊主看我吃得太认真，多给了我一根。\n人间的人真好，看你吃得香就高兴。',
      cause: '九尾狐第一次逛夜市',
      reply: [
        { text: '别吃坏了肚子', memory: { care_beast: 1 } },
        { text: '哪家最好吃', memory: { ask_focus: 1 } },
        { text: '带一份回来', memory: { keep_item: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-food-2', city: ['xian', 'harbin'], beast: 'jiuweihu', chain: { id: 'ch_food', step: 2 },
      requires: { memory: { ch_food: 1 } }, tags: ['food', 'social'], weight: 34,
      title: '带朋友一起吃', souvenir: 'sou-chili', insight: 2,
      memory: { set: { ch_food: 2 } },
      body: '这次带了个路上认识的朋友一起去吃。\n他不吃辣，我说"一点点没关系"，结果他喝了三碗水。\n他一边喝水一边说："下次还来。"\n人间交朋友，好像就是从"下次还来"开始的。',
      cause: '九尾狐带了朋友一起去吃',
      reply: [
        { text: '下次别骗人吃辣了', memory: { comfort_others: 1 } },
        { text: '这个朋友叫什么', memory: { ask_name: 1 } },
        { text: '带他回来做客', memory: { bring_friend: 1 } }
      ]
    }),
    E({
      id: 'ev-chain-food-3', city: ['suzhou', 'hangzhou', 'dunhuang'], beast: 'jiuweihu',
      chain: { id: 'ch_food', step: 3 },
      requires: { memory: { ch_food: 2 } }, tags: ['food', 'record'], weight: 40,
      title: '蜀中食录', souvenir: 'sou-handbook', insight: 3,
      memory: { set: { ch_food: 3 } },
      worldFlag: 'has_food_notes',
      body: '我做了一本册子，把吃过的地方都记下来。\n不是记哪家好吃——好吃是记不住的。\n我记的是：谁带我去的，谁多给了我一根，谁被辣哭了还说明天还来。\n上古的书里，从来不写这些。\n可我觉得，这才是人间最好吃的部分。',
      cause: '九尾狐开始记录与人有关的事',
      reply: [
        { text: '这一本我要收好', memory: { keep_item: 1 } },
        { text: '下一站想吃什么', memory: { ask_next: 1 } },
        { text: '你长大了', memory: { encourage: 1 } }
      ]
    }),

    /* ================= 回声事件（P0②：回信选择开关的后续剧情） =================
       requires.memory 表示"你曾说过某句话"；echo: true 提升优先级。
       这些事件让三选一的回信产生真实的、可被看到的后果。 */
    E({
      id: 'ev-echo-window', city: '*', beast: '*', tags: ['quiet', 'record'],
      requires: { memory: { look_out: 1 } }, echo: true, weight: 10,
      title: '窗外的那条河', souvenir: 'sou-postcard', insight: 2,
      body: '照你说的，这次我一直在看窗外。\n原来铁屋子会穿过一条很长的河。河上有很多桥，每一座都不一样。\n有一座桥上站着个人，举着手机拍河。我忽然明白了：他也在看窗外。\n我把看到的都画下来了，一共四座桥。',
      cause: '它听你的话，一直看着窗外',
      reply: [
        { text: '四座桥都寄给我', memory: { keep_item: 1 } },
        { text: '下次数数有多少座', memory: { ask_focus: 1 } },
        { text: '你也画进手账里', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-stranger', city: '*', beast: '*', tags: ['social', 'letter'],
      requires: { memory: { talk_stranger: 1 } }, echo: true, weight: 10,
      title: '邻座的人', souvenir: 'sou-postcard', insight: 2,
      body: '我跟旁边的人说话了。\n他是个很老的人，说自己年轻时修过很多条路。"每修一条，就少回一次家。"\n我问后悔吗。他说不后悔，又说，如果重来一次，也许会少修一条。\n到站的时候他拍了拍我。我不知道该说什么，就说了句"路上小心"。',
      cause: '你让它跟旁边的人说句话',
      reply: [
        { text: '你说得很好', memory: { encourage: 1 } },
        { text: '问问他修过哪条路', memory: { ask_story: 1 } },
        { text: '这份心情要记下来', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-brave', city: '*', beast: '*', tags: ['city', 'playful'],
      requires: { memory: { brave: 1 } }, echo: true, weight: 10,
      title: '走到顶', souvenir: 'sou-postcard', insight: 1,
      body: '这次我走到顶了。\n原来台阶的尽头是一个巨大的屋子，屋顶是透明的，阳光整片洒下来。\n很多人在上面走，谁也没跳下来。\n我想：上次我跳下来六次，其实只需要多站一会儿。',
      cause: '你说"再试一次，这次走到顶"',
      reply: [
        { text: '下次带你去更高的地方', memory: { encourage: 1 } },
        { text: '屋顶上看见什么了', memory: { ask_focus: 1 } },
        { text: '你变勇敢了', memory: { encourage: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-umbrella', city: '*', beast: '*', tags: ['rain', 'quiet'],
      requires: { memory: { bring_umbrella: 1 } }, echo: true, weight: 12,
      title: '伞下的路', souvenir: 'sou-rain-bottle', insight: 2,
      weather: 'rain',
      body: '这次下雨，我带了伞。\n伞面是桐油的，雨点打上去，声音跟打在别处不一样。\n我撑着伞走得很慢。有个小孩跑过来跟我挤一把，他妈妈在后面喊"谢谢"。\n到路口我们分开了。他说"哥哥再见"。\n我第一次觉得，带一把伞不只是为了不淋湿。',
      cause: '你说"下次带把伞"',
      reply: [
        { text: '伞要常带', memory: { bring_umbrella: 1 } },
        { text: '那个小孩很可爱', memory: { notice_child: 1 } },
        { text: '下次也给我撑一次', memory: { bring_me: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-card', city: '*', beast: ['qingniao', 'jiuweihu'], tags: ['letter', 'empathy'],
      requires: { memory: { send_card: 1 } }, echo: true, weight: 12,
      title: '明信片寄到了', souvenir: 'sou-silk', insight: 2,
      body: '我寄出去的明信片，收到了回音。\n老奶奶托人捎话：孙女收到那天，哭了。\n她说孙女把明信片贴在了书桌前，说"这是神仙寄的"。\n其实不是神仙。是一只失业的鸟。\n可这句话，我想记一辈子。',
      cause: '你说"寄给她一张明信片吧"',
      reply: [
        { text: '这不叫失业，叫转行', memory: { encourage: 1 } },
        { text: '再给她寄一张', memory: { send_card: 1 } },
        { text: '你自己也该高兴一点', memory: { care_beast: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-story', city: '*', beast: '*', tags: ['quiet', 'empathy'],
      requires: { memory: { ask_story: 1 } }, echo: true, weight: 10,
      title: '她以前的故事', souvenir: 'sou-postcard', insight: 2,
      body: '我按你说的，去听她讲故事了。\n她讲了四十分钟，讲她年轻时在纺织厂，讲她老伴追她时送了三斤苹果。\n讲到最后她说："这些事，我老伴走了以后就没讲过。"\n我说：您讲，我记着呢。\n回来我把记得的都写下来了，一共七页。',
      cause: '你说"去问问她们为什么天天来"',
      reply: [
        { text: '七页我都要看', memory: { ask_together: 1 } },
        { text: '以后常去听', memory: { ask_story: 1 } },
        { text: '她讲的这些，值得写进书里', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-light', city: '*', beast: '*', tags: ['night', 'quiet'],
      requires: { memory: { keep_light: 1 } }, echo: true, weight: 10,
      title: '给你的那盏灯', souvenir: 'sou-lantern', insight: 2,
      body: '我记得你说过，回来给我留一盏灯。\n所以这次我也买了一盏，很小的，装在瓶子里。\n我在夜里把它点上，放在窗台上。我对自己说：这是给那边那个人的。\n你大概看不见。可我知道它亮着。',
      cause: '你说"回来也给你留一盏"',
      reply: [
        { text: '我看见了', memory: { keep_light: 1 } },
        { text: '你也早点睡', memory: { care_beast: 1 } },
        { text: '这盏灯要一直留着', memory: { value_endure: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-teach', city: 'xian', beast: '*', tags: ['food', 'social'],
      requires: { memory: { teach_back: 1 } }, echo: true, weight: 10,
      title: '还他一点本事', souvenir: 'sou-hotpot-token', insight: 2,
      body: '我找到那位教我掰泡馍的大爷了。\n这次我带了自己做的桂花糕，教他怎么分辨桂花的品种。\n他学得很认真，还拿小本子记了。\n他说："掰馍我教了你四十分钟，你这个我也学四十分钟。"\n我们扯平了。',
      cause: '你说"下次教他点你的本事"',
      reply: [
        { text: '扯平了，真好', memory: { comfort_others: 1 } },
        { text: '下次教他更多', memory: { teach_back: 1 } },
        { text: '把这也记下来', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-phone', city: '*', beast: '*', tags: ['city', 'letter'],
      requires: { memory: { try_phone: 1 } }, echo: true, weight: 10,
      title: '它试着打了电话', souvenir: 'sou-postcard', insight: 2,
      body: '我借了一部手机，试着给你打了个电话。\n你没接。我听到了一段很奇怪的声音，说什么"您拨打的用户正忙"。\n我想：千里传音，果然也不是什么时候都能通的。\n后来我给你发了一条短信。只有两个字：在吗。',
      cause: '你说"你自己也可以试试手机"',
      reply: [
        { text: '我看到了，在的', memory: { call_me: 1 } },
        { text: '以后想我就打给我', memory: { encourage: 1 } },
        { text: '短信我存下来了', memory: { keep_item: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-promise', city: '*', beast: 'qingniao', tags: ['letter', 'empathy'],
      requires: { memory: { promise_deliver: 1 } }, echo: true, weight: 12,
      title: '画送到了', souvenir: 'sou-handbook', insight: 2,
      body: '那张画，我送到奶奶手里了。\n她住在很远的地方，我飞了三天。\n她接过画的时候，手在抖。她说："这是我家小宝画的。"\n她在门口站了很久，一直看那三个歪歪扭扭的人。\n我说：画太大了，手机装不下。她笑了，说："对，装不下。"',
      cause: '你说"一定要送到"',
      reply: [
        { text: '你做到了', memory: { encourage: 1 } },
        { text: '飞了三天，累不累', memory: { care_beast: 1 } },
        { text: '把这件事写下来', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-echo-knock', city: 'suzhou', beast: '*', tags: ['rain', 'quiet'],
      requires: { memory: { knock_door: 1 } }, echo: true, weight: 10,
      title: '我敲了门', souvenir: 'sou-paper-umbrella', insight: 2,
      weather: 'rain',
      body: '又下雨，我又拐进那条巷子。\n灯下还是有人在剥豆子。这次我敲了门。\n她给我搬了个小板凳，倒了杯热水，什么也没问。\n我坐到雨停。走的时候她说："下次落雨还来。"\n我说好。我已经有了一条可以回去的巷子。',
      cause: '你说"敲敲门，问问能不能进屋"',
      reply: [
        { text: '下次带我一起去', memory: { bring_me: 1 } },
        { text: '给她带点桂花糕', memory: { keep_item: 1 } },
        { text: '有可以回去的地方，真好', memory: { value_endure: 1 } }
      ]
    }),
    E({
      id: 'ev-world-rail', city: '*', beast: ['jiuweihu', 'qingniao'], tags: ['travel', 'record'],
      requires: { worldFlag: 'has_rail_notes' }, weight: 12,
      title: '翻出白泽的手稿', souvenir: 'sou-postcard', insight: 2,
      body: '路上迷路了。我想起家里挂着的那张铁路图，就照着记忆画了一份。\n居然真的对上了。\n白泽那家伙，平时闷得很，画起图来倒是一点不含糊。\n回去得跟它说一声：你那张图，有用。',
      cause: '家里挂着的铁路手册派上了用场',
      reply: [
        { text: '替我谢谢它', memory: { thank_friend: 1 } },
        { text: '你们可以一起研究', memory: { bring_friend: 1 } },
        { text: '记得在图上补一笔', memory: { record_habit: 1 } }
      ]
    }),
    E({
      id: 'ev-world-handbook', city: '*', beast: '*', tags: ['record', 'scholar'],
      requires: { worldFlag: 'has_handbook' }, weight: 12,
      title: '观察笔记的新一页', souvenir: 'sou-postcard', insight: 2,
      body: '我带着家里那本《现代人间观察笔记》出门，边走边补。\n今天新增三条：会自己开的门、会说话的柱子、给人让路的车。\n第四条写了一半——"为什么人要在公园里对着树站着？"\n留着，下次再想。',
      cause: '带着家里的观察笔记出门',
      reply: [
        { text: '第四条我也不知道', memory: { ask_together: 1 } },
        { text: '慢慢写，不着急', memory: { slow_down: 1 } },
        { text: '这本以后要传下去', memory: { value_endure: 1 } }
      ]
    }),
    E({
      id: 'ev-world-food', city: '*', beast: ['baize', 'qingniao'], tags: ['food', 'record'],
      requires: { worldFlag: 'has_food_notes' }, weight: 12,
      title: '照着食录找吃的', souvenir: 'sou-postcard', insight: 2,
      body: '出门前偷看了九尾狐的《蜀中食录》。\n它写得极细，连"第几家的辣椒要少放"都标了出来。\n我照着去了一家，辣得眼睛发红，还是吃完了。\n回来在页边补了一句：以上均为狐言，尽信之则辣。',
      cause: '照着九尾狐的食录去觅食',
      reply: [
        { text: '它写的你也敢全信', memory: { comfort_others: 1 } },
        { text: '下次一起去', memory: { bring_friend: 1 } },
        { text: '这句批注写得好', memory: { record_habit: 1 } }
      ]
    })
  ];

  /* ---------- 兜底信件（事件不足时使用） ---------- */
  SH.FILLER_LETTERS = [
    { title: '路上', body: '今天没遇见什么特别的事。\n风很好，路也很好。\n我找了个台阶坐了一会儿，看人来了又走。\n这样的一天，也算一天。' },
    { title: '一个名字', body: '我问了路上一个人的名字，他告诉了我。\n现在我知道了一个人类叫什么。\n这大概不算什么大事，可我记在本子第一页。' },
    { title: '关于睡觉', body: '人类每天都要睡一次，雷打不动。\n我问为什么，他们说"因为困"。\n我又问为什么困，他们说"因为昨天没睡好"。\n这个答案，我琢磨了一路。' },
    { title: '一只猫', body: '路上遇到一只猫，它看了我一眼，就走了。\n我在原地站了很久。\n在人间，好像只有猫能认出我们。\n它没说破，我也没说。' },
    { title: '关于路牌', body: '这里的路都有名字，写在牌子上。\n有的叫"人民"，有的叫"长安"，有的叫"幸福"。\n我在"幸福路"上走了两公里，什么也没发生。\n但走的时候，心情确实不错。' },
    { title: '一件小事', body: '今天有人给我让了一次路。\n很平常的动作，他大概一秒钟就忘了。\n我记到现在。' },
    { title: '关于时间', body: '人类把一天切成二十四份，每份都要安排点什么。\n我试着安排了，结果在第三份上睡过头了。\n醒来的时候，阳光正好。\n我想，这也是一种安排。' },
    { title: '给你', body: '没什么要说的。\n就是想让你知道：我还在路上，也还在想你。\n回来给你带东西。' }
  ];
})();
